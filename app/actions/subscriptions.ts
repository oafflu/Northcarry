'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logSystemAction } from '@/lib/system-logger'

export async function createSubscriptionProduct(data: {
  product_id: string
  variant_id: string
  is_subscription_enabled: boolean
  shipping_days: number
  one_time_price: number
  subscription_price: number | null
  prepaid_price: number | null
  available_frequencies: number[]
  status: 'active' | 'inactive'
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if subscription already exists for this product/variant
  const { data: existing } = await supabase
    .from('subscription_products')
    .select('id')
    .eq('product_id', data.product_id)
    .eq('variant_id', data.variant_id)
    .single()

  if (existing) {
    return { success: false, error: 'Subscription already exists for this product variant' }
  }

  const { data: subscriptionProduct, error } = await supabase
    .from('subscription_products')
    .insert({
      product_id: data.product_id,
      variant_id: data.variant_id,
      is_subscription_enabled: data.is_subscription_enabled,
      shipping_days: data.shipping_days,
      one_time_price: data.one_time_price,
      subscription_price: data.subscription_price,
      prepaid_price: data.prepaid_price,
      available_frequencies: data.available_frequencies,
      status: data.status,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating subscription product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/products')
  
  // Get product name for logging
  const { data: product } = await supabase
    .from('products')
    .select('title')
    .eq('id', data.product_id)
    .single()
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_product_created',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription product created for "${product?.title || data.product_id}"`,
    resourceType: 'subscription_product',
    resourceId: subscriptionProduct.id,
    actionDetails: {
      product_id: data.product_id,
      variant_id: data.variant_id,
      subscription_price: data.subscription_price,
      prepaid_price: data.prepaid_price,
      status: data.status,
    },
  })
  
  return { success: true, data: subscriptionProduct }
}

export async function updateSubscriptionProduct(
  id: string,
  data: Partial<{
    is_subscription_enabled: boolean
    shipping_days: number
    subscription_price: number | null
    prepaid_price: number | null
    available_frequencies: number[]
    status: 'active' | 'inactive'
  }>
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('subscription_products')
    .update(data)
    .eq('id', id)

  if (error) {
    console.error('Error updating subscription product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/products')
  return { success: true }
}

export async function deleteSubscriptionProduct(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if there are active subscriptions
  const { data: activeSubscriptions } = await supabase
    .from('customer_subscriptions')
    .select('id')
    .eq('subscription_product_id', id)
    .eq('status', 'active')
    .limit(1)

  if (activeSubscriptions && activeSubscriptions.length > 0) {
    return { success: false, error: 'Cannot delete subscription product with active subscriptions' }
  }

  // Check if this subscription product is used in any linked subscriptions
  const adminSupabase = createAdminSupabaseClient()
  const { data: linkedSubscriptions } = await adminSupabase
    .from('linked_subscriptions')
    .select('id, name')
    .eq('subscription_product_id', id)
    .eq('status', 'active')
    .limit(1)

  if (linkedSubscriptions && linkedSubscriptions.length > 0) {
    const linkedSubName = linkedSubscriptions[0].name || 'Untitled'
    return { 
      success: false, 
      error: `Cannot delete subscription product. It is used in linked subscription: "${linkedSubName}". Please delete or deactivate the linked subscription first.` 
    }
  }

  // Get subscription product details before deletion for logging
  const { data: subscriptionProduct } = await supabase
    .from('subscription_products')
    .select('product_id, products(title)')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('subscription_products')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting subscription product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions')
  revalidatePath('/admin/products')
  
  // Log the action
  await logSystemAction({
    actionType: 'subscription_product_deleted',
    actionCategory: 'subscriptions',
    actionDescription: `Subscription product ${id} deleted`,
    resourceType: 'subscription_product',
    resourceId: id,
    actionDetails: {
      product_title: (subscriptionProduct?.products as any)?.title || null,
    },
  })
  
  return { success: true }
}

export async function getSubscriptionProducts(useAdmin: boolean = false) {
  // Use admin client if requested (for admin pages) or server client (for regular use)
  const supabase = useAdmin 
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('subscription_products')
    .select(`
      *,
      products (id, title, slug, compare_at_price),
      product_variants (id, sku, color, price)
    `)
    .eq('status', 'active')
    .eq('is_subscription_enabled', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching subscription products:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getSubscriptionProductById(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { data: null, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('subscription_products')
    .select(`
      *,
      products (id, title, base_price, compare_at_price),
      product_variants (id, sku, color, price)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching subscription product:', error)
    return { data: null, error: error.message }
  }

  return { data: data || null, error: null }
}

export async function getSubscriptionProductsByProductId(productId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { data: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('subscription_products')
    .select(`
      *,
      products (id, title, base_price, compare_at_price),
      product_variants (id, sku, color, price)
    `)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching subscription products:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function bulkUpdateSubscriptionProducts(
  productId: string,
  variantIds: string[],
  data: {
    is_subscription_enabled: boolean
    shipping_days: number
    subscription_discount_percent?: number
    prepaid_discount_percent?: number
    available_frequencies: number[]
    status: 'active' | 'inactive'
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Get product data for compare_at_price
  const { data: productData } = await supabase
    .from('products')
    .select('base_price, compare_at_price')
    .eq('id', productId)
    .single()

  const comparePrice = productData?.compare_at_price 
    ? parseFloat(productData.compare_at_price.toString())
    : null
  const basePrice = productData?.base_price 
    ? parseFloat(productData.base_price.toString())
    : null

  // Get variants to calculate prices
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, price')
    .in('id', variantIds)

  if (!variants || variants.length === 0) {
    return { success: false, error: 'No variants found' }
  }

  // Calculate prices for each variant
  const updates = variantIds.map(variantId => {
    const variant = variants.find(v => v.id === variantId)
    if (!variant) return null

    const variantPrice = parseFloat(variant.price?.toString() || '0')
    const basePriceForSavings = (comparePrice && comparePrice > (basePrice || 0)) ? comparePrice : variantPrice

    const subscriptionPrice = data.subscription_discount_percent && data.subscription_discount_percent > 0
      ? basePriceForSavings * (1 - data.subscription_discount_percent / 100)
      : null

    const prepaidPrice = data.prepaid_discount_percent && data.prepaid_discount_percent > 0
      ? basePriceForSavings * (1 - data.prepaid_discount_percent / 100)
      : null

    return {
      variant_id: variantId,
      is_subscription_enabled: data.is_subscription_enabled,
      shipping_days: data.shipping_days,
      one_time_price: variantPrice,
      subscription_price: subscriptionPrice,
      prepaid_price: prepaidPrice,
      available_frequencies: data.available_frequencies,
      status: data.status,
    }
  }).filter(Boolean)

  // Update or insert subscription products
  let successCount = 0
  let errorCount = 0
  const errors: string[] = []

  for (const update of updates) {
    if (!update) continue

    // Check if subscription product exists
    const { data: existing } = await supabase
      .from('subscription_products')
      .select('id')
      .eq('product_id', productId)
      .eq('variant_id', update.variant_id)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('subscription_products')
        .update({
          is_subscription_enabled: update.is_subscription_enabled,
          shipping_days: update.shipping_days,
          subscription_price: update.subscription_price,
          prepaid_price: update.prepaid_price,
          available_frequencies: update.available_frequencies,
          status: update.status,
        })
        .eq('id', existing.id)

      if (error) {
        errorCount++
        errors.push(`Variant ${update.variant_id}: ${error.message}`)
      } else {
        successCount++
      }
    } else {
      // Insert new
      const { variant_id, ...updateWithoutVariantId } = update
      const { error } = await supabase
        .from('subscription_products')
        .insert({
          product_id: productId,
          variant_id: variant_id,
          ...updateWithoutVariantId,
        })

      if (error) {
        errorCount++
        errors.push(`Variant ${update.variant_id}: ${error.message}`)
      } else {
        successCount++
      }
    }
  }

  if (successCount > 0) {
    revalidatePath('/admin/subscriptions/products')
    revalidatePath('/admin/products')
    return { success: true, successCount, errorCount, errors }
  }

  return { success: false, error: errors.join('; ') }
}

export async function getCustomerSubscriptions(userId?: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const targetUserId = userId || user?.id
  if (!targetUserId) {
    return { data: [], error: 'Not authenticated' }
  }

  // Verify admin or same user
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin' && user?.id !== targetUserId) {
    return { data: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('customer_subscriptions')
    .select(`
      *,
      subscription_products (
        *,
        products (id, title),
        product_variants (id, sku, color, price)
      )
    `)
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching customer subscriptions:', error)
    return { data: [], error: error.message }
  }

  // Deduplicate by subscription id in case of duplicate rows
  const unique = (data || []).reduce((acc: Record<string, any>, sub: any) => {
    if (!acc[sub.id]) acc[sub.id] = sub
    return acc
  }, {})

  return { data: Object.values(unique), error: null }
}

export async function getAllSubscriptions() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Authentication error in getAllSubscriptions:', authError)
      return { data: [], error: 'Not authenticated' }
    }

    // Verify admin or partner
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return { data: [], error: 'Failed to verify user role' }
    }

    if (profile?.role !== 'admin' && profile?.role !== 'partner') {
      return { data: [], error: 'Unauthorized. Admin or partner access required.' }
    }

    // Use admin client to bypass RLS and ensure we get all data
    const adminSupabase = createAdminSupabaseClient()

    const { data, error } = await adminSupabase
      .from('customer_subscriptions')
      .select(`
        *,
        profiles!user_id (id, first_name, last_name, email),
        subscription_products (
          *,
          products (id, title),
          product_variants (id, sku, color, price)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return { data: [], error: error.message }
    }

    // Ensure data is serializable
    const serializableData = (data || []).map((sub: any) => ({
      ...sub,
      // Ensure dates are strings
      created_at: sub.created_at ? new Date(sub.created_at).toISOString() : null,
      updated_at: sub.updated_at ? new Date(sub.updated_at).toISOString() : null,
      next_billing_date: sub.next_billing_date || null,
      next_shipment_date: sub.next_shipment_date || null,
      cancelled_at: sub.cancelled_at ? new Date(sub.cancelled_at).toISOString() : null,
    }))

    return { data: serializableData, error: null }
  } catch (err: any) {
    console.error('Unexpected error in getAllSubscriptions:', err)
    return { data: [], error: err?.message || 'Failed to fetch subscriptions' }
  }
}

/**
 * Sync subscription statuses from Stripe for all subscriptions with stripe_subscription_id
 * This ensures local subscription statuses match Stripe's status
 */
export async function syncSubscriptionStatusesFromStripe() {
  const adminSupabase = createAdminSupabaseClient()
  
  try {
    // Get Stripe client - check database settings first, then environment variables
    let stripe: any = null
    try {
      // Try to get from settings first, fallback to environment variables
      const { data: setting } = await adminSupabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'stripe')
        .single()

      const settings = setting?.setting_value as any
      const apiKey = settings?.secret_key || process.env.STRIPE_SECRET_KEY

      if (!apiKey) {
        return { success: false, error: 'Stripe secret key is not configured. Please configure it in /admin/settings/payment or set STRIPE_SECRET_KEY environment variable.' }
      }

      const Stripe = (await import('stripe')).default
      stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' })
    } catch (stripeError: any) {
      console.error('Error initializing Stripe client:', stripeError)
      return { success: false, error: `Failed to initialize Stripe client: ${stripeError.message}` }
    }

    // Get all subscriptions with stripe_subscription_id
    const { data: subscriptions, error } = await adminSupabase
      .from('customer_subscriptions')
      .select('id, stripe_subscription_id, status, user_id')
      .not('stripe_subscription_id', 'is', null)

    if (error) {
      console.error('Error fetching subscriptions for status sync:', error)
      return { success: false, error: error.message, updated: 0, errors: [] }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, updated: 0, skipped: 0, errors: [], message: 'No subscriptions with Stripe IDs found' }
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const subscription of subscriptions) {
      try {
        // Retrieve subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id!)
        const stripeStatus = stripeSubscription.status

        // Map Stripe status to local status
        let newStatus: 'active' | 'paused' | 'cancelled' | 'expired' | 'completed' | null = null
        
        if (stripeStatus === 'active' || stripeStatus === 'trialing') {
          newStatus = 'active'
        } else if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') {
          newStatus = 'cancelled'
        } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') {
          newStatus = 'expired'
        } else if (stripeStatus === 'paused' || stripeStatus === 'incomplete') {
          newStatus = 'paused'
        }

        // Update if status changed
        if (newStatus && subscription.status !== newStatus) {
          const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
          }

          // Add cancelled_at if being cancelled
          if (newStatus === 'cancelled' && subscription.status !== 'cancelled') {
            updateData.cancelled_at = new Date().toISOString()
          }

          const { error: updateError } = await adminSupabase
            .from('customer_subscriptions')
            .update(updateData)
            .eq('id', subscription.id)

          if (updateError) {
            errors.push(`Subscription ${subscription.id}: ${updateError.message}`)
          } else {
            updated++
            console.log(`[Status Sync] Updated subscription ${subscription.id} from ${subscription.status} to ${newStatus} (Stripe: ${stripeStatus})`)
          }
        } else {
          skipped++
        }
      } catch (stripeError: any) {
        // If subscription not found in Stripe, mark as cancelled
        if (stripeError.code === 'resource_missing') {
          const { error: updateError } = await adminSupabase
            .from('customer_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', subscription.id)

          if (updateError) {
            errors.push(`Subscription ${subscription.id}: Failed to mark as cancelled - ${updateError.message}`)
          } else {
            updated++
            console.log(`[Status Sync] Stripe subscription ${subscription.stripe_subscription_id} not found, marked subscription ${subscription.id} as cancelled`)
          }
        } else {
          errors.push(`Subscription ${subscription.id}: ${stripeError.message || 'Unknown error'}`)
        }
      }
    }

    return {
      success: true,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${updated} subscription(s), skipped ${skipped} (no changes needed)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`,
    }
  } catch (err: any) {
    console.error('Error syncing subscription statuses from Stripe:', err)
    return { success: false, error: err?.message || 'Failed to sync statuses', updated: 0, skipped: 0, errors: [] }
  }
}

/**
 * Find duplicate subscriptions based on user_id, subscription_product_id, and purchase_type
 * Returns groups of duplicate subscriptions
 * Note: Only checks active and paused subscriptions - cancelled/expired are excluded
 */
export async function findDuplicateSubscriptions() {
  const adminSupabase = createAdminSupabaseClient()
  
  try {
    // Get all active and paused subscriptions (exclude cancelled/expired as they're not active duplicates)
    const { data: allSubscriptions, error } = await adminSupabase
      .from('customer_subscriptions')
      .select(`
        id,
        user_id,
        subscription_product_id,
        purchase_type,
        stripe_subscription_id,
        status,
        created_at,
        next_billing_date,
        next_shipment_date,
        profiles (email, first_name, last_name),
        subscription_products (
          products (title),
          product_variants (color)
        )
      `)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching subscriptions for duplicate check:', error)
      return { success: false, error: error.message, duplicates: [] }
    }

    if (!allSubscriptions || allSubscriptions.length === 0) {
      return { success: true, duplicates: [], message: 'No subscriptions found' }
    }

    // Group subscriptions by user_id + subscription_product_id + purchase_type
    const subscriptionGroups = new Map<string, any[]>()
    
    for (const sub of allSubscriptions) {
      const key = `${sub.user_id}_${sub.subscription_product_id}_${sub.purchase_type}`
      if (!subscriptionGroups.has(key)) {
        subscriptionGroups.set(key, [])
      }
      subscriptionGroups.get(key)!.push(sub)
    }

    // Find groups with more than one subscription (duplicates)
    const duplicates: Array<{
      key: string
      subscriptions: any[]
      recommendedKeep: string // ID of subscription to keep
      recommendedCancel: string[] // IDs of subscriptions to cancel
    }> = []

    for (const [key, subs] of subscriptionGroups.entries()) {
      if (subs.length > 1) {
        // Sort by: 1) Has stripe_subscription_id, 2) Most recent created_at, 3) Active status
        const sorted = [...subs].sort((a, b) => {
          // Prefer subscriptions with stripe_subscription_id
          if (a.stripe_subscription_id && !b.stripe_subscription_id) return -1
          if (!a.stripe_subscription_id && b.stripe_subscription_id) return 1
          
          // Prefer active over paused
          if (a.status === 'active' && b.status !== 'active') return -1
          if (a.status !== 'active' && b.status === 'active') return 1
          
          // Prefer most recent
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })

        const recommendedKeep = sorted[0].id
        const recommendedCancel = sorted.slice(1).map(s => s.id)

        duplicates.push({
          key,
          subscriptions: sorted,
          recommendedKeep,
          recommendedCancel,
        })
      }
    }

    return {
      success: true,
      duplicates,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.subscriptions.length - 1, 0),
      message: `Found ${duplicates.length} duplicate group(s) with ${duplicates.reduce((sum, d) => sum + d.subscriptions.length - 1, 0)} duplicate subscription(s)`,
    }
  } catch (err: any) {
    console.error('Error finding duplicate subscriptions:', err)
    return { success: false, error: err?.message || 'Failed to find duplicates', duplicates: [] }
  }
}

/**
 * Cancel duplicate subscriptions, keeping the recommended one
 * This will cancel subscriptions that are duplicates based on user_id + subscription_product_id + purchase_type
 */
export async function cancelDuplicateSubscriptions(dryRun: boolean = true) {
  const adminSupabase = createAdminSupabaseClient()
  
  try {
    const duplicateResult = await findDuplicateSubscriptions()
    
    if (!duplicateResult.success || !duplicateResult.duplicates || duplicateResult.duplicates.length === 0) {
      return {
        success: true,
        cancelled: 0,
        skipped: 0,
        message: 'No duplicate subscriptions found',
        details: [],
      }
    }

    let cancelled = 0
    let skipped = 0
    const details: string[] = []

    for (const duplicate of duplicateResult.duplicates) {
      const keepSub = duplicate.subscriptions.find(s => s.id === duplicate.recommendedKeep)
      const cancelSubs = duplicate.subscriptions.filter(s => duplicate.recommendedCancel.includes(s.id))

      for (const cancelSub of cancelSubs) {
        if (dryRun) {
          details.push(
            `[DRY RUN] Would cancel subscription ${cancelSub.id} (user: ${(cancelSub.profiles as any)?.email}, product: ${(cancelSub.subscription_products as any)?.products?.title}, created: ${new Date(cancelSub.created_at).toLocaleDateString()}), keeping ${keepSub?.id}`
          )
          skipped++
        } else {
          // Cancel the duplicate subscription
          const { error: cancelError } = await adminSupabase
            .from('customer_subscriptions')
            .update({
              status: 'cancelled',
              cancellation_reason: `Duplicate subscription - keeping ${duplicate.recommendedKeep}`,
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', cancelSub.id)

          if (cancelError) {
            details.push(`Error cancelling subscription ${cancelSub.id}: ${cancelError.message}`)
            skipped++
          } else {
            cancelled++
            details.push(
              `Cancelled duplicate subscription ${cancelSub.id} (user: ${(cancelSub.profiles as any)?.email}, product: ${(cancelSub.subscription_products as any)?.products?.title}), kept ${keepSub?.id}`
            )

            // Log the action
            await logSystemAction({
              actionType: 'subscription_cancelled',
              actionCategory: 'subscriptions',
              actionDescription: `Cancelled duplicate subscription ${cancelSub.id}`,
              resourceType: 'subscription',
              resourceId: cancelSub.id,
              actionDetails: {
                cancellation_reason: `Duplicate subscription - keeping ${duplicate.recommendedKeep}`,
                kept_subscription_id: duplicate.recommendedKeep,
              },
            })
          }
        }
      }
    }

    return {
      success: true,
      cancelled,
      skipped,
      message: dryRun
        ? `[DRY RUN] Would cancel ${skipped} duplicate subscription(s)`
        : `Cancelled ${cancelled} duplicate subscription(s), skipped ${skipped}`,
      details,
    }
  } catch (err: any) {
    console.error('Error cancelling duplicate subscriptions:', err)
    return {
      success: false,
      error: err?.message || 'Failed to cancel duplicates',
      cancelled: 0,
      skipped: 0,
      details: [],
    }
  }
}

/**
 * Create missing subscriptions from existing prepaid orders
 * This is a utility function to backfill subscriptions that should have been created during checkout
 */
export async function createSubscriptionsFromPrepaidOrders() {
  const adminSupabase = createAdminSupabaseClient()
  
  // Find order items with prepaid subscription items that don't have corresponding subscriptions
  // Query order_items directly and join with orders
  // Note: We don't filter by subscription_product_id because older orders might not have it
  const { data: orderItems, error: itemsError } = await adminSupabase
    .from('order_items')
    .select(`
      id,
      order_id,
      product_id,
      variant_id,
      quantity,
      purchase_type,
      subscription_product_id,
      orders (
        id,
        user_id,
        customer_email,
        created_at
      )
    `)
    .eq('purchase_type', 'prepaid')
    .limit(500) // Get more items, then sort in JS

  if (itemsError) {
    console.error('Error fetching prepaid order items:', itemsError)
    return { success: false, error: itemsError.message, created: 0 }
  }

  if (!orderItems || orderItems.length === 0) {
    return { success: true, message: 'No prepaid subscription orders found', created: 0 }
  }

  // Filter out items without order data and sort by order created_at (most recent first)
  // Note: We allow items without subscription_product_id - we'll look it up from variant_id
  const validOrderItems = (orderItems as any[])
    .filter((item: any) => item.orders && item.orders.user_id && item.variant_id)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.orders?.created_at || 0).getTime()
      const dateB = new Date(b.orders?.created_at || 0).getTime()
      return dateB - dateA // Descending order (most recent first)
    })
    .slice(0, 100) // Limit to 100 most recent

  if (validOrderItems.length === 0) {
    return { success: true, message: 'No prepaid subscription order items found', created: 0 }
  }

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const item of validOrderItems) {
    const order = item.orders as any
    if (!order?.user_id) {
      skipped++
      continue // Skip guest orders
    }
    
    // Get subscription_product_id - either from order_item or look it up from variant_id
    let subscriptionProductId = item.subscription_product_id
    
    // If subscription_product_id is missing, look it up from variant_id
    if (!subscriptionProductId && item.variant_id) {
      const { data: subProductByVariant, error: variantLookupError } = await adminSupabase
        .from('subscription_products')
        .select('id')
        .eq('variant_id', item.variant_id)
        .eq('status', 'active')
        .maybeSingle() // Use maybeSingle() instead of single() to avoid error if not found
      
      if (subProductByVariant) {
        subscriptionProductId = subProductByVariant.id
        if (process.env.NODE_ENV === 'development') {
          console.log(`[createSubscriptionsFromPrepaidOrders] Looked up subscription_product_id ${subscriptionProductId} from variant ${item.variant_id} for order ${order.id}`)
        }
      } else {
        errors.push(`No subscription product found for variant ${item.variant_id} in order ${order.id} (customer: ${order.customer_email})`)
        continue
      }
    }
    
    if (!subscriptionProductId) {
      errors.push(`No subscription product ID found for order item ${item.id} in order ${order.id}`)
      continue
    }
    
    // Check if subscription already exists for this order item
    // We need to be more specific - check if a subscription exists that was created
    // from THIS specific order_item, not just any subscription for the user/product
    
    // First, check if there's a subscription_order linking to the original order
    // (this happens when subscription is created during checkout and linked to original order)
    const { data: existingSubOrders } = await adminSupabase
      .from('subscription_orders')
      .select(`
        subscription_id,
        customer_subscriptions!inner (
          id,
          subscription_product_id,
          purchase_type
        )
      `)
      .eq('order_id', order.id)
      .limit(1)

    // If we found a subscription_order linked to this order, check if it matches our subscription_product_id
    if (existingSubOrders && existingSubOrders.length > 0) {
      const linkedSub = existingSubOrders[0].customer_subscriptions as any
      if (linkedSub && linkedSub.subscription_product_id === subscriptionProductId && linkedSub.purchase_type === 'prepaid') {
        skipped++
        if (process.env.NODE_ENV === 'development') {
          console.log(`[createSubscriptionsFromPrepaidOrders] Skipping order ${order.id} - subscription ${linkedSub.id} already linked via subscription_orders`)
        }
        continue // Subscription already exists and is linked to this order
      }
    }

    // Check if a subscription already exists for this user + product + purchase_type combination
    // This is more comprehensive than checking within a time window
    // We check ALL existing subscriptions, not just recent ones
    const { data: existingSubs } = await adminSupabase
      .from('customer_subscriptions')
      .select('id, created_at, status, stripe_subscription_id')
      .eq('user_id', order.user_id)
      .eq('subscription_product_id', subscriptionProductId)
      .eq('purchase_type', 'prepaid')
      .in('status', ['active', 'paused', 'completed']) // Include completed in case it's still relevant
      .order('created_at', { ascending: false })

    // If we found any existing subscription for this combination, skip creating a new one
    // The existing subscription might have been created from this order or another order
    // We'll let the deduplication function handle identifying true duplicates
    if (existingSubs && existingSubs.length > 0) {
      skipped++
      const existingSub = existingSubs[0] // Get the most recent one
      if (process.env.NODE_ENV === 'development') {
        console.log(`[createSubscriptionsFromPrepaidOrders] Skipping order ${order.id} - subscription ${existingSub.id} already exists for user ${order.user_id} and product ${subscriptionProductId} (status: ${existingSub.status}, created: ${new Date(existingSub.created_at).toLocaleDateString()})`)
      }
      continue // Subscription already exists for this combination
    }

    // Get subscription product details
    const { data: subProduct, error: productError } = await adminSupabase
      .from('subscription_products')
      .select('*, products(id, title), product_variants(id, sku, color, price)')
      .eq('id', subscriptionProductId)
      .single()

    if (productError || !subProduct) {
      errors.push(`Subscription product not found for order ${order.id}: ${productError?.message}`)
      continue
    }

    // Get user's default shipping address
    const { data: addresses } = await adminSupabase
      .from('addresses')
      .select('id')
      .eq('user_id', order.user_id)
      .eq('is_default', true)
      .limit(1)

    const shippingAddressId = addresses && addresses.length > 0 ? addresses[0].id : null

    // Calculate frequency (default to 3 months for prepaid, or use available_frequencies)
    const availableFrequencies = subProduct.available_frequencies || [3]
    const frequency = availableFrequencies[0] || 3 // Use first available frequency
    const pricePerCycle = subProduct.prepaid_price || subProduct.subscription_price || 0
    
    if (pricePerCycle <= 0) {
      errors.push(`Invalid price for subscription product ${subscriptionProductId} in order ${order.id}`)
      continue
    }

    const totalPrepaidAmount = pricePerCycle * item.quantity * frequency
    const shippingDays = subProduct.shipping_days || 14

    // Calculate dates based on order creation date
    const orderDate = new Date(order.created_at)
    const billingIntervalDays = shippingDays * frequency
    const nextBillingDate = new Date(orderDate.getTime() + billingIntervalDays * 24 * 60 * 60 * 1000)
    const nextShipmentDate = new Date(orderDate.getTime() + shippingDays * 24 * 60 * 60 * 1000)

    // Create subscription
    const { data: newSubscription, error: subError } = await adminSupabase
      .from('customer_subscriptions')
      .insert({
        user_id: order.user_id,
        subscription_product_id: subscriptionProductId,
        frequency_months: frequency,
        purchase_type: 'prepaid',
        quantity: item.quantity,
        price_per_cycle: pricePerCycle,
        total_prepaid_amount: totalPrepaidAmount,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
        shipping_address_id: shippingAddressId,
        billing_address_id: shippingAddressId,
        prepaid_cycles_remaining: frequency,
        status: 'active',
      })
      .select()
      .single()

    if (subError) {
      errors.push(`Failed to create subscription for order ${order.id} (customer: ${order.customer_email}): ${subError.message}`)
      if (process.env.NODE_ENV === 'development') {
        console.error(`[createSubscriptionsFromPrepaidOrders] Error creating subscription:`, {
          orderId: order.id,
          customerEmail: order.customer_email,
          subscriptionProductId,
          error: subError,
        })
      }
    } else {
      created++
      if (process.env.NODE_ENV === 'development') {
        console.log(`[createSubscriptionsFromPrepaidOrders] Created subscription:`, {
          subscriptionId: newSubscription?.id,
          orderId: order.id,
          customerEmail: order.customer_email,
          subscriptionProductId,
        })
      }
    }
  }

  // Log summary
  console.log(`[createSubscriptionsFromPrepaidOrders] Summary:`, {
    total: validOrderItems.length,
    created,
    skipped,
    errors: errors.length,
  })

  if (errors.length > 0 && process.env.NODE_ENV === 'development') {
    console.error(`[createSubscriptionsFromPrepaidOrders] Errors:`, errors)
  }

  return {
    success: true,
    created,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    message: `Created ${created} subscription(s) from prepaid orders (${skipped} already existed${errors.length > 0 ? `, ${errors.length} error(s)` : ''})`,
  }
}

export async function createSubscriptionOrder(
  subscriptionId: string,
  cycleNumber: number,
  billingDate: string,
  shipmentDate: string
) {
  const adminSupabase = createAdminSupabaseClient()
  const supabase = await createServerSupabaseClient()
  
  // Get subscription details (use admin client to bypass RLS)
  const { data: subscription } = await adminSupabase
    .from('customer_subscriptions')
    .select(`
      *,
      subscription_products (
        *,
        products (id, title),
        product_variants (id, sku, color, price)
      )
    `)
    .eq('id', subscriptionId)
    .single()

  if (!subscription) {
    return { success: false, error: 'Subscription not found' }
  }

  const subProduct = subscription.subscription_products
  const product = subProduct?.products
  const variant = subProduct?.product_variants

  if (!product || !variant) {
    return { success: false, error: 'Product or variant not found' }
  }

  // Get customer email from profile
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', subscription.user_id)
    .single()

  // Get shipping address - try subscription address_id first, then default shipping address
  let shippingAddress = null
  
  if (subscription.shipping_address_id) {
    const { data: address } = await adminSupabase
      .from('addresses')
      .select('*')
      .eq('id', subscription.shipping_address_id)
      .single()
    
    if (address) {
      shippingAddress = {
        address_line1: address.address_line1 || '',
        address_line2: address.address_line2 || null,
        city: address.city || '',
        state: address.state || null,
        postal_code: address.postal_code || null,
        country: address.country || 'US',
        phone: address.phone || null,
      }
    }
  }
  
  // If no address from subscription, try to get default shipping address for user
  if (!shippingAddress) {
    const { data: defaultAddress } = await adminSupabase
      .from('addresses')
      .select('*')
      .eq('user_id', subscription.user_id)
      .eq('type', 'shipping')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    
    if (defaultAddress) {
      shippingAddress = {
        address_line1: defaultAddress.address_line1 || '',
        address_line2: defaultAddress.address_line2 || null,
        city: defaultAddress.city || '',
        state: defaultAddress.state || null,
        postal_code: defaultAddress.postal_code || null,
        country: defaultAddress.country || 'US',
        phone: defaultAddress.phone || null,
      }
    }
  }
  
  // If still no address, create a minimal address object to satisfy database constraint
  // Use customer name and email as fallback
  if (!shippingAddress) {
    shippingAddress = {
      address_line1: '',
      address_line2: null,
      city: '',
      state: null,
      postal_code: null,
      country: 'US',
      phone: null,
    }
  }

  // Create order for this subscription cycle
  const orderNumber = `SUB-${subscriptionId.substring(0, 8)}-${cycleNumber}`
  
  const orderData: any = {
    order_number: orderNumber,
    user_id: subscription.user_id,
    customer_email: profile?.email || '',
    customer_first_name: profile?.first_name || '',
    customer_last_name: profile?.last_name || '',
    subtotal: parseFloat(subscription.price_per_cycle.toString()),
    shipping_cost: 0,
    tax_amount: 0,
    total: parseFloat(subscription.price_per_cycle.toString()),
    payment_status: subscription.purchase_type === 'prepaid' ? 'paid' : 'pending', // Prepaid already paid
    fulfillment_status: 'unfulfilled',
  }

  // Always add shipping address (required by database constraint)
    orderData.shipping_address = shippingAddress
    orderData.billing_address = shippingAddress // Use shipping as billing for now

  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert(orderData)
    .select()
    .single()

  if (orderError || !order) {
    console.error('Error creating subscription order:', orderError)
    return { success: false, error: orderError?.message || 'Failed to create order' }
  }

  // Create order item (use admin client)
  await adminSupabase.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    variant_id: variant.id,
    product_title: product.title,
    variant_color: variant.color,
    sku: variant.sku,
    quantity: subscription.quantity,
    unit_price: subscription.price_per_cycle,
    line_total: (parseFloat(subscription.price_per_cycle.toString()) * subscription.quantity).toFixed(2),
    purchase_type: subscription.purchase_type === 'prepaid' ? 'prepaid' : 'subscription',
    subscription_product_id: subscription.subscription_product_id, // Include subscription_product_id
  })

  // Create subscription_order link (use admin client)
  await adminSupabase.from('subscription_orders').insert({
    subscription_id: subscriptionId,
    order_id: order.id,
    cycle_number: cycleNumber,
    billing_date: billingDate,
    shipment_date: shipmentDate,
    status: 'pending',
  })

  // Assign order to suppliers based on product_supplier_links
  try {
    const { data: supplierLinks } = await adminSupabase
      .from('product_supplier_links')
      .select('supplier_id')
      .eq('variant_id', variant.id)
      .eq('is_primary_supplier', true)

    if (supplierLinks && supplierLinks.length > 0) {
      const uniqueSupplierIds = [...new Set(supplierLinks.map(link => link.supplier_id))]
      
      for (const supplierId of uniqueSupplierIds) {
        await adminSupabase
          .from('supplier_order_assignments')
          .insert({
            order_id: order.id,
            supplier_id: supplierId,
            assignment_status: 'pending',
          })
      }
      
      console.log(`Assigned subscription order ${order.order_number} to ${uniqueSupplierIds.length} supplier(s)`)
    }
  } catch (assignmentError) {
    console.error('Error assigning subscription order to suppliers:', assignmentError)
    // Don't fail order creation if assignment fails
  }

  // Send admin notification email for subscription orders
  try {
    const { sendAdminNewOrderEmail } = await import('@/lib/email')
    
    // Get order items for admin email
    const { data: orderItemsData } = await adminSupabase
      .from('order_items')
      .select('product_title, variant_color, quantity, unit_price, line_total')
      .eq('order_id', order.id)

    if (orderItemsData && orderItemsData.length > 0) {
      const customerName = profile 
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Customer'
        : 'Customer'
      
      await sendAdminNewOrderEmail(
        order.order_number,
        customerName,
        profile?.email || subscription.user_id,
        order.total.toFixed(2),
        orderItemsData.map(item => ({
          product_title: item.product_title,
          variant_color: item.variant_color || undefined,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }))
      )
      console.log(`[Subscription Order] Admin notification email sent for order ${order.order_number}`)
    }
  } catch (error) {
    console.error('Error sending admin notification email for subscription order:', error)
    // Don't fail order creation if email fails
  }

  return { success: true, data: order }
}

// ============================================
// LINKED SUBSCRIPTIONS
// ============================================

export async function getAllLinkedSubscriptions() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('linked_subscriptions')
    .select(`
      *,
      trigger_product:products!linked_subscriptions_trigger_product_id_fkey (
        id,
        title,
        slug
      ),
      trigger_variant:product_variants!linked_subscriptions_trigger_variant_id_fkey (
        id,
        color,
        sku
      ),
      subscription_product:subscription_products!linked_subscriptions_subscription_product_id_fkey (
        id,
        products (
          id,
          title,
          slug
        ),
        product_variants (
          id,
          color,
          sku
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getLinkedSubscription(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('linked_subscriptions')
    .select(`
      *,
      trigger_product:products!linked_subscriptions_trigger_product_id_fkey (
        id,
        title,
        slug
      ),
      trigger_variant:product_variants!linked_subscriptions_trigger_variant_id_fkey (
        id,
        color,
        sku
      ),
      subscription_product:subscription_products!linked_subscriptions_subscription_product_id_fkey (
        id,
        products (
          id,
          title,
          slug
        ),
        product_variants (
          id,
          color,
          sku
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Get active linked subscriptions for a product (where product is the trigger)
 * This is used to display subscription options on the trigger product page
 */
export async function getLinkedSubscriptionsForProduct(productId: string, variantId?: string) {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('linked_subscriptions')
    .select(`
      *,
      subscription_product:subscription_products!linked_subscriptions_subscription_product_id_fkey (
        id,
        variant_id,
        subscription_price,
        prepaid_price,
        available_frequencies,
        shipping_days,
        products (
          id,
          title,
          slug
        ),
        product_variants (
          id,
          color,
          sku,
          price
        )
      )
    `)
    .eq('trigger_product_id', productId)
    .eq('status', 'active')

  // If variant is specified, filter by variant or null (all variants)
  if (variantId) {
    query = query.or(`trigger_variant_id.eq.${variantId},trigger_variant_id.is.null`)
  } else {
    query = query.is('trigger_variant_id', null)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching linked subscriptions for product:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function createLinkedSubscription(data: {
  trigger_product_id: string
  trigger_variant_id?: string
  subscription_product_id: string
  frequency_months?: number
  purchase_type?: 'ongoing' | 'prepaid'
  quantity?: number
  min_quantity?: number
  auto_activate?: boolean
  name?: string
  description?: string
  status?: 'active' | 'inactive'
  start_after_months?: number
  billing_days_before_delivery?: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: linkedSubscription, error } = await adminSupabase
    .from('linked_subscriptions')
    .insert({
      trigger_product_id: data.trigger_product_id,
      trigger_variant_id: data.trigger_variant_id || null,
      subscription_product_id: data.subscription_product_id,
      frequency_months: data.frequency_months || 1,
      purchase_type: data.purchase_type || 'ongoing',
      quantity: data.quantity || 1,
      start_after_months: data.start_after_months || 2,
      billing_days_before_delivery: data.billing_days_before_delivery || 15,
      min_quantity: data.min_quantity || 1,
      auto_activate: data.auto_activate !== false,
      name: data.name || null,
      description: data.description || null,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions/linked')
  return { success: true, data: linkedSubscription }
}

export async function updateLinkedSubscription(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('linked_subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions/linked')
  return { success: true, data }
}

export async function deleteLinkedSubscription(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('linked_subscriptions')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/subscriptions/linked')
  return { success: true }
}

/**
 * Check for linked subscriptions and create them automatically
 * Called after order creation when trigger products are purchased
 */
export async function processLinkedSubscriptions(
  orderId: string,
  userId: string,
  orderItems: Array<{ product_id: string; variant_id: string; quantity: number }>,
  shippingAddressId?: string,
  billingAddressId?: string
) {
  const adminSupabase = createAdminSupabaseClient()

  try {
    // Get all active linked subscriptions
    const { data: linkedSubscriptions, error: linkedError } = await adminSupabase
      .from('linked_subscriptions')
      .select(`
        *,
        subscription_product:subscription_products!linked_subscriptions_subscription_product_id_fkey (
          *
        )
      `)
      .eq('status', 'active')

    if (linkedError || !linkedSubscriptions || linkedSubscriptions.length === 0) {
      return { success: true, created: [] }
    }

    const createdSubscriptions: string[] = []

    // Check each order item against linked subscriptions
    for (const orderItem of orderItems) {
      for (const linkedSub of linkedSubscriptions) {
        // Check if this order item matches the trigger product
        const matchesProduct = linkedSub.trigger_product_id === orderItem.product_id
        const matchesVariant = !linkedSub.trigger_variant_id || linkedSub.trigger_variant_id === orderItem.variant_id
        const meetsMinQuantity = orderItem.quantity >= (linkedSub.min_quantity || 1)

        if (matchesProduct && matchesVariant && meetsMinQuantity) {
          const subProduct = linkedSub.subscription_product as any
          
          if (!subProduct || !subProduct.is_subscription_enabled) {
            console.warn(`Linked subscription ${linkedSub.id} references invalid subscription product`)
            continue
          }

          // Calculate price per cycle
          const pricePerCycle = linkedSub.purchase_type === 'prepaid' && subProduct.prepaid_price
            ? parseFloat(subProduct.prepaid_price.toString())
            : subProduct.subscription_price
              ? parseFloat(subProduct.subscription_price.toString())
              : 0

          if (pricePerCycle <= 0) {
            console.warn(`Linked subscription ${linkedSub.id} has invalid pricing`)
            continue
          }

          // Calculate start delay (for products that come with initial supply)
          const startAfterMonths = linkedSub.start_after_months || 2
          const billingDaysBeforeDelivery = linkedSub.billing_days_before_delivery || 15
          
          // Calculate first delivery date (start_after_months from now)
          const now = new Date()
          const firstDeliveryDate = new Date(now)
          firstDeliveryDate.setMonth(firstDeliveryDate.getMonth() + startAfterMonths)
          
          // Calculate first billing date (billing_days_before_delivery before first delivery)
          const firstBillingDate = new Date(firstDeliveryDate)
          firstBillingDate.setDate(firstBillingDate.getDate() - billingDaysBeforeDelivery)

          try {
            // Create the subscription with custom dates
            const adminSupabase = createAdminSupabaseClient()
            
            // Get subscription product details
            const { data: subscriptionProduct } = await adminSupabase
              .from('subscription_products')
              .select('*')
              .eq('id', linkedSub.subscription_product_id)
              .single()

            if (!subscriptionProduct) {
              console.warn(`Subscription product not found for linked subscription ${linkedSub.id}`)
              continue
            }

            // Get Stripe customer ID if available
            const { data: profile } = await adminSupabase
              .from('profiles')
              .select('stripe_customer_id')
              .eq('id', userId)
              .single()

            // For prepaid subscriptions, calculate total prepaid amount
            let totalPrepaidAmount: number | null = null
            let prepaidCyclesRemaining: number = 0

            if (linkedSub.purchase_type === 'prepaid' && linkedSub.frequency_months) {
              totalPrepaidAmount = pricePerCycle * (linkedSub.quantity || 1) * linkedSub.frequency_months
              prepaidCyclesRemaining = linkedSub.frequency_months
            }

            // Create customer subscription with custom dates
            const { data: customerSubscription, error: subscriptionError } = await adminSupabase
              .from('customer_subscriptions')
              .insert({
                user_id: userId,
                subscription_product_id: linkedSub.subscription_product_id,
                frequency_months: linkedSub.frequency_months || 1,
                purchase_type: linkedSub.purchase_type || 'ongoing',
                quantity: linkedSub.quantity || 1,
                price_per_cycle: pricePerCycle,
                total_prepaid_amount: totalPrepaidAmount,
                next_billing_date: firstBillingDate.toISOString().split('T')[0],
                next_shipment_date: firstDeliveryDate.toISOString().split('T')[0],
                shipping_address_id: shippingAddressId || null,
                billing_address_id: billingAddressId || null,
                prepaid_cycles_remaining: prepaidCyclesRemaining,
                stripe_customer_id: profile?.stripe_customer_id || null,
                status: 'active',
              })
              .select()
              .single()

            if (subscriptionError || !customerSubscription) {
              console.error(`Error creating linked subscription ${linkedSub.id}:`, subscriptionError)
              continue
            }

            // Create the first cycle's order for the first delivery date
            try {
              await createSubscriptionOrder(
                customerSubscription.id,
                1, // First cycle
                firstBillingDate.toISOString().split('T')[0],
                firstDeliveryDate.toISOString().split('T')[0]
              )
              console.log(`Created first cycle order for linked subscription ${customerSubscription.id}`)
            } catch (orderError) {
              console.error('Error creating first cycle order:', orderError)
              // Don't fail subscription creation if order creation fails
            }

            createdSubscriptions.push(linkedSub.id)
            console.log(`Created linked subscription ${linkedSub.id} for order ${orderId}`)
          } catch (error: any) {
            console.error(`Error creating linked subscription ${linkedSub.id}:`, error)
            // Continue processing other linked subscriptions
          }
        }
      }
    }

    // Log the action
  await logSystemAction({
    actionType: 'customer_subscription_created',
    actionCategory: 'subscriptions',
    actionDescription: `Customer subscription created for user ${data.userId}`,
    resourceType: 'subscription',
    resourceId: customerSubscription.id,
    actionDetails: {
      subscription_product_id: data.subscriptionProductId,
      purchase_type: data.purchaseType,
      frequency_months: data.frequencyMonths,
      quantity: data.quantity,
      price_per_cycle: data.pricePerCycle,
      linked_subscriptions_created: createdSubscriptions.length,
    },
  })

  return { success: true, created: createdSubscriptions }
  } catch (error: any) {
    console.error('Error processing linked subscriptions:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'customer_subscription_created',
      actionCategory: 'subscriptions',
      actionDescription: `Failed to create customer subscription: ${error.message}`,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message, created: [] }
  }
}

/**
 * Create a customer subscription after checkout
 */
export async function createCustomerSubscription(data: {
  userId: string
  subscriptionProductId: string
  frequencyMonths: number
  purchaseType: 'ongoing' | 'prepaid'
  quantity: number
  pricePerCycle: number
  shippingAddressId?: string
  billingAddressId?: string
  shippingDays: number
  totalPrepaidAmount?: number
  prepaidCycles?: number
  stripeSubscriptionId?: string
  /** When set (e.g. from checkout), link the first cycle to this order instead of creating a new one (one order for cart) */
  existingOrderId?: string
}) {
  const adminSupabase = createAdminSupabaseClient()

  // Get subscription product details with variant and product for order_items
  const { data: subscriptionProduct, error: productError } = await adminSupabase
    .from('subscription_products')
    .select(`
      *,
      product_variants (id, product_id, color, sku, price, products (id, title))
    `)
    .eq('id', data.subscriptionProductId)
    .single()

  if (productError || !subscriptionProduct) {
    console.error('Error fetching subscription product:', productError)
    return { success: false, error: 'Subscription product not found' }
  }

  // Calculate billing interval in days based on shipping days and frequency
  // Billing should occur within the shipping time window
  const billingIntervalDays = data.shippingDays * data.frequencyMonths

  // Calculate next billing and shipment dates
  const now = new Date()
  const nextBillingDate = new Date(now.getTime() + billingIntervalDays * 24 * 60 * 60 * 1000)
  const nextShipmentDate = new Date(now.getTime() + data.shippingDays * 24 * 60 * 60 * 1000)

  // For prepaid subscriptions, calculate total prepaid amount and cycles remaining
  let totalPrepaidAmount: number | null = null
  let prepaidCyclesRemaining: number = 0

  if (data.purchaseType === 'prepaid') {
    // frequencyMonths is delivery interval (every N months); prepaidCycles controls how many deliveries are paid upfront.
    const prepaidCycles = data.prepaidCycles || 1
    totalPrepaidAmount = data.totalPrepaidAmount || (data.pricePerCycle * data.quantity * prepaidCycles)
    prepaidCyclesRemaining = prepaidCycles
  }

  // Get Stripe customer ID if available
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', data.userId)
    .single()

  let customerSubscription: Record<string, unknown> & { id: string } | null = null

  // Idempotency: webhook customer.subscription.created may insert first — avoid duplicate rows
  if (data.stripeSubscriptionId) {
    const { data: existingByStripe } = await adminSupabase
      .from('customer_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', data.stripeSubscriptionId)
      .eq('user_id', data.userId)
      .maybeSingle()

    if (existingByStripe) {
      if (existingByStripe.subscription_product_id !== data.subscriptionProductId) {
        console.error('Stripe subscription already linked to a different product', {
          stripeSubscriptionId: data.stripeSubscriptionId,
          existingProductId: existingByStripe.subscription_product_id,
          requestedProductId: data.subscriptionProductId,
        })
        return { success: false, error: 'Subscription already exists for this payment' }
      }
      customerSubscription = existingByStripe
      console.log(
        'Using existing customer_subscription (idempotent, webhook or retry):',
        existingByStripe.id
      )
    }
  }

  if (!customerSubscription) {
    const { data: inserted, error: subscriptionError } = await adminSupabase
      .from('customer_subscriptions')
      .insert({
        user_id: data.userId,
        subscription_product_id: data.subscriptionProductId,
        frequency_months: data.frequencyMonths,
        purchase_type: data.purchaseType,
        quantity: data.quantity,
        price_per_cycle: data.pricePerCycle,
        total_prepaid_amount: totalPrepaidAmount,
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
        shipping_address_id: data.shippingAddressId || null,
        billing_address_id: data.billingAddressId || null,
        prepaid_cycles_remaining: prepaidCyclesRemaining,
        stripe_subscription_id: data.stripeSubscriptionId || null,
        stripe_customer_id: profile?.stripe_customer_id || null,
        status: 'active',
      })
      .select()
      .single()

    if (subscriptionError || !inserted) {
      console.error('Error creating customer subscription:', subscriptionError, {
        userId: data.userId,
        subscriptionProductId: data.subscriptionProductId,
        purchaseType: data.purchaseType,
        error: subscriptionError,
      })
      return { success: false, error: subscriptionError?.message || 'Failed to create subscription' }
    }
    customerSubscription = inserted
  }

  // Log successful creation for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('Successfully created customer subscription:', {
      subscriptionId: customerSubscription.id,
      userId: data.userId,
      subscriptionProductId: data.subscriptionProductId,
      purchaseType: data.purchaseType,
      frequencyMonths: data.frequencyMonths,
    })
  }

  // First cycle: either link to existing order (checkout one-order flow) or create a new subscription order
  const firstShipmentDate = new Date(now.getTime() + data.shippingDays * 24 * 60 * 60 * 1000)
  const firstBillingDate = data.purchaseType === 'prepaid'
    ? now.toISOString().split('T')[0]
    : firstShipmentDate.toISOString().split('T')[0]

  const { data: existingCycle1 } = await adminSupabase
    .from('subscription_orders')
    .select('id, order_id')
    .eq('subscription_id', customerSubscription.id)
    .eq('cycle_number', 1)
    .maybeSingle()

  if (data.existingOrderId) {
    // Link first cycle to the existing checkout order (one order for cart with trigger + subscription items)
    try {
      const variant = (subscriptionProduct as any).product_variants
      const product = variant?.products || (subscriptionProduct as any).products
      if (variant?.id && product?.id) {
        if (!existingCycle1) {
          const { data: existingOi } = await adminSupabase
            .from('order_items')
            .select('id')
            .eq('order_id', data.existingOrderId)
            .eq('subscription_product_id', data.subscriptionProductId)
            .maybeSingle()

          if (!existingOi) {
            await adminSupabase.from('order_items').insert({
              order_id: data.existingOrderId,
              product_id: product.id,
              variant_id: variant.id,
              product_title: product.title || 'Subscription',
              variant_color: variant.color || 'Unknown',
              sku: variant.sku || 'N/A',
              quantity: data.quantity,
              unit_price: String(data.pricePerCycle),
              line_total: (data.pricePerCycle * data.quantity).toFixed(2),
              purchase_type: data.purchaseType === 'prepaid' ? 'prepaid' : 'subscription',
              subscription_product_id: data.subscriptionProductId,
              frequency_months: data.frequencyMonths,
              prepaid_cycles_remaining: data.purchaseType === 'prepaid' ? (data.prepaidCycles || 1) : null,
            })
          }
          await adminSupabase.from('subscription_orders').insert({
            subscription_id: customerSubscription.id,
            order_id: data.existingOrderId,
            cycle_number: 1,
            billing_date: firstBillingDate,
            shipment_date: firstShipmentDate.toISOString().split('T')[0],
            status: data.purchaseType === 'prepaid' ? 'completed' : 'pending',
          })
          console.log(`Linked subscription ${customerSubscription.id} cycle 1 to existing order ${data.existingOrderId}`)
        } else if (existingCycle1.order_id !== data.existingOrderId) {
          console.warn('Cycle 1 already linked to a different order; skipping duplicate link', {
            subscriptionId: customerSubscription.id,
            existingOrderId: existingCycle1.order_id,
            requestedOrderId: data.existingOrderId,
          })
        }
      } else if (!existingCycle1) {
        await createSubscriptionOrder(
          customerSubscription.id,
          1,
          firstBillingDate,
          firstShipmentDate.toISOString().split('T')[0]
        )
      }
    } catch (linkError) {
      console.error('Error linking subscription to existing order:', linkError)
      if (!existingCycle1) {
        try {
          await createSubscriptionOrder(
            customerSubscription.id,
            1,
            firstBillingDate,
            firstShipmentDate.toISOString().split('T')[0]
          )
        } catch (orderError) {
          console.error('Error creating first cycle order:', orderError)
        }
      }
    }
  } else {
    try {
      if (!existingCycle1) {
        await createSubscriptionOrder(
          customerSubscription.id,
          1,
          firstBillingDate,
          firstShipmentDate.toISOString().split('T')[0]
        )
        console.log(`Created first cycle order for subscription ${customerSubscription.id}`)
      }
    } catch (orderError) {
      console.error('Error creating first cycle order:', orderError)
    }
  }

  // Send new subscription email notification if enabled (async, don't wait)
  try {
    const { getSubscriptionSettings } = await import('@/app/actions/subscription-settings')
    const settingsResult = await getSubscriptionSettings()
    
    if (settingsResult.data?.emailNotifications.newSubscription) {
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
        .eq('id', customerSubscription.id)
        .single()

      if (subscriptionData) {
        const { sendNewSubscriptionEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        // Send email asynchronously (don't wait for it)
        sendNewSubscriptionEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription',
          (subscriptionData.subscription_products as any)?.product_variants?.color || '',
          (subscriptionData.subscription_products as any)?.product_variants?.sku || ''
        ).catch((emailErr) => {
          console.error('Error sending subscription email:', emailErr)
        })
      }
    }
  } catch (emailError) {
    console.error('Error sending new subscription email:', emailError)
    // Don't fail subscription creation if email fails
  }

  return {
    success: true,
    data: customerSubscription,
    subscription: customerSubscription,
  }
}

// Helper function to send subscription email notification (for use elsewhere)
export async function sendSubscriptionEmailNotification(subscriptionId: string) {
  try {
    const adminSupabase = createAdminSupabaseClient()
    const { getSubscriptionSettings } = await import('@/app/actions/subscription-settings')
    const settingsResult = await getSubscriptionSettings()
    
    if (settingsResult.data?.emailNotifications.newSubscription) {
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
        const { sendNewSubscriptionEmail } = await import('@/lib/email')
        const profile = subscriptionData.profiles as any
        const product = (subscriptionData.subscription_products as any)?.products
        
        await sendNewSubscriptionEmail(
          profile.email,
          `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer',
          product?.title || 'Subscription'
        )
      }
    }
  } catch (emailError) {
    console.error('Error sending new subscription email:', emailError)
  }
}

/**
 * Get subscription analytics data
 */
export async function getSubscriptionAnalytics(filters?: {
  productId?: string
  variantId?: string
  subscriptionProductId?: string
  startDate?: string
  endDate?: string
}) {
  const adminSupabase = createAdminSupabaseClient()

  try {
    // Build base query for subscriptions
    let subscriptionsQuery = adminSupabase
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_products (
          *,
          products (id, title),
          product_variants (id, sku, color)
        )
      `)

    // Apply filters
    if (filters?.subscriptionProductId) {
      subscriptionsQuery = subscriptionsQuery.eq('subscription_product_id', filters.subscriptionProductId)
    }

    const { data: allSubscriptions, error: subscriptionsError } = await subscriptionsQuery

    // Apply product/variant filters in JavaScript (Supabase doesn't support nested filtering)
    let subscriptions = allSubscriptions || []
    if (filters?.productId) {
      subscriptions = subscriptions.filter(s => 
        s.subscription_products?.product_id === filters.productId
      )
    }
    if (filters?.variantId) {
      subscriptions = subscriptions.filter(s => 
        s.subscription_products?.variant_id === filters.variantId
      )
    }

    if (subscriptionsError) {
      console.error('Error fetching subscriptions:', subscriptionsError)
      return { success: false, error: subscriptionsError.message }
    }


    // 1. Subscription Summary Stats
    const totalSubscriptions = subscriptions.length
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length
    const pausedSubscriptions = subscriptions.filter(s => s.status === 'paused').length
    const cancelledSubscriptions = subscriptions.filter(s => s.status === 'cancelled').length
    const expiredSubscriptions = subscriptions.filter(s => s.status === 'expired').length
    const completedSubscriptions = subscriptions.filter(s => s.status === 'completed').length
    const failedSubscriptions = subscriptions.filter(s => s.status === 'failed').length

    // Get unique customers
    const uniqueUserIds = new Set(subscriptions.map(s => s.user_id))
    const totalCustomers = uniqueUserIds.size
    const activeCustomers = new Set(
      subscriptions.filter(s => s.status === 'active').map(s => s.user_id)
    ).size

    // Get total orders from subscription_orders
    const { count: totalOrders } = await adminSupabase
      .from('subscription_orders')
      .select('*', { count: 'exact', head: true })

    // Calculate revenue from subscription orders (filtered by date range if provided)
    let subscriptionOrdersQuery = adminSupabase
      .from('subscription_orders')
      .select(`
        *,
        orders (id, total, payment_status, created_at)
      `)
    
    // Apply date filter to orders if provided
    if (filters?.startDate || filters?.endDate) {
      if (filters.startDate) {
        subscriptionOrdersQuery = subscriptionOrdersQuery.gte('billing_date', filters.startDate)
      }
      if (filters.endDate) {
        subscriptionOrdersQuery = subscriptionOrdersQuery.lte('billing_date', filters.endDate)
      }
    }

    const { data: subscriptionOrdersData } = await subscriptionOrdersQuery

    // Filter subscription orders by selected subscriptions (if product/variant filters are applied)
    let filteredSubscriptionOrders = subscriptionOrdersData || []
    if (subscriptions.length < (allSubscriptions?.length || 0)) {
      const subscriptionIds = new Set(subscriptions.map(s => s.id))
      filteredSubscriptionOrders = filteredSubscriptionOrders.filter((so: any) => 
        subscriptionIds.has(so.subscription_id)
      )
    }

    // Calculate revenue metrics
    const paidOrders = filteredSubscriptionOrders.filter((so: any) => so.orders?.payment_status === 'paid')
    const totalRevenue = paidOrders.reduce((sum: number, so: any) => {
      return sum + parseFloat(so.orders?.total?.toString() || '0')
    }, 0)

    // Calculate revenue by purchase type
    const prepaidSubscriptions = subscriptions.filter(s => s.purchase_type === 'prepaid')
    const ongoingSubscriptions = subscriptions.filter(s => s.purchase_type === 'ongoing')
    
    // Prepaid revenue: from total_prepaid_amount (already paid upfront)
    // Filter by date range if provided (check subscription created_at)
    let filteredPrepaidSubs = prepaidSubscriptions
    if (filters?.startDate || filters?.endDate) {
      filteredPrepaidSubs = prepaidSubscriptions.filter(s => {
        const created = new Date(s.created_at)
        if (filters.startDate && created < new Date(filters.startDate)) return false
        if (filters.endDate && created > new Date(filters.endDate)) return false
        return true
      })
    }
    const prepaidRevenue = filteredPrepaidSubs.reduce((sum: number, s: any) => {
      return sum + parseFloat(s.total_prepaid_amount?.toString() || '0')
    }, 0)

    // Ongoing revenue: from subscription orders (recurring payments)
    const ongoingRevenue = paidOrders
      .filter((so: any) => {
        const sub = subscriptions.find(s => s.id === so.subscription_id)
        return sub?.purchase_type === 'ongoing'
      })
      .reduce((sum: number, so: any) => {
        return sum + parseFloat(so.orders?.total?.toString() || '0')
      }, 0)

    // Calculate MRR (Monthly Recurring Revenue) from active ongoing subscriptions
    const activeOngoingSubs = ongoingSubscriptions.filter(s => s.status === 'active')
    const mrr = activeOngoingSubs.reduce((sum: number, s: any) => {
      return sum + (parseFloat(s.price_per_cycle?.toString() || '0') * (s.quantity || 1))
    }, 0)

    // Calculate ARR (Annual Recurring Revenue)
    const arr = mrr * 12

    // Revenue from prepaid subscriptions (already collected)
    const prepaidCollectedRevenue = filteredPrepaidSubs
      .filter(s => s.status === 'active' || s.status === 'completed')
      .reduce((sum: number, s: any) => {
        return sum + parseFloat(s.total_prepaid_amount?.toString() || '0')
      }, 0)

    // 2. Average Subscription Length
    const completedSubs = subscriptions.filter(s => 
      s.status === 'completed' || s.status === 'cancelled' || s.status === 'expired'
    )
    
    let avgSubscriptionLength = 0
    let avgCompletedLength = 0

    if (subscriptions.length > 0) {
      // Calculate average length for all subscriptions (based on created_at to cancelled_at or now)
      const now = new Date()
      const totalMonths = subscriptions.reduce((sum, s) => {
        const start = new Date(s.created_at)
        const end = s.cancelled_at ? new Date(s.cancelled_at) : now
        const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
        return sum + months
      }, 0)
      avgSubscriptionLength = totalMonths / subscriptions.length
    }

    if (completedSubs.length > 0) {
      const totalCompletedMonths = completedSubs.reduce((sum, s) => {
        const start = new Date(s.created_at)
        const end = s.cancelled_at ? new Date(s.cancelled_at) : new Date(s.updated_at)
        const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)
        return sum + months
      }, 0)
      avgCompletedLength = totalCompletedMonths / completedSubs.length
    }

    // 3. 12-Month Churn Rate
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    
    const subscriptionsInPeriod = subscriptions.filter(s => 
      new Date(s.created_at) >= twelveMonthsAgo
    )
    
    const churnedInPeriod = subscriptionsInPeriod.filter(s => 
      s.status === 'cancelled' || s.status === 'expired'
    ).length

    const churnRate = subscriptionsInPeriod.length > 0
      ? (churnedInPeriod / subscriptionsInPeriod.length) * 100
      : 0

    // Churn rate over time (monthly)
    const churnRateOverTime: Array<{ month: string; rate: number }> = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date()
      monthStart.setMonth(monthStart.getMonth() - i)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      
      const monthEnd = new Date(monthStart)
      monthEnd.setMonth(monthEnd.getMonth() + 1)
      monthEnd.setDate(0)
      monthEnd.setHours(23, 59, 59, 999)

      const subsInMonth = subscriptions.filter(s => {
        const created = new Date(s.created_at)
        return created >= monthStart && created <= monthEnd
      }).length

      const churnedInMonth = subscriptions.filter(s => {
        const created = new Date(s.created_at)
        const cancelled = s.cancelled_at ? new Date(s.cancelled_at) : null
        return created >= monthStart && created <= monthEnd && 
               cancelled && cancelled >= monthStart && cancelled <= monthEnd
      }).length

      const rate = subsInMonth > 0 ? (churnedInMonth / subsInMonth) * 100 : 0
      churnRateOverTime.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        rate: parseFloat(rate.toFixed(2))
      })
    }

    // 4. New Subscriptions Over Time
    const startDate = filters?.startDate ? new Date(filters.startDate) : new Date()
    startDate.setDate(startDate.getDate() - 7) // Default to last 7 days
    const endDate = filters?.endDate ? new Date(filters.endDate) : new Date()

    const newSubscriptionsOverTime: Array<{ date: string; count: number }> = []
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    for (let i = 0; i <= daysDiff; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      date.setHours(0, 0, 0, 0)
      
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = subscriptions.filter(s => {
        const created = new Date(s.created_at)
        return created >= date && created < nextDate
      }).length

      newSubscriptionsOverTime.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      })
    }

    const newSubscriptionsCount = subscriptions.filter(s => {
      const created = new Date(s.created_at)
      return created >= startDate && created <= endDate
    }).length

    // 5. Retention by Cohort
    const cohorts: Array<{
      cohort: string
      total: number
      retention: { [key: string]: number }
    }> = []

    // Group subscriptions by month of creation
    const subscriptionsByMonth = new Map<string, typeof subscriptions>()
    subscriptions.forEach(sub => {
      const created = new Date(sub.created_at)
      const monthKey = created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      if (!subscriptionsByMonth.has(monthKey)) {
        subscriptionsByMonth.set(monthKey, [])
      }
      subscriptionsByMonth.get(monthKey)!.push(sub)
    })

    // Calculate retention for each cohort
    // Get all subscription orders first for efficiency (for retention calculation)
    const allSubscriptionIds = subscriptions.map(s => s.id)
    const { data: retentionSubscriptionOrders } = await adminSupabase
      .from('subscription_orders')
      .select('subscription_id, billing_date')
      .in('subscription_id', allSubscriptionIds)

    subscriptionsByMonth.forEach((cohortSubs, monthKey) => {
      const total = cohortSubs.length
      const retention: { [key: string]: number } = {}
      
      // Get orders for this cohort
      const cohortSubIds = cohortSubs.map(s => s.id)
      const cohortOrders = retentionSubscriptionOrders?.filter((order: any) => 
        cohortSubIds.includes(order.subscription_id)
      ) || []

      // Calculate retention for months 1-12
      for (let month = 1; month <= 12; month++) {
        const cohortStart = new Date(cohortSubs[0].created_at)
        const monthEnd = new Date(cohortStart)
        monthEnd.setMonth(monthEnd.getMonth() + month)
        
        const stillActive = cohortSubs.filter(sub => {
          // Check if subscription is still active at this month mark
          const cancelled = sub.cancelled_at ? new Date(sub.cancelled_at) : null
          if (cancelled && cancelled < monthEnd) return false
          
          // Check if subscription has orders in this period (indicating it's still active)
          const hasOrderInPeriod = cohortOrders.some((order: any) => 
            order.subscription_id === sub.id && 
            new Date(order.billing_date) <= monthEnd
          )
          
          // If no orders yet but subscription is not cancelled, consider it active
          return !cancelled || (hasOrderInPeriod && cancelled >= monthEnd)
        }).length

        retention[`mo${month}`] = total > 0 ? Math.round((stillActive / total) * 100) : 0
      }

      cohorts.push({
        cohort: monthKey,
        total,
        retention
      })
    })

    // Sort cohorts by date
    cohorts.sort((a, b) => {
      const dateA = new Date(a.cohort)
      const dateB = new Date(b.cohort)
      return dateA.getTime() - dateB.getTime()
    })

    // 6. Payment Schedule (for a specific month)
    // Note: This will be calculated on the client side based on selected month
    // For now, we'll use current month
    const paymentSchedule: Array<{
      date: string
      successful: { count: number; amount: number }
      failed: { count: number }
      scheduled: { count: number }
    }> = []

    // Get subscription orders for payment schedule
    const targetMonth = new Date()
    targetMonth.setMonth(targetMonth.getMonth()) // Current month
    
    const { data: subscriptionOrders } = await adminSupabase
      .from('subscription_orders')
      .select(`
        *,
        orders (id, total, payment_status)
      `)
      .gte('billing_date', new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString().split('T')[0])
      .lt('billing_date', new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1).toISOString().split('T')[0])

    // Group by date
    const ordersByDate = new Map<string, typeof subscriptionOrders>()
    subscriptionOrders?.forEach(order => {
      const date = order.billing_date
      if (!ordersByDate.has(date)) {
        ordersByDate.set(date, [])
      }
      ordersByDate.get(date)!.push(order)
    })

    // Calculate stats per day
    const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day)
      const dateStr = date.toISOString().split('T')[0]
      
      const ordersForDay = ordersByDate.get(dateStr) || []
      const successful = ordersForDay.filter(o => o.orders?.payment_status === 'paid')
      const failed = ordersForDay.filter(o => o.orders?.payment_status === 'failed')
      const scheduled = ordersForDay.filter(o => 
        !o.orders || (o.orders.payment_status !== 'paid' && o.orders.payment_status !== 'failed')
      )

      paymentSchedule.push({
        date: dateStr,
        successful: {
          count: successful.length,
          amount: successful.reduce((sum, o) => sum + parseFloat(o.orders?.total?.toString() || '0'), 0)
        },
        failed: { count: failed.length },
        scheduled: { count: scheduled.length }
      })
    }

    return {
      success: true,
      data: {
        summary: {
          totalSubscriptions,
          activeSubscriptions,
          pausedSubscriptions,
          cancelledSubscriptions,
          expiredSubscriptions,
          completedSubscriptions,
          failedSubscriptions,
          totalOrders: totalOrders || 0,
          totalCustomers,
          activeCustomers,
          // Purchase type breakdown
          ongoingSubscriptions: ongoingSubscriptions.length,
          prepaidSubscriptions: prepaidSubscriptions.length,
          activeOngoingSubscriptions: activeOngoingSubs.length,
          activePrepaidSubscriptions: prepaidSubscriptions.filter(s => s.status === 'active').length,
        },
        revenue: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          prepaidRevenue: parseFloat(prepaidRevenue.toFixed(2)),
          ongoingRevenue: parseFloat(ongoingRevenue.toFixed(2)),
          prepaidCollectedRevenue: parseFloat(prepaidCollectedRevenue.toFixed(2)),
          mrr: parseFloat(mrr.toFixed(2)),
          arr: parseFloat(arr.toFixed(2)),
        },
        averages: {
          avgSubscriptionLength: parseFloat(avgSubscriptionLength.toFixed(2)),
          avgCompletedLength: parseFloat(avgCompletedLength.toFixed(2)),
          totalSubscriptions: subscriptions.length,
          completedSubscriptions: completedSubs.length
        },
        churn: {
          rate: parseFloat(churnRate.toFixed(2)),
          totalSubscriptions: subscriptionsInPeriod.length,
          churnRateOverTime
        },
        newSubscriptions: {
          count: newSubscriptionsCount,
          overTime: newSubscriptionsOverTime,
          period: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          }
        },
        retention: {
          cohorts
        },
        paymentSchedule: {
          month: targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          schedule: paymentSchedule
        }
      }
    }
  } catch (error: any) {
    console.error('Error fetching subscription analytics:', error)
    return { success: false, error: error.message || 'Failed to fetch analytics' }
  }
}

