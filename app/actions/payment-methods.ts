'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'
import { getSetting, saveSetting } from './settings'

export async function getPaymentMethods() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('saved_payment_methods')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payment methods:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function deletePaymentMethod(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('saved_payment_methods')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting payment method:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function setDefaultPaymentMethod(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Unset all defaults
  await supabase
    .from('saved_payment_methods')
    .update({ is_default: false })
    .eq('user_id', user.id)

  // Set this as default
  const { error } = await supabase
    .from('saved_payment_methods')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error setting default payment method:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Admin functions for Stripe payment methods configuration
export async function getStripePaymentMethods() {
  try {
    // Get Stripe settings
    const stripeSetting = await getSetting('stripe')
    const stripeConfig = stripeSetting.data as any

    if (!stripeConfig?.enabled || !stripeConfig?.secret_key) {
      return { data: [], error: 'Stripe is not configured' }
    }

    // Get enabled payment methods from admin settings
    const enabledMethodsSetting = await getSetting('stripe_payment_methods')
    const enabledMethods = (enabledMethodsSetting.data as Record<string, boolean>) || {}

    // Define available payment method types with categories
    const paymentMethodTypes = [
      { id: 'card', name: 'Card', type: 'card', category: 'cards', icon: '💳', popularIn: ['All regions'] },
      { id: 'apple_pay', name: 'Apple Pay', type: 'apple_pay', category: 'wallet', icon: '🍎', popularIn: ['iOS', 'Safari'] },
      { id: 'google_pay', name: 'Google Pay', type: 'google_pay', category: 'wallet', icon: '📱', popularIn: ['Android', 'Chrome'] },
      { id: 'link', name: 'Link', type: 'link', category: 'wallet', icon: '🔗', popularIn: ['US', 'Stripe users'] },
      { id: 'us_bank_account', name: 'US Bank Account', type: 'us_bank_account', category: 'cards', icon: '🏦', popularIn: ['US'] },
      { id: 'affirm', name: 'Affirm', type: 'affirm', category: 'buy_now_pay_later', icon: '💰', popularIn: ['US', 'Canada'] },
      { id: 'afterpay_clearpay', name: 'Afterpay / Clearpay', type: 'afterpay_clearpay', category: 'buy_now_pay_later', icon: '📦', popularIn: ['US', 'UK', 'AU'] },
      { id: 'klarna', name: 'Klarna', type: 'klarna', category: 'buy_now_pay_later', icon: '🛒', popularIn: ['US', 'EU'] },
      { id: 'paypal', name: 'PayPal', type: 'paypal', category: 'wallet', icon: '💼', popularIn: ['Global'] },
    ]

    const methods = paymentMethodTypes.map((method) => ({
      id: method.id,
      name: method.name,
      type: method.type,
      category: method.category,
      icon: method.icon,
      popularIn: method.popularIn,
      enabled: enabledMethods[method.id] ?? (method.id === 'card'), // Card is enabled by default
    }))

    return { data: methods, error: null }
  } catch (error: any) {
    console.error('Error fetching Stripe payment methods:', error)
    return { data: [], error: error.message || 'Failed to fetch payment methods' }
  }
}

export async function savePaymentMethods(enabledMethods: Record<string, boolean>) {
  try {
    const result = await saveSetting(
      'stripe_payment_methods',
      enabledMethods,
      'payment',
      'Enabled Stripe payment methods'
    )

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving payment methods:', error)
    return { success: false, error: error.message || 'Failed to save payment methods' }
  }
}

// Get payment method images
export async function getPaymentMethodImages() {
  try {
    const result = await getSetting('payment_method_images')
    const images = result.data as Record<string, { imageUrl?: string; cardImages?: Array<{ name: string; url: string; alt: string }> }> || {}
    return { data: images, error: null }
  } catch (error: any) {
    console.error('Error fetching payment method images:', error)
    return { data: {}, error: error.message || 'Failed to fetch payment method images' }
  }
}

// Save payment method images
export async function savePaymentMethodImages(images: Record<string, { imageUrl?: string; cardImages?: Array<{ name: string; url: string; alt: string }> }>) {
  try {
    const result = await saveSetting(
      'payment_method_images',
      images,
      'payment',
      'Payment method images for checkout page'
    )

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving payment method images:', error)
    return { success: false, error: error.message || 'Failed to save payment method images' }
  }
}
