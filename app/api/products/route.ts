import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const searchParams = request.nextUrl.searchParams
  const ids = searchParams.get('ids')?.split(',').filter(Boolean)

  if (!ids || ids.length === 0) {
    return NextResponse.json({ products: [] })
  }

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      title,
      slug,
      base_price,
      product_variants (id, color, price, image_url)
    `)
    .in('id', ids)
    .eq('status', 'active')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: products || [] })
}

