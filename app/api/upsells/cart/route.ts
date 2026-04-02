import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const searchParams = request.nextUrl.searchParams
  const cartValue = searchParams.get('cart_value')
  const cartProductIds = searchParams.get('product_ids')?.split(',').filter(Boolean) || []

  let query = supabase
    .from('cart_upsells')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  const { data: upsells, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by conditions
  const applicableUpsells = upsells?.filter(upsell => {
    // Check cart value
    if (cartValue) {
      const cartVal = parseFloat(cartValue)
      if (upsell.min_cart_value && cartVal < upsell.min_cart_value) return false
      if (upsell.max_cart_value && cartVal > upsell.max_cart_value) return false
    }

    // Check required products
    if (upsell.required_products && Array.isArray(upsell.required_products) && upsell.required_products.length > 0) {
      const hasRequired = upsell.required_products.some((id: string) => cartProductIds.includes(id))
      if (!hasRequired) return false
    }

    // Check excluded products
    if (upsell.excluded_products && Array.isArray(upsell.excluded_products) && upsell.excluded_products.length > 0) {
      const hasExcluded = upsell.excluded_products.some((id: string) => cartProductIds.includes(id))
      if (hasExcluded) return false
    }

    return true
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

