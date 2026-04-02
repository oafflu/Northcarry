'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getSubscriptionSettings } from './subscription-settings'
import { logSystemAction } from '@/lib/system-logger'

// Pause subscription
export async function pauseSubscription(subscriptionId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active') {
    return { success: false, error: 'Only active subscriptions can be paused' }
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      status: 'paused',
      pause_reason: 'Customer requested',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error pausing subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionPaused) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionPausedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionPausedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending pause email:', emailError)
    // Don't fail the pause if email fails
  }

  revalidatePath('/account/subscriptions')
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_paused',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription ${subscriptionId} paused`,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    actionDetails: {
      pause_reason: 'Customer requested',
    },
  })
  
  return { success: true }
}

// Resume subscription
export async function resumeSubscription(subscriptionId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, next_billing_date, next_shipment_date')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'paused') {
    return { success: false, error: 'Only paused subscriptions can be resumed' }
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error resuming subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionResumed) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionResumedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionResumedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending resume email:', emailError)
    // Don't fail the resume if email fails
  }

  revalidatePath('/account/subscriptions')
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_resumed',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription ${subscriptionId} resumed`,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    actionDetails: {
      next_billing_date: subscription.next_billing_date,
      next_shipment_date: subscription.next_shipment_date,
    },
  })
  
  return { success: true }
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string, reason?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, stripe_subscription_id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status === 'cancelled') {
    return { success: false, error: 'Subscription is already cancelled' }
  }

  // Cancel Stripe subscription if exists
  if (subscription.stripe_subscription_id) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (stripeError) {
      console.error('Error cancelling Stripe subscription:', stripeError)
      // Continue with cancellation even if Stripe fails
    }
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      status: 'cancelled',
      cancellation_reason: reason || 'Customer requested',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error cancelling subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionCancelled) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionCancelledEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionCancelledEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending cancellation email:', emailError)
    // Don't fail the cancellation if email fails
  }

  revalidatePath('/account/subscriptions')
  return { success: true }
}

// Charge now (process payment immediately)
export async function chargeNow(subscriptionId: string) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, next_billing_date, price_per_cycle, quantity, payment_method_id, stripe_subscription_id')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active') {
    return { success: false, error: 'Only active subscriptions can be charged' }
  }

  // Process payment via Stripe
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
    
    const amount = Math.round(parseFloat(subscription.price_per_cycle.toString()) * subscription.quantity * 100) // Convert to cents

    // Get customer's payment method
    if (!subscription.payment_method_id) {
      return { success: false, error: 'No payment method found for this subscription' }
    }

    // Get customer's Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return { success: false, error: 'No Stripe customer ID found' }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: profile.stripe_customer_id,
      payment_method: subscription.payment_method_id,
      confirm: true,
      description: `Subscription charge for subscription ${subscriptionId}`,
    })

    if (paymentIntent.status !== 'succeeded') {
      return { success: false, error: 'Payment failed' }
    }

    // Update next billing date
    const nextBillingDate = new Date(subscription.next_billing_date)
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1) // Add 1 month

    await supabase
      .from('customer_subscriptions')
      .update({
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)

    return { success: true, paymentIntentId: paymentIntent.id }
  } catch (error: any) {
    console.error('Error charging subscription:', error)
    return { success: false, error: error.message || 'Failed to process payment' }
  }
}

// Skip next payment/order
export async function skipNextOrder(subscriptionId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, next_billing_date, next_shipment_date, frequency_months')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active') {
    return { success: false, error: 'Only active subscriptions can skip orders' }
  }

  // Calculate next dates (skip current cycle)
  const nextBillingDate = new Date(subscription.next_billing_date)
  const nextShipmentDate = new Date(subscription.next_shipment_date)
  
  nextBillingDate.setMonth(nextBillingDate.getMonth() + subscription.frequency_months)
  nextShipmentDate.setMonth(nextShipmentDate.getMonth() + subscription.frequency_months)

  // Update subscription dates
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      next_billing_date: nextBillingDate.toISOString().split('T')[0],
      next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error skipping order:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.orderSkipped) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendOrderSkippedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendOrderSkippedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending skip email:', emailError)
    // Don't fail the skip if email fails
  }

  revalidatePath('/account/subscriptions')
  return { success: true }
}

// ============================================
// ADMIN FUNCTIONS (No user ownership check)
// ============================================

