"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"
import { MAX_CAMPAIGN_SEND_PER_GO } from "@/lib/email-campaigns-config"

/**
 * Resume a partially sent campaign (for Microsoft 365 daily limit)
 * Returns immediately and processes in the background to avoid timeouts
 */
export async function resumeEmailCampaign(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .single()

    if (campaignError || !campaign) {
      return { success: false, error: campaignError?.message || "Campaign not found" }
    }

    // Allow resume for campaigns in "sending" status or "sent" status with incomplete sends
    if (campaign.status !== "sending" && !(campaign.status === "sent" && campaign.sent_count < campaign.total_recipients)) {
      return { success: false, error: "Campaign cannot be resumed. Only partially sent campaigns can be resumed." }
    }

    // Update campaign status to sending immediately
    await supabase
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", id)

    // In serverless environments, we can't reliably call external API routes
    // because preview deployments require authentication. Instead, we'll process
    // directly but in a way that won't block the response.
    // The process will run in the background and continue even if the request times out.
    console.log(`[Resume Campaign ${id}] Starting resume process directly (background)...`)
    
    // Process directly in background - this will continue even after the server action returns
    // In Vercel serverless, the function will continue running until completion or timeout
    processCampaignResume(id)
      .then((result) => {
        console.log(`[Resume Campaign ${id}] Resume process completed:`, result)
      })
      .catch((error) => {
        console.error(`[Resume Campaign ${id}] Resume process failed:`, error)
        console.error(`[Resume Campaign ${id}] Error stack:`, error.stack)
        
        // Try to update campaign status to indicate failure
        const supabase = createAdminSupabaseClient()
        supabase
          .from("email_campaigns")
          .update({ status: "draft" })
          .eq("id", id)
          .catch((err) => {
            console.error(`[Resume Campaign ${id}] Failed to update status:`, err)
          })
      })

    // Return immediately - sending continues via API route
    return {
      success: true,
      message: "Campaign resume started. Sending will continue automatically.",
      sent: campaign.sent_count || 0,
      total: campaign.total_recipients || 0,
    }
  } catch (error: any) {
    console.error("Error resuming email campaign:", error)
    return { success: false, error: error.message || "Failed to resume campaign" }
  }
}

/**
 * Internal function to actually resume sending campaign emails
 * This runs in the background after resumeEmailCampaign initiates it
 */
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
      return
    }

    if (!campaign.html_content) {
      console.error(`[Resume Campaign ${id}] Campaign has no content`)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return
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
      recipients = await getCampaignRecipients(campaign)
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
      console.log(`[Resume Campaign ${id}] No remaining recipients - campaign already complete`)
    }

    if (remainingRecipients.length === 0) {
      // All sent, mark as complete
      await supabase
        .from("email_campaigns")
        .update({ status: "sent" })
        .eq("id", id)
      return
    }

    // Send remaining emails with same batch settings for consistency (warmed-up: 5000/3k personalization, 10min)
    const { sendBulkMarketingEmails } = await import("@/lib/email-marketing")
    
    const needsPersonalization = campaign.html_content?.includes('{{firstName') || 
                                 campaign.html_content?.includes('{{name') ||
                                 campaign.subject?.includes('{{firstName') ||
                                 campaign.subject?.includes('{{name')
    
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
      console.log(`[Resume Campaign ${id}] Template requires personalization, fetching recipient data...`)
      recipientDataMap = await getCampaignRecipientDataMap(campaign, remainingRecipients)
    }
    
    const result = await sendBulkMarketingEmails(
      remainingRecipients,
      campaign.subject,
      campaign.html_content || "",
      {
        batchSize: BATCH_SIZE,
        delayBetweenBatches: DELAY_MS, // 15 minutes = 900,000 ms
        campaignId: campaign.id,
        recipientDataMap: recipientDataMap,
        onProgress: (sent, total, remaining) => {
          supabase
            .from("email_campaigns")
            .update({ sent_count: alreadySent + sent })
            .eq("id", id)
            .then(() => {})
        },
      }
    )

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
  } catch (error: any) {
    console.error(`[Resume Campaign ${id}] Error in processCampaignResume:`, error)
    
    // Update campaign status to failed
    const supabase = createAdminSupabaseClient()
    await supabase
      .from("email_campaigns")
      .update({ status: "draft" })
      .eq("id", id)
  }
}

