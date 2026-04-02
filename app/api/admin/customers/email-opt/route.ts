'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function ensureAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()
  if (profile?.role !== 'admin') {
    return null
  }
  return { supabaseAdmin: createAdminSupabaseClient() }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })

  const auth = await ensureAdmin()
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = auth.supabaseAdmin

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  const email = profile?.email?.toLowerCase().trim()
  if (!email) return NextResponse.json({ success: true, status: 'unknown' })

  let status: string | undefined

  const { data: byUserId } = await supabase
    .from('email_subscribers')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()

  if (byUserId?.status) {
    status = byUserId.status
  } else {
    const { data: byEmail } = await supabase
      .from('email_subscribers')
      .select('status')
      .eq('email', email)
      .maybeSingle()
    if (byEmail?.status) {
      status = byEmail.status
    }
  }

  if (!status || status === 'unknown') {
    const { data: nl } = await supabase
      .from('newsletter_subscriptions')
      .select('status')
      .eq('email', email)
      .maybeSingle()
    if (nl?.status === 'unsubscribed' || nl?.status === 'bounced') {
      status = 'unsubscribed'
    } else if (nl?.status === 'active') {
      status = 'active'
    }
  }

  return NextResponse.json({
    success: true,
    status: status || 'unknown',
    email,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { userId, optIn } = body
  if (!userId || typeof optIn !== 'boolean') {
    return NextResponse.json({ success: false, error: 'userId and optIn are required' }, { status: 400 })
  }

  const auth = await ensureAdmin()
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = auth.supabaseAdmin

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  const email = profile?.email?.toLowerCase().trim()
  if (!email) {
    return NextResponse.json({ success: false, error: 'Customer email not found' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const status = optIn ? 'active' : 'unsubscribed'

  await supabase
    .from('email_subscribers')
    .upsert(
      {
        email,
        user_id: userId,
        status,
        unsubscribed_at: optIn ? null : now,
      },
      { onConflict: 'email' }
    )

  await supabase
    .from('newsletter_subscriptions')
    .update({
      status,
      unsubscribed_at: optIn ? null : now,
      updated_at: now,
    })
    .eq('email', email)

  return NextResponse.json({ success: true, status })
}