// Admin: Pause subscription
export async function adminPauseSubscription(subscriptionId: string, reason?: string) {
  const adminSupabase = createAdminSupabaseClient()
  const serverSupabase = await createServerSupabaseClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is admin or partner
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return { success: false, error: 'Unauthorized. Only admin and partner can pause subscriptions.' }
  }

  // Get subscription (no user ownership check)
  const { data: subscription, error: fetchError } = await adminSupabase
    .from('customer_subscriptions')
    .select('id, status')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active') {
    return { success: false, error: 'Only active subscriptions can be paused' }
  }

  // Update subscription status
  const { error: updateError } = await adminSupabase
    .from('customer_subscriptions')
    .update({
      status: 'paused',
      pause_reason: reason || 'Admin requested',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error pausing subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionPaused) {
      const { data: subscriptionData } = await adminSupabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionPausedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionPausedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending pause email:', emailError)
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath(`/admin/subscriptions/${subscriptionId}`)
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_paused',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription ${subscriptionId} paused by admin`,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    actionDetails: {
      pause_reason: reason || 'Admin requested',
      admin_email: user.email,
    },
  })
  
  return { success: true }
}

// Admin: Resume subscription
export async function adminResumeSubscription(subscriptionId: string) {
  const adminSupabase = createAdminSupabaseClient()
  const serverSupabase = await createServerSupabaseClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is admin or partner
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return { success: false, error: 'Unauthorized. Only admin and partner can resume subscriptions.' }
  }

  // Get subscription (no user ownership check)
  const { data: subscription, error: fetchError } = await adminSupabase
    .from('customer_subscriptions')
    .select('id, status, next_billing_date, next_shipment_date')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'paused') {
    return { success: false, error: 'Only paused subscriptions can be resumed' }
  }

  // Update subscription status
  const { error: updateError } = await adminSupabase
    .from('customer_subscriptions')
    .update({
      status: 'active',
      pause_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error resuming subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionResumed) {
      const { data: subscriptionData } = await adminSupabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionResumedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionResumedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending resume email:', emailError)
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath(`/admin/subscriptions/${subscriptionId}`)
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_resumed',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription ${subscriptionId} resumed by admin`,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    actionDetails: {
      next_billing_date: subscription.next_billing_date,
      next_shipment_date: subscription.next_shipment_date,
      admin_email: user.email,
    },
  })
  
  return { success: true }
}

