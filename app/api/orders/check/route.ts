import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const paymentIntentId = searchParams.get('paymentIntentId')
    
    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminSupabaseClient()
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, user_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking order:', error)
      return NextResponse.json(
        { error: 'Failed to check order' },
        { status: 500 }
      )
    }
    
    if (order) {
      return NextResponse.json({
        exists: true,
        orderId: order.id,
        orderNumber: order.order_number,
        userId: order.user_id,
      })
    }
    
    return NextResponse.json({
      exists: false,
    })
  } catch (error: any) {
    console.error('Error in order check API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