export interface EmailCampaign {
  id: string
  name: string
  subject: string
  preview_text?: string
  from_name: string
  from_email: string
  reply_to_email?: string
  template_id?: string
  content: any
  html_content?: string
  status: string
  recipient_type: string
  segment_id?: string
  recipient_list?: any
  scheduled_at?: string
  sent_at?: string
  total_recipients: number
  sent_count: number
  delivered_count: number
  open_count: number
  click_count: number
  bounce_count: number
  unsubscribe_count: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateCampaignInput {
  name: string
  subject: string
  preview_text?: string
  from_name: string
  from_email: string
  reply_to_email?: string
  template_id?: string
  content?: any
  html_content?: string
  recipient_type: "all" | "all_customers" | "segment" | "custom"
  segment_id?: string
  recipient_list?: any
  scheduled_at?: string
  /**
   * IANA timezone used when the admin picked scheduled_at (e.g. America/Los_Angeles).
   * Stored into email_campaigns.content.schedule_timezone for correct display/editing.
   */
  scheduled_timezone?: string
}

export interface UpdateCampaignInput {
  name?: string
  subject?: string
  preview_text?: string
  from_name?: string
  from_email?: string
  reply_to_email?: string
  template_id?: string
  content?: any
  html_content?: string
  status?: string
  recipient_type?: string
  segment_id?: string
  recipient_list?: any
  scheduled_at?: string
  scheduled_timezone?: string
}

/**
 * Get all email campaigns
 */
export async function getEmailCampaigns(filters?: {
  status?: string
  search?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase.from("email_campaigns").select("*").order("created_at", { ascending: false })

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching email campaigns:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as EmailCampaign[], error: null }
  } catch (error: any) {
    console.error("Error in getEmailCampaigns:", error)
    return { success: false, error: error.message || "Failed to fetch campaigns", data: null }
  }
}

/**
 * Get a single email campaign by ID
 */
