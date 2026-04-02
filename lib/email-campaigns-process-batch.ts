/**
 * Shared logic: process one batch for a campaign and update sent_count.
 * Used by: POST /api/admin/email-campaigns/process-batch and cron email-campaigns-resume.
 */
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getCampaignRecipients, getCampaignRecipientDataMap } from '@/app/actions/email-campaigns'
import { sendBulkMarketingEmails } from '@/lib/email-marketing'

export async function processOneBatch(campaignId: string): Promise<{
  success: boolean
  sent?: number
  total?: number
  done?: boolean
  error?: string
}> {
  try {
    const supabase = createAdminSupabaseClient()

    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return { success: false, error: 'Campaign not found' }
    }

    if (campaign.status !== 'sending') {
      return {
        success: true,
        sent: campaign.sent_count || 0,
        total: campaign.total_recipients || 0,
        done: true,
      }
    }

    let recipients: string[] = []
    const storedRecipients = (campaign.content as any)?.stored_recipients
    if (storedRecipients && Array.isArray(storedRecipients) && storedRecipients.length > 0) {
      recipients = storedRecipients
    } else {
      recipients = await getCampaignRecipients(campaign as any)
      if (recipients.length === 0) {
        await supabase.from('email_campaigns').update({ status: 'draft' }).eq('id', campaignId)
        return { success: false, error: 'No recipients' }
      }
      await supabase
        .from('email_campaigns')
        .update({
          content: {
            ...(campaign.content || {}),
            stored_recipients: recipients,
            stored_at: new Date().toISOString(),
          },
        })
        .eq('id', campaignId)
    }

    const alreadySent = campaign.sent_count || 0
    const remaining = recipients.slice(alreadySent)
    if (remaining.length === 0) {
      await supabase.from('email_campaigns').update({ status: 'sent' }).eq('id', campaignId)
      return { success: true, sent: alreadySent, total: recipients.length, done: true }
    }

    const needsPersonalization =
      campaign.html_content?.includes('{{firstName') ||
      campaign.html_content?.includes('{{name') ||
      campaign.subject?.includes('{{firstName') ||
      campaign.subject?.includes('{{name')
    // Personalized emails are sent in sub-batches of 100; serverless often times out before 3000 complete.
    // Use a smaller batch so one request finishes (e.g. 1000 = 10 sub-batches ~1–2 min). Override with EMAIL_PERSONALIZED_BATCH_SIZE.
    const DEFAULT_PERSONALIZED_BATCH = 1000
    const DEFAULT_NON_PERSONALIZED_BATCH = 5000
    const BATCH_SIZE = needsPersonalization
      ? parseInt(process.env.EMAIL_PERSONALIZED_BATCH_SIZE || String(DEFAULT_PERSONALIZED_BATCH), 10)
      : parseInt(process.env.EMAIL_BATCH_SIZE || String(DEFAULT_NON_PERSONALIZED_BATCH), 10)
    const batch = remaining.slice(0, BATCH_SIZE)

    let recipientDataMap: Map<string, { firstName?: string; lastName?: string; name?: string }> | undefined
    if (needsPersonalization) {
      recipientDataMap = await getCampaignRecipientDataMap(campaign as any, batch)
    }

    const result = await sendBulkMarketingEmails(
      batch,
      campaign.subject,
      campaign.html_content || '',
      {
        batchSize: batch.length,
        delayBetweenBatches: 0,
        campaignId: campaign.id,
        recipientDataMap,
        onProgress: (sent) => {
          supabase
            .from('email_campaigns')
            .update({ sent_count: alreadySent + sent })
            .eq('id', campaignId)
            .then(() => {})
        },
      }
    )

    const newSent = alreadySent + result.sent
    const done = newSent >= recipients.length
    await supabase
      .from('email_campaigns')
      .update({ status: done ? 'sent' : 'sending', sent_count: newSent })
      .eq('id', campaignId)

    return { success: true, sent: newSent, total: recipients.length, done }
  } catch (error: any) {
    console.error('[processOneBatch]', campaignId, error)
    return { success: false, error: error?.message || 'Process batch failed' }
  }
}
