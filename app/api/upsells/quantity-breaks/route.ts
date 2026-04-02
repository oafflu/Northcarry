import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const searchParams = request.nextUrl.searchParams
  const productId = searchParams.get('product_id')
  const variantId = searchParams.get('variant_id')
  const quantity = searchParams.get('quantity')

  let query = supabase
    .from('quantity_breaks')
    .select('*')
    .eq('status', 'active')

  if (productId) {
    query = query.eq('product_id', productId)
  }
  if (variantId) {
    query = query.eq('variant_id', variantId)
  }

  const { data: breaks, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If quantity is provided, find the best applicable break
  if (quantity && breaks && breaks.length > 0) {
    const qty = parseInt(quantity)
    let bestBreak = null
    let bestTier = null

    for (const breakItem of breaks) {
      if (breakItem.tiers && Array.isArray(breakItem.tiers)) {
        for (const tier of breakItem.tiers) {
          if (qty >= tier.quantity) {
            if (!bestTier || tier.quantity > bestTier.quantity) {
              bestTier = tier
              bestBreak = breakItem
            }
          }
        }
      }
    }

    return NextResponse.json({ break: bestBreak, tier: bestTier })
  }

  return NextResponse.json({ breaks: breaks || [] })
}

