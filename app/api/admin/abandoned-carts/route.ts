import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// GET - Get abandoned carts (carts not converted to orders after 1 hour)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Get all cart items that haven't been converted to orders
    // A cart is considered abandoned if:
    // 1. It's older than 1 hour
    // 2. No order exists with matching user_id or customer_email
    // 3. Cart items still exist
    
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    // Get all cart items with their product info
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(`
        id,
        user_id,
        session_id,
        quantity,
        created_at,
        updated_at,
        product_variants (
          id,
          color,
          price,
          sku,
          image_url,
          products (
            id,
            title,
            base_price,
            slug
          )
        )
      `)
      .lt('updated_at', oneHourAgo.toISOString())
      .order('updated_at', { ascending: false })
    
    if (cartError) {
      console.error('Error fetching cart items:', cartError)
      return NextResponse.json(
        { error: cartError.message || 'Failed to fetch abandoned carts' },
        { status: 500 }
      )
    }
    
    // Group cart items by user_id or session_id
    const cartGroups = new Map<string, any[]>()
    
    cartItems?.forEach((item: any) => {
      const key = item.user_id || item.session_id || 'anonymous'
      if (!cartGroups.has(key)) {
        cartGroups.set(key, [])
      }
      cartGroups.get(key)!.push(item)
    })
    
    // Get user profiles for user_id carts
    const userIds = Array.from(cartGroups.keys()).filter(k => k !== 'anonymous' && !k.startsWith('session_'))
    const userProfiles = new Map<string, any>()
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', userIds)
      
      profiles?.forEach((profile: any) => {
        userProfiles.set(profile.id, profile)
      })
    }
    
    // Build abandoned cart list
    const abandonedCarts: any[] = []
    
    for (const [key, items] of cartGroups.entries()) {
      // Check if an order exists for this user/session
      let hasOrder = false
      
      if (key !== 'anonymous' && !key.startsWith('session_')) {
        // Check for orders by user_id
        const { count } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', key)
          .gte('created_at', items[0].created_at)
        
        hasOrder = (count || 0) > 0
      }
      
      // Only include if no order exists (truly abandoned)
      if (!hasOrder && items.length > 0) {
        const profile = userProfiles.get(key)
        const totalValue = items.reduce((sum, item) => {
          const price = item.product_variants?.price || item.product_variants?.products?.base_price || 0
          return sum + (price * item.quantity)
        }, 0)
        
        const lastUpdated = new Date(Math.max(...items.map((i: any) => new Date(i.updated_at).getTime())))
        const daysAbandoned = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
        
        abandonedCarts.push({
          user_id: key !== 'anonymous' && !key.startsWith('session_') ? key : undefined,
          session_id: key.startsWith('session_') ? key : undefined,
          customer_email: profile?.email,
          customer_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
          cart_items: items.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            product: item.product_variants?.products?.title,
            variant: item.product_variants?.color,
            price: item.product_variants?.price || item.product_variants?.products?.base_price,
            image: item.product_variants?.image_url,
          })),
          total_value: totalValue,
          last_updated: lastUpdated.toISOString(),
          days_abandoned: daysAbandoned,
        })
      }
    }
    
    // Sort by days abandoned (most recent first)
    abandonedCarts.sort((a, b) => b.days_abandoned - a.days_abandoned)
    
    // Apply pagination
    const total = abandonedCarts.length
    const paginatedCarts = abandonedCarts.slice(offset, offset + limit)
    
    return NextResponse.json({ 
      carts: paginatedCarts,
      total,
      hasMore: offset + limit < total
    })
  } catch (error: any) {
    console.error('Error fetching abandoned carts:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

