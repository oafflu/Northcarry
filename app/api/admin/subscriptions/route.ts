import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get all subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_products (
          *,
          products (id, title),
          product_variants (id, sku, color, price)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      subscriptions: subscriptions || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/subscriptions:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