export async function getEmailCampaignById(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase.from("email_campaigns").select("*").eq("id", id).single()

    if (error) {
      console.error("Error fetching email campaign:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as EmailCampaign, error: null }
  } catch (error: any) {
    console.error("Error in getEmailCampaignById:", error)
    return { success: false, error: error.message || "Failed to fetch campaign", data: null }
  }
}

/**
 * Create a new email campaign
 */
export async function createEmailCampaign(input: CreateCampaignInput, userId?: string) {
  try {
    const supabase = createAdminSupabaseClient()

    // Normalize recipient_type to match DB constraint (allowed: all, segment, custom)
    const normalizedRecipientType = input.recipient_type === "all_customers" ? "all" : input.recipient_type

    // Calculate recipient count based on recipient type
    let totalRecipients = 0
    if (normalizedRecipientType === "all") {
      // Use same logic as analytics - get count of all customers with valid emails
      const { count: subscriberTableCount } = await supabase
        .from("email_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
      
      const { count: customersWithValidEmails } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "customer")
        .not("email", "is", null)
        .like("email", "%@%")
      
      // Use the higher count (same logic as analytics)
      totalRecipients = Math.max(subscriberTableCount || 0, customersWithValidEmails || 0)
    } else if (normalizedRecipientType === "segment" && input.segment_id) {
      const { data: segment } = await supabase.from("email_segments").select("subscriber_count").eq("id", input.segment_id).single()
      totalRecipients = segment?.subscriber_count || 0
    } else if (normalizedRecipientType === "custom" && input.recipient_list) {
      totalRecipients = Array.isArray(input.recipient_list) ? input.recipient_list.length : 0
    }

    const mergedContent =
      input.scheduled_timezone
        ? { ...(input.content || {}), schedule_timezone: input.scheduled_timezone }
        : (input.content || {})

    const campaignData = {
      name: input.name,
      subject: input.subject,
      preview_text: input.preview_text || null,
      from_name: input.from_name,
      from_email: input.from_email,
      reply_to_email: input.reply_to_email || null,
      template_id: input.template_id || null,
      content: mergedContent,
      html_content: input.html_content || null,
      status: input.scheduled_at ? "scheduled" : "draft",
      recipient_type: normalizedRecipientType,
      segment_id: input.segment_id || null,
      recipient_list: input.recipient_list || null,
      scheduled_at: input.scheduled_at || null,
      total_recipients: totalRecipients,
      created_by: userId || null,
    }

    const { data, error } = await supabase.from("email_campaigns").insert(campaignData).select().single()

    if (error) {
      console.error("Error creating email campaign:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing")
    return { success: true, data: data as EmailCampaign, error: null }
  } catch (error: any) {
    console.error("Error in createEmailCampaign:", error)
    return { success: false, error: error.message || "Failed to create campaign", data: null }
  }
}

/**
 * Update an email campaign
 */
export async function updateEmailCampaign(id: string, input: UpdateCampaignInput) {
  try {
    const supabase = createAdminSupabaseClient()

    // Recalculate recipient count if recipient type changed
    let totalRecipients: number | undefined = undefined
    if (input.recipient_type !== undefined) {
      const normalizedRecipientType = input.recipient_type === "all_customers" ? "all" : input.recipient_type

      if (normalizedRecipientType === "all") {
        const { count: subscriberTableCount } = await supabase
          .from("email_subscribers")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
        
        const { count: customersWithValidEmails } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "customer")
          .not("email", "is", null)
          .like("email", "%@%")
        
        totalRecipients = Math.max(subscriberTableCount || 0, customersWithValidEmails || 0)
      } else if (normalizedRecipientType === "segment" && input.segment_id) {
        const { data: segment } = await supabase.from("email_segments").select("subscriber_count").eq("id", input.segment_id).single()
        totalRecipients = segment?.subscriber_count || 0
      } else if (normalizedRecipientType === "custom" && input.recipient_list) {
        totalRecipients = Array.isArray(input.recipient_list) ? input.recipient_list.length : 0
      }
    }

    const updateData: any = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.subject !== undefined) updateData.subject = input.subject
    if (input.preview_text !== undefined) updateData.preview_text = input.preview_text
    if (input.from_name !== undefined) updateData.from_name = input.from_name
    if (input.from_email !== undefined) updateData.from_email = input.from_email
    if (input.reply_to_email !== undefined) updateData.reply_to_email = input.reply_to_email
    if (input.template_id !== undefined) updateData.template_id = input.template_id
    // Merge content updates so we don't clobber stored fields like stored_recipients
    if (input.content !== undefined || input.scheduled_timezone !== undefined) {
      const { data: existing } = await supabase
        .from("email_campaigns")
        .select("content")
        .eq("id", id)
        .maybeSingle()

      const existingContent = (existing as any)?.content && typeof (existing as any).content === "object"
        ? (existing as any).content
        : {}

      const merged = {
        ...existingContent,
        ...(input.content || {}),
        ...(input.scheduled_timezone ? { schedule_timezone: input.scheduled_timezone } : {}),
      }

      updateData.content = merged
    }
    if (input.html_content !== undefined) updateData.html_content = input.html_content
    if (input.status !== undefined) updateData.status = input.status
    if (input.recipient_type !== undefined) updateData.recipient_type = input.recipient_type === "all_customers" ? "all" : input.recipient_type
    if (input.segment_id !== undefined) updateData.segment_id = input.segment_id
    if (input.recipient_list !== undefined) updateData.recipient_list = input.recipient_list
    if (input.scheduled_at !== undefined) updateData.scheduled_at = input.scheduled_at
    if (totalRecipients !== undefined) updateData.total_recipients = totalRecipients

    const { data, error } = await supabase.from("email_campaigns").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating email campaign:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing")
    return { success: true, data: data as EmailCampaign, error: null }
  } catch (error: any) {
    console.error("Error in updateEmailCampaign:", error)
    return { success: false, error: error.message || "Failed to update campaign", data: null }
  }
}

