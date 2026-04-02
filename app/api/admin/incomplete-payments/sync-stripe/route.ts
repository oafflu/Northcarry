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
 * Sync incomplete payments from Stripe
 * Fetches failed payment intents and failed subscription invoices from Stripe
 * and imports them into incomplete_payments table
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await req.json()
    const { limit = 100, startAfter, syncSubscriptions = true } = body

    let imported = 0
    let skipped = 0
    let errors: string[] = []
    let hasMore = false
    let nextStartAfter: string | null = null

    // 1. Fetch failed payment intents from Stripe
    const paymentIntentParams: Stripe.PaymentIntentListParams = {
      limit: Math.min(limit, 100), // Stripe max is 100
      expand: ['data.customer', 'data.latest_charge'],
    }

    if (startAfter && !startAfter.startsWith('in_')) {
      paymentIntentParams.starting_after = startAfter
    }

    // Initialize Stripe client
    const stripe = await getStripeClient()
    const paymentIntents = await stripe.paymentIntents.list(paymentIntentParams)

    // Process payment intents
    for (const paymentIntent of paymentIntents.data) {
      try {
        // Only process failed/incomplete payments
        if (
          paymentIntent.status !== 'requires_payment_method' &&
          paymentIntent.status !== 'canceled' &&
          paymentIntent.status !== 'payment_failed'
        ) {
          continue
        }

        // Skip if amount is 0
        if (!paymentIntent.amount || paymentIntent.amount === 0) {
          skipped++
          continue
        }

        // Check if already exists
        const { data: existing } = await supabase
          .from('incomplete_payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single()

        if (existing) {
          skipped++
          continue
        }

        // Get customer email
        let customerEmail: string | null = null
        let customerName: string | null = null
        let userId: string | null = null
        let stripeCustomerId: string | null = null

        if (paymentIntent.customer) {
          if (typeof paymentIntent.customer === 'string') {
            stripeCustomerId = paymentIntent.customer
            try {
              const stripe = await getStripeClient()
              const customer = await stripe.customers.retrieve(paymentIntent.customer)
              if (!customer.deleted) {
                customerEmail = (customer as Stripe.Customer).email || null
                customerName = (customer as Stripe.Customer).name || null
              }
            } catch (e) {
              console.warn(`Could not retrieve customer ${paymentIntent.customer}:`, e)
            }
          } else {
            customerEmail = paymentIntent.customer.email || null
            customerName = paymentIntent.customer.name || null
            stripeCustomerId = paymentIntent.customer.id
          }
        }

        // Try to get email from metadata or receipt_email
        if (!customerEmail) {
          customerEmail = paymentIntent.metadata?.email || paymentIntent.receipt_email || null
        }
        if (!customerName) {
          customerName = paymentIntent.metadata?.firstName || paymentIntent.metadata?.customerName || null
        }

        // Skip if no email
        if (!customerEmail) {
          skipped++
          continue
        }

        // Try to find user by email
        if (customerEmail) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', customerEmail.toLowerCase())
            .single()
          userId = profile?.id || null
        }

        // Get failure details
        const lastPaymentError = paymentIntent.last_payment_error
        const failureReason = lastPaymentError?.type || paymentIntent.status || 'unknown'
        const failureCode = lastPaymentError?.code || null
        const failureMessage = lastPaymentError?.message || null

        // Try to find related order
        let orderId: string | null = null
        let orderNumber: string | null = null
        let cartItems: any[] = []

        const metadataOrderId = paymentIntent.metadata?.orderId
        if (metadataOrderId) {
          const { data: order } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('id', metadataOrderId)
            .single()
          
          if (order) {
            orderId = order.id
            orderNumber = order.order_number

            // Get cart items from order
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_title, variant_color, quantity, unit_price, line_total')
              .eq('order_id', order.id)
            
            cartItems = orderItems || []
          }
        }

        // Insert incomplete payment record
        const { error: insertError } = await supabase
          .from('incomplete_payments')
          .insert({
            user_id: userId,
            customer_email: customerEmail.toLowerCase().trim(),
            customer_name: customerName,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_customer_id: stripeCustomerId,
            payment_amount: (paymentIntent.amount / 100).toFixed(2),
            currency: paymentIntent.currency || 'usd',
            failure_reason: failureReason,
            failure_code: failureCode,
            failure_message: failureMessage,
            order_id: orderId,
            order_number: orderNumber,
            cart_items: cartItems.length > 0 ? cartItems : null,
            retry_count: 0,
            recovered: !!orderId, // Mark as recovered immediately if an order already exists
            email_sent: false,
            automation_triggered: false,
            created_at: new Date(paymentIntent.created * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error(`Error inserting payment intent ${paymentIntent.id}:`, insertError)
          errors.push(`Payment ${paymentIntent.id}: ${insertError.message}`)
        } else {
          imported++
        }
      } catch (error: any) {
        console.error(`Error processing payment intent ${paymentIntent.id}:`, error)
        errors.push(`Payment ${paymentIntent.id}: ${error.message || 'Unknown error'}`)
      }
    }

    // Update pagination info from payment intents
    hasMore = paymentIntents.has_more
    if (paymentIntents.data.length > 0) {
      nextStartAfter = paymentIntents.data[paymentIntents.data.length - 1].id
    }

    // 2. Fetch failed subscription invoices from Stripe (if enabled)
    if (syncSubscriptions) {
      try {
        const invoiceParams: Stripe.InvoiceListParams = {
          limit: Math.min(limit, 100),
          status: 'open', // Open invoices that haven't been paid
          expand: ['data.customer', 'data.payment_intent', 'data.subscription'],
        }

        if (startAfter && startAfter.startsWith('in_')) {
          invoiceParams.starting_after = startAfter
        }

        // Initialize Stripe client for invoices
        const stripe = await getStripeClient()
        const invoices = await stripe.invoices.list(invoiceParams)

        for (const invoice of invoices.data) {
          try {
            // Only process invoices that are actually failed/unpaid
            if (invoice.status === 'paid' || invoice.amount_paid >= invoice.amount_due) {
              continue
            }

            // Skip if amount is 0
            if (!invoice.amount_due || invoice.amount_due === 0) {
              skipped++
              continue
            }

            // Get payment intent from invoice
            const paymentIntentId = typeof invoice.payment_intent === 'string' 
              ? invoice.payment_intent 
              : invoice.payment_intent?.id

            if (!paymentIntentId) {
              // For subscription invoices, check if we should create a record anyway
              // Check if already exists by invoice ID
              const { data: existing } = await supabase
                .from('incomplete_payments')
                .select('id')
                .eq('stripe_payment_intent_id', invoice.id) // Use invoice ID as fallback
                .single()

              if (existing) {
                skipped++
                continue
              }
            } else {
              // Check if already exists by payment intent ID
              const { data: existing } = await supabase
                .from('incomplete_payments')
                .select('id')
                .eq('stripe_payment_intent_id', paymentIntentId)
                .single()

              if (existing) {
                skipped++
                continue
              }
            }

            // Get customer info
            let customerEmail: string | null = null
            let customerName: string | null = null
            let userId: string | null = null
            let stripeCustomerId: string | null = null

            if (invoice.customer) {
              if (typeof invoice.customer === 'string') {
                stripeCustomerId = invoice.customer
                try {
                  const stripe = await getStripeClient()
                  const customer = await stripe.customers.retrieve(invoice.customer)
                  if (!customer.deleted) {
                    customerEmail = (customer as Stripe.Customer).email || null
                    customerName = (customer as Stripe.Customer).name || null
                  }
                } catch (e) {
                  console.warn(`Could not retrieve customer ${invoice.customer}:`, e)
                }
              } else {
                customerEmail = invoice.customer.email || null
                customerName = invoice.customer.name || null
                stripeCustomerId = invoice.customer.id
              }
            }

            // Try to get email from metadata
            if (!customerEmail) {
              customerEmail = invoice.metadata?.email || invoice.customer_email || null
            }
            if (!customerName) {
              customerName = invoice.metadata?.customerName || invoice.metadata?.firstName || null
            }

            // Skip if no email
            if (!customerEmail) {
              skipped++
              continue
            }

            // Try to find user by email
            if (customerEmail) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', customerEmail.toLowerCase())
                .single()
              userId = profile?.id || null
            }

            // Get failure details
            let failureReason = 'unpaid_invoice'
            let failureCode: string | null = null
            let failureMessage: string | null = null

            // If invoice has a payment intent, get error from there
            if (invoice.payment_intent && typeof invoice.payment_intent !== 'string') {
              const pi = invoice.payment_intent as Stripe.PaymentIntent
              if (pi.last_payment_error) {
                failureReason = pi.last_payment_error.type || 'unpaid_invoice'
                failureCode = pi.last_payment_error.code || null
                failureMessage = pi.last_payment_error.message || null
              }
            }

            // Try to find related order
            let orderId: string | null = null
            let orderNumber: string | null = null
            let cartItems: any[] = []

            // Check invoice metadata for order info
            const metadataOrderId = invoice.metadata?.orderId
            if (metadataOrderId) {
              const { data: order } = await supabase
                .from('orders')
                .select('id, order_number')
                .eq('id', metadataOrderId)
                .single()
              
              if (order) {
                orderId = order.id
                orderNumber = order.order_number

                // Get cart items from order
                const { data: orderItems } = await supabase
                  .from('order_items')
                  .select('product_title, variant_color, quantity, unit_price, line_total')
                  .eq('order_id', order.id)
                
                cartItems = orderItems || []
              }
            }

            // If this is a subscription invoice, try to find order via subscription
            if (invoice.subscription && !orderId) {
              const subscriptionId = typeof invoice.subscription === 'string' 
                ? invoice.subscription 
                : invoice.subscription.id

              // Find customer subscription
              const { data: customerSubscription } = await supabase
                .from('customer_subscriptions')
                .select('id')
                .eq('stripe_subscription_id', subscriptionId)
                .single()

              if (customerSubscription) {
                // Find related orders via subscription_orders
                const { data: subOrders } = await supabase
                  .from('subscription_orders')
                  .select('order_id')
                  .eq('subscription_id', customerSubscription.id)
                  .order('created_at', { ascending: false })
                  .limit(1)

                if (subOrders && subOrders.length > 0) {
                  const { data: order } = await supabase
                    .from('orders')
                    .select('id, order_number')
                    .eq('id', subOrders[0].order_id)
                    .single()

                  if (order) {
                    orderId = order.id
                    orderNumber = order.order_number

                    // Get cart items
                    const { data: orderItems } = await supabase
                      .from('order_items')
                      .select('product_title, variant_color, quantity, unit_price, line_total')
                      .eq('order_id', order.id)
                    
                    cartItems = orderItems || []
                  }
                }
              }
            }

            // Use payment intent ID if available, otherwise use invoice ID
            const recordPaymentIntentId = paymentIntentId || invoice.id

            // Insert incomplete payment record
            const { error: insertError } = await supabase
              .from('incomplete_payments')
              .insert({
                user_id: userId,
                customer_email: customerEmail.toLowerCase().trim(),
                customer_name: customerName,
                stripe_payment_intent_id: recordPaymentIntentId,
                stripe_customer_id: stripeCustomerId,
                payment_amount: (invoice.amount_due / 100).toFixed(2),
                currency: invoice.currency || 'usd',
                failure_reason: failureReason,
                failure_code: failureCode,
                failure_message: failureMessage || `Unpaid invoice ${invoice.number || invoice.id}`,
                order_id: orderId,
                order_number: orderNumber,
                cart_items: cartItems.length > 0 ? cartItems : null,
                retry_count: 0,
                recovered: false,
                email_sent: false,
                automation_triggered: false,
                created_at: new Date(invoice.created * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })

            if (insertError) {
              console.error(`Error inserting invoice ${invoice.id}:`, insertError)
              errors.push(`Invoice ${invoice.id}: ${insertError.message}`)
            } else {
              imported++
              
              // Trigger incomplete payment automation
              try {
                const { triggerAutomation } = await import('@/app/actions/email-automations')
                await triggerAutomation('custom', customerEmail.toLowerCase().trim(), {
                  userId: userId || undefined,
                  name: customerName,
                  trigger_name: 'incomplete_payment',
                  payment_intent_id: recordPaymentIntentId,
                })
                
                // Mark automation as triggered
                await supabase
                  .from('incomplete_payments')
                  .update({ automation_triggered: true })
                  .eq('stripe_payment_intent_id', recordPaymentIntentId)
              } catch (automationError) {
                console.error(`Error triggering automation for invoice ${invoice.id}:`, automationError)
                // Don't fail the import if automation fails
              }
            }
          } catch (error: any) {
            console.error(`Error processing invoice ${invoice.id}:`, error)
            errors.push(`Invoice ${invoice.id}: ${error.message || 'Unknown error'}`)
          }
        }

        // Update pagination if invoices have more
        if (invoices.has_more && invoices.data.length > 0) {
          hasMore = true
          nextStartAfter = invoices.data[invoices.data.length - 1].id
        }
      } catch (invoiceError: any) {
        console.error('Error fetching invoices:', invoiceError)
        errors.push(`Invoice sync error: ${invoiceError.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      hasMore,
      nextStartAfter: hasMore ? nextStartAfter : null,
      message: `Imported ${imported} incomplete payment(s), skipped ${skipped} existing/duplicate(s)`,
    })
  } catch (error: any) {
    console.error('Error syncing incomplete payments from Stripe:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to sync incomplete payments',
        details: error.stack 
      },
      { status: 500 }
    )
  }
}

