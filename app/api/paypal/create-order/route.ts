import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, currency = 'USD', items, customerEmail, customerName, hasSubscriptions, subscriptionType, tax = 0, shipping = 0, discount = 0 } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    // Ensure amount is a number
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0
    if (numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
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

    // Process items and calculate item_total
    const processedItems = items?.map((item: any) => {
      // Ensure price is a number and format it
      const itemPrice = typeof item.price === 'number' 
        ? item.price 
        : parseFloat(item.price) || 0
      
      return {
        name: item.name || 'Product',
        quantity: item.quantity.toString(),
        unit_amount: {
          currency_code: currency,
          value: itemPrice.toFixed(2),
        },
        price: itemPrice,
        qty: item.quantity,
      }
    }) || []

    // Calculate item_total (sum of all item prices * quantities)
    const itemTotal = processedItems.reduce((sum: number, item: any) => {
      return sum + (item.price * item.qty)
    }, 0)

    // Ensure breakdown components are numbers
    const taxAmount = typeof tax === 'number' ? tax : parseFloat(tax) || 0
    const shippingAmount = typeof shipping === 'number' ? shipping : parseFloat(shipping) || 0
    const discountAmount = typeof discount === 'number' ? discount : parseFloat(discount) || 0

    // Calculate the expected total from breakdown
    // total = item_total + tax + shipping - discount
    const calculatedTotal = itemTotal + taxAmount + shippingAmount - discountAmount

    // Build breakdown object
    const breakdown: any = {
      item_total: {
        currency_code: currency,
        value: itemTotal.toFixed(2),
      },
    }

    // Only include breakdown components if they're greater than 0
    if (taxAmount > 0) {
      breakdown.tax_total = {
        currency_code: currency,
        value: taxAmount.toFixed(2),
      }
    }
    if (shippingAmount > 0) {
      breakdown.shipping = {
        currency_code: currency,
        value: shippingAmount.toFixed(2),
      }
    }
    if (discountAmount > 0) {
      breakdown.discount = {
        currency_code: currency,
        value: discountAmount.toFixed(2),
      }
    }

    // Use the calculated total to ensure it matches the breakdown
    const finalAmount = Math.max(0, calculatedTotal)

    // Create PayPal order
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: finalAmount.toFixed(2),
            breakdown,
          },
          items: processedItems.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unit_amount: item.unit_amount,
          })),
          description: `Order from BREVI`,
        },
      ],
      application_context: {
        brand_name: 'BREVI',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/checkout/paypal/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/checkout`,
      },
    }

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `order-${Date.now()}`,
      },
      body: JSON.stringify(orderData),
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text()
      console.error('PayPal order creation error:', {
        status: orderResponse.status,
        statusText: orderResponse.statusText,
        errorData,
        orderData: JSON.stringify(orderData, null, 2),
      })
      let errorMessage = 'Failed to create PayPal order'
      try {
        const errorJson = JSON.parse(errorData)
        errorMessage = errorJson.message || errorJson.error_description || errorJson.details?.[0]?.description || errorMessage
        if (errorJson.details && Array.isArray(errorJson.details)) {
          const details = errorJson.details.map((d: any) => d.description || d.issue).filter(Boolean).join(', ')
          if (details) {
            errorMessage = `${errorMessage}: ${details}`
          }
        }
      } catch {
        // If parsing fails, use the raw error data (truncated if too long)
        errorMessage = errorData.length > 200 ? errorData.substring(0, 200) + '...' : errorData || errorMessage
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    const order = await orderResponse.json()

    // Store order in database for tracking (pending order)
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    const userId = user?.id

    // Store subscription metadata if present
    const subscriptionMetadata: any = {}
    if (hasSubscriptions) {
      subscriptionMetadata.has_subscriptions = true
      subscriptionMetadata.subscription_type = subscriptionType
      subscriptionMetadata.subscription_items = items?.filter((item: any) => 
        item.purchaseType === 'subscription' || item.purchaseType === 'prepaid'
      ).map((item: any) => ({
        subscription_id: item.subscriptionId,
        purchase_type: item.purchaseType,
        frequency: item.frequency,
        shipping_days: item.shippingDays,
      }))
    }

    // Insert order into database (customer email/name are optional at this stage)
    const { error: insertError } = await adminSupabase
      .from('orders')
      .insert({
        user_id: userId || null,
        customer_email: customerEmail || null,
        customer_name: customerName || null,
        total_amount: numericAmount,
        currency: currency,
        payment_status: 'pending',
        payment_method: 'paypal',
        payment_intent_id: order.id, // Store PayPal order ID
        metadata: {
          paypal_order_id: order.id,
          paypal_status: order.status,
          ...subscriptionMetadata,
        },
      })

    if (insertError) {
      console.error('Error inserting order into database:', insertError)
      // Don't fail the PayPal order creation if DB insert fails
      // The order will be created when payment is captured
    }

    return NextResponse.json({
      id: order.id,
      status: order.status,
    })
  } catch (error: any) {
    console.error('PayPal create order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create PayPal order' },
      { status: 500 }
    )
  }
}

