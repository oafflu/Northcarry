import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getCampaignRecipientDataMap, getCampaignRecipients } from '@/app/actions/email-campaigns'

// This is a server action that we'll import
async function processCampaignResume(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .single()

    if (campaignError || !campaign) {
      console.error(`[Resume Campaign ${id}] Error fetching campaign:`, campaignError)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return { success: false, error: 'Campaign not found' }
    }

    if (!campaign.html_content) {
      console.error(`[Resume Campaign ${id}] Campaign has no content`)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return { success: false, error: 'Campaign has no content' }
    }

    // Get stored recipient list (ensures consistent order for resume)
    // If not stored, fetch fresh list
    let recipients: string[] = []
    const storedRecipients = (campaign.content as any)?.stored_recipients
    
    if (storedRecipients && Array.isArray(storedRecipients) && storedRecipients.length > 0) {
      // Use stored recipients to ensure we resume from the exact same list
      recipients = storedRecipients
      console.log(`[Resume Campaign ${id}] Using stored recipient list: ${recipients.length} recipients`)
    } else {
      // Fallback: fetch fresh list and store it
      console.log(`[Resume Campaign ${id}] No stored recipients found, fetching fresh list...`)
      recipients = await getCampaignRecipients(campaign as any)
      
      if (recipients.length === 0) {
        console.error(`[Resume Campaign ${id}] No recipients found after fetching`)
        return { success: false, error: 'No recipients found for campaign' }
      }
      
      await supabase
        .from("email_campaigns")
        .update({
          content: {
            ...(campaign.content || {}),
            stored_recipients: recipients,
            stored_at: new Date().toISOString(),
          }
        })
        .eq("id", id)
      console.log(`[Resume Campaign ${id}] Fetched and stored ${recipients.length} recipients`)
    }
    
    const alreadySent = campaign.sent_count || 0
    
    // Get remaining recipients by slicing from the already sent count
    // This works because we're using the stored list which maintains consistent order
    const remainingRecipients = recipients.slice(alreadySent)
    
    console.log(`[Resume Campaign ${id}] Already sent: ${alreadySent}, Total recipients: ${recipients.length}, Remaining: ${remainingRecipients.length}`)
    
    if (remainingRecipients.length === 0) {
      // All sent, mark as complete
      await supabase
        .from("email_campaigns")
        .update({ status: "sent" })
        .eq("id", id)
      return { success: true, message: 'Campaign already complete', sent: alreadySent, total: recipients.length }
    }

    // Send remaining emails with same batch settings for consistency
    const { sendBulkMarketingEmails } = await import("@/lib/email-marketing")
    // Check if personalization is needed - if so, use smaller batches to avoid timeouts
    const needsPersonalization = campaign.html_content?.includes('{{firstName') || 
                                 campaign.html_content?.includes('{{name') ||
                                 campaign.subject?.includes('{{firstName') ||
                                 campaign.subject?.includes('{{name')
    
    // Warmed-up sender: 5000/batch (3000 if personalization). Override with env.
    const DEFAULT_BATCH_SIZE = needsPersonalization ? 3000 : 5000
    const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10)
    const DELAY_MINUTES = parseInt(process.env.EMAIL_BATCH_DELAY_MINUTES || '10', 10)
    const DELAY_MS = DELAY_MINUTES * 60 * 1000
    
    const totalBatches = Math.ceil(remainingRecipients.length / BATCH_SIZE)
    const estimatedHours = (totalBatches * DELAY_MINUTES) / 60
    const estimatedDays = estimatedHours / 24
    
    console.log(`[Resume Campaign ${id}] Sending ${remainingRecipients.length.toLocaleString()} remaining emails in ${totalBatches} batches of ${BATCH_SIZE}`)
    console.log(`[Resume Campaign ${id}] Interval: ${DELAY_MINUTES} minutes between batches`)
    console.log(`[Resume Campaign ${id}] Estimated completion: ${estimatedDays > 1 ? `${estimatedDays.toFixed(1)} days` : `${estimatedHours.toFixed(1)} hours`}`)
    
    console.log(`[Resume Campaign ${id}] Personalization needed: ${needsPersonalization}`)
    
    // Fetch recipient data for personalization if needed
    let recipientDataMap: Map<string, { firstName?: string; lastName?: string; name?: string }> | undefined
    if (needsPersonalization) {
      console.log(`[Resume Campaign ${id}] Template requires personalization, fetching recipient data for ${remainingRecipients.length} recipients...`)
      try {
        recipientDataMap = await getCampaignRecipientDataMap(campaign as any, remainingRecipients)
        console.log(`[Resume Campaign ${id}] Fetched recipient data for ${recipientDataMap.size} recipients`)
      } catch (error: any) {
        console.error(`[Resume Campaign ${id}] Error fetching recipient data:`, error)
        // Continue without personalization if data fetch fails
        console.log(`[Resume Campaign ${id}] Continuing without personalization due to error`)
      }
    }
    
    console.log(`[Resume Campaign ${id}] Starting to send ${remainingRecipients.length} emails...`)
    
    const result = await sendBulkMarketingEmails(
      remainingRecipients,
      campaign.subject,
      campaign.html_content || "",
      {
        batchSize: BATCH_SIZE,
        delayBetweenBatches: DELAY_MS,
        campaignId: campaign.id,
        recipientDataMap: recipientDataMap,
        onProgress: (sent, total, remaining) => {
          console.log(`[Resume Campaign ${id}] Progress: ${sent}/${total} sent, ${remaining} remaining`)
          supabase
            .from("email_campaigns")
            .update({ sent_count: alreadySent + sent })
            .eq("id", id)
            .then(() => {
              console.log(`[Resume Campaign ${id}] Updated sent_count to ${alreadySent + sent}`)
            })
            .catch((err) => {
              console.error(`[Resume Campaign ${id}] Error updating sent_count:`, err)
            })
        },
      }
    )
    
    console.log(`[Resume Campaign ${id}] Send result:`, {
      success: result.success,
      sent: result.sent,
      total: result.total,
      needsResume: result.needsResume,
      errors: result.errors?.length || 0,
      errorDetails: result.errors?.slice(0, 3) || [],
    })
    
    // Update campaign
    if (result.needsResume) {
      await supabase
        .from("email_campaigns")
        .update({
          status: "sending",
          sent_count: alreadySent + result.sent,
        })
        .eq("id", id)
      
      console.log(`[Resume Campaign ${id}] Partially sent: ${alreadySent + result.sent}/${recipients.length}. Will resume again if needed.`)
    } else {
      await supabase
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_count: alreadySent + result.sent,
        })
        .eq("id", id)
      
      console.log(`[Resume Campaign ${id}] Successfully completed: ${alreadySent + result.sent} emails sent`)
    }

    return {
      success: true,
      sent: alreadySent + result.sent,
      total: recipients.length,
      remaining: recipients.length - (alreadySent + result.sent),
    }
  } catch (error: any) {
    console.error(`[Resume Campaign ${id}] Error in processCampaignResume:`, error)
    
    // Update campaign status to failed
    const supabase = createAdminSupabaseClient()
    await supabase
      .from("email_campaigns")
      .update({ status: "draft" })
      .eq("id", id)
    
    return { success: false, error: error.message || 'Failed to resume campaign' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { campaignId } = await request.json()
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    console.log(`[Resume API] Starting resume process for campaign ${campaignId}`)

    // In serverless environments, we need to actually wait for the process to start
    // but return quickly to avoid timeout. We'll start it and wait a moment to ensure it begins.
    const processPromise = processCampaignResume(campaignId)
      .then((result) => {
        console.log(`[Resume API ${campaignId}] Process completed:`, result)
        return result
      })
      .catch((error: any) => {
        console.error(`[Resume API ${campaignId}] Process failed:`, error)
        console.error(`[Resume API ${campaignId}] Error stack:`, error.stack)
        throw error
      })

    // Don't await - let it run in background, but ensure it starts
    // In Vercel, the function will continue running until it completes or times out
    processPromise.catch(() => {
      // Error already logged above
    })

    // Return immediately - processing continues
    return NextResponse.json({
      success: true,
      message: 'Campaign resume processing started',
      campaignId,
    })
  } catch (error: any) {
    console.error('Error in resume API route:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resume campaign' },
      { status: 500 }
    )
  }
}
