import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// GET - Get incomplete payments for email marketing
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const recovered = searchParams.get('recovered')
    const emailSent = searchParams.get('email_sent')
    const paymentMethod = searchParams.get('payment_method') // Filter by payment method
    const failureReason = searchParams.get('failure_reason') // Filter by failure reason
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // First check if table exists and has data
    const { count: totalCount, error: countError } = await supabase
      .from('incomplete_payments')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('Error checking incomplete_payments table:', countError)
      // Table might not exist - return empty array
      return NextResponse.json({ payments: [], total: 0, error: countError.message })
    }

    let query = supabase
      .from('incomplete_payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (recovered !== null) {
      query = query.eq('recovered', recovered === 'true')
    }

    if (emailSent !== null) {
      query = query.eq('email_sent', emailSent === 'true')
    }

    if (paymentMethod) {
      query = query.eq('payment_method', paymentMethod)
    }

    if (failureReason) {
      if (failureReason === 'other') {
        // Filter for failure reasons that don't match common known ones
        query = query
          .not('failure_reason', 'is', null)
          .not('failure_reason', 'in', '("card_declined","insufficient_funds","expired_card","order_not_created","payment_failed","authentication_required")')
      } else {
        query = query.eq('failure_reason', failureReason)
      }
    }

    if (startDate) {
      // Expecting ISO string or YYYY-MM-DD; Supabase will handle ISO compare on timestamptz
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching incomplete payments:', error)
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('incomplete_payments table does not exist. Please run the migration script.')
        return NextResponse.json({ payments: [], total: 0, message: 'Table does not exist. Please run migration script.' })
      }
      return NextResponse.json(
        { error: error.message || 'Failed to fetch incomplete payments', payments: [] },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      payments: data || [], 
      total: count || 0,
      hasMore: (count || 0) > offset + limit 
    })
  } catch (error: any) {
    console.error('Error fetching incomplete payments:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

