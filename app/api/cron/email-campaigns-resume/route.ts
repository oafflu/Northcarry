import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Cron job to automatically resume paused email campaigns
 * This should be scheduled to run periodically (e.g., every hour or every 6 hours)
 * Configured in vercel.json to run every 6 hours
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (set in Vercel environment variables)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()

    // Find campaigns that are in "sending" status but haven't completed
    // These are campaigns that were paused (likely due to rate limits)
    const { data: allCampaigns, error: fetchError } = await supabase
      .from('email_campaigns')
      .select('id, name, sent_count, total_recipients, status, updated_at, html_content, subject, content, recipient_type, segment_id')
      .eq('status', 'sending')
      .order('updated_at', { ascending: true })

    // Filter campaigns where sent_count < total_recipients
    const pausedCampaigns = allCampaigns?.filter(
      (campaign) => (campaign.sent_count || 0) < (campaign.total_recipients || 0)
    ) || []

    if (fetchError) {
      console.error('Error fetching paused campaigns:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!pausedCampaigns || pausedCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No paused campaigns found',
        resumed: 0,
      })
    }

    console.log(`[Auto Resume] Found ${pausedCampaigns.length} paused campaign(s); processing one batch each (await so sent_count updates)`)

    const { processOneBatch } = await import('@/lib/email-campaigns-process-batch')
    let resumed = 0
    const errors: string[] = []

    for (const campaign of pausedCampaigns) {
      try {
        console.log(`[Auto Resume] Processing one batch for campaign: ${campaign.name} (${campaign.id})`)
        const result = await processOneBatch(campaign.id)
        if (result.success && result.sent !== undefined) {
          resumed++
          console.log(`[Auto Resume] Campaign ${campaign.name}: sent ${result.sent}/${result.total}${result.done ? ' (done)' : ''}`)
        } else if (result.error) {
          errors.push(`Campaign ${campaign.name}: ${result.error}`)
        }
      } catch (error: any) {
        errors.push(`Campaign ${campaign.name}: ${error.message || 'Unknown error'}`)
        console.error(`[Auto Resume] Error resuming campaign ${campaign.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${pausedCampaigns.length} paused campaign(s)`,
      resumed,
      failed: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit to first 10 errors
    })
  } catch (error: any) {
    console.error('Error in email campaigns auto-resume cron job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