/**
 * Cancel schedule for a campaign (set back to draft, clear scheduled_at).
 */
export async function unscheduleEmailCampaign(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data: campaign } = await supabase.from("email_campaigns").select("id, status").eq("id", id).single()
    if (!campaign) return { success: false, error: "Campaign not found" }
    if (campaign.status !== "scheduled") {
      return { success: false, error: "Only scheduled campaigns can be unscheduled" }
    }
    const { error } = await supabase
      .from("email_campaigns")
      .update({ status: "draft", scheduled_at: null })
      .eq("id", id)
    if (error) {
      console.error("Error unscheduling campaign:", error)
      return { success: false, error: error.message }
    }
    revalidatePath("/admin/email-marketing")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in unscheduleEmailCampaign:", error)
    return { success: false, error: error.message || "Failed to cancel schedule" }
  }
}

/**
 * Delete an email campaign
 */
export async function deleteEmailCampaign(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("email_campaigns").delete().eq("id", id)

    if (error) {
      console.error("Error deleting email campaign:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/email-marketing")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in deleteEmailCampaign:", error)
    return { success: false, error: error.message || "Failed to delete campaign" }
  }
}

/**
 * Get recipient list for a campaign (returns emails only)
 * Handles pagination to fetch all recipients (Supabase default limit is 1,000)
 * Exported for use in API routes
 */
export async function getCampaignRecipients(campaign: EmailCampaign): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  const recipients: string[] = []

  if (campaign.recipient_type === "all" || campaign.recipient_type === "all_customers") {
    // Get all customers with valid emails - handle pagination
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: customers, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "customer")
        .not("email", "is", null)
        .like("email", "%@%")
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error) {
        console.error("Error fetching customers:", error)
        break
      }
      
      if (customers && customers.length > 0) {
        recipients.push(...customers.map(c => c.email).filter(Boolean))
        hasMore = customers.length === pageSize
        page++
      } else {
        hasMore = false
      }
    }
    
    console.log(`[Campaign ${campaign.id}] Fetched ${recipients.length} recipients from customers`)
  } else if (campaign.recipient_type === "segment" && campaign.segment_id) {
    const { data: segment, error: segmentError } = await supabase
      .from("email_segments")
      .select("conditions")
      .eq("id", campaign.segment_id)
      .single()

    if (segmentError || !segment) {
      console.error("Error fetching segment:", segmentError)
      return []
    }

    const conditions = Array.isArray(segment.conditions) ? segment.conditions : []
    const { resolveSegmentConditionsToEmails } = await import("./email-segments")
    const segmentEmails = await resolveSegmentConditionsToEmails(conditions)
    recipients.push(...segmentEmails)
  } else if (campaign.recipient_type === "custom" && campaign.recipient_list) {
    if (Array.isArray(campaign.recipient_list)) {
      recipients.push(...campaign.recipient_list.filter(Boolean))
    }
  }

  // Remove duplicates
  const uniqueRecipients = Array.from(new Set(recipients))
  console.log(`[Campaign ${campaign.id}] Total unique recipients: ${uniqueRecipients.length} (recipient_type: ${campaign.recipient_type}, segment_id: ${campaign.segment_id || 'none'})`)
  
  // If we got 0 recipients but campaign has total_recipients set, log a warning
  if (uniqueRecipients.length === 0 && campaign.total_recipients && campaign.total_recipients > 0) {
    console.warn(`[Campaign ${campaign.id}] WARNING: getCampaignRecipients returned 0 recipients but campaign.total_recipients is ${campaign.total_recipients}. This suggests stored recipients should be used instead.`)
  }
  
  return uniqueRecipients
}

/**
 * Get recipient data map (email -> {firstName, lastName, name}) for personalization
 * Exported for use in API routes
 */
