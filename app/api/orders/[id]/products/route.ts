import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: orderItems, error } = await supabase
    .from('order_items')
    .select('product_id')
    .eq('order_id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const productIds = orderItems?.map(item => item.product_id).filter(Boolean) || []
  return NextResponse.json({ product_ids: productIds })
}

