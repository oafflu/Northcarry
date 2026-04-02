import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Called when the customer returns from 3DS redirect (e.g. /checkout/success).
 * Creates the order from the checkout snapshot so we don't rely on the client
 * still having the checkout page open. No auth required — only the return URL
 * from Stripe contains the payment_intent id.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const paymentIntentId = (body.paymentIntentId || body.payment_intent_id || new URL(req.url).searchParams.get('payment_intent_id')) as string | null
    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid payment_intent_id' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const { data: stripeSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()
    const stripeSettings = stripeSetting?.setting_value as any
    const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY
    if (!stripeSecretKey) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 500 })
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['charges.data'] })
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({
        success: false,
        error: `Payment not completed (status: ${paymentIntent.status}). Complete payment first.`,
      }, { status: 400 })
    }

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle()
    if (existingOrder) {
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        alreadyExists: true,
      })
    }

    const { data: snapshotRow } = await supabase
      .from('checkout_snapshots')
      .select('order_number, snapshot')
      .eq('payment_intent_id', paymentIntent.id)
      .maybeSingle()

    if (!snapshotRow?.snapshot) {
      return NextResponse.json({
        success: false,
        error: 'No checkout snapshot found. Order may already exist or payment was from an older flow.',
      }, { status: 404 })
    }

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
    const shippingAddress = snap.shippingAddress && typeof snap.shippingAddress === 'object'
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

    const chargeId = (paymentIntent as any).charges?.data?.[0]?.id || null
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

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id, order_number')
      .single()

    let order = createdOrder
    if (orderError?.code === '23505') {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle()
      if (existing) {
        order = existing
        await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntent.id)
        return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.order_number, alreadyExists: true })
      }
    }

    if (orderError || !order) {
      console.error('complete-return: order insert failed', orderError)
      return NextResponse.json({ success: false, error: orderError?.message || 'Failed to create order' }, { status: 500 })
    }

    const snapshotItems = Array.isArray(snap.items) ? snap.items : []
    if (snapshotItems.length > 0) {
      const orderItemsToInsert = snapshotItems.map((i: any) => ({
        order_id: order!.id,
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

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
    })
  } catch (err: any) {
    console.error('complete-return error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 })
  }
}
