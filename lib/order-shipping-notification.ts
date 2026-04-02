import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Marks that the transactional shipping notification email was sent.
 * Requires `orders.shipping_notification_sent_at` (see scripts/add-shipping-notification-sent-at.sql).
 */
export async function markShippingNotificationSent(orderId: string): Promise<void> {
  const supabase = createAdminSupabaseClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('orders')
    .update({
      shipping_notification_sent_at: now,
      updated_at: now,
    })
    .eq('id', orderId)

  if (error) {
    console.warn('[markShippingNotificationSent]', orderId, error.message)
  }
}