export async function getCampaignRecipientDataMap(
  campaign: EmailCampaign,
  recipientEmails: string[]
): Promise<Map<string, { firstName?: string; lastName?: string; name?: string }>> {
  const supabase = createAdminSupabaseClient()
  const recipientDataMap = new Map<string, { firstName?: string; lastName?: string; name?: string }>()

  // Fetch recipient data in batches
  const batchSize = 1000
  for (let i = 0; i < recipientEmails.length; i += batchSize) {
    const batch = recipientEmails.slice(i, i + batchSize)
    
    // Fetch from profiles table
    const { data: profiles } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .in('email', batch.map(e => e.toLowerCase()))
    
    if (profiles) {
      profiles.forEach((profile: any) => {
        if (profile.email) {
          recipientDataMap.set(profile.email.toLowerCase(), {
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.first_name || profile.email,
          })
        }
      })
    }
    
    // Fetch from email_subscribers table for any missing
    const missingEmails = batch.filter(e => !recipientDataMap.has(e.toLowerCase()))
    if (missingEmails.length > 0) {
      const { data: subscribers } = await supabase
        .from('email_subscribers')
        .select('email, name')
        .in('email', missingEmails.map(e => e.toLowerCase()))
      
      if (subscribers) {
        subscribers.forEach((subscriber: any) => {
          if (subscriber.email && !recipientDataMap.has(subscriber.email.toLowerCase())) {
            const nameParts = (subscriber.name || '').split(' ')
            recipientDataMap.set(subscriber.email.toLowerCase(), {
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              name: subscriber.name || subscriber.email,
            })
          }
        })
      }
    }
  }

  console.log(`[Campaign ${campaign.id}] Fetched recipient data for ${recipientDataMap.size} recipients`)
  return recipientDataMap
}

/**
 * Internal function to actually send the campaign emails
 * This runs in the background after sendEmailCampaign initiates it
 */
