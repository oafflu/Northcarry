'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').toString().toLowerCase().trim()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email is required.' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const unsubscribedAt = new Date().toISOString()

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .eq('role', 'customer')
      .maybeSingle()

    // Update email_subscribers (include user_id when we know the customer so admin "Marketing Emails" stays in sync)
    await supabase
      .from('email_subscribers')
      .upsert(
        {
          email,
          user_id: profileRow?.id ?? null,
          status: 'unsubscribed',
          unsubscribed_at: unsubscribedAt,
        },
        { onConflict: 'email' }
      )

    // Update newsletter_subscriptions if present
    await supabase
      .from('newsletter_subscriptions')
      .update({
        status: 'unsubscribed',
        unsubscribed_at: unsubscribedAt,
        updated_at: unsubscribedAt,
      })
      .eq('email', email)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in unsubscribe API:', error)
    return NextResponse.json({ success: false, error: 'Failed to process unsubscribe.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ success: false, error: 'A valid email is required.' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('email_subscribers')
    .select('status, unsubscribed_at')
    .eq('email', email)
    .single()

  return NextResponse.json({
    success: true,
    email,
    status: data?.status || 'active',
    unsubscribed_at: data?.unsubscribed_at || null,
  })
}
