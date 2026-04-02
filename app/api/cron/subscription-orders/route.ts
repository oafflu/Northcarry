import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Cron job to create subscription orders for upcoming cycles
 * 
 * This endpoint should be called daily (or as needed) to:
 * 1. Find subscriptions with next_shipment_date <= today
 * 2. Create orders for those cycles
 * 3. Update subscription dates for next cycle
 * 
 * Security: Protected by Vercel Cron secret
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (set in Vercel environment variables)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = createAdminSupabaseClient()
  const today = new Date().toISOString().split('T')[0]
  
  try {
    // Find active subscriptions that need orders created
    // For prepaid: check prepaid_cycles_remaining > 0
    // For ongoing: check status = 'active'
    const { data: subscriptions, error: subError } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_products (
          *,
          products (id, title),
          product_variants (id, sku, color, price)
        )
      `)
      .eq('status', 'active')
      .lte('next_shipment_date', today)
      .order('next_shipment_date', { ascending: true })

    if (subError) {
      console.error('Error fetching subscriptions:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions', details: subError.message },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No subscriptions need orders created',
        processed: 0,
      })
    }

    let processed = 0
    let errors: string[] = []

    // Import the subscription order creation function
    const subscriptionsModule = await import('@/app/actions/subscriptions')
    const createSubscriptionOrder = subscriptionsModule.createSubscriptionOrder

    // Import Stripe to check subscription status
    let stripe: any = null
    try {
      const Stripe = (await import('stripe')).default
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY
      if (stripeSecretKey) {
        stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
      }
    } catch (stripeError) {
      console.warn('Stripe not available for subscription status verification:', stripeError)
    }

    for (const subscription of subscriptions) {
      try {
        // Verify Stripe subscription status if stripe_subscription_id exists
        if (subscription.stripe_subscription_id && stripe) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
            const stripeStatus = stripeSubscription.status

            // Map Stripe status to local status
            let shouldUpdateStatus = false
            let newStatus: 'active' | 'paused' | 'cancelled' | 'expired' | 'completed' | null = null

            if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') {
              if (subscription.status !== 'cancelled') {
                newStatus = 'cancelled'
                shouldUpdateStatus = true
              }
            } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') {
              if (subscription.status !== 'expired') {
                newStatus = 'expired'
                shouldUpdateStatus = true
              }
            } else if (stripeStatus === 'paused' || stripeStatus === 'incomplete') {
              if (subscription.status !== 'paused') {
                newStatus = 'paused'
                shouldUpdateStatus = true
              }
            }

            // If Stripe subscription is not active, update local status and skip order creation
            if (shouldUpdateStatus && newStatus) {
              console.log(`[Cron] Updating subscription ${subscription.id} status from ${subscription.status} to ${newStatus} (Stripe status: ${stripeStatus})`)
              await supabase
                .from('customer_subscriptions')
                .update({
                  status: newStatus,
                  cancelled_at: newStatus === 'cancelled' ? new Date().toISOString() : subscription.cancelled_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', subscription.id)
              
              // Skip order creation for non-active subscriptions
              continue
            }
          } catch (stripeError: any) {
            // If subscription not found in Stripe, it might be deleted - mark as cancelled
            if (stripeError.code === 'resource_missing') {
              console.log(`[Cron] Stripe subscription ${subscription.stripe_subscription_id} not found, marking as cancelled`)
              await supabase
                .from('customer_subscriptions')
                .update({
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', subscription.id)
              continue
            } else {
              console.warn(`[Cron] Error checking Stripe subscription ${subscription.stripe_subscription_id}:`, stripeError.message)
              // Continue processing if it's not a "not found" error
            }
          }
        }

        // Check if order already exists for this cycle
        // Get the highest cycle number for this subscription
        const { data: existingOrders } = await supabase
          .from('subscription_orders')
          .select('cycle_number, shipment_date')
          .eq('subscription_id', subscription.id)
          .order('cycle_number', { ascending: false })
          .limit(1)

        const nextCycleNumber = existingOrders && existingOrders.length > 0
          ? existingOrders[0].cycle_number + 1
          : 1

        // Check if an order already exists for the current shipment date
        // This prevents creating duplicate orders for the same cycle
        if (existingOrders && existingOrders.length > 0) {
          const latestOrder = existingOrders[0]
          const { data: latestOrderDetails } = await supabase
            .from('subscription_orders')
            .select('shipment_date')
            .eq('subscription_id', subscription.id)
            .eq('cycle_number', latestOrder.cycle_number)
            .single()

          if (latestOrderDetails && latestOrderDetails.shipment_date === subscription.next_shipment_date) {
            // Order already exists for this shipment date, skip
            continue
          }
        }

        // For prepaid subscriptions, check if cycles remaining
        if (subscription.purchase_type === 'prepaid') {
          if (!subscription.prepaid_cycles_remaining || subscription.prepaid_cycles_remaining <= 0) {
            // No cycles remaining, mark as completed
            await supabase
              .from('customer_subscriptions')
              .update({ status: 'completed' })
              .eq('id', subscription.id)
            continue
          }
        }

        // Calculate dates for this cycle
        const shipmentDate = subscription.next_shipment_date
        const billingDate = subscription.next_billing_date

        // Create order for this cycle
        const orderResult = await createSubscriptionOrder(
          subscription.id,
          nextCycleNumber,
          billingDate,
          shipmentDate
        )

        if (!orderResult.success) {
          errors.push(`Subscription ${subscription.id}: ${orderResult.error}`)
          continue
        }

        // Update subscription for next cycle
        const frequencyMonths = subscription.frequency_months || 1
        const shippingDays = subscription.subscription_products?.shipping_days || 14
        
        // Calculate next dates
        const currentShipmentDate = new Date(shipmentDate)
        const nextShipmentDate = new Date(currentShipmentDate)
        nextShipmentDate.setMonth(nextShipmentDate.getMonth() + frequencyMonths)
        
        const nextBillingDate = new Date(nextShipmentDate)
        nextBillingDate.setDate(nextBillingDate.getDate() - shippingDays)

        const updateData: any = {
          next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
          next_billing_date: nextBillingDate.toISOString().split('T')[0],
        }

        // For prepaid subscriptions, decrement cycles remaining
        if (subscription.purchase_type === 'prepaid' && subscription.prepaid_cycles_remaining) {
          const newCyclesRemaining = subscription.prepaid_cycles_remaining - 1
          updateData.prepaid_cycles_remaining = newCyclesRemaining
          
          if (newCyclesRemaining <= 0) {
            updateData.status = 'completed'
          }
        }

        // For ongoing subscriptions, handle Stripe billing
        if (subscription.purchase_type === 'ongoing' && subscription.stripe_subscription_id) {
          // Stripe will handle billing automatically via webhooks
          // We just need to update the dates
        }

        await supabase
          .from('customer_subscriptions')
          .update(updateData)
          .eq('id', subscription.id)

        processed++

        console.log(`Created order for subscription ${subscription.id}, cycle ${nextCycleNumber}`)
      } catch (error: any) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        errors.push(`Subscription ${subscription.id}: ${error.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} subscription(s)`,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Error in subscription orders cron job:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