async function processCampaignSending(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .single()

    if (campaignError || !campaign) {
      console.error(`[Campaign ${id}] Error fetching campaign:`, campaignError)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return
    }

    if (!campaign.html_content) {
      console.error(`[Campaign ${id}] Campaign has no content`)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return
    }

    // Get recipient list
    let recipients = await getCampaignRecipients(campaign)
    
    if (recipients.length === 0) {
      console.error(`[Campaign ${id}] No recipients found`)
      await supabase
        .from("email_campaigns")
        .update({ status: "draft" })
        .eq("id", id)
      return
    }

    // Store the full recipient list in campaign content for reliable resume
    // This ensures we can resume from the exact same list in the same order
    const storedRecipients = (campaign.content as any)?.stored_recipients
    if (!storedRecipients || storedRecipients.length !== recipients.length) {
      // Store recipients list for resume functionality
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
      console.log(`[Campaign ${id}] Stored ${recipients.length} recipients for resume tracking`)
    } else {
      // Use stored recipients to ensure consistent order for resume
      recipients = storedRecipients
      console.log(`[Campaign ${id}] Using stored recipient list (${recipients.length} recipients)`)
    }

    // Get email provider config - Mailgun is default for all marketing emails
    const { getSetting } = await import("@/app/actions/settings")
    const { data: emailProvider } = await getSetting('email_provider')
    const config = emailProvider as any
    
    // Mailgun is the default for all marketing emails
    const hasMailgunApiKey = !!(config.mailgun_api_key || process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY)
    
    // Log configuration for debugging
    console.log(`[Campaign ${id}] Email Provider Config:`, {
      provider: config.provider || 'mailgun',
      hasMailgunApiKey,
      recipientsCount: recipients.length,
    })
    
    // Validate Mailgun configuration
    if (!hasMailgunApiKey) {
      console.error(`[Campaign ${id}] Mailgun API key is missing! Please check your Mailgun API key in /admin/settings/email`)
      throw new Error('Mailgun API key is missing. Please configure it in /admin/settings/email')
    }
    
    // Enforce max per send (batches + cron resume handle the rest)
    if (recipients.length > MAX_CAMPAIGN_SEND_PER_GO) {
      console.log(`[Campaign ${id}] Capping at ${MAX_CAMPAIGN_SEND_PER_GO} recipients per send; ${recipients.length - MAX_CAMPAIGN_SEND_PER_GO} will be sent on resume`)
      recipients.splice(MAX_CAMPAIGN_SEND_PER_GO)
    }
    
    if (recipients.length >= MAX_CAMPAIGN_SEND_PER_GO) {
      console.log(`[Campaign ${id}] Large send: ${recipients.length.toLocaleString()} recipients (max ${MAX_CAMPAIGN_SEND_PER_GO.toLocaleString()} per go)`)
    }
    
    // Send emails with rate limiting and batching via Mailgun
    // Warmed-up sender defaults: 5000/batch (3000 if personalization), 10 min delay. Override with env.
    // - EMAIL_BATCH_SIZE: emails per batch (default: 5000, or 3000 if personalization)
    // - EMAIL_BATCH_DELAY_MINUTES: minutes between batches (default: 10)
    const { sendBulkMarketingEmails } = await import("@/lib/email-marketing")
    
    const needsPersonalization = campaign.html_content?.includes('{{firstName') || 
                                 campaign.html_content?.includes('{{name') ||
                                 campaign.subject?.includes('{{firstName') ||
                                 campaign.subject?.includes('{{name')
    
    const DEFAULT_BATCH_SIZE = needsPersonalization ? 3000 : 5000
    const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || DEFAULT_BATCH_SIZE.toString(), 10)
    const DELAY_MINUTES = parseInt(process.env.EMAIL_BATCH_DELAY_MINUTES || '10', 10)
    const DELAY_MS = DELAY_MINUTES * 60 * 1000

    const totalBatches = Math.ceil(recipients.length / BATCH_SIZE)
    const estimatedHours = (totalBatches * DELAY_MINUTES) / 60
    const estimatedDays = estimatedHours / 24
    
    console.log(`[Campaign ${id}] Sending ${recipients.length.toLocaleString()} emails in ${totalBatches} batches of ${BATCH_SIZE}`)
    console.log(`[Campaign ${id}] Interval: ${DELAY_MINUTES} minutes between batches`)
    console.log(`[Campaign ${id}] Estimated completion: ${estimatedDays > 1 ? `${estimatedDays.toFixed(1)} days` : `${estimatedHours.toFixed(1)} hours`}`)
    console.log(`[Campaign ${id}] Personalization needed: ${needsPersonalization}`)
    
    // Fetch recipient data for personalization if needed
    let recipientDataMap: Map<string, { firstName?: string; lastName?: string; name?: string }> | undefined
    if (needsPersonalization) {
      console.log(`[Campaign ${id}] Template requires personalization, fetching recipient data...`)
      recipientDataMap = await getCampaignRecipientDataMap(campaign, recipients)
    }
    
    const result = await sendBulkMarketingEmails(
      recipients,
      campaign.subject,
      campaign.html_content,
      {
        batchSize: BATCH_SIZE,
        delayBetweenBatches: DELAY_MS, // 15 minutes = 900,000 ms
        campaignId: campaign.id,
        recipientDataMap: recipientDataMap,
        onProgress: (sent, total, remaining) => {
          // Update campaign progress
          supabase
            .from("email_campaigns")
            .update({ sent_count: sent })
            .eq("id", id)
            .then(() => {})
        },
      }
    )

    // Update campaign status and metrics
    if (result.needsResume) {
      // Campaign partially sent - store remaining recipients for resume
      const remainingRecipients = result.remainingRecipients || []
      await supabase
        .from("email_campaigns")
        .update({
          status: "sending", // Keep as sending
          sent_count: result.sent,
          content: {
            ...(campaign.content || {}),
            stored_recipients: recipients, // Keep full list
            remaining_recipients: remainingRecipients, // Store remaining for resume
            last_resume_at: new Date().toISOString(),
          }
        })
        .eq("id", id)
      
      console.log(`[Campaign ${id}] Partially sent: ${result.sent}/${recipients.length}. Remaining: ${remainingRecipients.length}. Can be resumed.`)
    } else {
      // Campaign fully sent
      await supabase
        .from("email_campaigns")
        .update({
          status: "sent",
          sent_count: result.sent,
        })
        .eq("id", id)
      
      console.log(`[Campaign ${id}] Successfully completed: ${result.sent} emails sent`)
    }
  } catch (error: any) {
    console.error(`[Campaign ${id}] Error in processCampaignSending:`, error)
    
    // Update campaign status to failed
    const supabase = createAdminSupabaseClient()
    await supabase
      .from("email_campaigns")
      .update({ status: "draft" })
      .eq("id", id)
  }
}

