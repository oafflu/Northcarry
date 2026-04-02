import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

// This endpoint should be called by a cron job to check for abandoned carts
// and trigger automations
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = createAdminSupabaseClient()
    
    // Get abandoned carts (older than 1 hour, no order created)
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    const { data: cartItems } = await supabase
      .from('cart_items')
      .select(`
        id,
        user_id,
        session_id,
        updated_at,
        profiles:user_id (
          email,
          first_name,
          last_name
        )
      `)
      .lt('updated_at', oneHourAgo.toISOString())
      .not('user_id', 'is', null)
    
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No abandoned carts found',
        processed: 0 
      })
    }
    
    // Group by user_id and check if order exists
    const userCarts = new Map<string, any[]>()
    
    cartItems.forEach((item: any) => {
      if (item.user_id) {
        if (!userCarts.has(item.user_id)) {
          userCarts.set(item.user_id, [])
        }
        userCarts.get(item.user_id)!.push(item)
      }
    })
    
    let processed = 0
    let triggered = 0
    
    for (const [userId, items] of userCarts.entries()) {
      // Check if order exists for this user since cart was last updated
      const latestCartUpdate = new Date(Math.max(...items.map((i: any) => new Date(i.updated_at).getTime())))
      
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', latestCartUpdate.toISOString())
      
      // If no order exists, cart is abandoned - trigger automation
      if ((count || 0) === 0 && items[0].profiles?.email) {
        const profile = items[0].profiles
        const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined
        
        // Get session_id for guest users (if available)
        const { data: cartItem } = await supabase
          .from('cart_items')
          .select('session_id')
          .eq('user_id', userId)
          .not('session_id', 'is', null)
          .limit(1)
          .single()
        
        try {
          const result = await triggerAutomation('abandoned_cart', profile.email, {
            userId: userId,
            name: userName,
            sessionId: cartItem?.session_id,
          })
          
          if (result.success && result.triggered > 0) {
            triggered++
          }
        } catch (error) {
          console.error(`Error triggering automation for ${profile.email}:`, error)
        }
        
        processed++
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processed} abandoned carts, triggered ${triggered} automations`,
      processed,
      triggered,
    })
  } catch (error: any) {
    console.error('Error processing abandoned carts:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

