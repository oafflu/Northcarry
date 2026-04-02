import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

interface PaymentIntentRequest {
  amount: number
  currency?: string
  customerEmail?: string
  customerId?: string
  metadata?: Record<string, string>
}

export async function POST(req: NextRequest) {
  try {
    const body: PaymentIntentRequest = await req.json()
    const { amount, currency = 'usd', customerEmail, customerId, metadata = {} } = body

    // Get Stripe configuration
    const adminSupabase = createAdminSupabaseClient()
    const { data: stripeSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeSettings = stripeSetting?.setting_value as any
    const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY
    const stripeEnabled = stripeSettings?.enabled !== false

    if (!stripeEnabled || !stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 400 }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })

    // Get enabled payment methods
    const { data: paymentMethodsSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_payment_methods')
      .single()

    const enabledMethods = paymentMethodsSetting?.setting_value as any || {}
    const safePaymentMethodTypes: string[] = ['card']
    if (enabledMethods.link === true) {
      safePaymentMethodTypes.push('link')
    }

    // Validate amount
    const amountInCents = Math.round(amount * 100)
    if (amountInCents < 50) {
      return NextResponse.json(
        { error: 'Amount must be at least $0.50' },
        { status: 400 }
      )
    }

    // Create or get Stripe customer
    let finalCustomerId = customerId
    if (!finalCustomerId && customerEmail) {
      const customers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      })

      if (customers.data.length > 0) {
        finalCustomerId = customers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          metadata: metadata,
        })
        finalCustomerId = customer.id
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      customer: finalCustomerId || undefined,
      payment_method_types: safePaymentMethodTypes,
      metadata: metadata,
      confirmation_method: 'automatic',
      confirm: false, // Will be confirmed on client side
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: finalCustomerId,
    })
  } catch (error: any) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}

