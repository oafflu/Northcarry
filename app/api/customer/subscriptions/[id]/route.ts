import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: subscription, error } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_products (
          *,
          products (id, title, base_price, compare_at_price),
          product_variants (id, sku, color, price)
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(subscription)
  } catch (error: any) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

