import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'

// Lazy initialization of Stripe to avoid build-time errors
// Checks database settings first, then falls back to environment variables
async function getStripeClient(): Promise<Stripe> {
  const supabase = createAdminSupabaseClient()
  
  // Try to get from settings first, fallback to environment variables
  const { data: setting } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'stripe')
    .single()

  const settings = setting?.setting_value as any
  const apiKey = settings?.secret_key || process.env.STRIPE_SECRET_KEY

  if (!apiKey) {
    throw new Error('Stripe secret key is not configured. Please configure it in /admin/settings/payment or set STRIPE_SECRET_KEY environment variable.')
  }

  return new Stripe(apiKey, {
    apiVersion: '2024-12-18.acacia',
  })
}

/**
 * Sync active subscriptions from Stripe
 * Fetches active subscriptions from Stripe and creates customer_subscriptions records
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await req.json()
    const { limit = 100, startAfter } = body

    // Initialize Stripe client
    const stripe = await getStripeClient()

    // Fetch subscriptions from Stripe (all statuses to sync status updates)
    // Note: We'll filter to active for creation, but check all for status updates
    const params: Stripe.SubscriptionListParams = {
      limit: Math.min(limit, 100), // Stripe max is 100
      status: 'all', // Get all statuses to sync status updates for existing subscriptions
      expand: ['data.customer', 'data.items.data.price', 'data.latest_invoice'],
    }

    if (startAfter) {
      params.starting_after = startAfter
    }

    const subscriptions = await stripe.subscriptions.list(params)

    let imported = 0
    let skipped = 0
    let errors: string[] = []

    for (const subscription of subscriptions.data) {
      try {
        // Check if subscription already exists by stripe_subscription_id
        const { data: existingByStripeId } = await supabase
          .from('customer_subscriptions')
          .select('id, user_id, subscription_product_id, purchase_type, status')
          .eq('stripe_subscription_id', subscription.id)
          .single()

        if (existingByStripeId) {
          // Update status to match Stripe subscription status
          const stripeStatus = subscription.status
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
          if (newStatus && existingByStripeId.status !== newStatus) {
            const updateData: any = {
              status: newStatus,
              updated_at: new Date().toISOString(),
            }

            // Add cancelled_at if being cancelled
            if (newStatus === 'cancelled' && existingByStripeId.status !== 'cancelled') {
              updateData.cancelled_at = new Date().toISOString()
            }

            await supabase
              .from('customer_subscriptions')
              .update(updateData)
              .eq('id', existingByStripeId.id)
            
            console.log(`[Sync Stripe] Updated subscription ${existingByStripeId.id} status from ${existingByStripeId.status} to ${newStatus} (Stripe: ${stripeStatus})`)
          }
          
          skipped++
          continue
        }

        // Only create new subscriptions if Stripe subscription is active
        // Cancelled/expired subscriptions in Stripe should not create new local subscriptions
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          skipped++
          continue
        }

        // Get customer info first (needed for duplicate check)
        let customerEmail: string | null = null
        let customerName: string | null = null
        let userId: string | null = null
        let stripeCustomerId: string | null = null

        if (subscription.customer) {
          if (typeof subscription.customer === 'string') {
            stripeCustomerId = subscription.customer
            try {
              const stripe = await getStripeClient()
              const customer = await stripe.customers.retrieve(subscription.customer)
              if (!customer.deleted) {
                customerEmail = (customer as Stripe.Customer).email || null
                customerName = (customer as Stripe.Customer).name || null
              }
            } catch (e) {
              console.warn(`Could not retrieve customer ${subscription.customer}:`, e)
            }
          } else {
            customerEmail = subscription.customer.email || null
            customerName = subscription.customer.name || null
            stripeCustomerId = subscription.customer.id
          }
        }

        // Skip if no customer email
        if (!customerEmail) {
          skipped++
          errors.push(`Subscription ${subscription.id}: No customer email found`)
          continue
        }

        // Find user by email or Stripe customer ID
        if (customerEmail) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', customerEmail.toLowerCase())
            .single()
          userId = profile?.id || null
        }

        // If not found by email, try Stripe customer ID
        if (!userId && stripeCustomerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', stripeCustomerId)
            .single()
          userId = profile?.id || null
        }

        // Get first subscription item (we'll sync the primary subscription)
        const firstItem = subscription.items.data[0]
        if (!firstItem) {
          skipped++
          errors.push(`Subscription ${subscription.id}: No subscription items found`)
          continue
        }

        // Get subscription product ID from price metadata
        const priceMetadata = firstItem.price?.metadata || {}
        const subscriptionProductId = priceMetadata.subscription_product_id

        if (!subscriptionProductId) {
          skipped++
          errors.push(`Subscription ${subscription.id}: No subscription_product_id in price metadata`)
          continue
        }

        // Also check if a subscription exists for this user + product + purchase_type combination
        // This prevents creating duplicates if the subscription was created manually or from prepaid orders
        // but doesn't have the stripe_subscription_id set yet
        if (userId && subscriptionProductId) {
          // Determine purchase type (default to ongoing for now)
          const purchaseType: 'ongoing' | 'prepaid' = 'ongoing'
          
          const { data: existingByUserProduct } = await supabase
            .from('customer_subscriptions')
            .select('id, stripe_subscription_id')
            .eq('user_id', userId)
            .eq('subscription_product_id', subscriptionProductId)
            .eq('purchase_type', purchaseType)
            .in('status', ['active', 'paused'])
            .single()

          if (existingByUserProduct) {
            // If existing subscription doesn't have stripe_subscription_id, update it
            if (!existingByUserProduct.stripe_subscription_id) {
              await supabase
                .from('customer_subscriptions')
                .update({
                  stripe_subscription_id: subscription.id,
                  stripe_customer_id: stripeCustomerId,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingByUserProduct.id)
              
              skipped++
              continue
            } else {
              // Already has a different stripe_subscription_id - this might be a duplicate
              skipped++
              errors.push(`Subscription ${subscription.id}: User ${userId} already has an active subscription ${existingByUserProduct.id} for product ${subscriptionProductId} with different Stripe subscription ID`)
              continue
            }
          }
        }

        // Verify subscription product exists
        const { data: subscriptionProduct } = await supabase
          .from('subscription_products')
          .select('id, shipping_days')
          .eq('id', subscriptionProductId)
          .single()

        if (!subscriptionProduct) {
          skipped++
          errors.push(`Subscription ${subscription.id}: Subscription product ${subscriptionProductId} not found`)
          continue
        }

        // Calculate subscription details
        const quantity = firstItem.quantity || 1
        const pricePerCycle = (firstItem.price?.unit_amount || 0) / 100 // Convert from cents
        const interval = firstItem.price?.recurring?.interval || 'month'
        const intervalCount = firstItem.price?.recurring?.interval_count || 1
        const frequencyMonths = interval === 'month' ? intervalCount : interval === 'year' ? intervalCount * 12 : 1

        // Calculate dates
        const now = new Date()
        const currentPeriodStart = new Date(subscription.current_period_start * 1000)
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000)
        const shippingDays = subscriptionProduct.shipping_days || 14

        // Next billing date is the end of current period
        const nextBillingDate = currentPeriodEnd
        // Next shipment date is before next billing (accounting for shipping time)
        const nextShipmentDate = new Date(currentPeriodEnd)
        nextShipmentDate.setDate(nextShipmentDate.getDate() - shippingDays)

        // Get customer's default shipping address
        let shippingAddressId: string | null = null
        if (userId) {
          const { data: defaultAddress } = await supabase
            .from('addresses')
            .select('id')
            .eq('user_id', userId)
            .eq('is_default', true)
            .eq('type', 'shipping')
            .single()
          
          shippingAddressId = defaultAddress?.id || null
        }

        // Determine purchase type (check if subscription has a trial or is prepaid)
        // For now, assume ongoing unless we can determine otherwise
        const purchaseType: 'ongoing' | 'prepaid' = 'ongoing'

        // Create customer subscription
        const { data: customerSubscription, error: insertError } = await supabase
          .from('customer_subscriptions')
          .insert({
            user_id: userId,
            subscription_product_id: subscriptionProductId,
            frequency_months: frequencyMonths,
            purchase_type: purchaseType,
            quantity: quantity,
            price_per_cycle: pricePerCycle,
            next_billing_date: nextBillingDate.toISOString().split('T')[0],
            next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
            shipping_address_id: shippingAddressId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: stripeCustomerId,
            status: 'active',
            created_at: new Date(subscription.created * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError || !customerSubscription) {
          console.error(`Error creating subscription ${subscription.id}:`, insertError)
          errors.push(`Subscription ${subscription.id}: ${insertError?.message || 'Failed to create'}`)
        } else {
          imported++

          // Try to link to existing order if one exists
          // Check if there's an order with this subscription's metadata
          const orderNumber = subscription.metadata?.orderNumber
          if (orderNumber) {
            const { data: order } = await supabase
              .from('orders')
              .select('id')
              .eq('order_number', orderNumber)
              .single()

            if (order) {
              // Link order to subscription via subscription_orders
              await supabase
                .from('subscription_orders')
                .insert({
                  subscription_id: customerSubscription.id,
                  order_id: order.id,
                  cycle_number: 0, // Initial order
                  billing_date: currentPeriodStart.toISOString().split('T')[0],
                  shipment_date: currentPeriodStart.toISOString().split('T')[0],
                  status: 'completed',
                })
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        errors.push(`Subscription ${subscription.id}: ${error.message || 'Unknown error'}`)
      }
    }

    const hasMore = subscriptions.has_more
    const lastSubscriptionId = subscriptions.data.length > 0 
      ? subscriptions.data[subscriptions.data.length - 1].id 
      : null

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors to first 10
      errorCount: errors.length,
      hasMore,
      nextStartAfter: hasMore ? lastSubscriptionId : null,
      message: `Imported ${imported} subscription(s), skipped ${skipped} existing/duplicate(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`,
    })
  } catch (error: any) {
    console.error('Error syncing subscriptions from Stripe:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to sync subscriptions',
        details: error.stack 
      },
      { status: 500 }
    )
  }
}

