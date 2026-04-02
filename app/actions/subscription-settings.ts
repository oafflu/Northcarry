'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SubscriptionSettings {
  // Customer Portal Button Visibility
  showCancelButton: boolean
  showPauseResumeButtons: boolean
  showChargeNowButton: boolean
  showSkipPaymentButton: boolean

  // Customer Portal Product/Discount Management
  allowAddingRemovingDiscounts: boolean
  allowChangingSellingPlans: boolean
  allowAddingProducts: boolean
  allowRemovingProducts: boolean
  allowSwappingProducts: 'none' | 'same_plan' | 'any_plan'
  allowChangingQuantity: 'none' | 'increase_only' | 'decrease_only' | 'both'

  // Post-Checkout Link
  showPortalLinkAfterCheckout: boolean

  // Email Notifications
  emailNotifications: {
    newSubscription: boolean
    subscriptionExpired: boolean
    subscriptionPaused: boolean
    subscriptionResumed: boolean
    subscriptionEdited: boolean
    subscriptionCancelled: boolean
    paymentFailedRetrying: boolean
    paymentFailedLastAttempt: boolean
    orderSkipped: boolean
    paymentReminder: boolean
    paymentReminderDays: number // Days before payment to send reminder
  }
}

const DEFAULT_SETTINGS: SubscriptionSettings = {
  showCancelButton: true,
  showPauseResumeButtons: true,
  showChargeNowButton: false,
  showSkipPaymentButton: true,
  allowAddingRemovingDiscounts: true,
  allowChangingSellingPlans: true,
  allowAddingProducts: true,
  allowRemovingProducts: true,
  allowSwappingProducts: 'same_plan',
  allowChangingQuantity: 'both',
  showPortalLinkAfterCheckout: true,
  emailNotifications: {
    newSubscription: true,
    subscriptionExpired: true,
    subscriptionPaused: true,
    subscriptionResumed: true,
    subscriptionEdited: true,
    subscriptionCancelled: true,
    paymentFailedRetrying: true,
    paymentFailedLastAttempt: true,
    orderSkipped: true,
    paymentReminder: true,
    paymentReminderDays: 2,
  },
}

export async function getSubscriptionSettings(): Promise<{ data: SubscriptionSettings | null; error: string | null }> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'subscription_settings')
    .eq('setting_category', 'subscriptions')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching subscription settings:', error)
    return { data: null, error: error.message }
  }

  if (!data) {
    return { data: DEFAULT_SETTINGS, error: null }
  }

  return { data: data.setting_value as SubscriptionSettings, error: null }
}

export async function saveSubscriptionSettings(settings: SubscriptionSettings): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('admin_settings')
    .upsert({
      setting_key: 'subscription_settings',
      setting_value: settings,
      setting_category: 'subscriptions',
      description: 'Subscription system settings including customer portal controls and email notifications',
    }, {
      onConflict: 'setting_key'
    })

  if (error) {
    console.error('Error saving subscription settings:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions/settings')
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_settings_updated',
    actionCategory: 'settings',
    actionDescription: 'Subscription settings updated',
    resourceType: 'settings',
    resourceName: 'subscription_settings',
    actionDetails: {
      email_notifications: settings.emailNotifications,
    },
  })
  
  return { success: true, error: null }
}

