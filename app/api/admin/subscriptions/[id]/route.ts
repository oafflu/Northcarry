import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id: subscriptionId } = await params

    // Get subscription with related data
    const { data: sub, error: subError } = await supabase
      .from("customer_subscriptions")
      .select(`
        *,
        profiles (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        subscription_products (
          id,
          products (
            id,
            title,
            slug
          ),
          product_variants (
            id,
            sku,
            color,
            price
          )
        ),
        addresses!shipping_address_id (
          id,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          is_default
        )
      `)
      .eq("id", subscriptionId)
      .single()

    if (subError) {
      console.error("Error fetching subscription:", subError)
      return NextResponse.json(
        { error: subError.message || "Subscription not found", details: subError },
        { status: 404 }
      )
    }

    if (!sub) {
      console.error("Subscription not found:", subscriptionId)
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    // Get related orders
    const { data: subOrders } = await supabase
      .from("subscription_orders")
      .select(`
        *,
        orders:order_id (
          id,
          order_number,
          total_amount,
          payment_status,
          fulfillment_status,
          created_at
        )
      `)
      .eq("subscription_id", subscriptionId)
      .order("cycle_number", { ascending: false })

    return NextResponse.json({
      subscription: sub,
      orders: subOrders || [],
    })
  } catch (error: any) {
    console.error("Error fetching subscription:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscription" },
      { status: 500 }
    )
  }
}

