import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Auto-recover orders from incomplete payments
 * Processes all unrecovered payments that have successful payments but no orders
 */
export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    const supabase = createAdminSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can auto-recover orders.' }, { status: 403 })
    }

    const body = await req.json()
    const { limit = 100, paymentMethod = 'stripe' } = body

    // Get unrecovered payments that can be recovered
    // Only recover payments where payment succeeded but order wasn't created
    const query = supabase
      .from('incomplete_payments')
      .select('*')
      .eq('recovered', false)
      .eq('payment_method', paymentMethod)
      .in('failure_reason', ['order_not_created', 'MISSING_ORDER'])
      .limit(limit)

    const { data: incompletePayments, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ 
        error: `Failed to fetch incomplete payments: ${fetchError.message}` 
      }, { status: 500 })
    }

    if (!incompletePayments || incompletePayments.length === 0) {
      return NextResponse.json({
        success: true,
        recovered: 0,
        failed: 0,
        skipped: 0,
        message: 'No recoverable payments found',
      })
    }

    let recovered = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    // Process each payment
    for (const payment of incompletePayments) {
      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, order_number')
          .or(`stripe_payment_intent_id.eq.${payment.stripe_payment_intent_id},order_number.eq.${payment.order_number || ''}`)
          .limit(1)
          .maybeSingle()

        if (existingOrder) {
          // Order already exists, mark as recovered
          await supabase
            .from('incomplete_payments')
            .update({
              recovered: true,
              recovered_at: new Date().toISOString(),
              recovery_reason: 'order_exists',
              order_id: existingOrder.id,
              order_number: existingOrder.order_number,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
          skipped++
          continue
        }

        // Call the recover-order endpoint for each payment
        const recoverResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/incomplete-payments/recover-order`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: payment.stripe_payment_intent_id,
              orderNumber: payment.order_number,
              incompletePaymentId: payment.id,
            }),
          }
        )

        const recoverData = await recoverResponse.json()

        if (recoverResponse.ok && recoverData.success) {
          recovered++
        } else {
          failed++
          errors.push(`${payment.customer_email}: ${recoverData.error || 'Unknown error'}`)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (error: any) {
        failed++
        errors.push(`${payment.customer_email}: ${error.message || 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      recovered,
      failed,
      skipped,
      total: incompletePayments.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors in response
    })
  } catch (error: any) {
    console.error('Error auto-recovering orders:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to auto-recover orders' 
    }, { status: 500 })
  }
}
