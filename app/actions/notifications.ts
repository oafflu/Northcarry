'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendPushNotification, sendMulticastPushNotification } from '@/lib/firebase-admin'

export interface NotificationData {
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  link?: string
  metadata?: Record<string, any>
}

// Map notification type to preference column
function getPreferenceColumn(type: string): string {
  const mapping: Record<string, string> = {
    order_confirmed: 'order_updates',
    order_shipped: 'shipping_updates',
    order_delivered: 'shipping_updates',
    abandoned_cart: 'abandoned_cart',
    promotional: 'promotional',
    low_stock: 'low_stock_alerts',
    new_order: 'new_orders',
    support_ticket: 'support_tickets',
    review_posted: 'review_posted',
  }
  
  return mapping[type] || 'order_updates'
}

// Send notification to a specific user
export async function sendNotification(
  userId: string,
  notification: NotificationData
) {
  try {
    // Check if notifications are enabled
    const adminSupabase = createAdminSupabaseClient()
    const { data: setting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'push_notifications')
      .single()

    const settings = setting?.setting_value as any
    if (!settings?.enabled) {
      return { success: false, error: 'Push notifications are disabled' }
    }

    // Get user's FCM tokens
    const { data: tokensData } = await adminSupabase
      .from('fcm_tokens')
      .select(`
        id,
        token,
        notification_preferences!inner (
          ${getPreferenceColumn(notification.type || 'info')}
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!tokensData || tokensData.length === 0) {
      return { success: false, error: 'No active FCM tokens found for user' }
    }

    // Filter tokens based on preferences
    const enabledTokens = tokensData.filter((t: any) => {
      const prefs = t.notification_preferences
      const prefColumn = getPreferenceColumn(notification.type || 'info')
      return prefs && prefs[prefColumn] !== false
    })

    if (enabledTokens.length === 0) {
      return { success: false, error: 'User has disabled this notification type' }
    }

    const tokens = enabledTokens.map((t: any) => t.token)

    // Send notification
    const result = await sendMulticastPushNotification(tokens, {
      title: notification.title,
      body: notification.message,
      url: notification.link,
      icon: '/icon.svg',
      data: {
        type: notification.type || 'info',
        ...notification.metadata,
      },
    })

    // Log notifications
    const logs = enabledTokens.map((t: any) => ({
      user_id: userId,
      fcm_token_id: t.id,
      notification_type: notification.type || 'info',
      title: notification.title,
      body: notification.message,
      data: notification.metadata || {},
      status: 'sent' as const,
      related_entity_type: notification.metadata?.entityType,
      related_entity_id: notification.metadata?.entityId,
    }))

    await adminSupabase.from('notification_logs').insert(logs)

    // Deactivate invalid tokens
    if (result.invalidTokens.length > 0) {
      await adminSupabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .in('token', result.invalidTokens)
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error: any) {
    console.error('Error sending notification:', error)
    return { success: false, error: error.message }
  }
}

// Send notification to all admins
export async function notifyAdmins(notification: NotificationData) {
  try {
    // Check if notifications are enabled
    const adminSupabase = createAdminSupabaseClient()
    const { data: setting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'push_notifications')
      .single()

    const settings = setting?.setting_value as any
    if (!settings?.enabled) {
      return { success: false, error: 'Push notifications are disabled' }
    }

    // Get all admin user IDs
    const { data: admins } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) {
      return { success: false, error: 'No admins found' }
    }

    const adminIds = admins.map(a => a.id)

    // Get FCM tokens for admins
    const { data: tokensData } = await adminSupabase
      .from('fcm_tokens')
      .select(`
        id,
        user_id,
        token,
        notification_preferences!inner (
          ${getPreferenceColumn(notification.type || 'info')}
        )
      `)
      .in('user_id', adminIds)
      .eq('is_active', true)

    if (!tokensData || tokensData.length === 0) {
      return { success: false, error: 'No active FCM tokens found for admins' }
    }

    // Filter tokens based on preferences
    const enabledTokens = tokensData.filter((t: any) => {
      const prefs = t.notification_preferences
      const prefColumn = getPreferenceColumn(notification.type || 'info')
      return prefs && prefs[prefColumn] !== false
    })

    if (enabledTokens.length === 0) {
      return { success: false, error: 'All admins have disabled this notification type' }
    }

    const tokens = enabledTokens.map((t: any) => t.token)

    // Send notification
    const result = await sendMulticastPushNotification(tokens, {
      title: notification.title,
      body: notification.message,
      url: notification.link,
      icon: '/icon.svg',
      data: {
        type: notification.type || 'info',
        ...notification.metadata,
      },
    })

    // Log notifications
    const logs = enabledTokens.map((t: any) => ({
      user_id: t.user_id,
      fcm_token_id: t.id,
      notification_type: notification.type || 'info',
      title: notification.title,
      body: notification.message,
      data: notification.metadata || {},
      status: 'sent' as const,
      related_entity_type: notification.metadata?.entityType,
      related_entity_id: notification.metadata?.entityId,
    }))

    await adminSupabase.from('notification_logs').insert(logs)

    // Deactivate invalid tokens
    if (result.invalidTokens.length > 0) {
      await adminSupabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .in('token', result.invalidTokens)
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error: any) {
    console.error('Error notifying admins:', error)
    return { success: false, error: error.message }
  }
}

/** Push to every user with role admin or partner (FCM), same shape as notifyAdmins. */
export async function notifyAdminsAndPartners(notification: NotificationData) {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data: setting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'push_notifications')
      .single()

    const settings = setting?.setting_value as any
    if (!settings?.enabled) {
      return { success: false, error: 'Push notifications are disabled' }
    }

    const { data: users } = await adminSupabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'partner'])

    if (!users || users.length === 0) {
      return { success: false, error: 'No admin or partner users found' }
    }

    const userIds = users.map((u) => u.id)

    const { data: tokensData } = await adminSupabase
      .from('fcm_tokens')
      .select(`
        id,
        user_id,
        token,
        notification_preferences!inner (
          ${getPreferenceColumn(notification.type || 'info')}
        )
      `)
      .in('user_id', userIds)
      .eq('is_active', true)

    if (!tokensData || tokensData.length === 0) {
      return { success: false, error: 'No active FCM tokens for admin/partner users' }
    }

    const enabledTokens = tokensData.filter((t: any) => {
      const prefs = t.notification_preferences
      const prefColumn = getPreferenceColumn(notification.type || 'info')
      return prefs && prefs[prefColumn] !== false
    })

    if (enabledTokens.length === 0) {
      return { success: false, error: 'All recipients have disabled this notification type' }
    }

    const tokens = enabledTokens.map((t: any) => t.token)

    const result = await sendMulticastPushNotification(tokens, {
      title: notification.title,
      body: notification.message,
      url: notification.link,
      icon: '/icon.svg',
      data: {
        type: notification.type || 'info',
        ...notification.metadata,
      },
    })

    const logs = enabledTokens.map((t: any) => ({
      user_id: t.user_id,
      fcm_token_id: t.id,
      notification_type: notification.type || 'info',
      title: notification.title,
      body: notification.message,
      data: notification.metadata || {},
      status: 'sent' as const,
      related_entity_type: notification.metadata?.entityType,
      related_entity_id: notification.metadata?.entityId,
    }))

    await adminSupabase.from('notification_logs').insert(logs)

    if (result.invalidTokens.length > 0) {
      await adminSupabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .in('token', result.invalidTokens)
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error: any) {
    console.error('Error notifying admins and partners:', error)
    return { success: false, error: error.message }
  }
}

// Send notification to a supplier
export async function notifySupplier(
  supplierId: string,
  notification: NotificationData
) {
  return sendNotification(supplierId, notification)
}

// Send notification to all suppliers
export async function notifyAllSuppliers(notification: NotificationData) {
  try {
    // Check if notifications are enabled
    const adminSupabase = createAdminSupabaseClient()
    const { data: setting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'push_notifications')
      .single()

    const settings = setting?.setting_value as any
    if (!settings?.enabled) {
      return { success: false, error: 'Push notifications are disabled' }
    }

    // Get all supplier user IDs
    const { data: suppliers } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('role', 'supplier')

    if (!suppliers || suppliers.length === 0) {
      return { success: false, error: 'No suppliers found' }
    }

    const supplierIds = suppliers.map(s => s.id)

    // Get FCM tokens for suppliers
    const { data: tokensData } = await adminSupabase
      .from('fcm_tokens')
      .select(`
        id,
        user_id,
        token,
        notification_preferences!inner (
          ${getPreferenceColumn(notification.type || 'info')}
        )
      `)
      .in('user_id', supplierIds)
      .eq('is_active', true)

    if (!tokensData || tokensData.length === 0) {
      return { success: false, error: 'No active FCM tokens found for suppliers' }
    }

    // Filter tokens based on preferences
    const enabledTokens = tokensData.filter((t: any) => {
      const prefs = t.notification_preferences
      const prefColumn = getPreferenceColumn(notification.type || 'info')
      return prefs && prefs[prefColumn] !== false
    })

    if (enabledTokens.length === 0) {
      return { success: false, error: 'All suppliers have disabled this notification type' }
    }

    const tokens = enabledTokens.map((t: any) => t.token)

    // Send notification
    const result = await sendMulticastPushNotification(tokens, {
      title: notification.title,
      body: notification.message,
      url: notification.link,
      icon: '/icon.svg',
      data: {
        type: notification.type || 'info',
        ...notification.metadata,
      },
    })

    // Log notifications
    const logs = enabledTokens.map((t: any) => ({
      user_id: t.user_id,
      fcm_token_id: t.id,
      notification_type: notification.type || 'info',
      title: notification.title,
      body: notification.message,
      data: notification.metadata || {},
      status: 'sent' as const,
      related_entity_type: notification.metadata?.entityType,
      related_entity_id: notification.metadata?.entityId,
    }))

    await adminSupabase.from('notification_logs').insert(logs)

    // Deactivate invalid tokens
    if (result.invalidTokens.length > 0) {
      await adminSupabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .in('token', result.invalidTokens)
    }

    return {
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }
  } catch (error: any) {
    console.error('Error notifying suppliers:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get user's notifications from database
 */
export async function getUserNotifications(options?: {
  limit?: number
  offset?: number
  type?: string
  status?: 'sent' | 'failed' | 'clicked'
  unreadOnly?: boolean
}) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated', data: [] }
  }

  try {
    let query = supabase
      .from('notification_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('sent_at', { ascending: false })

    if (options?.type) {
      query = query.eq('notification_type', options.type)
    }

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      return { success: false, error: error.message, data: [] }
    }

    // Filter unread if requested (unread = not clicked)
    let notifications = data || []
    if (options?.unreadOnly) {
      notifications = notifications.filter(n => n.status !== 'clicked')
    }

    return { success: true, data: notifications }
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Mark notification as clicked/read
 */
export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notification_logs')
      .update({
        status: 'clicked',
        clicked_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error marking notification as read:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notification_logs')
      .update({
        status: 'clicked',
        clicked_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .neq('status', 'clicked')

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const { error } = await supabase
      .from('notification_logs')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting notification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Save FCM token for user
 */
export async function saveFCMToken(token: string, deviceType: 'web' | 'ios' | 'android' = 'web') {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Check if token already exists
    const { data: existing } = await supabase
      .from('fcm_tokens')
      .select('id')
      .eq('token', token)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Update existing token
      await supabase
        .from('fcm_tokens')
        .update({
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Insert new token
      await supabase
        .from('fcm_tokens')
        .insert({
          user_id: user.id,
          token,
          device_type: deviceType,
          browser_info: typeof navigator !== 'undefined' ? {
            userAgent: navigator.userAgent,
          } : null,
        })
    }

    return { success: true }
  } catch (error: any) {
    console.error('Save FCM token error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Remove FCM token (on logout or permission revoked)
 */
export async function removeFCMToken(token: string) {
  const supabase = await createServerSupabaseClient()
  
  try {
    await supabase
      .from('fcm_tokens')
      .update({ is_active: false })
      .eq('token', token)

    return { success: true }
  } catch (error: any) {
    console.error('Remove FCM token error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(preferences: Record<string, boolean>) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('notification_preferences')
    .update({
      ...preferences,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
