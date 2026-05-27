import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  EXTERNAL_GATEWAY_KEYS,
  normalizeExternalGatewaySettings,
  type ExternalGatewayKey,
} from '@/lib/external-gateways'

type VerifyBody = {
  gateway: ExternalGatewayKey
  reference: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerifyBody
    if (!body?.gateway || !EXTERNAL_GATEWAY_KEYS.includes(body.gateway) || !body?.reference) {
      return NextResponse.json({ success: false, error: 'Invalid verification request' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const { data: row } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', body.gateway)
      .single()
    const settings = normalizeExternalGatewaySettings(row?.setting_value)
    if (!settings.enabled) {
      return NextResponse.json({ success: false, error: `${body.gateway} is disabled` }, { status: 400 })
    }

    if (body.gateway === 'paystack' && settings.secret_key) {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
        },
      })
      const data = await verifyRes.json()
      const paid = Boolean(data?.status && data?.data?.status === 'success')
      return NextResponse.json({
        success: paid,
        paid,
        gateway: body.gateway,
        reference: body.reference,
        raw: data,
        error: paid ? null : data?.message || 'Paystack verification failed',
      })
    }

    // Generic verification endpoint mode (Kora/Chipper/2Checkout custom APIs).
    if (settings.verify_url) {
      const verifyUrl = settings.verify_url.includes('{reference}')
        ? settings.verify_url.replace('{reference}', encodeURIComponent(body.reference))
        : `${settings.verify_url}${settings.verify_url.includes('?') ? '&' : '?'}reference=${encodeURIComponent(body.reference)}`

      const verifyRes = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          ...(settings.secret_key ? { Authorization: `Bearer ${settings.secret_key}` } : {}),
          ...(settings.public_key ? { 'X-Public-Key': settings.public_key } : {}),
        },
      })
      const data = await verifyRes.json().catch(() => ({}))
      const statusValue =
        data?.data?.status || data?.status || data?.data?.payment_status || data?.payment_status || ''
      const paid = ['success', 'successful', 'paid', 'completed', true].includes(
        typeof statusValue === 'string' ? statusValue.toLowerCase() : statusValue
      )
      return NextResponse.json({
        success: paid,
        paid,
        gateway: body.gateway,
        reference: body.reference,
        raw: data,
        error: paid ? null : data?.message || 'Gateway verification failed',
      })
    }

    // If no verification endpoint is configured, do not auto-approve.
    return NextResponse.json(
      { success: false, paid: false, error: 'No verification endpoint configured for this gateway' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('External verify error:', error)
    return NextResponse.json(
      { success: false, paid: false, error: error?.message || 'Failed to verify external payment' },
      { status: 500 }
    )
  }
}
