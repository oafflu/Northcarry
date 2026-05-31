import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  EXTERNAL_GATEWAY_KEYS,
  isExternalGatewayConfigured,
  normalizeExternalGatewaySettings,
  normalizePayoneerSettings,
  type ExternalGatewayKey,
} from '@/lib/external-gateways'
import {
  createPayoneerListSession,
  getPayoneerIntegrationMode,
} from '@/lib/payoneer-checkout'

type InitBody = {
  gateway: ExternalGatewayKey
  amount: number
  currency: string
  email: string
  country?: string
  firstName?: string
  lastName?: string
  metadata?: Record<string, any>
}

function resolveCallbackUrl(baseUrl: string, configured: string | undefined, gateway: string, reference: string) {
  const raw =
    configured?.trim() ||
    `${baseUrl}/checkout?payment_status=success&gateway=${encodeURIComponent(gateway)}&reference=${encodeURIComponent(reference)}`
  return raw
    .replace('{reference}', encodeURIComponent(reference))
    .replace('{gateway}', encodeURIComponent(gateway))
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InitBody
    if (!body?.gateway || !EXTERNAL_GATEWAY_KEYS.includes(body.gateway)) {
      return NextResponse.json({ success: false, error: 'Invalid gateway' }, { status: 400 })
    }
    if (!body?.email || !body?.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'Missing required payment fields' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const { data: row } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', body.gateway)
      .single()
    const settings =
      body.gateway === 'payoneer'
        ? normalizePayoneerSettings(row?.setting_value)
        : normalizeExternalGatewaySettings(row?.setting_value)
    if (!settings.enabled) {
      return NextResponse.json({ success: false, error: `${body.gateway} is disabled` }, { status: 400 })
    }

    if (!isExternalGatewayConfigured(body.gateway, settings)) {
      return NextResponse.json(
        { success: false, error: `${body.gateway} is enabled but not fully configured` },
        { status: 400 }
      )
    }

    const reference = `${body.gateway}_${randomUUID().replace(/-/g, '')}`
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
    const callbackUrl = resolveCallbackUrl(baseUrl, settings.callback_url, body.gateway, reference)

    if (body.gateway === 'payoneer') {
      const cancelUrl =
        settings.callback_url?.trim().replace('payment_status=success', 'payment_status=cancelled') ||
        `${baseUrl}/checkout?payment_status=cancelled&gateway=payoneer`

      const payoneerSession = await createPayoneerListSession({
        settings,
        reference,
        amount: body.amount,
        currency: body.currency || 'USD',
        email: body.email,
        country: body.country || 'US',
        firstName: body.firstName,
        lastName: body.lastName,
        returnUrl: callbackUrl,
        cancelUrl,
      })

      const mode = getPayoneerIntegrationMode(settings)
      const env = settings.mode === 'live' ? 'live' : 'test'

      if (mode === 'hosted') {
        const redirectUrl = payoneerSession.redirectUrl
        if (!redirectUrl) {
          return NextResponse.json(
            { success: false, error: 'Payoneer hosted checkout URL was not returned' },
            { status: 400 }
          )
        }
        return NextResponse.json({
          success: true,
          gateway: body.gateway,
          reference,
          redirectUrl,
          payoneerSessionId: payoneerSession.longId,
        })
      }

      return NextResponse.json({
        success: true,
        gateway: body.gateway,
        reference,
        embedded: true,
        payoneer: {
          longId: payoneerSession.longId,
          listUrl: payoneerSession.listUrl,
          env,
        },
        payoneerSessionId: payoneerSession.longId,
      })
    }

    // Provider-specific fast path for Paystack.
    if (body.gateway === 'paystack' && settings.secret_key) {
      const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: body.email,
          amount: Math.round(body.amount * 100),
          currency: body.currency || 'USD',
          reference,
          callback_url: callbackUrl,
          metadata: body.metadata || {},
        }),
      })
      const data = await paystackRes.json()
      if (!paystackRes.ok || !data?.status || !data?.data?.authorization_url) {
        return NextResponse.json(
          { success: false, error: data?.message || 'Failed to initialize Paystack payment' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        gateway: body.gateway,
        reference,
        redirectUrl: data.data.authorization_url,
      })
    }

    // Generic initialize endpoint mode for providers like Kora/Chipper/2Checkout.
    if (settings.initialize_url) {
      const initRes = await fetch(settings.initialize_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.secret_key ? { Authorization: `Bearer ${settings.secret_key}` } : {}),
          ...(settings.public_key ? { 'X-Public-Key': settings.public_key } : {}),
        },
        body: JSON.stringify({
          amount: body.amount,
          currency: body.currency || 'USD',
          email: body.email,
          reference,
          callback_url: callbackUrl,
          metadata: body.metadata || {},
        }),
      })
      const data = await initRes.json().catch(() => ({}))
      const redirectUrl =
        data?.data?.checkout_url ||
        data?.data?.payment_link ||
        data?.data?.authorization_url ||
        data?.checkout_url ||
        data?.payment_link ||
        data?.authorization_url

      if (!initRes.ok || !redirectUrl) {
        return NextResponse.json(
          { success: false, error: data?.message || 'Gateway initialization failed' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        gateway: body.gateway,
        reference,
        redirectUrl,
      })
    }

    // Hosted URL template fallback.
    if (settings.checkout_url_template) {
      const redirectUrl = settings.checkout_url_template
        .replace('{reference}', encodeURIComponent(reference))
        .replace('{amount}', encodeURIComponent(String(body.amount)))
        .replace('{currency}', encodeURIComponent(body.currency || 'USD'))
        .replace('{email}', encodeURIComponent(body.email))
        .replace('{callback_url}', encodeURIComponent(callbackUrl))

      return NextResponse.json({
        success: true,
        gateway: body.gateway,
        reference,
        redirectUrl,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Gateway is enabled but not configured for initialization' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('External initialize error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to initialize external payment' },
      { status: 500 }
    )
  }
}
