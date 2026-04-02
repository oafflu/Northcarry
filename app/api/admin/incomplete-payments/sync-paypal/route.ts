import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Sync incomplete payments from PayPal
 * Queries incomplete PayPal orders from our database and imports them into incomplete_payments table
 * Note: PayPal's API doesn't support listing all orders, so we query our own database
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await req.json()
    const { limit = 100, startAfter } = body

    let imported = 0
    let skipped = 0
    let errors: string[] = []
    let hasMore = false
    let nextStartAfter: string | null = null

    // Get PayPal configuration
    const { data: paypalSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'paypal')
      .single()

    const paypalSettings = paypalSetting?.setting_value as any
    const clientId = paypalSettings?.client_id
    const clientSecret = paypalSettings?.client_secret
    const mode = paypalSettings?.mode || 'sandbox'
    const enabled = paypalSettings?.enabled

    if (!enabled || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'PayPal is not configured. Please configure it in /admin/settings/payment.' },
        { status: 400 }
      )
    }

    // Get access token from PayPal (for fetching order details)
    const baseUrl = mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    let accessToken: string | null = null
    try {
      const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
        }),
      })

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        accessToken = tokenData.access_token
      }
    } catch (err) {
      console.warn('Could not get PayPal access token, will use database data only:', err)
    }

    // Query incomplete PayPal orders from our database
    // These are orders created but not completed
    const currentOffset = parseInt(startAfter || '0')
    
    // Query all incomplete orders first, then filter for PayPal
    const { data: allIncompleteOrders, error: queryError } = await supabase
      .from('orders')
      .select('id, order_number, user_id, customer_email, customer_first_name, customer_last_name, customer_name, total, total_amount, currency, payment_status, payment_method, payment_intent_id, stripe_payment_intent_id, metadata, created_at')
      .in('payment_status', ['pending', 'failed'])
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + limit - 1)
    
    if (queryError) {
      console.error('Error querying incomplete PayPal orders:', {
        error: queryError,
        message: queryError.message,
        code: queryError.code,
        details: queryError.details,
        hint: queryError.hint,
      })
      return NextResponse.json(
        { 
          error: 'Failed to query incomplete PayPal orders from database', 
          details: queryError.message,
          code: queryError.code,
          hint: queryError.hint,
        },
        { status: 500 }
      )
    }
    
    // Filter for PayPal orders (check payment_method field or metadata)
    const incompleteOrders = (allIncompleteOrders || []).filter((order: any) => {
      // Check if payment_method is 'paypal'
      if (order.payment_method === 'paypal') {
        return true
      }
      // Check metadata for PayPal indicators
      if (order.metadata?.paypal_order_id || order.metadata?.paypal_status) {
        return true
      }
      // Check if payment_intent_id looks like a PayPal order ID
      if (order.payment_intent_id && order.payment_intent_id.length > 10) {
        return true
      }
      return false
    })

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('payment_status', ['pending', 'failed'])

    // Process each incomplete order from our database
    for (const order of incompleteOrders) {
      try {
        // Get PayPal order ID from payment_intent_id or metadata
        const paypalOrderId = order.payment_intent_id || order.metadata?.paypal_order_id
        if (!paypalOrderId) {
          skipped++
          continue
        }

        // Skip if already in incomplete_payments
        const { data: existingByPaypalId } = await supabase
          .from('incomplete_payments')
          .select('id')
          .eq('paypal_order_id', paypalOrderId)
          .maybeSingle()
        
        const { data: existingByStripeId } = await supabase
          .from('incomplete_payments')
          .select('id')
          .eq('stripe_payment_intent_id', `paypal_${paypalOrderId}`)
          .maybeSingle()
        
        const existing = existingByPaypalId || existingByStripeId

        if (existing) {
          skipped++
          continue
        }

        // Get PayPal order details from PayPal API to get more info (optional)
        let paypalOrderDetails: any = null
        if (accessToken && paypalOrderId) {
          try {
            const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
            })

            if (orderResponse.ok) {
              paypalOrderDetails = await orderResponse.json()
            }
          } catch (err) {
            console.warn('Could not fetch PayPal order details:', paypalOrderId)
          }
        }

        // Determine failure reason
        let failureReason: string | null = null
        let failureMessage: string | null = null

        if (order.payment_status === 'failed') {
          failureReason = 'payment_failed'
          failureMessage = 'Payment failed'
        } else if (paypalOrderDetails) {
          if (paypalOrderDetails.status === 'CANCELLED') {
            failureReason = 'cancelled'
            failureMessage = 'Order was cancelled by customer'
          } else if (paypalOrderDetails.status === 'VOIDED') {
            failureReason = 'voided'
            failureMessage = 'Order was voided'
          } else if (['CREATED', 'SAVED', 'APPROVED'].includes(paypalOrderDetails.status)) {
            failureReason = 'incomplete'
            failureMessage = 'Order was created but not completed'
          }
        } else {
          failureReason = 'incomplete'
          failureMessage = 'Order is pending payment'
        }

        // Get cart items from order metadata or PayPal order details
        let cartItems: any[] = []
        if (order.metadata?.items) {
          cartItems = order.metadata.items
        } else if (paypalOrderDetails?.purchase_units?.[0]?.items) {
          cartItems = paypalOrderDetails.purchase_units[0].items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.unit_amount?.value || 0),
            sku: item.sku,
          }))
        }

        // Insert into incomplete_payments
        const { error: insertError } = await supabase
          .from('incomplete_payments')
          .insert({
            user_id: order.user_id,
            customer_email: order.customer_email || 'unknown@example.com',
            customer_name: order.customer_name || (order.customer_first_name ? `${order.customer_first_name} ${order.customer_last_name || ''}`.trim() : null) || null,
            paypal_order_id: paypalOrderId,
            stripe_payment_intent_id: `paypal_${paypalOrderId}`,
            payment_method: 'paypal',
            payment_amount: parseFloat((order.total_amount || order.total || 0).toString()),
            currency: order.currency || 'usd',
            failure_reason: failureReason,
            failure_message: failureMessage,
            order_id: order.id,
            order_number: order.order_number,
            cart_items: cartItems.length > 0 ? cartItems : null,
            recovered: false,
            email_sent: false,
            automation_triggered: false,
            retry_count: 0,
          })

        if (insertError) {
          console.error('Error inserting PayPal incomplete payment:', insertError)
          errors.push(`Failed to insert order ${order.id}: ${insertError.message}`)
          continue
        }

        imported++
      } catch (error: any) {
        console.error('Error processing PayPal order:', order.id, error)
        errors.push(`Failed to process order ${order.id}: ${error.message}`)
      }
    }

    // Check if there are more orders for pagination
    hasMore = totalCount ? currentOffset + limit < totalCount : false
    if (hasMore) {
      nextStartAfter = (currentOffset + limit).toString()
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      hasMore,
      nextStartAfter,
    })
  } catch (error: any) {
    console.error('Error syncing PayPal incomplete payments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync PayPal incomplete payments', details: error.stack },
      { status: 500 }
    )
  }
}
