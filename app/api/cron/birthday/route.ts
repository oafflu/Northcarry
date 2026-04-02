import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

// This endpoint should be called by a cron job daily to check for customer birthdays
// and trigger birthday automations
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const supabase = createAdminSupabaseClient()
    
    // Get today's date
    const today = new Date()
    const todayMonth = today.getMonth() + 1 // JavaScript months are 0-indexed
    const todayDay = today.getDate()
    
    // Get customers with birthdays today
    // Note: This assumes you have a birthday field in profiles table
    // If not, you'll need to add it or use a different method
    const { data: customers } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, birthday')
      .eq('role', 'customer')
      .not('email', 'is', null)
      .like('email', '%@%')
      .not('birthday', 'is', null)
    
    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No customers with birthdays found',
        processed: 0 
      })
    }
    
    let processed = 0
    let triggered = 0
    
    for (const customer of customers) {
      if (customer.birthday) {
        try {
          // Parse birthday (assuming format YYYY-MM-DD or similar)
          const birthday = new Date(customer.birthday)
          const birthdayMonth = birthday.getMonth() + 1
          const birthdayDay = birthday.getDate()
          
          // Check if birthday is today
          if (birthdayMonth === todayMonth && birthdayDay === todayDay) {
            const userName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || undefined
            
            const result = await triggerAutomation('birthday', customer.email!, {
              userId: customer.id,
              name: userName,
            })
            
            if (result.success && result.triggered > 0) {
              triggered++
            }
            processed++
          }
        } catch (error) {
          console.error(`Error processing birthday for ${customer.email}:`, error)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${processed} birthdays, triggered ${triggered} birthday automations`,
      processed,
      triggered,
    })
  } catch (error: any) {
    console.error('Error processing birthday campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

