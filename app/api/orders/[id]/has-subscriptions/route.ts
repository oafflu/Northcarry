import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminSupabaseClient()
    
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('purchase_type')
      .eq('order_id', id)
    
    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json({ hasSubscriptions: false })
    }
    
    const hasSubscriptions = orderItems.some((item: any) => 
      item.purchase_type === 'subscription' || item.purchase_type === 'prepaid'
    )
    
    return NextResponse.json({ hasSubscriptions })
  } catch (error: any) {
    console.error('Error checking subscriptions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check subscriptions' },
      { status: 500 }
    )
  }
}

