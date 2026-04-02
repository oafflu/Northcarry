import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  // Get active bundles
  const { data: bundles, error } = await supabase
    .from('product_bundles')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get products for bundles
  const productIds = new Set<string>()
  bundles?.forEach(bundle => {
    bundle.main_products?.forEach((mp: any) => productIds.add(mp.product_id))
    bundle.bonus_products?.forEach((bp: any) => productIds.add(bp.product_id))
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
    .in('id', Array.from(productIds))
    .eq('status', 'active')

  return NextResponse.json({ bundles: bundles || [], products: products || [] })
}

