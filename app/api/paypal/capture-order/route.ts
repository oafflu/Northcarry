import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get PayPal configuration
    const adminSupabase = createAdminSupabaseClient()
    const { data: paypalSetting } = await adminSupabase
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
        { error: 'PayPal is not configured' },
        { status: 400 }
      )
    }

    // Get access token from PayPal
    const baseUrl = mode === 'live' 
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'

    // Create Basic Auth header
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

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

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('PayPal token error:', errorData)
      return NextResponse.json(
        { error: 'Failed to authenticate with PayPal' },
        { status: 500 }
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Capture the order
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!captureResponse.ok) {
      const errorData = await captureResponse.text()
      console.error('PayPal capture error:', errorData)
      return NextResponse.json(
        { error: 'Failed to capture PayPal order' },
        { status: 500 }
      )
    }

    const captureData = await captureResponse.json()

    // Update order in database
    const { data: order } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('payment_intent_id', orderId)
      .single()

    if (order) {
      await adminSupabase
        .from('orders')
        .update({
          payment_status: captureData.status === 'COMPLETED' ? 'paid' : 'pending',
          metadata: {
            ...(order.metadata || {}),
            paypal_capture: captureData,
            paypal_status: captureData.status,
          },
        })
        .eq('id', order.id)
      
      // Note: Subscriptions will be created by the createOrder function
      // when called from the checkout page after PayPal payment success
      // The createOrder function already handles subscription creation
    }

    return NextResponse.json({
      id: captureData.id,
      status: captureData.status,
      payer: captureData.payer,
      purchase_units: captureData.purchase_units,
    })
  } catch (error: any) {
    console.error('PayPal capture order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to capture PayPal order' },
      { status: 500 }
    )
  }
}

