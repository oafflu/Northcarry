import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { normalizeExternalGatewaySettings } from '@/lib/external-gateways'
import { isPayoneerPaymentSuccessful } from '@/lib/payoneer-checkout'

function verifyPayoneerSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return signature === expected
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody || '{}') as Record<string, unknown>

    const supabase = createAdminSupabaseClient()
    const { data: row } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payoneer')
      .single()

    const settings = normalizeExternalGatewaySettings(row?.setting_value)
    const signature =
      req.headers.get('x-payoneer-signature') ||
      req.headers.get('x-optile-signature') ||
      req.headers.get('x-signature')

    const webhookSecret = settings.webhook_secret?.trim() || settings.secret_key?.trim()
    if (webhookSecret && !verifyPayoneerSignature(rawBody, signature, webhookSecret)) {
      console.warn('[Payoneer webhook] Invalid signature')
      return NextResponse.json({ received: false }, { status: 401 })
    }

    const event = (body.event as string) || (body.type as string) || ''
    const data = (body.data as Record<string, unknown>) || body
    const isSuccessEvent = /success|charged|paid|completed/i.test(event)
    const paid = isSuccessEvent || isPayoneerPaymentSuccessful(data)

    if (paid) {
      console.log('[Payoneer webhook] Payment notification received', {
        event,
        reference: data.reference || data.transactionId,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Payoneer webhook] Error:', error)
    return NextResponse.json({ received: true })
  }
}
