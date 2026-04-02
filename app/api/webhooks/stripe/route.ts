import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { awardPoints } from '@/app/actions/loyalty'
import { sendNotification, notifyAdmins } from '@/app/actions/notifications'

// Get Stripe configuration
async function getStripeConfig() {
  // Use admin client to read settings (bypasses RLS)
  const adminSupabase = createAdminSupabaseClient()
  
  // Try to get from settings first, fallback to environment variables
  const { data: setting } = await adminSupabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'stripe')
    .single()

  const settings = setting?.setting_value as any

  const secretKey = settings?.secret_key || process.env.STRIPE_SECRET_KEY
  const webhookSecret = settings?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET

  if (!secretKey) {
    throw new Error('Stripe secret key not configured')
  }

  const webhookSecrets: string[] = []
  if (webhookSecret) webhookSecrets.push(webhookSecret)

  return {
    stripe: new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
    }),
    webhookSecrets,
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event | null = null
  let stripe: Stripe
  let webhookSecrets: string[]

  try {
    const config = await getStripeConfig()
    stripe = config.stripe
    webhookSecrets = config.webhookSecrets

    if (webhookSecrets.length === 0) {
      console.error('No webhook secrets configured')
      return NextResponse.json({ error: 'Webhook secrets not configured' }, { status: 500 })
    }

    // Try each webhook secret until one works
    let lastError: Error | null = null
    for (const webhookSecret of webhookSecrets) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
        // Success! Break out of the loop
        break
      } catch (err: any) {
        lastError = err
        // Continue to next secret
        continue
      }
    }

    // If we didn't successfully verify with any secret, return error
    if (!event) {
      console.error('Webhook signature verification failed with all secrets:', lastError?.message)
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('Error during webhook verification:', err.message)
    return NextResponse.json({ error: 'Webhook verification error' }, { status: 400 })
  }

  // Validate event structure before processing
  if (!event || !event.data || !event.type) {
    console.error('Invalid webhook event structure:', { 
      hasEvent: !!event, 
      hasData: !!event?.data, 
      hasType: !!event?.type,
      eventType: event?.type 
    })
    return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 })
  }

  // Use admin client for webhook operations (bypasses RLS)
  const supabase = createAdminSupabaseClient()

  try {
    switch (event.type) {
      // ============================================
      // PAYMENT SUCCESS
      // ============================================
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        // If no orderId in metadata, try to find by payment intent ID
        let order: any = null
        const metadataOrderNumber = paymentIntent.metadata?.orderNumber
        
        if (orderId) {
          const { data } = await supabase
            .from('orders')
            .select('id, order_number, user_id, total, payment_status')
            .eq('id', orderId)
            .single()
          order = data
        } else {
          // Fallback: find by stripe_payment_intent_id
          const { data } = await supabase
            .from('orders')
            .select('id, order_number, user_id, total, payment_status')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single()
          order = data
        }
        
        // If still not found, try by order number
        if (!order && metadataOrderNumber) {
          const { data } = await supabase
            .from('orders')
            .select('id, order_number, user_id, total, payment_status')
            .eq('order_number', metadataOrderNumber)
            .single()
          order = data
        }

        // Subscription checkout: payment intent has subscription_id in metadata; order number is BREVI-xxx but actual order is SUB-xxx-1
        if (!order && paymentIntent.metadata?.subscription_id) {
          const stripeSubscriptionId = paymentIntent.metadata.subscription_id as string
          const { data: customerSub } = await supabase
            .from('customer_subscriptions')
            .select('id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single()
          if (customerSub?.id) {
            const { data: subOrderRow } = await supabase
              .from('subscription_orders')
              .select('order_id')
              .eq('subscription_id', customerSub.id)
              .order('cycle_number', { ascending: true })
              .limit(1)
              .single()
            if (subOrderRow?.order_id) {
              const { data: orderRow } = await supabase
                .from('orders')
                .select('id, order_number, user_id, total, payment_status')
                .eq('id', subOrderRow.order_id)
                .single()
              order = orderRow
              if (order) {
                console.log('Found subscription order by subscription_id for payment_intent.succeeded:', order.order_number)
              }
            }
          }
        }

        const hasSubscriptionItems = paymentIntent.metadata?.has_subscription_items === 'true'
        if (!order && hasSubscriptionItems) {
          // Subscription/prepaid checkouts can create their order asynchronously in createOrder.
          // Avoid creating an extra BREVI-* fallback order in webhook for this flow.
          for (const waitMs of [250, 500, 1000, 2000]) {
            await new Promise((resolve) => setTimeout(resolve, waitMs))
            const { data: byPaymentIntent } = await supabase
              .from('orders')
              .select('id, order_number, user_id, total, payment_status')
              .eq('stripe_payment_intent_id', paymentIntent.id)
              .maybeSingle()
            if (byPaymentIntent) {
              order = byPaymentIntent
              break
            }
          }
          if (!order) {
            console.log(
              'Order not found yet for subscription/prepaid payment intent; continuing to snapshot fallback:',
              paymentIntent.id
            )
          }
        }

        if (!order) {
          // Try to create order from checkout snapshot (saved when PaymentIntent was created)
          const { data: snapshotRow } = await supabase
            .from('checkout_snapshots')
            .select('order_number, snapshot')
            .eq('payment_intent_id', paymentIntent.id)
            .maybeSingle()

          if (snapshotRow?.snapshot) {
            const snap = snapshotRow.snapshot as any
            const cust = snap.customer || {}
            const customerEmail = (cust.email || paymentIntent.metadata?.email || paymentIntent.receipt_email || '').trim()
            let finalOrderNumber = snapshotRow.order_number || paymentIntent.metadata?.orderNumber || ''
            if (!finalOrderNumber && paymentIntent.description) {
              const m = paymentIntent.description.match(/Order\s+(BREVI-[\w-]+)/i)
              if (m?.[1]) finalOrderNumber = m[1]
            }
            if (!finalOrderNumber) {
              finalOrderNumber = `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
            }
            const t = snap.totals || {}
            const subtotal = parseFloat(t.subtotal ?? paymentIntent.metadata?.subtotal ?? '0') || paymentIntent.amount / 100
            const discountAmount = parseFloat(t.discountAmount ?? paymentIntent.metadata?.discountAmount ?? '0')
            const shippingCost = parseFloat(t.shippingCost ?? paymentIntent.metadata?.shipping ?? '0')
            const taxAmount = parseFloat(t.taxAmount ?? paymentIntent.metadata?.tax ?? '0')
            const total = parseFloat(t.total ?? '0') || paymentIntent.amount / 100
            let shippingAddress = snap.shippingAddress && typeof snap.shippingAddress === 'object'
              ? {
                  address_line1: snap.shippingAddress.address_line1 || '',
                  address_line2: snap.shippingAddress.address_line2 || null,
                  city: snap.shippingAddress.city || '',
                  state: snap.shippingAddress.state || null,
                  postal_code: snap.shippingAddress.postal_code || null,
                  country: snap.shippingAddress.country || 'US',
                  phone: snap.shippingAddress.phone || cust.phone,
                }
              : {
                  address_line1: '[Address not available - please update]',
                  address_line2: null,
                  city: '[City not available - please update]',
                  state: null,
                  postal_code: null,
                  country: 'US',
                  phone: null,
                }
            const billingAddress = snap.billingAddress && typeof snap.billingAddress === 'object'
              ? {
                  address_line1: snap.billingAddress.address_line1 || '',
                  address_line2: snap.billingAddress.address_line2 || null,
                  city: snap.billingAddress.city || '',
                  state: snap.billingAddress.state || null,
                  postal_code: snap.billingAddress.postal_code || null,
                  country: snap.billingAddress.country || 'US',
                  phone: snap.billingAddress.phone || cust.phone,
                }
              : shippingAddress
            let userId: string | null = null
            if (customerEmail) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', customerEmail.toLowerCase())
                .single()
              userId = profile?.id || null
            }
            let chargeId: string | null = null
            try {
              const charges = await stripe.paymentIntents.retrieve(paymentIntent.id, { expand: ['charges.data'] })
              chargeId = (charges as any).charges?.data?.[0]?.id || null
            } catch (_) {}
            const orderData: any = {
              order_number: finalOrderNumber,
              user_id: userId,
              customer_email: customerEmail,
              customer_first_name: (cust.firstName || paymentIntent.metadata?.firstName || '').trim() || 'Customer',
              customer_last_name: (cust.lastName || paymentIntent.metadata?.lastName || '').trim(),
              customer_phone: cust.phone || null,
              subtotal: parseFloat(Number(subtotal).toFixed(2)),
              discount_amount: parseFloat(Number(discountAmount).toFixed(2)),
              shipping_cost: parseFloat(Number(shippingCost).toFixed(2)),
              tax_amount: parseFloat(Number(taxAmount).toFixed(2)),
              total: parseFloat(Number(total).toFixed(2)),
              shipping_address: shippingAddress,
              billing_address: billingAddress,
              payment_status: 'paid',
              fulfillment_status: 'unfulfilled',
              stripe_payment_intent_id: paymentIntent.id,
            }
            if (chargeId) orderData.stripe_charge_id = chargeId
            const { data: createdOrder, error: createErr } = await supabase
              .from('orders')
              .insert(orderData)
              .select('id, order_number, user_id, total, payment_status')
              .single()
            if (!createErr && createdOrder) {
              const snapshotItems = Array.isArray(snap.items) ? snap.items : []
              if (snapshotItems.length > 0) {
                const orderItemsToInsert = snapshotItems.map((i: any) => ({
                  order_id: createdOrder.id,
                  product_id: i.product_id,
                  variant_id: i.variant_id,
                  product_title: i.product_title || 'Product',
                  variant_color: i.variant_color || 'Unknown',
                  sku: i.sku || 'N/A',
                  quantity: Number(i.quantity) || 1,
                  unit_price: String(i.unit_price ?? '0'),
                  line_total: String(i.line_total ?? '0'),
                  purchase_type: i.purchase_type || 'one-time',
                }))
                await supabase.from('order_items').insert(orderItemsToInsert)
              }
              await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntent.id)
              order = createdOrder
              console.log('Created order from checkout snapshot in webhook:', createdOrder.order_number)
            } else if (createErr?.code === '23505') {
              // Unique violation: order was already created (e.g. by createOrder before webhook). Use existing order.
              const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, order_number, user_id, total, payment_status')
                .eq('stripe_payment_intent_id', paymentIntent.id)
                .maybeSingle()
              if (existingOrder) {
                order = existingOrder
                await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntent.id)
                console.log('Order already existed for payment intent (duplicate prevented):', existingOrder.order_number)
              }
            }
          }

          if (!order) {
            console.error('Order not found for payment intent:', paymentIntent.id, {
              paymentIntentId: paymentIntent.id,
              metadata: paymentIntent.metadata,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
            })
            // Log to incomplete_payments for tracking and recovery
            try {
              const customerEmail = paymentIntent.metadata?.email || paymentIntent.receipt_email || null
              const customerName = paymentIntent.metadata?.firstName
                ? `${paymentIntent.metadata.firstName} ${paymentIntent.metadata.lastName || ''}`.trim()
                : null
              let userId: string | null = null
              if (customerEmail) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('email', customerEmail.toLowerCase())
                  .single()
                userId = profile?.id || null
              }
              const { data: existingIncomplete } = await supabase
                .from('incomplete_payments')
                .select('id')
                .eq('stripe_payment_intent_id', paymentIntent.id)
                .single()
              if (!existingIncomplete && customerEmail) {
                await supabase
                  .from('incomplete_payments')
                  .insert({
                    user_id: userId,
                    customer_email: customerEmail.toLowerCase().trim(),
                    customer_name: customerName,
                    stripe_payment_intent_id: paymentIntent.id,
                    stripe_customer_id: typeof paymentIntent.customer === 'string'
                      ? paymentIntent.customer
                      : paymentIntent.customer?.id || null,
                    payment_amount: (paymentIntent.amount / 100).toFixed(2),
                    currency: paymentIntent.currency || 'usd',
                    failure_reason: 'order_not_created',
                    failure_code: 'MISSING_ORDER',
                    failure_message: 'Payment succeeded but order was not created in system',
                    order_number: metadataOrderNumber || null,
                    retry_count: 0,
                    recovered: false,
                    email_sent: false,
                    automation_triggered: false,
                    created_at: new Date(paymentIntent.created * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                console.log('Created incomplete_payment record for successful payment without order:', paymentIntent.id)
                await notifyAdmins({
                  title: '⚠️ Payment Succeeded But Order Missing',
                  message: `Payment intent ${paymentIntent.id} succeeded but no order was found. Order number: ${metadataOrderNumber || 'N/A'}. Amount: ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency?.toUpperCase() || 'USD'}`,
                  type: 'warning',
                })
              }
            } catch (incompleteError: any) {
              console.error('Error creating incomplete_payment record:', incompleteError)
            }
            break
          }
        }

        const userId = order.user_id || paymentIntent.metadata?.userId
        const orderNumber = order.order_number || metadataOrderNumber || 'Unknown'

        // Get customer email and name early so they're available throughout the case block
        const customerEmail = paymentIntent.metadata?.email || order.customer_email
        const customerName = paymentIntent.metadata?.firstName || order.customer_first_name || 'Customer'

        // Get charge ID if available
        let chargeId: string | null = null
        try {
          const charges = await stripe.paymentIntents.retrieve(paymentIntent.id, {
            expand: ['charges.data']
          })
          chargeId = (charges as any).charges?.data?.[0]?.id || null
        } catch (chargeError) {
          console.error('Error retrieving charge:', chargeError)
          // Continue without charge ID
        }

        // Update order payment status and store Stripe IDs
        const updateData: any = {
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id,
        }
        if (chargeId) {
          updateData.stripe_charge_id = chargeId
        }

        const { error: orderError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id)

        if (orderError) {
          console.error('Error updating order:', orderError)
          break
        }

        // Award loyalty points for purchase
        if (userId) {
          const pointsToAward = Math.floor(parseFloat(order.total.toString()) || 0)
          await awardPoints(userId, pointsToAward, 'purchase', order.id)
        }

        // Auto-assign order to supplier (if not already assigned)
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('variant_id, quantity')
          .eq('order_id', order.id)

        if (orderItems) {
          // Get primary supplier for each variant
          for (const item of orderItems) {
            const { data: supplierLink } = await supabase
              .from('product_supplier_links')
              .select('supplier_id')
              .eq('variant_id', item.variant_id)
              .eq('is_primary_supplier', true)
              .single()

            if (supplierLink) {
              // Check if assignment already exists
              const { data: existingAssignment } = await supabase
                .from('supplier_order_assignments')
                .select('id')
                .eq('order_id', order.id)
                .eq('supplier_id', supplierLink.supplier_id)
                .single()

              if (!existingAssignment) {
                await supabase
                  .from('supplier_order_assignments')
                  .insert({
                    order_id: order.id,
                    supplier_id: supplierLink.supplier_id,
                    assignment_status: 'pending',
                  })
              }
            }
          }
        }
        
        // Send order confirmation email
        try {
          const { sendOrderConfirmationEmail, sendOrderConfirmationForExistingAccount } = await import('@/lib/email')
          
          if (customerEmail) {
            // Try to send confirmation with magic link if user exists
            if (userId) {
              try {
                const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
                const { data: magicLink } = await supabase.auth.admin.generateLink({
                  type: 'magiclink',
                  email: customerEmail,
                  options: {
                    redirectTo: `${siteUrl}/account`,
                  },
                })
                
                if (magicLink?.properties?.action_link) {
                  await sendOrderConfirmationForExistingAccount(
                    customerEmail,
                    customerName,
                    orderNumber,
                    magicLink.properties.action_link,
                    {
                      total: order.total.toString(),
                      paymentStatus: 'paid',
                    }
                  )
                } else {
                  await sendOrderConfirmationEmail(
                    customerEmail,
                    customerName,
                    orderNumber,
                    {
                      total: order.total.toString(),
                      paymentStatus: 'paid',
                    }
                  )
                }
              } catch (emailError) {
                console.error('Error sending order confirmation email:', emailError)
                // Try fallback
                await sendOrderConfirmationEmail(
                  customerEmail,
                  customerName,
                  orderNumber,
                  {
                    total: order.total.toString(),
                    paymentStatus: 'paid',
                  }
                )
              }
            } else {
              await sendOrderConfirmationEmail(
                customerEmail,
                customerName,
                orderNumber,
                {
                  total: order.total.toString(),
                  paymentStatus: 'paid',
                }
              )
            }
            const { logOrderAction } = await import('@/lib/system-logger')
            await logOrderAction(
              'confirmation_email_sent',
              `Order confirmation email sent to ${customerEmail} (Stripe payment)`,
              order.id,
              orderNumber,
              { email: customerEmail, source: 'stripe_webhook' }
            )
          }
        } catch (emailError) {
          console.error('Error in order confirmation email flow:', emailError)
        }

        // Notify customer
        if (userId) {
          await sendNotification(userId, {
            title: 'Order Confirmed!',
            message: `Your order #${orderNumber} has been confirmed and payment received.`,
            type: 'success',
            link: `/account/orders/${order.id}`,
            metadata: { orderId: order.id, orderNumber },
          })
        }

        // Notify admins
        await notifyAdmins({
          title: 'New Order',
          message: `Order #${orderNumber} has been paid and needs fulfillment.`,
          type: 'info',
          link: `/admin/orders/${order.id}`,
          metadata: { orderId: order.id, orderNumber },
        })

        // Trigger post_purchase automation
        if (customerEmail) {
          try {
            const { triggerAutomation } = await import('@/app/actions/email-automations')
            await triggerAutomation('post_purchase', customerEmail, {
              userId: userId || undefined,
              name: customerName,
              orderId: order.id,
              orderNumber: orderNumber,
            })
          } catch (automationError) {
            console.error('Error triggering post_purchase automation:', automationError)
          }
        }

        console.log(`✅ Payment succeeded for order ${order.id} (${orderNumber})`)
        break
      }

      // ============================================
      // PAYMENT FAILURE
      // ============================================
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        // Find order by metadata or payment intent ID
        let order: any = null
        if (orderId) {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .eq('id', orderId)
            .single()
          order = data
        } else {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single()
          order = data
        }

        if (!order) {
          console.error('Order not found for failed payment intent:', paymentIntent.id)
          break
        }

        // Update order payment status
        await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Release reserved inventory
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('variant_id, quantity')
          .eq('order_id', order.id)

        if (orderItems) {
          for (const item of orderItems) {
            // Get supplier inventory
            const { data: supplierLink } = await supabase
              .from('product_supplier_links')
              .select('supplier_inventory_id')
              .eq('variant_id', item.variant_id)
              .eq('is_primary_supplier', true)
              .single()

            if (supplierLink) {
              // Release reserved inventory
              await supabase.rpc('release_reserved_inventory', {
                inventory_id: supplierLink.supplier_inventory_id,
                quantity: item.quantity,
              })
            }
          }
        }

            // Send payment failure email
            // Notify customer
            if (userId) {
              await sendNotification(userId, {
                title: 'Payment Failed',
                message: `Payment for order #${orderNumber || order.id} could not be processed. Please try again.`,
                type: 'error',
                link: `/checkout`,
                metadata: { orderId: order.id },
              })
            }

            console.log(`❌ Payment failed for order ${order.id}`)
            break
      }

      // ============================================
      // REFUNDS
      // ============================================
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const paymentIntentId = charge.payment_intent as string

        // Find order by charge ID, payment intent ID, or metadata
        let order: any = null
        
        // Try by charge ID first (most reliable)
        const { data: orderByCharge } = await supabase
          .from('orders')
          .select('id, user_id, total, payment_status')
          .eq('stripe_charge_id', charge.id)
          .single()
        
        if (orderByCharge) {
          order = orderByCharge
        } else if (paymentIntentId) {
          // Try by payment intent ID
          const { data: orderByPI } = await supabase
            .from('orders')
            .select('id, user_id, total, payment_status')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()
          order = orderByPI
        } else if (charge.metadata?.orderId) {
          // Try by metadata
          const { data } = await supabase
            .from('orders')
            .select('id, user_id, total, payment_status')
            .eq('id', charge.metadata.orderId)
            .single()
          order = data
        }

        if (!order) {
          console.error('Order not found for refund')
          break
        }
        const refundAmount = charge.amount_refunded / 100 // Convert from cents
        const isFullRefund = refundAmount >= parseFloat(order.total.toString())

        // Update order payment status
        await supabase
          .from('orders')
          .update({
            payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
            refund_amount: refundAmount.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Create refund record
        const refundId = charge.refunds?.data?.[0]?.id || null
        await supabase.from('refunds').insert({
          order_id: order.id,
          amount: refundAmount.toString(),
          reason: 'Customer request',
          status: 'completed',
          stripe_refund_id: refundId,
          processed_at: new Date().toISOString(),
        })

        // Reverse loyalty points (if full refund)
        if (isFullRefund && order.user_id) {
          const pointsToReverse = Math.floor(parseFloat(order.total.toString()) || 0)
          await awardPoints(order.user_id, -pointsToReverse, 'purchase', order.id)
        }

        // Restock inventory if applicable
        // (This should be handled by the returns system)

        // Notify customer
        if (order.user_id) {
          await sendNotification(order.user_id, {
            title: 'Refund Processed',
            message: `Your refund of $${refundAmount.toFixed(2)} for order #${order.order_number || order.id} has been processed.`,
            type: 'success',
            link: `/account/orders/${order.id}`,
            metadata: { orderId: order.id, refundAmount },
          })
        }

        // Notify admins
        await notifyAdmins({
          title: 'Refund Processed',
          message: `Refund of $${refundAmount.toFixed(2)} processed for order #${order.order_number || order.id}.`,
          type: 'info',
          link: `/admin/orders/${order.id}`,
          metadata: { orderId: order.id, refundAmount },
        })

        console.log(`💰 Refund processed for order ${order.id}: $${refundAmount}`)
        break
      }

      // ============================================
      // DISPUTES/CHARGEBACKS
      // ============================================
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = dispute.charge as string

        // Find order by charge ID
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_number, customer_email')
          .eq('stripe_charge_id', chargeId)
          .single()

        if (!order) {
          console.error('Order not found for dispute')
          break
        }

        // Create dispute record
        await supabase.from('disputes').insert({
          order_id: order.id,
          stripe_dispute_id: dispute.id,
          amount: (dispute.amount / 100).toString(),
          reason: dispute.reason || 'unknown',
          status: 'open',
          created_at: new Date(dispute.created * 1000).toISOString(),
        })

        // Update order status
        await supabase
          .from('orders')
          .update({
            payment_status: 'disputed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        // Notify admins
        await notifyAdmins({
          title: '⚠️ Payment Dispute',
          message: `A dispute has been filed for order #${order.order_number || order.id}. Action required.`,
          type: 'warning',
          link: `/admin/orders/${order.id}`,
          metadata: { orderId: order.id, disputeId: dispute.id },
        })

        console.log(`⚠️ Dispute created for order ${order.order_number}`)
        break
      }

      case 'charge.dispute.updated': {
        const dispute = event.data.object as Stripe.Dispute

        // Update dispute record
        await supabase
          .from('disputes')
          .update({
            status: dispute.status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_dispute_id', dispute.id)

        console.log(`📝 Dispute updated: ${dispute.id}`)
        break
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute

        // Update dispute record
        await supabase
          .from('disputes')
          .update({
            status: 'closed',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_dispute_id', dispute.id)

        // If dispute lost, process refund
        if (dispute.status === 'lost') {
          // Handle refund processing
          const { data: disputeRecord } = await supabase
            .from('disputes')
            .select('order_id')
            .eq('stripe_dispute_id', dispute.id)
            .single()

          if (disputeRecord) {
            await supabase
              .from('orders')
              .update({
                payment_status: 'refunded',
                updated_at: new Date().toISOString(),
              })
              .eq('id', disputeRecord.order_id)
          }
        }

        console.log(`✅ Dispute closed: ${dispute.id}`)
        break
      }

      // ============================================
      // PAYMENT METHOD EVENTS
      // ============================================
      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod
        const customerId = paymentMethod.customer as string

        // Save payment method for customer
        if (customerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          if (profile) {
            await supabase.from('saved_payment_methods').upsert({
              user_id: profile.id,
              stripe_payment_method_id: paymentMethod.id,
              type: paymentMethod.type,
              last4: paymentMethod.card?.last4,
              brand: paymentMethod.card?.brand,
              exp_month: paymentMethod.card?.exp_month,
              exp_year: paymentMethod.card?.exp_year,
            })
          }
        }

        console.log(`💳 Payment method attached: ${paymentMethod.id}`)
        break
      }

      // ============================================
      // CUSTOMER EVENTS
      // ============================================
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer
        const email = customer.email

        if (email) {
          // Link Stripe customer ID to user profile
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customer.id,
            })
            .eq('email', email)
        }

        console.log(`👤 Customer created: ${customer.id}`)
        break
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer
        const email = customer.email

        if (email) {
          // Update customer information
          await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customer.id,
            })
            .eq('email', email)
        }

        console.log(`👤 Customer updated: ${customer.id}`)
        break
      }

      // ============================================
      // PAYMENT INTENT EVENTS
      // ============================================
      case 'payment_intent.created': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`🔄 Payment intent created: ${paymentIntent.id}`)
        // Log for analytics
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId
        const subscriptionId = paymentIntent.metadata?.subscriptionId
        const customerEmail = paymentIntent.metadata?.email || paymentIntent.receipt_email
        const customerName = paymentIntent.metadata?.firstName || paymentIntent.metadata?.customerName
        const userId = paymentIntent.metadata?.userId

        // Cancel incomplete subscription if payment failed
        if (subscriptionId) {
          try {
            // Check if subscription is still incomplete
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
              // Cancel the incomplete subscription
              await stripe.subscriptions.cancel(subscriptionId)
              console.log(`✅ Canceled incomplete subscription ${subscriptionId} due to payment failure`)
            }
          } catch (subError: any) {
            // Subscription might already be canceled or not exist
            console.log(`Could not cancel subscription ${subscriptionId}:`, subError.message)
          }
        }

        // Update order status if order exists
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
        }

        // Track incomplete payment for email marketing
        if (customerEmail && paymentIntent.amount > 0) {
          // Get cart items from order if order exists
          let cartItems: any[] = []
          if (orderId) {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_title, variant_color, quantity, unit_price, line_total')
              .eq('order_id', orderId)
            
            cartItems = orderItems || []
          }

          // Get failure reason from last payment error
          const lastPaymentError = paymentIntent.last_payment_error
          const failureReason = lastPaymentError?.type || 'unknown'
          const failureCode = lastPaymentError?.code || null
          const failureMessage = lastPaymentError?.message || null

          // Get order number if order exists
          let orderNumber: string | null = null
          if (orderId) {
            const { data: order } = await supabase
              .from('orders')
              .select('order_number')
              .eq('id', orderId)
              .single()
            orderNumber = order?.order_number || null
          }

          // Insert or update incomplete payment record
          // First check if record exists
          const { data: existingPayment } = await supabase
            .from('incomplete_payments')
            .select('id, retry_count')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single()

          if (existingPayment) {
            // Update existing record (increment retry count)
            await supabase
              .from('incomplete_payments')
              .update({
                failure_reason: failureReason,
                failure_code: failureCode,
                failure_message: failureMessage,
                retry_count: (existingPayment.retry_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPayment.id)
            
            console.log(`📝 Updated incomplete payment record for ${paymentIntent.id} (retry ${(existingPayment.retry_count || 0) + 1})`)
          } else {
            // Insert new record
            const { error: insertError } = await supabase
              .from('incomplete_payments')
              .insert({
                user_id: userId || null,
                customer_email: customerEmail.toLowerCase().trim(),
                customer_name: customerName || null,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_customer_id: paymentIntent.customer as string || null,
                payment_amount: (paymentIntent.amount / 100).toFixed(2),
                currency: paymentIntent.currency || 'usd',
                failure_reason: failureReason,
                failure_code: failureCode,
                failure_message: failureMessage,
                order_id: orderId || null,
                order_number: orderNumber,
                cart_items: cartItems.length > 0 ? cartItems : null,
                retry_count: 0,
                recovered: false,
                email_sent: false,
                automation_triggered: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            
            if (insertError) {
              console.error('❌ Error inserting incomplete payment:', insertError)
            } else {
              console.log(`📝 Created incomplete payment record for ${paymentIntent.id}`)
            }
          }
          
          // Trigger incomplete payment automation
          try {
            const { triggerAutomation } = await import('@/app/actions/email-automations')
            // Use custom trigger for incomplete payments
            const result = await triggerAutomation('custom', customerEmail, {
              userId: userId || undefined,
              name: customerName,
              trigger_name: 'incomplete_payment',
              payment_intent_id: paymentIntent.id,
            })
            
            // Mark automation as triggered and email as sent if successful
            if (result.success && result.triggered > 0) {
              await supabase
                .from('incomplete_payments')
                .update({
                  automation_triggered: true,
                  email_sent: true,
                  email_sent_at: new Date().toISOString(),
                })
                .eq('stripe_payment_intent_id', paymentIntent.id)
            }
          } catch (automationError) {
            console.error('Error triggering incomplete payment automation:', automationError)
          }
        }

        console.log(`❌ Payment intent failed: ${paymentIntent.id}`)
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Release inventory
          // Update order status
          await supabase
            .from('orders')
            .update({
              payment_status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId)
        }

        console.log(`❌ Payment intent canceled: ${paymentIntent.id}`)
        break
      }

      // ============================================
      // SUBSCRIPTION EVENTS
      // ============================================
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const subscriptionId = subscription.id

        // Already linked (e.g. from convert order to subscription) – do not create a duplicate
        const { data: existingByStripeId } = await supabase
          .from('customer_subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle()
        if (existingByStripeId) {
          console.log(`✅ Stripe subscription ${subscriptionId} already linked to customer subscription ${existingByStripeId.id}`)
          break
        }

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        // Checkout sets subscription.metadata.orderNumber (BREVI-*). createOrder persists customer_subscriptions
        // after payment; inserting here races createOrder and duplicates ongoing subscriptions.
        if (subscription.metadata?.orderNumber) {
          if (profile) {
            const firstItemMeta = subscription.items?.data?.[0]
            const subscriptionProductIdFromPrice = (firstItemMeta?.price?.metadata as Record<string, string> | undefined)
              ?.subscription_product_id
            if (subscriptionProductIdFromPrice) {
              const { data: pendingRows } = await supabase
                .from('customer_subscriptions')
                .select('id')
                .eq('user_id', profile.id)
                .eq('subscription_product_id', subscriptionProductIdFromPrice)
                .is('stripe_subscription_id', null)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
              if (pendingRows && pendingRows.length > 0) {
                await supabase
                  .from('customer_subscriptions')
                  .update({
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', pendingRows[0].id)
                console.log(
                  `✅ Linked Stripe subscription ${subscriptionId} to pending customer subscription ${pendingRows[0].id} (checkout)`
                )
              }
            }
          }
          console.log(
            `Checkout subscription ${subscriptionId} (order ${subscription.metadata.orderNumber}): customer row owned by createOrder`
          )
          break
        }

        if (profile) {
          // Link only when subscription_product_id matches (avoid wrong customer_subscriptions row)
          const firstItem = subscription.items?.data?.[0]
          const priceMetadata = firstItem?.price?.metadata || {}
          const subscriptionProductIdFromPrice = priceMetadata.subscription_product_id as string | undefined

          const { data: customerSubscriptions } = subscriptionProductIdFromPrice
            ? await supabase
                .from('customer_subscriptions')
                .select('id')
                .eq('user_id', profile.id)
                .eq('subscription_product_id', subscriptionProductIdFromPrice)
                .is('stripe_subscription_id', null)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
            : { data: null as { id: string }[] | null }

          if (customerSubscriptions && customerSubscriptions.length > 0) {
            await supabase
              .from('customer_subscriptions')
              .update({
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', customerSubscriptions[0].id)

            console.log(`✅ Linked Stripe subscription ${subscriptionId} to customer subscription ${customerSubscriptions[0].id}`)
          } else {
            // No existing subscription found - try to create one from Stripe subscription data
            if (firstItem) {
              const priceId = firstItem.price?.id
              const quantity = firstItem.quantity || 1
              
              // Try to find subscription_product by Stripe price ID in metadata
              // First, check if we can find it via price metadata
              const priceMetadata = firstItem.price?.metadata || {}
              const subscriptionProductId = priceMetadata.subscription_product_id
              
              if (subscriptionProductId) {
                // Verify subscription product exists
                const { data: subscriptionProduct } = await supabase
                  .from('subscription_products')
                  .select('id, shipping_days, subscription_price, prepaid_price')
                  .eq('id', subscriptionProductId)
                  .single()
                
                if (subscriptionProduct) {
                  // Get customer's default shipping address
                  const { data: defaultAddress } = await supabase
                    .from('addresses')
                    .select('id')
                    .eq('user_id', profile.id)
                    .eq('is_default', true)
                    .eq('type', 'shipping')
                    .single()
                  
                  // Calculate dates
                  const now = new Date()
                  const interval = subscription.items.data[0].price?.recurring?.interval
                  const intervalCount = subscription.items.data[0].price?.recurring?.interval_count || 1
                  const frequencyMonths = interval === 'month' ? intervalCount : interval === 'year' ? intervalCount * 12 : 1
                  const shippingDays = subscriptionProduct.shipping_days || 14
                  const nextBillingDate = new Date(now.getTime() + (frequencyMonths * 30 * 24 * 60 * 60 * 1000))
                  const nextShipmentDate = new Date(now.getTime() + (shippingDays * 24 * 60 * 60 * 1000))
                  
                  // Get price per cycle (convert from cents to dollars)
                  const unitAmount = firstItem.price?.unit_amount || 0
                  const pricePerCycle = unitAmount / 100
                  
                  // Create customer subscription
                  const { data: newSubscription, error: createError } = await supabase
                    .from('customer_subscriptions')
                    .insert({
                      user_id: profile.id,
                      subscription_product_id: subscriptionProductId,
                      frequency_months: frequencyMonths,
                      purchase_type: 'ongoing',
                      quantity: quantity,
                      price_per_cycle: pricePerCycle,
                      next_billing_date: nextBillingDate.toISOString().split('T')[0],
                      next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
                      shipping_address_id: defaultAddress?.id || null,
                      stripe_subscription_id: subscriptionId,
                      stripe_customer_id: customerId,
                      status: 'active',
                    })
                    .select()
                    .single()
                  
                  if (createError || !newSubscription) {
                    console.error(`❌ Failed to create customer subscription from Stripe subscription ${subscriptionId}:`, createError)
                  } else {
                    console.log(`✅ Created customer subscription ${newSubscription.id} from Stripe subscription ${subscriptionId}`)
                  }
                } else {
                  console.warn(`⚠️ Subscription product ${subscriptionProductId} not found for Stripe subscription ${subscriptionId}`)
                }
              } else {
                console.warn(`⚠️ No subscription_product_id in price metadata for Stripe subscription ${subscriptionId}. Cannot auto-create customer subscription.`)
              }
            }
          }
        } else {
          console.warn(`⚠️ No profile found for Stripe customer ${customerId} (subscription ${subscriptionId})`)
        }

        console.log(`📦 Subscription created: ${subscriptionId}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          // Update subscription status if needed
          const { data: subscription } = await supabase
            .from('customer_subscriptions')
            .select('id, status')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (subscription && subscription.status !== 'active') {
            await supabase
              .from('customer_subscriptions')
              .update({
                status: 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', subscription.id)
          }

          // Find and update related orders for this subscription invoice
          // Orders are linked via subscription_orders table
          const { data: subscriptionOrders } = await supabase
            .from('subscription_orders')
            .select('order_id')
            .eq('subscription_id', subscription.id)

          if (subscriptionOrders && subscriptionOrders.length > 0) {
            const orderIds = subscriptionOrders.map(so => so.order_id).filter(Boolean)
            
            // Update payment status for all related orders
            if (orderIds.length > 0) {
              await supabase
                .from('orders')
                .update({
                  payment_status: 'paid',
                  updated_at: new Date().toISOString(),
                })
                .in('id', orderIds)
              
              console.log(`✅ Updated payment status for ${orderIds.length} order(s) related to subscription ${subscription.id}`)
            }
          }

          // Also try to find order by invoice metadata or payment intent
          const paymentIntentId = invoice.payment_intent as string
          if (paymentIntentId) {
            const { data: ordersByPaymentIntent } = await supabase
              .from('orders')
              .select('id, payment_status')
              .eq('stripe_payment_intent_id', paymentIntentId)
              .in('payment_status', ['pending', 'processing'])

            if (ordersByPaymentIntent && ordersByPaymentIntent.length > 0) {
              await supabase
                .from('orders')
                .update({
                  payment_status: 'paid',
                  updated_at: new Date().toISOString(),
                })
                .in('id', ordersByPaymentIntent.map(o => o.id))
              
              console.log(`✅ Updated payment status for ${ordersByPaymentIntent.length} order(s) via payment intent ${paymentIntentId}`)
            }
          }
        }

        console.log(`✅ Invoice payment succeeded: ${invoice.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          // Check if subscription is incomplete and should be canceled
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            // If subscription is still incomplete after payment failure, cancel it
            if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
              await stripe.subscriptions.cancel(subscriptionId)
              console.log(`✅ Canceled incomplete subscription ${subscriptionId} due to invoice payment failure`)
            }
          } catch (subError: any) {
            console.log(`Could not check/cancel subscription ${subscriptionId}:`, subError.message)
          }

          // Update subscription status if needed
          const { data: subscription } = await supabase
            .from('customer_subscriptions')
            .select('id, status')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (subscription) {
            // Optionally pause subscription or mark for retry
            // For now, just log the failure
            console.log(`⚠️ Invoice payment failed for subscription: ${subscriptionId}`)
          }
        }

        console.log(`❌ Invoice payment failed: ${invoice.id}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id
        const stripeStatus = subscription.status

        // Map Stripe subscription status to our status
        let localStatus: 'active' | 'paused' | 'cancelled' | 'expired' | 'completed' | null = null
        
        if (stripeStatus === 'active' || stripeStatus === 'trialing') {
          localStatus = 'active'
        } else if (stripeStatus === 'canceled' || stripeStatus === 'cancelled') {
          localStatus = 'cancelled'
        } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') {
          localStatus = 'expired'
        } else if (stripeStatus === 'paused' || stripeStatus === 'incomplete') {
          localStatus = 'paused'
        }

        if (localStatus) {
          // Update customer subscription status if it exists
          const { data: customerSubscription } = await supabase
            .from('customer_subscriptions')
            .select('id, status')
            .eq('stripe_subscription_id', subscriptionId)
            .single()

          if (customerSubscription && customerSubscription.status !== localStatus) {
            const updateData: any = {
              status: localStatus,
              updated_at: new Date().toISOString(),
            }

            // Add cancelled_at if being cancelled
            if (localStatus === 'cancelled' && !customerSubscription.status) {
              updateData.cancelled_at = new Date().toISOString()
            }

            await supabase
              .from('customer_subscriptions')
              .update(updateData)
              .eq('id', customerSubscription.id)
            
            console.log(`✅ Updated customer subscription ${customerSubscription.id} from ${customerSubscription.status} to ${localStatus} (Stripe status: ${stripeStatus})`)
          }
        }

        console.log(`📦 Subscription updated: ${subscriptionId} (Stripe status: ${stripeStatus})`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id

        // Update customer subscription status if it exists
        const { data: customerSubscription } = await supabase
          .from('customer_subscriptions')
          .select('id, status')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (customerSubscription && customerSubscription.status !== 'cancelled') {
          await supabase
            .from('customer_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', customerSubscription.id)
          
          console.log(`✅ Updated customer subscription ${customerSubscription.id} to cancelled (Stripe subscription deleted)`)
        }

        console.log(`📦 Subscription deleted: ${subscriptionId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    )
  }
}

