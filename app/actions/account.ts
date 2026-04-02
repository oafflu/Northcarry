'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { isCustomerFulfilledBucket } from '@/lib/order-fulfillment-display'

export async function getAccountOrders(userId: string, limit = 20, offset = 0) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total,
      fulfillment_status,
      payment_status,
      created_at,
      order_items (
        id,
        product_title,
        variant_color,
        quantity,
        line_total
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getOrderById(orderId: string, userId?: string) {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_title,
        variant_color,
        quantity,
        unit_price,
        line_total,
        sku
      ),
      order_tracking (
        id,
        carrier,
        tracking_number,
        status,
        notes,
        created_at
      )
    `)
    .eq('id', orderId)
    .single()

  const { data, error } = await query

  if (error) {
    return { data: null, error: error.message }
  }

  // Check if user has access (if userId provided)
  if (userId && data.user_id !== userId) {
    return { data: null, error: 'Unauthorized' }
  }

  return { data, error: null }
}

export async function getAccountStats(userId: string) {
  const supabase = await createServerSupabaseClient()

  const [ordersResult, totalSpentResult] = await Promise.all([
    supabase
      .from('orders')
      .select('id, fulfillment_status, total', { count: 'exact' })
      .eq('user_id', userId),
    supabase
      .from('orders')
      .select('total')
      .eq('user_id', userId)
      .eq('payment_status', 'paid'),
  ])

  if (ordersResult.error) {
    return {
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalSpent: 0,
    }
  }

  const orders = ordersResult.data || []
  const totalOrders = orders.length
  const pendingOrders = orders.filter(
    (o) =>
      o.fulfillment_status === 'processing' ||
      o.fulfillment_status === 'unfulfilled' ||
      !o.fulfillment_status
  ).length
  const completedOrders = orders.filter((o) => isCustomerFulfilledBucket(o.fulfillment_status)).length
  const totalSpent = (totalSpentResult.data || []).reduce((sum, o) => sum + parseFloat(o.total), 0)

  return {
    totalOrders,
    pendingOrders,
    completedOrders,
    totalSpent,
  }
}

/** Get order activity timeline for customer (only if order belongs to userId) */
export async function getOrderActivities(orderId: string, userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, user_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order || order.user_id !== userId) {
    return { data: [], error: orderError?.message || 'Unauthorized or order not found' }
  }

  const adminSupabase = createAdminSupabaseClient()
  const { data: logs, error: logsError } = await adminSupabase
    .from('system_logs')
    .select('id, action_type, action_description, action_details, created_at, status')
    .eq('resource_type', 'order')
    .eq('resource_id', orderId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (logsError) {
    return { data: [], error: logsError.message }
  }
  return { data: logs || [], error: null }
}