/**
 * Send a campaign: store recipients and set status so process-batch (API) can send in reliable, one-batch-per-request runs.
 * Client should call POST /api/admin/email-campaigns/process-batch with this campaign id to run the first batch.
 * Cron (or manual Resume) runs process-batch for remaining batches.
 */
export async function sendEmailCampaign(id: string) {
  try {
    const supabase = createAdminSupabaseClient()

    const { data: campaign, error: campaignError } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", id)
      .single()

    if (campaignError || !campaign) {
      return { success: false, error: campaignError?.message || "Campaign not found" }
    }

    if (!campaign.html_content) {
      return { success: false, error: "Campaign has no content" }
    }

    if (campaign.status === "sending") {
      return { success: false, error: "Campaign is already being sent" }
    }

    // Fetch and store recipients in this request so process-batch has them (avoids fire-and-forget never running on serverless)
    const recipients = await getCampaignRecipients(campaign as any)
    if (recipients.length === 0) {
      return { success: false, error: "No recipients found for this campaign" }
    }

    await supabase
      .from("email_campaigns")
      .update({
        status: "sending",
        sent_at: new Date().toISOString(),
        sent_count: 0,
        total_recipients: recipients.length,
        content: {
          ...(campaign.content || {}),
          stored_recipients: recipients,
          stored_at: new Date().toISOString(),
        },
      })
      .eq("id", id)

    // Kick off first send batch immediately in the background so campaigns
    // actually send when started from the admin UI, without requiring an extra API call.
    processCampaignSending(id)
      .then(() => {
        console.log(`[Campaign ${id}] Background send started from sendEmailCampaign`)
      })
      .catch((error) => {
        console.error(`[Campaign ${id}] Failed to start background send:`, error)
      })

    return {
      success: true,
      message: `Campaign sending started for ${recipients.length.toLocaleString()} recipients.`,
      sent: 0,
      total: recipients.length,
      triggerProcessBatch: false,
    }
  } catch (error: any) {
    console.error("Error starting email campaign:", error)
    return { success: false, error: error.message || "Failed to start campaign" }
  }
}

/**
 * Send a test email for a campaign
 * Uses marketing email provider (SendGrid if configured, otherwise SMTP)
 */
export async function sendCampaignTestEmail(testEmail: string, subject: string, htmlContent: string) {
  try {
    if (!testEmail || !testEmail.includes("@")) {
      return { success: false, error: "Please provide a valid email address" }
    }

    if (!subject || !htmlContent) {
      return { success: false, error: "Subject and content are required" }
    }

    // Try to use marketing email provider (SendGrid) first
    try {
      const { sendMarketingEmail } = await import("@/lib/email-marketing")
      await sendMarketingEmail({
        to: testEmail,
        subject: `[TEST] ${subject}`,
        html: htmlContent,
        categories: ["test"],
      })
      return { success: true, message: "Test email sent successfully via marketing provider!" }
    } catch (marketingError: any) {
      // Fallback to regular email if marketing provider not configured
      console.log("Marketing email provider not available, using system email:", marketingError.message)
      const { sendEmail } = await import("@/lib/email")
      await sendEmail({
        to: testEmail,
        subject: `[TEST] ${subject}`,
        html: htmlContent,
      })
      return { success: true, message: "Test email sent successfully!" }
    }
  } catch (error: any) {
    console.error("Error sending test email:", error)
    return { success: false, error: error.message || "Failed to send test email" }
  }
}