// Admin: Cancel subscription
export async function adminCancelSubscription(subscriptionId: string, reason?: string) {
  const adminSupabase = createAdminSupabaseClient()
  const serverSupabase = await createServerSupabaseClient()
  const { data: { user } } = await serverSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is admin or partner
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return { success: false, error: 'Unauthorized. Only admin and partner can cancel subscriptions.' }
  }

  // Get subscription (no user ownership check)
  const { data: subscription, error: fetchError } = await adminSupabase
    .from('customer_subscriptions')
    .select('id, status, stripe_subscription_id')
    .eq('id', subscriptionId)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status === 'cancelled') {
    return { success: false, error: 'Subscription is already cancelled' }
  }

  // Cancel Stripe subscription if exists
  if (subscription.stripe_subscription_id) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (stripeError) {
      console.error('Error cancelling Stripe subscription:', stripeError)
      // Continue with cancellation even if Stripe fails
    }
  }

  // Update subscription status
  const { error: updateError } = await adminSupabase
    .from('customer_subscriptions')
    .update({
      status: 'cancelled',
      cancellation_reason: reason || 'Admin requested',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error cancelling subscription:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled
  try {
    const settingsResult = await getSubscriptionSettings()
    if (settingsResult.data?.emailNotifications.subscriptionCancelled) {
      const { data: subscriptionData } = await adminSupabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionCancelledEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionCancelledEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending cancellation email:', emailError)
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath(`/admin/subscriptions/${subscriptionId}`)
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_cancelled',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription ${subscriptionId} cancelled by admin`,
    resourceType: 'subscription',
    resourceId: subscriptionId,
    actionDetails: {
      cancellation_reason: reason || 'Admin requested',
      admin_email: user.email,
    },
  })
  
  return { success: true }
}

// Update subscription quantity
export async function updateSubscriptionQuantity(
  subscriptionId: string,
  newQuantity: number
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check settings
  const settingsResult = await getSubscriptionSettings()
  const settings = settingsResult.data

  if (!settings) {
    return { success: false, error: 'Settings not found' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, quantity')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active' && subscription.status !== 'paused') {
    return { success: false, error: 'Only active or paused subscriptions can be updated' }
  }

  // Check quantity change restrictions
  const currentQuantity = subscription.quantity
  const quantityChange = newQuantity - currentQuantity

  if (quantityChange === 0) {
    return { success: false, error: 'Quantity unchanged' }
  }

  if (settings.allowChangingQuantity === 'none') {
    return { success: false, error: 'Quantity changes are not allowed' }
  }

  if (settings.allowChangingQuantity === 'increase_only' && quantityChange < 0) {
    return { success: false, error: 'Decreasing quantity is not allowed' }
  }

  if (settings.allowChangingQuantity === 'decrease_only' && quantityChange > 0) {
    return { success: false, error: 'Increasing quantity is not allowed' }
  }

  if (newQuantity < 1) {
    return { success: false, error: 'Quantity must be at least 1' }
  }

  // Update quantity
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      quantity: newQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error updating quantity:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled (subscription edited)
  try {
    if (settings.emailNotifications.subscriptionEdited) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionEditedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionEditedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending edit email:', emailError)
    // Don't fail the update if email fails
  }

  revalidatePath('/account/subscriptions')
  return { success: true }
}

// Update subscription frequency (selling plan)
export async function updateSubscriptionFrequency(
  subscriptionId: string,
  newFrequencyMonths: number
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check settings
  const settingsResult = await getSubscriptionSettings()
  const settings = settingsResult.data

  if (!settings) {
    return { success: false, error: 'Settings not found' }
  }

  if (!settings.allowChangingSellingPlans) {
    return { success: false, error: 'Changing selling plans is not allowed' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, subscription_product_id, frequency_months')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active' && subscription.status !== 'paused') {
    return { success: false, error: 'Only active or paused subscriptions can be updated' }
  }

  // Verify new frequency is available for this subscription product
  const { data: subscriptionProduct } = await supabase
    .from('subscription_products')
    .select('available_frequencies')
    .eq('id', subscription.subscription_product_id)
    .single()

  if (!subscriptionProduct?.available_frequencies?.includes(newFrequencyMonths)) {
    return { success: false, error: 'This frequency is not available for this subscription' }
  }

  // Update frequency
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      frequency_months: newFrequencyMonths,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error updating frequency:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled (subscription edited)
  try {
    if (settings.emailNotifications.subscriptionEdited) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionEditedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionEditedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending edit email:', emailError)
    // Don't fail the update if email fails
  }

  revalidatePath('/account/subscriptions')
  return { success: true }
}

// Swap subscription product/variant
export async function swapSubscriptionProduct(
  subscriptionId: string,
  newSubscriptionProductId: string
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check settings
  const settingsResult = await getSubscriptionSettings()
  const settings = settingsResult.data

  if (!settings) {
    return { success: false, error: 'Settings not found' }
  }

  if (settings.allowSwappingProducts === 'none') {
    return { success: false, error: 'Swapping products is not allowed' }
  }

  // Verify subscription belongs to user
  const { data: subscription, error: fetchError } = await supabase
    .from('customer_subscriptions')
    .select('id, status, user_id, subscription_product_id, frequency_months, purchase_type')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  if (subscription.status !== 'active' && subscription.status !== 'paused') {
    return { success: false, error: 'Only active or paused subscriptions can be updated' }
  }

  // Get current and new subscription products
  const { data: currentSubProduct } = await supabase
    .from('subscription_products')
    .select('id, product_id, variant_id, available_frequencies, subscription_price, prepaid_price')
    .eq('id', subscription.subscription_product_id)
    .single()

  const { data: newSubProduct } = await supabase
    .from('subscription_products')
    .select('id, product_id, variant_id, available_frequencies, subscription_price, prepaid_price')
    .eq('id', newSubscriptionProductId)
    .single()

  if (!currentSubProduct || !newSubProduct) {
    return { success: false, error: 'Subscription product not found' }
  }

  // Check swap restrictions
  if (settings.allowSwappingProducts === 'same_plan') {
    // Check if both products are in the same "plan" (same product, different variant)
    if (currentSubProduct.product_id !== newSubProduct.product_id) {
      return { success: false, error: 'You can only swap to variants of the same product' }
    }
  }
  // 'any_plan' allows any swap

  // Verify new frequency is available for new product
  if (!newSubProduct.available_frequencies?.includes(subscription.frequency_months)) {
    return { success: false, error: `Frequency of ${subscription.frequency_months} month(s) is not available for the selected product` }
  }

  // Calculate new price based on purchase type
  const newPrice = subscription.purchase_type === 'prepaid' && newSubProduct.prepaid_price
    ? newSubProduct.prepaid_price
    : newSubProduct.subscription_price || 0

  // Update subscription product
  const { error: updateError } = await supabase
    .from('customer_subscriptions')
    .update({
      subscription_product_id: newSubscriptionProductId,
      price_per_cycle: newPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)

  if (updateError) {
    console.error('Error swapping product:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send email notification if enabled (subscription edited)
  try {
    if (settings.emailNotifications.subscriptionEdited) {
      const { data: subscriptionData } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_products!inner (
            products (title),
            product_variants (color, sku)
          ),
          profiles!inner (email, first_name, last_name)
        `)
        .eq('id', subscriptionId)
        .single()

      if (subscriptionData) {
        const { sendSubscriptionEditedEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendSubscriptionEditedEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending edit email:', emailError)
    // Don't fail the swap if email fails
  }

  revalidatePath('/account/subscriptions')
  return { success: true }
}
