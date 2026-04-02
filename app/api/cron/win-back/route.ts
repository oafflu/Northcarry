import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

// This endpoint should be called by a cron job to check for inactive customers
// and trigger win-back automations
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
    
    // Get customers who haven't made a purchase in 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    // Get all customers
    const { data: customers } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, created_at')
      .eq('role', 'customer')
      .not('email', 'is', null)
      .like('email', '%@%')
    
    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No customers found',
        processed: 0 
      })
    }
    
    let processed = 0
    let triggered = 0
    
    for (const customer of customers) {
      // Get last order date for this customer
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('created_at')
        .eq('user_id', customer.id)
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      // If no orders, check if customer is older than 90 days
      if (!lastOrder) {
        const customerAge = new Date(customer.created_at)
        if (customerAge < ninetyDaysAgo) {
          // Customer is inactive - trigger win-back
          try {
            const userName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || undefined
            const result = await triggerAutomation('win_back', customer.email!, {
              userId: customer.id,
              name: userName,
            })
            
            if (result.success && result.triggered > 0) {
              triggered++
            }
          } catch (error) {
            console.error(`Error triggering win-back for ${customer.email}:`, error)
          }
          processed++
        }
      } else {
        // Check if last order was more than 90 days ago
        const lastOrderDate = new Date(lastOrder.created_at)
        if (lastOrderDate < ninetyDaysAgo) {
          // Customer is inactive - trigger win-back
          try {
            const userName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || undefined
            const result = await triggerAutomation('win_back', customer.email!, {
              userId: customer.id,
              name: userName,
            })
            
            if (result.success && result.triggered > 0) {
              triggered++
            }
          } catch (error) {
            console.error(`Error triggering win-back for ${customer.email}:`, error)
          }
          processed++
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processed} inactive customers, triggered ${triggered} win-back automations`,
      processed,
      triggered,
    })
  } catch (error: any) {
    console.error('Error processing win-back campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

