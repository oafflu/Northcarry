'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createSubscriptionOrder } from './subscriptions'

/**
 * Manually trigger a cron job
 * This is used by the admin interface to run cron jobs on demand
 */
export async function runCronJob(jobName: 'subscription-orders') {
  const supabase = createAdminSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  if (jobName === 'subscription-orders') {
    try {
      // Find active subscriptions that need orders created
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
        return {
          success: false,
          error: 'Failed to fetch subscriptions',
          details: subError.message,
        }
      }

      if (!subscriptions || subscriptions.length === 0) {
        return {
          success: true,
          message: 'No subscriptions need orders created',
          processed: 0,
        }
      }

      // Initialize Stripe so we can verify subscription status before creating orders (same as API cron)
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

      let processed = 0
      let errors: string[] = []

      for (const subscription of subscriptions) {
        try {
          // Verify Stripe subscription status if stripe_subscription_id exists (keep in sync with Stripe)
          if (subscription.stripe_subscription_id && stripe) {
            try {
              const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
              const stripeStatus = stripeSubscription.status

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

              if (shouldUpdateStatus && newStatus) {
                console.log(`[Cron Run] Updating subscription ${subscription.id} status from ${subscription.status} to ${newStatus} (Stripe status: ${stripeStatus})`)
                await supabase
                  .from('customer_subscriptions')
                  .update({
                    status: newStatus,
                    cancelled_at: newStatus === 'cancelled' ? new Date().toISOString() : subscription.cancelled_at,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', subscription.id)
                continue
              }
            } catch (stripeError: any) {
              if (stripeError.code === 'resource_missing') {
                console.log(`[Cron Run] Stripe subscription ${subscription.stripe_subscription_id} not found, marking as cancelled`)
                await supabase
                  .from('customer_subscriptions')
                  .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', subscription.id)
                continue
              }
              console.warn(`[Cron Run] Error checking Stripe subscription ${subscription.stripe_subscription_id}:`, stripeError.message)
            }
          }

          // Check if order already exists for this cycle
          const { data: existingOrders } = await supabase
            .from('subscription_orders')
            .select('cycle_number')
            .eq('subscription_id', subscription.id)
            .order('cycle_number', { ascending: false })
            .limit(1)

          const nextCycleNumber = existingOrders && existingOrders.length > 0
            ? existingOrders[0].cycle_number + 1
            : 1

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

      return {
        success: true,
        message: `Processed ${processed} subscription(s)`,
        processed,
        errors: errors.length > 0 ? errors : undefined,
      }
    } catch (error: any) {
      console.error('Error in subscription orders cron job:', error)
      return {
        success: false,
        error: 'Internal server error',
        details: error.message,
      }
    }
  }

  return {
    success: false,
    error: `Unknown cron job: ${jobName}`,
  }
}

/**
 * Retry creating subscription orders for subscriptions that should have orders
 * This is useful when orders failed to create due to errors (e.g., missing shipping_address)
 */
export async function retryFailedSubscriptionOrders() {
  const supabase = createAdminSupabaseClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // Find active subscriptions that need orders created (next_shipment_date has passed)
    // Note: We filter by status='active' but will also verify Stripe status in the loop
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
      return {
        success: false,
        error: 'Failed to fetch subscriptions',
        details: subError.message,
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return {
        success: true,
        message: 'No subscriptions need orders created',
        processed: 0,
        created: 0,
        skipped: 0,
        errors: [],
      }
    }

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

    let processed = 0
    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const subscription of subscriptions) {
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
            console.log(`[Retry Cron] Updating subscription ${subscription.id} status from ${subscription.status} to ${newStatus} (Stripe status: ${stripeStatus})`)
            await supabase
              .from('customer_subscriptions')
              .update({
                status: newStatus,
                cancelled_at: newStatus === 'cancelled' ? new Date().toISOString() : subscription.cancelled_at,
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)
            
            // Skip order creation for non-active subscriptions
            skipped++
            continue
          }
        } catch (stripeError: any) {
          // If subscription not found in Stripe, it might be deleted - mark as cancelled
          if (stripeError.code === 'resource_missing') {
            console.log(`[Retry Cron] Stripe subscription ${subscription.stripe_subscription_id} not found, marking as cancelled`)
            await supabase
              .from('customer_subscriptions')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)
            skipped++
            continue
          } else {
            console.warn(`[Retry Cron] Error checking Stripe subscription ${subscription.stripe_subscription_id}:`, stripeError.message)
            // Continue processing if it's not a "not found" error
          }
        }
      }

      try {
        // Check if order already exists for the current cycle
        // Get the highest cycle number for this subscription
        const { data: existingOrders } = await supabase
          .from('subscription_orders')
          .select('cycle_number, shipment_date, order_id')
          .eq('subscription_id', subscription.id)
          .order('cycle_number', { ascending: false })
          .limit(1)

        // Determine the next cycle number
        const nextCycleNumber = existingOrders && existingOrders.length > 0
          ? existingOrders[0].cycle_number + 1
          : 1

        // Check if an order already exists for the current shipment date
        // If the latest order's shipment_date matches next_shipment_date, skip
        if (existingOrders && existingOrders.length > 0) {
          const latestOrder = existingOrders[0]
          
          // Check by shipment date
          const { data: latestOrderDetails } = await supabase
            .from('subscription_orders')
            .select('shipment_date, order_id')
            .eq('subscription_id', subscription.id)
            .eq('cycle_number', latestOrder.cycle_number)
            .single()

          if (latestOrderDetails && latestOrderDetails.shipment_date === subscription.next_shipment_date) {
            // Order already exists for this shipment date, skip
            skipped++
            continue
          }

          // Also check if an order exists for the next cycle number (in case it was created manually)
          const { data: nextCycleOrder } = await supabase
            .from('subscription_orders')
            .select('id, shipment_date')
            .eq('subscription_id', subscription.id)
            .eq('cycle_number', nextCycleNumber)
            .single()

          if (nextCycleOrder && nextCycleOrder.shipment_date === subscription.next_shipment_date) {
            // Order already exists for next cycle with this shipment date, skip
            skipped++
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
            skipped++
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
          errors.push(`Subscription ${subscription.id} (${subscription.subscription_products?.products?.title || 'Unknown'}): ${orderResult.error}`)
          processed++
          continue
        }

        // Update subscription for next cycle only if order was successfully created
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

        await supabase
          .from('customer_subscriptions')
          .update(updateData)
          .eq('id', subscription.id)

        created++
        processed++

        console.log(`Created order for subscription ${subscription.id}, cycle ${nextCycleNumber}`)
      } catch (error: any) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        errors.push(`Subscription ${subscription.id}: ${error.message || 'Unknown error'}`)
        processed++
      }
    }

    return {
      success: true,
      message: `Processed ${processed} subscription(s): ${created} created, ${skipped} skipped`,
      processed,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error: any) {
    console.error('Error in retry failed subscription orders:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: error.message,
    }
  }
}
