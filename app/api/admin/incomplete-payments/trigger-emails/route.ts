import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

/**
 * POST - Trigger email automations for incomplete payments that haven't been sent yet
 * This is useful for retrying emails that failed previously
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { paymentIds, triggerAll = false } = body
    
    if (!triggerAll && (!paymentIds || paymentIds.length === 0)) {
      return NextResponse.json(
        { error: 'Payment IDs are required or set triggerAll to true' },
        { status: 400 }
      )
    }

    // Get incomplete payments that haven't been sent
    let query = supabase
      .from('incomplete_payments')
      .select('*')
      .eq('email_sent', false)
      .eq('recovered', false) // Only send to unrecovered payments
    
    if (!triggerAll && paymentIds) {
      query = query.in('id', paymentIds)
    }
    
    const { data: payments, error } = await query
    
    if (error) {
      console.error('Error fetching incomplete payments:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch incomplete payments' },
        { status: 500 }
      )
    }
    
    if (!payments || payments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unsent incomplete payments found',
        triggered: 0,
        total: 0,
      })
    }
    
    let triggered = 0
    let failed = 0
    const errors: string[] = []
    
    // Trigger automation for each payment
    for (const payment of payments) {
      try {
        // Skip if an order already exists for this payment intent or same email around the same time
        const { data: relatedOrders } = await supabase
          .from('orders')
          .select('id, order_number, created_at, stripe_payment_intent_id, customer_email')
          .or(`stripe_payment_intent_id.eq.${payment.stripe_payment_intent_id},customer_email.eq.${payment.customer_email}`)
          .gte('created_at', new Date(new Date(payment.created_at).getTime() - 1000 * 60 * 60 * 24).toISOString()) // within 24h
          .lte('created_at', new Date(new Date(payment.created_at).getTime() + 1000 * 60 * 60 * 24).toISOString())

        if (relatedOrders && relatedOrders.length > 0) {
          // Mark as recovered and skip emailing to avoid confusion
          await supabase
            .from('incomplete_payments')
            .update({
              recovered: true,
              recovery_reason: 'order_exists',
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
          continue
        }

        const result = await triggerAutomation('custom', payment.customer_email, {
          userId: payment.user_id || undefined,
          name: payment.customer_name || undefined,
          trigger_name: 'incomplete_payment',
          payment_intent_id: payment.stripe_payment_intent_id,
        })
        
        if (result.success && result.triggered > 0) {
          // Mark as sent
          await supabase
            .from('incomplete_payments')
            .update({
              automation_triggered: true,
              email_sent: true,
              email_sent_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
          
          triggered++
        } else {
          failed++
          errors.push(`Payment ${payment.id}: ${result.error || 'Automation not triggered'}`)
        }
      } catch (error: any) {
        failed++
        errors.push(`Payment ${payment.id}: ${error.message || 'Unknown error'}`)
        console.error(`Error triggering automation for payment ${payment.id}:`, error)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Triggered ${triggered} of ${payments.length} incomplete payment automations`,
      triggered,
      failed,
      total: payments.length,
      errors: errors.slice(0, 10), // Limit errors to first 10
    })
  } catch (error: any) {
    console.error('Error triggering incomplete payment emails:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

