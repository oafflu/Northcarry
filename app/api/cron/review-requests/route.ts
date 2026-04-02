import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

/**
 * Cron job to send review request emails to customers 25 days after purchase
 * This should be scheduled to run daily
 * 
 * To set up in Vercel:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/review-requests",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (set in Vercel environment variables)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const now = new Date()
    const daysAgo = new Date(now)
    daysAgo.setDate(daysAgo.getDate() - 25)

    // Find orders that were completed 25 days ago (within a 24-hour window)
    const startDate = new Date(daysAgo)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(daysAgo)
    endDate.setHours(23, 59, 59, 999)

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_email,
        user_id,
        created_at,
        order_items (
          id,
          product_id,
          products (
            id,
            title,
            slug
          )
        )
      `)
      .eq('fulfillment_status', 'fulfilled')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', details: ordersError.message },
        { status: 500 }
      )
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders found for review requests',
        processed: 0,
      })
    }

    let processed = 0
    let skipped = 0
    let errors: string[] = []

    for (const order of orders) {
      try {
        // Check if review request already sent for this order
        const { data: existingRequest } = await supabase
          .from('review_requests')
          .select('id')
          .eq('order_id', order.id)
          .single()

        if (existingRequest) {
          skipped++
          continue
        }

        // Check if customer already reviewed products from this order
        if (order.user_id && order.order_items) {
          const productIds = order.order_items
            .map((item: any) => item.product_id)
            .filter(Boolean)

          if (productIds.length > 0) {
            const { data: existingReviews } = await supabase
              .from('reviews')
              .select('id')
              .eq('user_id', order.user_id)
              .in('product_id', productIds)
              .limit(1)

            // If customer already reviewed, skip
            if (existingReviews && existingReviews.length > 0) {
              // Mark as skipped
              await supabase.from('review_requests').insert({
                order_id: order.id,
                customer_email: order.customer_email,
                user_id: order.user_id,
                sent: false,
                skipped: true,
                skip_reason: 'already_reviewed',
              })
              skipped++
              continue
            }
          }
        }

        // Get customer name
        let customerName = 'Valued Customer'
        if (order.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', order.user_id)
            .single()

          if (profile) {
            customerName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || customerName
          }
        }

        // Get first product for review link
        const firstProduct = order.order_items?.[0]?.products
        const reviewLink = firstProduct
          ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/product/${firstProduct.slug}?review=true`
          : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/product?review=true`

        // Trigger review_request automation
        const result = await triggerAutomation('review_request', order.customer_email, {
          userId: order.user_id || undefined,
          name: customerName,
          orderId: order.id,
          orderNumber: order.order_number,
          reviewLink: reviewLink,
          productName: firstProduct?.title ?? firstProduct?.name,
        })

        if (result.success && result.triggered > 0) {
          // Record review request
          await supabase.from('review_requests').insert({
            order_id: order.id,
            customer_email: order.customer_email,
            user_id: order.user_id,
            sent: true,
            sent_at: new Date().toISOString(),
            skipped: false,
          })
          processed++
        } else {
          errors.push(`Order ${order.order_number}: ${result.error || 'Automation not triggered'}`)
        }
      } catch (error: any) {
        errors.push(`Order ${order.id}: ${error.message}`)
        console.error(`Error processing order ${order.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Review requests processed: ${processed} sent, ${skipped} skipped`,
      processed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('Error in review requests cron:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request)
}

