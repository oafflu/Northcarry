'use server'

// Email marketing utility - Uses Mailgun (default) for all marketing emails
import { sendEmail as sendEmailViaMailgun, sendBulkEmails as sendBulkEmailsViaMailgun } from './email-mailgun'
import { getSetting } from '@/app/actions/settings'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

interface MarketingEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
  replyTo?: string
  categories?: string[]
  // Optional campaign context for analytics (used by SendGrid webhooks)
  campaignId?: string
}

/**
 * Get daily email count for tracking (Mailgun has high limits, so this is just for analytics)
 */
async function getDailyEmailCount(): Promise<number> {
  try {
    const supabase = createAdminSupabaseClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Count emails sent today from email_campaigns
    const { data: todayCampaigns } = await supabase
      .from("email_campaigns")
      .select("sent_count")
      .eq("status", "sent")
      .gte("sent_at", today.toISOString())
    
    const totalSent = todayCampaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0
    
    return totalSent
  } catch (error) {
    console.error("Error getting daily email count:", error)
    return 0
  }
}

// Cache provider config
let cachedProvider: string | null = null
let providerCacheTime: number = 0

/**
 * Send marketing email via Mailgun (default for all marketing emails)
 * This is used for email campaigns and marketing communications
 */
export async function sendMarketingEmail(options: MarketingEmailOptions) {
  try {
    // Always use Mailgun for marketing emails
    return await sendEmailViaMailgun({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      from: options.from,
      fromName: options.fromName,
      replyTo: options.replyTo,
      categories: ['marketing', ...(options.categories || [])],
      campaignId: options.campaignId,
    })
  } catch (error: any) {
    console.error('[sendMarketingEmail] Error sending marketing email:', error)
    throw error
  }
}

/**
 * Send bulk marketing emails via Mailgun with batch processing
 */
export async function sendBulkMarketingEmails(
  recipients: string[],
  subject: string,
  html: string,
  options?: {
    batchSize?: number
    delayBetweenBatches?: number
    onProgress?: (sent: number, total: number, remaining: number) => void
    campaignId?: string
    recipientDataMap?: Map<string, { firstName?: string; lastName?: string; name?: string; [key: string]: any }>
  }
) {
  try {
    // Always use Mailgun for bulk marketing emails
    // Warmed-up sender: 5000 per batch (3000 if personalization), 10-minute intervals (override via options)
    const DEFAULT_BATCH_SIZE = 5000
    const DEFAULT_DELAY_MINUTES = 10
    const DEFAULT_DELAY_MS = DEFAULT_DELAY_MINUTES * 60 * 1000
    
    return await sendBulkEmailsViaMailgun(
      recipients,
      subject,
      html,
      {
        batchSize: options?.batchSize || DEFAULT_BATCH_SIZE,
        delayBetweenBatches: options?.delayBetweenBatches || DEFAULT_DELAY_MS,
        onProgress: options?.onProgress,
        campaignId: options?.campaignId,
        recipientDataMap: options?.recipientDataMap,
      }
    )
  } catch (error: any) {
    console.error('[sendBulkMarketingEmails] Error:', error)
    throw error
  }
}
