import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('product_id')
  if (!productId) {
    return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { data: groups, error } = await supabase
    .from('frequently_bought_together')
    .select('*')
    .eq('main_product_id', productId)
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!groups?.length) {
    return NextResponse.json({ groups: [], products: [] })
  }

  const productIds = new Set<string>()
  for (const g of groups) {
    productIds.add(g.main_product_id)
    const related = g.related_products
    if (Array.isArray(related)) {
      for (const rp of related) {
        if (rp?.product_id) productIds.add(rp.product_id)
      }
    }
  }

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
        image_url
      )
    `)
    .in('id', Array.from(productIds))
    .eq('status', 'active')

  return NextResponse.json({ groups, products: products || [] })
}
