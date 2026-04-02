import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Recover order from incomplete payment
 * Creates an order record from a successful payment that doesn't have an order
 */
export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    const supabase = createAdminSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can recover orders.' }, { status: 403 })
    }

    const body = await req.json()
    let { paymentIntentId, orderNumber, incompletePaymentId } = body

    if (!paymentIntentId && !orderNumber && !incompletePaymentId) {
      return NextResponse.json({ 
        error: 'Either paymentIntentId, orderNumber, or incompletePaymentId is required' 
      }, { status: 400 })
    }

    // Get Stripe configuration
    const { data: stripeSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeSettings = stripeSetting?.setting_value as any
    const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })

    let paymentIntent: Stripe.PaymentIntent | null = null
    let incompletePayment: any = null

    // Find incomplete payment record if ID provided
    if (incompletePaymentId) {
      const { data } = await supabase
        .from('incomplete_payments')
        .select('*')
        .eq('id', incompletePaymentId)
        .single()
      
      if (data) {
        incompletePayment = data
        paymentIntentId = data.stripe_payment_intent_id
      }
    }

    // Retrieve payment intent from Stripe
    if (paymentIntentId) {
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['customer'],
        })
      } catch (error: any) {
        return NextResponse.json({ 
          error: `Failed to retrieve payment intent: ${error.message}` 
        }, { status: 400 })
      }
    } else if (orderNumber) {
      // Search for payment intent by order number
      try {
        // First, try searching in metadata (most reliable)
        const searchResults = await stripe.paymentIntents.search({
          query: `metadata['orderNumber']:'${orderNumber}'`,
          limit: 10,
        })

        if (searchResults.data.length > 0) {
          // Use the first matching payment intent
          paymentIntent = searchResults.data[0]
          paymentIntentId = paymentIntent.id
        } else {
          // If not found in metadata, search recent payment intents and check descriptions
          // Since description is not a searchable field, we need to list and filter
          console.log(`Order number not found in metadata, searching recent payment intents for description containing: ${orderNumber}`)
          
          // List recent successful payment intents (last 100)
          const recentPayments = await stripe.paymentIntents.list({
            limit: 100,
            expand: ['data.customer'],
          })

          // Filter by description containing the order number
          const matchingPayment = recentPayments.data.find(
            (pi) => pi.description && pi.description.includes(orderNumber)
          )

          if (matchingPayment) {
            paymentIntent = matchingPayment
            paymentIntentId = paymentIntent.id
            // Extract order number from description if it matches the pattern
            // Description format: "Order BREVI-20260120-G0CD"
            const descriptionMatch = paymentIntent.description?.match(/Order\s+(BREVI-[\w-]+)/i)
            if (descriptionMatch && descriptionMatch[1]) {
              // Store the extracted order number to use later
              orderNumber = descriptionMatch[1]
            }
            console.log(`Found payment intent ${paymentIntentId} with order number in description: ${orderNumber}`)
          } else {
            return NextResponse.json({ 
              error: `Payment intent not found for order number: ${orderNumber}. The order number may only be in the description field, which requires searching recent payments. Please provide the Payment Intent ID (e.g., pi_3SrgQqGcTncGVTkL1A9a5UAq) directly from the Stripe Dashboard.` 
            }, { status: 404 })
          }
        }
      } catch (searchError: any) {
        console.error('Error searching Stripe for order number:', searchError)
        return NextResponse.json({ 
          error: `Failed to search Stripe: ${searchError.message}. Please provide the payment intent ID directly from Stripe Dashboard.` 
        }, { status: 400 })
      }
    }

    if (!paymentIntent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
    }

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, order_number')
      .or(`stripe_payment_intent_id.eq.${paymentIntent.id},order_number.eq.${paymentIntent.metadata?.orderNumber || ''}`)
      .limit(1)
      .maybeSingle()

    if (existingOrder) {
      return NextResponse.json({ 
        success: true,
        message: 'Order already exists',
        order: existingOrder,
      })
    }

    // Prefer checkout snapshot (full cart + address) when available
    const { data: snapshotRow } = await supabase
      .from('checkout_snapshots')
      .select('order_number, snapshot')
      .eq('payment_intent_id', paymentIntent.id)
      .maybeSingle()

    let usedSnapshot = false
    let customerEmail: string
    let customerFirstName: string
    let customerLastName: string
    let customerPhone: string | null = null
    let userId: string | null = null
    let shippingAddress: any
    let billingAddress: any
    let subtotal: number
    let discountAmount: number
    let shippingCost: number
    let taxAmount: number
    let total: number
    let finalOrderNumber: string
    const snapshotItems: Array<{ product_id: string; variant_id: string; product_title: string; variant_color: string; sku: string; quantity: number; unit_price: string; line_total: string; purchase_type: string }> = []

    if (snapshotRow?.snapshot) {
      const snap = snapshotRow.snapshot as any
      const cust = snap.customer || {}
      customerEmail = (cust.email || paymentIntent.metadata?.email || paymentIntent.receipt_email || '').trim()
      customerFirstName = (cust.firstName || paymentIntent.metadata?.firstName || '').trim() || 'Customer'
      customerLastName = (cust.lastName || paymentIntent.metadata?.lastName || '').trim()
      customerPhone = cust.phone || null
      const t = snap.totals || {}
      subtotal = parseFloat(t.subtotal ?? paymentIntent.metadata?.subtotal ?? '0') || paymentIntent.amount / 100
      discountAmount = parseFloat(t.discountAmount ?? paymentIntent.metadata?.discountAmount ?? '0')
      shippingCost = parseFloat(t.shippingCost ?? paymentIntent.metadata?.shipping ?? '0')
      taxAmount = parseFloat(t.taxAmount ?? paymentIntent.metadata?.tax ?? '0')
      total = parseFloat(t.total ?? '0') || paymentIntent.amount / 100
      shippingAddress = snap.shippingAddress && typeof snap.shippingAddress === 'object'
        ? {
            address_line1: snap.shippingAddress.address_line1 || '',
            address_line2: snap.shippingAddress.address_line2 || null,
            city: snap.shippingAddress.city || '',
            state: snap.shippingAddress.state || null,
            postal_code: snap.shippingAddress.postal_code || null,
            country: snap.shippingAddress.country || 'US',
            phone: snap.shippingAddress.phone || customerPhone,
          }
        : null
      billingAddress = snap.billingAddress && typeof snap.billingAddress === 'object'
        ? {
            address_line1: snap.billingAddress.address_line1 || '',
            address_line2: snap.billingAddress.address_line2 || null,
            city: snap.billingAddress.city || '',
            state: snap.billingAddress.state || null,
            postal_code: snap.billingAddress.postal_code || null,
            country: snap.billingAddress.country || 'US',
            phone: snap.billingAddress.phone || customerPhone,
          }
        : shippingAddress
      finalOrderNumber = snapshotRow.order_number || paymentIntent.metadata?.orderNumber || ''
      if (!finalOrderNumber && paymentIntent.description) {
        const m = paymentIntent.description.match(/Order\s+(BREVI-[\w-]+)/i)
        if (m?.[1]) finalOrderNumber = m[1]
      }
      if (!finalOrderNumber) {
        finalOrderNumber = `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      }
      if (Array.isArray(snap.items)) {
        snapshotItems.push(...snap.items.map((i: any) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          product_title: i.product_title || 'Product',
          variant_color: i.variant_color || 'Unknown',
          sku: i.sku || 'N/A',
          quantity: Number(i.quantity) || 1,
          unit_price: String(i.unit_price ?? '0'),
          line_total: String(i.line_total ?? '0'),
          purchase_type: i.purchase_type || 'one-time',
        })))
      }
      usedSnapshot = true
    }

    if (!usedSnapshot) {
      // Fallback: extract from payment intent only (no items, placeholder address possible)
      customerEmail = (paymentIntent.metadata?.email || paymentIntent.receipt_email || '').trim()
      customerFirstName = (paymentIntent.metadata?.firstName || '').trim() || 'Customer'
      customerLastName = (paymentIntent.metadata?.lastName || '').trim()

      let metadataOrderNumber = paymentIntent.metadata?.orderNumber
      if (!metadataOrderNumber && paymentIntent.description) {
        const descriptionMatch = paymentIntent.description.match(/Order\s+(BREVI-[\w-]+)/i)
        if (descriptionMatch?.[1]) metadataOrderNumber = descriptionMatch[1]
      }
      finalOrderNumber = metadataOrderNumber || orderNumber || 
        `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      if (!customerEmail) {
        return NextResponse.json({ 
          error: 'Customer email not found in payment intent. Cannot create order without email.' 
        }, { status: 400 })
      }

      if (customerEmail) {
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customerEmail.toLowerCase())
          .single()
        userId = customerProfile?.id || null
      }

      let addrShipping: any = null
      let addrBilling: any = null
      if (userId) {
        const { data: defaultAddress } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'shipping')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle()
        if (defaultAddress) {
          addrShipping = {
            address_line1: defaultAddress.address_line1 || '',
            address_line2: defaultAddress.address_line2 || null,
            city: defaultAddress.city || '',
            state: defaultAddress.state || null,
            postal_code: defaultAddress.postal_code || null,
            country: defaultAddress.country || 'US',
            phone: defaultAddress.phone || null,
          }
          addrBilling = addrShipping
        }
      }
      if (!addrShipping) {
        addrShipping = {
          address_line1: '[Address not available - please update]',
          address_line2: null,
          city: '[City not available - please update]',
          state: null,
          postal_code: null,
          country: 'US',
          phone: null,
        }
        addrBilling = addrShipping
      }
      shippingAddress = addrShipping
      billingAddress = addrBilling
      subtotal = parseFloat(paymentIntent.metadata?.subtotal || '0') || paymentIntent.amount / 100
      discountAmount = parseFloat(paymentIntent.metadata?.discountAmount || '0')
      shippingCost = parseFloat(paymentIntent.metadata?.shipping || '0')
      taxAmount = parseFloat(paymentIntent.metadata?.tax || '0')
      total = paymentIntent.amount / 100
    }

    // Resolve userId by email if not set (e.g. when used snapshot)
    if (userId == null && customerEmail) {
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail.toLowerCase())
        .single()
      userId = customerProfile?.id || null
    }

    if (!customerEmail) {
      return NextResponse.json({ 
        error: 'Customer email not found. Cannot create order without email.' 
      }, { status: 400 })
    }

    // Get charge ID if available
    let chargeId: string | null = null
    try {
      const charges = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['charges.data'],
      })
      chargeId = (charges as any).charges?.data?.[0]?.id || null
    } catch (chargeError) {
      console.error('Error retrieving charge:', chargeError)
    }

    const orderData: any = {
      order_number: finalOrderNumber,
      user_id: userId,
      customer_email: customerEmail,
      customer_first_name: customerFirstName,
      customer_last_name: customerLastName,
      customer_phone: customerPhone,
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

    if (chargeId) {
      orderData.stripe_charge_id = chargeId
    }

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError || !createdOrder) {
      console.error('Error creating order:', orderError)
      return NextResponse.json({ 
        error: orderError?.message || 'Failed to create order',
        details: orderError,
      }, { status: 500 })
    }

    // Insert order items from snapshot when available
    if (snapshotItems.length > 0) {
      const orderItemsToInsert = snapshotItems.map((item) => ({
        order_id: createdOrder.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_title: item.product_title,
        variant_color: item.variant_color,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        purchase_type: item.purchase_type,
      }))
      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert)
      if (itemsErr) {
        console.error('Error creating order items from snapshot:', itemsErr)
        // Order already created; don't fail recovery
      } else {
        await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntent.id)
      }
    }

    // Update incomplete_payment record if it exists
    if (incompletePayment || paymentIntentId) {
      const updateData: any = {
        recovered: true,
        recovered_at: new Date().toISOString(),
        recovery_reason: 'order_created_manually',
        order_id: createdOrder.id,
        order_number: finalOrderNumber,
        updated_at: new Date().toISOString(),
      }

      if (incompletePayment) {
        await supabase
          .from('incomplete_payments')
          .update(updateData)
          .eq('id', incompletePayment.id)
      } else {
        // Try to find by payment intent ID
        await supabase
          .from('incomplete_payments')
          .update(updateData)
          .eq('stripe_payment_intent_id', paymentIntent.id)
      }
    }

    // Award loyalty points if user exists
    if (userId) {
      try {
        const { awardPoints } = await import('@/app/actions/loyalty')
        const pointsToAward = Math.floor(total)
        await awardPoints(userId, pointsToAward, 'purchase', createdOrder.id)
      } catch (pointsError) {
        console.error('Error awarding loyalty points:', pointsError)
        // Non-critical, continue
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order recovered successfully',
      order: {
        id: createdOrder.id,
        order_number: createdOrder.order_number,
        total: createdOrder.total,
        payment_status: createdOrder.payment_status,
        note: usedSnapshot && snapshotItems.length > 0
          ? 'Order recovered with full line items and address from checkout snapshot.'
          : usedSnapshot
            ? 'Address and totals recovered from snapshot; add order items manually if needed.'
            : '⚠️ Order items and/or address may need to be updated manually. Please review the order details.',
      },
    })
  } catch (error: any) {
    console.error('Error recovering order:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to recover order' 
    }, { status: 500 })
  }
}
