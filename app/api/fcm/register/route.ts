'use server'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { token, deviceType = 'web' } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if token already exists
    const adminSupabase = createAdminSupabaseClient()
    const { data: existing } = await adminSupabase
      .from('fcm_tokens')
      .select('id')
      .eq('token', token)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Update existing token
      await adminSupabase
        .from('fcm_tokens')
        .update({
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Insert new token
      await adminSupabase
        .from('fcm_tokens')
        .insert({
          user_id: user.id,
          token,
          device_type: deviceType,
          browser_info: {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          },
        })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('FCM token registration error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminSupabase = createAdminSupabaseClient()
    await adminSupabase
      .from('fcm_tokens')
      .update({ is_active: false })
      .eq('token', token)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('FCM token removal error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
