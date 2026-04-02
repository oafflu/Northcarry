import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const searchParams = request.nextUrl.searchParams
  const orderValue = searchParams.get('order_value')
  const productIds = searchParams.get('product_ids')?.split(',')

  let query = supabase
    .from('post_purchase_upsells')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: upsells, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by trigger conditions
  const applicableUpsells = upsells?.filter(upsell => {
    if (upsell.trigger_type === 'always') return true
    if (upsell.trigger_type === 'order_value' && orderValue) {
      const minValue = upsell.trigger_conditions?.min_value
      return !minValue || parseFloat(orderValue) >= minValue
    }
    if (upsell.trigger_type === 'product_purchased' && productIds) {
      const requiredProducts = upsell.trigger_conditions?.product_ids || []
      return requiredProducts.some((id: string) => productIds.includes(id))
    }
    return false
  }) || []

  // Get products for upsells
  const upsellProductIds = new Set<string>()
  applicableUpsells.forEach(upsell => {
    upsell.upsell_products?.forEach((up: any) => upsellProductIds.add(up.product_id))
  })

  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      title,
      slug,
      base_price,
      product_variants (
        id, 
        color, 
        price, 
        image_url,
        subscription_products (
          id,
          is_subscription_enabled,
          subscription_price,
          prepaid_price,
          one_time_price,
          available_frequencies,
          shipping_days
        )
      )
    `)
    .in('id', Array.from(upsellProductIds))
    .eq('status', 'active')

  return NextResponse.json({ upsells: applicableUpsells, products: products || [] })
}

