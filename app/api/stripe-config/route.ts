import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const adminSupabase = createAdminSupabaseClient()
    
    const { data: stripeSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeSettings = stripeSetting?.setting_value as any
    const publishableKey = stripeSettings?.publishable_key || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    const enabled = stripeSettings?.enabled !== false

    if (!enabled || !publishableKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      publishableKey,
      enabled,
    })
  } catch (error: any) {
    console.error('Error getting Stripe config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get Stripe configuration' },
      { status: 500 }
    )
  }
}

