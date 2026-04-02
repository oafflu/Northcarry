'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomBytes, randomUUID } from 'crypto'
import { logOrderAction, logSystemAction } from '@/lib/system-logger'
import { taxAmountForCheckout } from '@/lib/tax'
import { fetchTaxExemptionEntries } from '@/lib/tax-server'

// Check if order has subscription items
export async function orderHasSubscriptions(orderId: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient()
  
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('purchase_type')
    .eq('order_id', orderId)
  
  if (!orderItems || orderItems.length === 0) {
    return false
  }
  
  return orderItems.some((item: any) => 
    item.purchase_type === 'subscription' || item.purchase_type === 'prepaid'
  )
}

const ADMIN_ORDERS_LIST_SELECT = `
  id,
  order_number,
  customer_email,
  customer_first_name,
  customer_last_name,
  total,
  payment_status,
  fulfillment_status,
  created_at,
  order_items (
    id,
    product_title,
    quantity,
    purchase_type
  )
`

/** When filtering by derived purchase type, scan at most this many recent orders (then paginate in memory). */
const ADMIN_ORDERS_PURCHASE_TYPE_SCAN_LIMIT = 2000

function formatAdminOrderRow(order: any) {
  let purchaseType = 'one-time'
  if (order.order_items && order.order_items.length > 0) {
    const purchaseTypes = new Set(order.order_items.map((item: any) => item.purchase_type).filter(Boolean))
    if (purchaseTypes.size > 1) {
      purchaseType = 'mixed'
    } else if (purchaseTypes.size === 1) {
      purchaseType = Array.from(purchaseTypes)[0] as string
    }
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    customer: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Guest',
    email: order.customer_email,
    date: new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    total: parseFloat(order.total || '0').toFixed(2),
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    itemsCount: order.order_items?.length || 0,
    purchaseType,
  }
}

function applyAdminOrdersFilters(
  query: ReturnType<ReturnType<typeof createAdminSupabaseClient>['from']>,
  filters?: {
    search?: string
    paymentStatus?: string
    fulfillmentStatus?: string
    startDate?: string
    endDate?: string
  }
) {
  let q = query
  if (filters?.search) {
    q = q.or(
      `order_number.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,customer_first_name.ilike.%${filters.search}%,customer_last_name.ilike.%${filters.search}%`
    )
  }
  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    q = q.eq('payment_status', filters.paymentStatus)
  }
  if (filters?.fulfillmentStatus && filters.fulfillmentStatus !== 'all') {
    q = q.eq('fulfillment_status', filters.fulfillmentStatus)
  }
  if (filters?.startDate) {
    q = q.gte('created_at', filters.startDate)
  }
  if (filters?.endDate) {
    const endDate = new Date(filters.endDate)
    endDate.setDate(endDate.getDate() + 1)
    q = q.lt('created_at', endDate.toISOString())
  }
  return q
}

export async function getAdminOrders(filters?: {
  search?: string
  paymentStatus?: string
  fulfillmentStatus?: string
  purchaseType?: string
  limit?: number
  offset?: number
  startDate?: string
  endDate?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const limit = filters?.limit ?? 50
    const offset = filters?.offset ?? 0
    const filterBase = {
      search: filters?.search,
      paymentStatus: filters?.paymentStatus,
      fulfillmentStatus: filters?.fulfillmentStatus,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    }
    const purchaseTypeFilter = filters?.purchaseType && filters.purchaseType !== 'all' ? filters.purchaseType : null

    if (purchaseTypeFilter) {
      let query = supabase.from('orders').select(ADMIN_ORDERS_LIST_SELECT).order('created_at', { ascending: false })
      query = applyAdminOrdersFilters(query, filterBase)
      query = query.range(0, ADMIN_ORDERS_PURCHASE_TYPE_SCAN_LIMIT - 1)

      const { data, error } = await query
      if (error) {
        console.error('Error fetching orders:', error)
        return { data: [], total: 0, error: error.message }
      }

      let formatted = (data || []).map(formatAdminOrderRow)
      formatted = formatted.filter((o) => o.purchaseType === purchaseTypeFilter)
      const total = formatted.length
      const pageSlice = formatted.slice(offset, offset + limit)
      return { data: pageSlice, total, error: null }
    }

    let countQuery = supabase.from('orders').select('*', { count: 'exact', head: true })
    countQuery = applyAdminOrdersFilters(countQuery, filterBase)
    const { count, error: countError } = await countQuery
    if (countError) {
      console.error('Error counting orders:', countError)
      return { data: [], total: 0, error: countError.message }
    }

    let dataQuery = supabase.from('orders').select(ADMIN_ORDERS_LIST_SELECT).order('created_at', { ascending: false })
    dataQuery = applyAdminOrdersFilters(dataQuery, filterBase)
    dataQuery = dataQuery.range(offset, offset + limit - 1)

    const { data, error } = await dataQuery
    if (error) {
      console.error('Error fetching orders:', error)
      return { data: [], total: 0, error: error.message }
    }

    const formattedOrders = (data || []).map(formatAdminOrderRow)
    return { data: formattedOrders, total: count ?? 0, error: null }
  } catch (error: any) {
    console.error('Error in getAdminOrders:', error)
    return { data: [], total: 0, error: error.message || 'Failed to fetch orders' }
  }
}

export async function getAdminOrderById(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          variant_id,
          product_title,
          variant_color,
          sku,
          quantity,
          unit_price,
          line_total,
          purchase_type,
          subscription_product_id,
          frequency_months,
          prepaid_cycles_remaining,
          product_variants (
            id,
            image_url,
            color_image_url
          ),
          products:product_id (
            id,
            title,
            product_images (
              id,
              image_url,
              is_primary,
              sort_order,
              variant_id
            )
          )
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

    if (error) {
      console.error('Error fetching order:', error)
      return { data: null, error: error.message }
    }

    if (!order) {
      return { data: null, error: 'Order not found' }
    }

    return { data: order, error: null }
  } catch (error: any) {
    console.error('Error in getAdminOrderById:', error)
    return { data: null, error: error.message || 'Failed to fetch order' }
  }
}

export async function updateOrderFulfillment(
  orderId: string,
  fulfillmentStatus: string,
  trackingNumber?: string,
  shippingCarrier?: string
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Update order fulfillment status
    const updateData: any = {
      fulfillment_status: fulfillmentStatus,
      updated_at: new Date().toISOString(),
    }

    // Set fulfilled_at if status is fulfilled
    if (fulfillmentStatus === 'fulfilled') {
      updateData.fulfilled_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (error) {
      console.error('Error updating order:', error)
      return { success: false, error: error.message }
    }

    // Update order_tracking table if tracking information is provided
    if (trackingNumber && shippingCarrier) {
      const { getTrackingUrl } = await import('@/lib/tracking-urls')
      const trackingUrl = getTrackingUrl(shippingCarrier, trackingNumber)
      
      // Check if tracking record exists
      const { data: existingTracking } = await supabase
        .from('order_tracking')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()
      
      if (existingTracking) {
        // Update existing tracking record
        await supabase
          .from('order_tracking')
          .update({
            carrier: shippingCarrier,
            tracking_number: trackingNumber,
            status: 'shipped',
            notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTracking.id)
      } else {
        // Insert new tracking record
        await supabase.from('order_tracking').insert({
          order_id: orderId,
          carrier: shippingCarrier,
          tracking_number: trackingNumber,
          status: 'shipped',
          notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null
        })
      }

      // Also update supplier_order_assignments if they exist
      // Find assignments for this order
      const { data: assignments } = await supabase
        .from('supplier_order_assignments')
        .select('id')
        .eq('order_id', orderId)
        .eq('assignment_status', 'shipped')
      
      if (assignments && assignments.length > 0) {
        // Update all shipped assignments with the new tracking info
        await supabase
          .from('supplier_order_assignments')
          .update({
            carrier: shippingCarrier,
            tracking_number: trackingNumber,
            updated_at: new Date().toISOString()
          })
          .in('id', assignments.map(a => a.id))
      }
    }

    revalidatePath(`/admin/orders/${orderId}`)
    
    // Get order number for logging
    const { data: order } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single()
    
    // Log the action
    await logOrderAction(
      'fulfillment_updated',
      `Order ${order?.order_number || orderId} fulfillment status updated to ${fulfillmentStatus}`,
      orderId,
      order?.order_number,
      {
        fulfillment_status: fulfillmentStatus,
        tracking_number: trackingNumber || null,
        shipping_carrier: shippingCarrier || null,
      }
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('Error in updateOrderFulfillment:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'order_fulfillment_updated',
      actionCategory: 'order_management',
      actionDescription: `Failed to update order ${orderId} fulfillment: ${error.message}`,
      resourceType: 'order',
      resourceId: orderId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to update order' }
  }
}

/**
 * Update order shipping address and customer phone
 * Sends email notification to customer if address or phone changes
 */
export async function updateOrderAddress(
  orderId: string,
  updates: {
    shippingAddress?: {
      address_line1: string
      address_line2?: string
      city: string
      state: string
      postal_code: string
      country: string
    }
    customerPhone?: string
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get current order to compare changes
    const { data: currentOrder, error: orderError } = await supabase
      .from('orders')
      .select('shipping_address, customer_phone, customer_email, customer_first_name, customer_last_name, order_number')
      .eq('id', orderId)
      .single()

    if (orderError || !currentOrder) {
      return { success: false, error: 'Order not found' }
    }

    const updateData: any = {}
    const changes: string[] = []

    // Update shipping address if provided
    if (updates.shippingAddress) {
      const currentAddress = currentOrder.shipping_address as any || {}
      const newAddress = updates.shippingAddress
      
      // Check if address actually changed
      const addressChanged = 
        currentAddress.address_line1 !== newAddress.address_line1 ||
        currentAddress.address_line2 !== newAddress.address_line2 ||
        currentAddress.city !== newAddress.city ||
        currentAddress.state !== newAddress.state ||
        currentAddress.postal_code !== newAddress.postal_code ||
        currentAddress.country !== newAddress.country

      if (addressChanged) {
        updateData.shipping_address = newAddress
        changes.push('shipping address')
      }
    }

    // Update phone if provided
    if (updates.customerPhone !== undefined) {
      if (currentOrder.customer_phone !== updates.customerPhone) {
        updateData.customer_phone = updates.customerPhone || null
        changes.push('phone number')
      }
    }

    // Only update if there are actual changes
    if (Object.keys(updateData).length === 0) {
      return { success: true, message: 'No changes detected' }
    }

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order address:', updateError)
      return { success: false, error: updateError.message }
    }

    // Send email notification if there were changes
    if (changes.length > 0 && currentOrder.customer_email) {
      try {
        const { sendOrderUpdateEmail } = await import('@/lib/email')
        await sendOrderUpdateEmail(
          currentOrder.customer_email,
          `${currentOrder.customer_first_name || ''} ${currentOrder.customer_last_name || ''}`.trim() || 'Customer',
          currentOrder.order_number,
          changes,
          updateData.shipping_address || currentOrder.shipping_address,
          updateData.customer_phone || currentOrder.customer_phone
        )
      } catch (emailError) {
        console.error('Error sending order update email:', emailError)
        // Don't fail the update if email fails
      }
    }

    revalidatePath(`/admin/orders/${orderId}`)
    return { success: true, message: `Order ${changes.join(' and ')} updated successfully` }
  } catch (error: any) {
    console.error('Error in updateOrderAddress:', error)
    return { success: false, error: error.message || 'Failed to update order address' }
  }
}

/**
 * Get customer addresses for admin (by user_id)
 */
export async function getCustomerAddressesForAdmin(userId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('id, address_line1, address_line2, city, state, postal_code, country, is_default, type')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customer addresses:', error)
      return { data: [], error: error.message }
    }

    return { data: addresses || [], error: null }
  } catch (error: any) {
    console.error('Error in getCustomerAddressesForAdmin:', error)
    return { data: [], error: error.message }
  }
}

/**
 * Helper function to check if an order is free (below $1)
 */
function isFreeOrder(order: any): boolean {
  const total = parseFloat(order.total?.toString() || '0')
  return total < 1.0
}

/**
 * Cancel an order (admin, partner, or customer who owns the order)
 * Refunds payment through Stripe if payment was recorded (skips refund for free orders)
 * Updates supplier assignments immediately
 */
export async function cancelOrder(orderId: string, reason?: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const adminSupabase = createAdminSupabaseClient()

    // Get order details
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*, order_items(id, variant_id, quantity)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    // Check user role - admin, partner, or customer who owns the order
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdminOrPartner = profile?.role === 'admin' || profile?.role === 'partner'
    const isOrderOwner = order.user_id === user.id

    if (!isAdminOrPartner && !isOrderOwner) {
      return { success: false, error: 'Unauthorized. You can only cancel your own orders.' }
    }

    // Check if order is already cancelled
    if (order.fulfillment_status === 'cancelled') {
      return { success: false, error: 'Order is already cancelled' }
    }

    // Check if order is free (below $1) - no refund needed for free orders
    const freeOrder = isFreeOrder(order)

    // Process Stripe refund if payment was made AND order is not free
    let refundProcessed = false
    let refundError: string | null = null

    if (!freeOrder && order.payment_status === 'paid' && order.stripe_payment_intent_id) {
      try {
        // Get Stripe configuration
        const { data: stripeSetting } = await adminSupabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'stripe')
          .single()

        const stripeSettings = stripeSetting?.setting_value as any
        const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

        if (stripeSecretKey) {
          const Stripe = (await import('stripe')).default
          const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2025-10-29.clover',
          })

          // Get payment intent to find the charge
          const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id)
          
          if (paymentIntent.latest_charge) {
            // Create refund
            const refund = await stripe.refunds.create({
              charge: paymentIntent.latest_charge as string,
              amount: Math.round(parseFloat(order.total.toString()) * 100), // Convert to cents
              reason: 'requested_by_customer',
              metadata: {
                order_id: orderId,
                order_number: order.order_number || '',
                cancelled_by: user.id,
                reason: reason || 'Admin cancellation',
              },
            })

            // Create refund record
            await adminSupabase.from('refunds').insert({
              order_id: orderId,
              amount: order.total.toString(),
              reason: reason || 'Order cancelled by admin',
              status: 'completed',
              stripe_refund_id: refund.id,
              processed_at: new Date().toISOString(),
            })

            refundProcessed = true
            console.log(`✅ Refund processed for cancelled order ${orderId}: $${order.total}`)
          }
        }
      } catch (stripeError: any) {
        console.error('Error processing Stripe refund:', stripeError)
        refundError = stripeError.message || 'Failed to process refund'
        // Continue with cancellation even if refund fails
      }
    }

    // Update order status to cancelled
    // Note: cancellation_reason and cancelled_at columns may not exist in all schemas
    // Only update fields that definitely exist
    // payment_status check constraint only allows: 'pending', 'paid', 'refunded', 'failed'
    const updateData: any = {
      fulfillment_status: 'cancelled',
      payment_status: refundProcessed ? 'refunded' : order.payment_status, // Keep original status for free orders
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await adminSupabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Error cancelling order:', updateError)
      return { success: false, error: updateError.message }
    }

    // Update supplier assignments immediately - cancel all assignments
    const { data: assignments } = await adminSupabase
      .from('supplier_order_assignments')
      .select('id, supplier_id')
      .eq('order_id', orderId)
      .neq('assignment_status', 'cancelled')

    if (assignments && assignments.length > 0) {
      await adminSupabase
        .from('supplier_order_assignments')
        .update({
          assignment_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .in('id', assignments.map(a => a.id))

      // Notify suppliers about cancellation
      for (const assignment of assignments) {
        try {
          const { data: supplier } = await adminSupabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('id', assignment.supplier_id)
            .single()

          if (supplier?.email) {
            const { sendEmail } = await import('@/lib/email')
            await sendEmail({
              to: supplier.email,
              subject: `Order ${order.order_number} Cancelled`,
              html: `
                <p>Hello ${supplier.first_name || 'Supplier'},</p>
                <p>The order ${order.order_number} that was assigned to you has been cancelled.</p>
                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                <p>Please check your supplier portal for more details.</p>
                <p>Best regards,<br>The BREVI™ Team</p>
              `,
            })
          }
        } catch (emailError) {
          console.error('Error sending cancellation email to supplier:', emailError)
        }
      }
    }

    // Reverse loyalty points if order was paid and not free
    if (!freeOrder && order.payment_status === 'paid' && order.user_id) {
      try {
        const { awardPoints } = await import('@/app/actions/loyalty')
        const pointsToReverse = Math.floor(parseFloat(order.total.toString()) || 0)
        await awardPoints(order.user_id, -pointsToReverse, 'purchase', order.id)
      } catch (pointsError) {
        console.error('Error reversing loyalty points:', pointsError)
        // Don't fail cancellation if points reversal fails
      }
    }

    // Send notification to customer
    if (order.user_id) {
      try {
        const { sendNotification } = await import('@/app/actions/notifications')
        await sendNotification(order.user_id, {
          title: 'Order Cancelled',
          message: `Your order #${order.order_number || orderId} has been cancelled.${refundProcessed ? ' A refund has been processed.' : ''}`,
          type: 'info',
          link: `/account/orders/${orderId}`,
          metadata: { orderId, refundProcessed },
        })
      } catch (notifError) {
        console.error('Error sending notification:', notifError)
      }
    }

    // Send email to customer
    if (order.customer_email) {
      try {
        const { sendEmail } = await import('@/lib/email')
        await sendEmail({
          to: order.customer_email,
          subject: `Order ${order.order_number} Cancelled`,
          html: `
            <p>Hello ${order.customer_first_name || 'Customer'},</p>
            <p>We're writing to inform you that your order #${order.order_number} has been cancelled.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            ${freeOrder ? `<p>This was a free order, so no refund is needed.</p>` : ''}
            ${refundProcessed ? `<p>A refund of $${parseFloat(order.total.toString()).toFixed(2)} has been processed and should appear in your account within 5-10 business days.</p>` : ''}
            <p>If you have any questions, please contact us at hello@brevibrushes.com</p>
            <p>Best regards,<br>The BREVI™ Team</p>
          `,
        })
        console.log(`✅ Cancellation email sent to customer: ${order.customer_email}`)
      } catch (emailError) {
        console.error('Error sending cancellation email to customer:', emailError)
      }
    }

    // Send email to all admin and partner users
    try {
      const { data: adminPartnerUsers } = await adminSupabase
        .from('profiles')
        .select('email, first_name, last_name, role')
        .in('role', ['admin', 'partner'])
        .not('email', 'is', null)

      if (adminPartnerUsers && adminPartnerUsers.length > 0) {
        const { sendEmail } = await import('@/lib/email')
        const cancelledBy = isAdminOrPartner 
          ? `${user.email} (${profile?.role || 'admin'})`
          : `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || order.customer_email || 'Customer'

        for (const adminPartner of adminPartnerUsers) {
          if (!adminPartner.email) continue

          try {
            const recipientName = `${adminPartner.first_name || ''} ${adminPartner.last_name || ''}`.trim() || adminPartner.email
            await sendEmail({
              to: adminPartner.email,
              subject: `Order ${order.order_number} Cancelled`,
              html: `
                <p>Hello ${recipientName},</p>
                <p>Order <strong>${order.order_number}</strong> has been cancelled.</p>
                <p><strong>Order Details:</strong></p>
                <ul>
                  <li>Order Number: ${order.order_number}</li>
                  <li>Customer: ${order.customer_first_name || ''} ${order.customer_last_name || ''} (${order.customer_email})</li>
                  <li>Order Total: $${parseFloat(order.total.toString()).toFixed(2)}</li>
                  <li>Cancelled By: ${cancelledBy}</li>
                  ${reason ? `<li>Reason: ${reason}</li>` : ''}
                  ${freeOrder ? `<li>Note: This was a free order (no refund needed)</li>` : ''}
                  ${refundProcessed ? `<li>Refund: $${parseFloat(order.total.toString()).toFixed(2)} has been processed</li>` : ''}
                </ul>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/admin/orders/${orderId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order</a></p>
                <p>Best regards,<br>The BREVI™ Team</p>
              `,
            })
            console.log(`✅ Cancellation email sent to ${adminPartner.role}: ${adminPartner.email}`)
          } catch (emailError) {
            console.error(`Error sending cancellation email to ${adminPartner.role} ${adminPartner.email}:`, emailError)
          }
        }
      }
    } catch (adminEmailError) {
      console.error('Error sending cancellation emails to admin/partner users:', adminEmailError)
      // Don't fail cancellation if admin emails fail
    }

    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/orders')
    revalidatePath('/supplier/orders')
    revalidatePath(`/account/orders/${orderId}`)
    revalidatePath('/account/orders')

    // Log the action
    await logOrderAction(
      'cancelled',
      `Order ${order.order_number} cancelled${reason ? `: ${reason}` : ''}`,
      orderId,
      order.order_number,
      {
        reason: reason || 'No reason provided',
        refund_processed: refundProcessed,
        refund_error: refundError || null,
        free_order: freeOrder,
        cancelled_by_role: profile?.role,
      }
    )

    return {
      success: true,
      refundProcessed,
      refundError: refundError || undefined,
      freeOrder,
      message: freeOrder
        ? 'Free order cancelled successfully (no refund needed)'
        : refundProcessed
          ? 'Order cancelled and refund processed successfully'
          : refundError
            ? `Order cancelled, but refund failed: ${refundError}`
            : 'Order cancelled successfully',
    }
  } catch (error: any) {
    console.error('Error in cancelOrder:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'order_cancelled',
      actionCategory: 'order_management',
      actionDescription: `Failed to cancel order ${orderId}: ${error.message}`,
      resourceType: 'order',
      resourceId: orderId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to cancel order' }
  }
}

export async function getOrderCounts() {
  try {
    const supabase = createAdminSupabaseClient()
    
    const [allOrders, pendingOrders, paidOrders, fulfilledOrders] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'pending'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('payment_status', 'paid'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('fulfillment_status', 'fulfilled'),
    ])

    return {
      all: allOrders.count || 0,
      pending: pendingOrders.count || 0,
      paid: paidOrders.count || 0,
      fulfilled: fulfilledOrders.count || 0,
    }
  } catch (error: any) {
    console.error('Error getting order counts:', error)
    return { all: 0, pending: 0, paid: 0, fulfilled: 0 }
  }
}

export async function getDashboardStats() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get date ranges for comparison (current period vs previous period)
    const now = new Date()
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    // Get current period stats
    const [currentRevenueResult, currentOrdersResult] = await Promise.all([
      supabase
        .from('orders')
        .select('total')
        .eq('payment_status', 'paid')
        .gte('created_at', currentPeriodStart.toISOString()),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', currentPeriodStart.toISOString()),
    ])

    // Get previous period stats
    const [previousRevenueResult, previousOrdersResult] = await Promise.all([
      supabase
        .from('orders')
        .select('total')
        .eq('payment_status', 'paid')
        .gte('created_at', previousPeriodStart.toISOString())
        .lte('created_at', previousPeriodEnd.toISOString()),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', previousPeriodStart.toISOString())
        .lte('created_at', previousPeriodEnd.toISOString()),
    ])

    // Calculate revenue
    const currentRevenue = (currentRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total?.toString() || '0'),
      0
    )
    const previousRevenue = (previousRevenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total?.toString() || '0'),
      0
    )
    const revenueChange = previousRevenue > 0 
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
      : currentRevenue > 0 ? 100 : 0

    // Calculate order counts
    const currentOrders = currentOrdersResult.count || 0
    const previousOrders = previousOrdersResult.count || 0
    const ordersChange = previousOrders > 0 
      ? ((currentOrders - previousOrders) / previousOrders) * 100 
      : currentOrders > 0 ? 100 : 0

    // Get product count
    const { count: productCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get customer count
    const { count: customerCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer')

    // Get total revenue (all time)
    const { data: allRevenueData } = await supabase
      .from('orders')
      .select('total')
      .eq('payment_status', 'paid')

    const totalRevenue = (allRevenueData || []).reduce(
      (sum, o) => sum + parseFloat(o.total?.toString() || '0'),
      0
    )

    // Get total orders (all time)
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })

    return {
      revenue: {
        total: totalRevenue,
        current: currentRevenue,
        previous: previousRevenue,
        change: revenueChange,
      },
      orders: {
        total: totalOrders || 0,
        current: currentOrders,
        previous: previousOrders,
        change: ordersChange,
      },
      products: productCount || 0,
      customers: customerCount || 0,
    }
  } catch (error: any) {
    console.error('Error getting dashboard stats:', error)
    return {
      revenue: { total: 0, current: 0, previous: 0, change: 0 },
      orders: { total: 0, current: 0, previous: 0, change: 0 },
      products: 0,
      customers: 0,
    }
  }
}

export async function getRecentOrders(limit = 5) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_first_name,
        customer_last_name,
        customer_email,
        total,
        payment_status,
        fulfillment_status,
        created_at,
        order_items (
          id,
          product_title,
          quantity
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent orders:', error)
      return { data: [], error: error.message }
    }

    // Format orders for display
    const formattedOrders = (orders || []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      customer: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || order.customer_email || 'Guest',
      product: order.order_items && order.order_items.length > 0
        ? order.order_items[0].product_title || 'Product'
        : 'N/A',
      amount: parseFloat(order.total?.toString() || '0').toFixed(2),
      status: order.fulfillment_status || 'unfulfilled',
      paymentStatus: order.payment_status || 'pending',
      createdAt: order.created_at,
    }))

    return { data: formattedOrders, error: null }
  } catch (error: any) {
    console.error('Error in getRecentOrders:', error)
    return { data: [], error: error.message || 'Failed to fetch recent orders' }
  }
}

export async function assignOrdersToSuppliers() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get all orders
    const { data: allOrders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_items (
          variant_id
        )
      `)

    if (!allOrders || allOrders.length === 0) {
      return { success: true, assigned: 0, message: 'No orders found' }
    }

    // Get orders that already have assignments
    const { data: assignedOrders } = await supabase
      .from('supplier_order_assignments')
      .select('order_id')

    const assignedOrderIds = new Set((assignedOrders || []).map(a => a.order_id))
    
    // Filter to orders without assignments
    const ordersWithoutAssignments = allOrders.filter(order => !assignedOrderIds.has(order.id))

    if (!ordersWithoutAssignments || ordersWithoutAssignments.length === 0) {
      return { success: true, assigned: 0, message: 'All orders already have supplier assignments' }
    }

    let assignedCount = 0
    let errorCount = 0
    // Track assignments by supplier for email notifications
    const supplierAssignments: Map<string, { supplier: any, orderNumbers: string[] }> = new Map()

    for (const order of ordersWithoutAssignments) {
      if (!order.order_items || order.order_items.length === 0) {
        continue
      }

      const variantIds = order.order_items
        .map((item: any) => item.variant_id)
        .filter(Boolean)

      if (variantIds.length === 0) {
        continue
      }

      // Get suppliers for these variants
      const { data: supplierLinks } = await supabase
        .from('product_supplier_links')
        .select('supplier_id, variant_id')
        .in('variant_id', variantIds)
        .eq('is_primary_supplier', true)

      if (supplierLinks && supplierLinks.length > 0) {
        const uniqueSupplierIds = [...new Set(supplierLinks.map(link => link.supplier_id))]
        
        // Create assignments
        for (const supplierId of uniqueSupplierIds) {
          const { error } = await supabase
            .from('supplier_order_assignments')
            .insert({
              order_id: order.id,
              supplier_id: supplierId,
              assignment_status: 'pending',
            })
            .select()

          if (error) {
            if (error.code !== '23505') { // Not a unique constraint violation
              console.error(`Error assigning order ${order.order_number} to supplier:`, error)
              errorCount++
            }
          } else {
            assignedCount++
            
            // Track assignment for email notification
            if (!supplierAssignments.has(supplierId)) {
              // Fetch supplier details if not already cached
              const { data: supplier } = await supabase
                .from('profiles')
                .select('id, email, first_name, last_name, company_name')
                .eq('id', supplierId)
                .single()
              
              if (supplier) {
                supplierAssignments.set(supplierId, {
                  supplier,
                  orderNumbers: []
                })
              }
            }
            
            const assignment = supplierAssignments.get(supplierId)
            if (assignment && order.order_number) {
              assignment.orderNumbers.push(order.order_number)
            }
          }
        }
      }
    }

    // Send email notifications to suppliers
    for (const [supplierId, assignment] of supplierAssignments.entries()) {
      if (assignment.orderNumbers.length > 0) {
        try {
          const supplierName = assignment.supplier.company_name || 
            `${assignment.supplier.first_name || ''} ${assignment.supplier.last_name || ''}`.trim() || 
            'Supplier'
          
          const { sendSupplierOrderAssignmentEmail } = await import('@/lib/email')
          await sendSupplierOrderAssignmentEmail(
            assignment.supplier.email,
            supplierName,
            assignment.orderNumbers.slice(0, 10), // Limit to first 10 for email display
            assignment.orderNumbers.length
          )
          console.log(`Email notification sent to supplier ${assignment.supplier.email} for ${assignment.orderNumbers.length} order(s)`)
        } catch (emailError) {
          console.error(`Error sending email to supplier ${assignment.supplier.email}:`, emailError)
          // Don't fail the assignment if email fails
        }
      }
    }

    return {
      success: true,
      assigned: assignedCount,
      errors: errorCount,
      message: `Assigned ${assignedCount} order(s) to suppliers. ${errorCount} error(s).`,
    }
  } catch (error: any) {
    console.error('Error assigning orders to suppliers:', error)
    return {
      success: false,
      assigned: 0,
      errors: 0,
      error: error.message || 'Failed to assign orders to suppliers',
    }
  }
}

export async function assignOrdersToSupplier(orderIds: string[], supplierId: string) {
  try {
    console.log('assignOrdersToSupplier called with:', { orderIds, supplierId, orderIdsLength: orderIds?.length })
    
    const supabase = createAdminSupabaseClient()
    
    if (!orderIds || orderIds.length === 0) {
      console.error('No orders selected')
      return { success: false, error: 'No orders selected', assigned: 0, errors: 0, errorMessages: [] }
    }

    if (!supplierId || supplierId.trim() === '') {
      console.error('No supplier selected')
      return { success: false, error: 'No supplier selected', assigned: 0, errors: 0, errorMessages: [] }
    }

    // Verify supplier exists
    console.log('Verifying supplier:', supplierId)
    const { data: supplier, error: supplierError } = await supabase
      .from('profiles')
      .select('id, role, email, first_name, last_name, company_name')
      .eq('id', supplierId)
      .eq('role', 'supplier')
      .single()

    if (supplierError) {
      console.error('Supplier lookup error:', supplierError)
      return { 
        success: false, 
        error: `Supplier lookup failed: ${supplierError.message}`, 
        assigned: 0, 
        errors: 0,
        errorMessages: [supplierError.message]
      }
    }

    if (!supplier) {
      console.error('Supplier not found:', supplierId)
      return { 
        success: false, 
        error: 'Supplier not found or is not a supplier', 
        assigned: 0, 
        errors: 0,
        errorMessages: ['Supplier not found']
      }
    }

    console.log('Supplier verified:', supplier.email || supplier.company_name)

    let assignedCount = 0
    let alreadyAssignedCount = 0
    let errorCount = 0
    const errors: string[] = []
    const assignedOrderNumbers: string[] = [] // Track successfully assigned orders

    // Verify orders exist
    console.log('Verifying orders:', orderIds.length, 'order(s)')
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number')
      .in('id', orderIds)

    if (ordersError) {
      console.error('Error verifying orders:', ordersError)
      return {
        success: false,
        error: `Error verifying orders: ${ordersError.message}`,
        assigned: 0,
        errors: 0,
        errorMessages: [ordersError.message],
      }
    }

    if (!orders || orders.length === 0) {
      console.error('No valid orders found for IDs:', orderIds)
      return {
        success: false,
        error: 'No valid orders found',
        assigned: 0,
        errors: 0,
        errorMessages: ['No orders found with the provided IDs'],
      }
    }

    console.log('Found', orders.length, 'valid order(s)')

    const validOrderIds = orders.map(o => o.id)
    const invalidOrderIds = orderIds.filter(id => !validOrderIds.includes(id))
    
    if (invalidOrderIds.length > 0) {
      errors.push(`${invalidOrderIds.length} invalid order ID(s)`)
      errorCount += invalidOrderIds.length
    }

    for (const orderId of validOrderIds) {
      try {
        // Check if assignment already exists
        const { data: existing, error: checkError } = await supabase
          .from('supplier_order_assignments')
          .select('id')
          .eq('order_id', orderId)
          .eq('supplier_id', supplierId)
          .maybeSingle()

        if (checkError) {
          console.error(`Error checking existing assignment for order ${orderId}:`, checkError)
          errors.push(`Order ${orderId}: ${checkError.message}`)
          errorCount++
          continue
        }

        if (existing) {
          alreadyAssignedCount++
          continue // Already assigned
        }

        const { error: insertError } = await supabase
          .from('supplier_order_assignments')
          .insert({
            order_id: orderId,
            supplier_id: supplierId,
            assignment_status: 'pending',
          })

        if (insertError) {
          if (insertError.code === '23505') {
            // Unique constraint violation - already assigned (race condition)
            alreadyAssignedCount++
          } else {
            console.error(`Error assigning order ${orderId} to supplier:`, insertError)
            const orderNumber = orders.find(o => o.id === orderId)?.order_number || orderId
            errors.push(`Order ${orderNumber}: ${insertError.message}`)
            errorCount++
          }
        } else {
          assignedCount++
          // Track the order number for email notification
          const orderNumber = orders.find(o => o.id === orderId)?.order_number
          if (orderNumber) {
            assignedOrderNumbers.push(orderNumber)
          }
        }
      } catch (itemError: any) {
        console.error(`Unexpected error processing order ${orderId}:`, itemError)
        const orderNumber = orders.find(o => o.id === orderId)?.order_number || orderId
        errors.push(`Order ${orderNumber}: ${itemError.message || 'Unexpected error'}`)
        errorCount++
      }
    }

    // Build result message
    const parts: string[] = []
    if (assignedCount > 0) {
      parts.push(`Assigned ${assignedCount} order(s)`)
    }
    if (alreadyAssignedCount > 0) {
      parts.push(`${alreadyAssignedCount} already assigned`)
    }
    if (errorCount > 0) {
      parts.push(`${errorCount} error(s)`)
    }

    const message = parts.length > 0 
      ? parts.join(', ') + '.'
      : 'No orders were assigned.'

    console.log('Assignment complete:', { assignedCount, alreadyAssignedCount, errorCount })
    
    // Send email notification to supplier if orders were assigned
    if (assignedCount > 0 && assignedOrderNumbers.length > 0) {
      try {
        const supplierName = supplier.company_name || 
          `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim() || 
          'Supplier'
        
        const { sendSupplierOrderAssignmentEmail } = await import('@/lib/email')
        await sendSupplierOrderAssignmentEmail(
          supplier.email,
          supplierName,
          assignedOrderNumbers.slice(0, 10), // Limit to first 10 for email display
          assignedCount
        )
        console.log(`Email notification sent to supplier ${supplier.email} for ${assignedCount} order(s)`)
      } catch (emailError) {
        console.error('Error sending supplier assignment email:', emailError)
        // Don't fail the assignment if email fails
      }
    }
    
    return {
      success: assignedCount > 0 || (alreadyAssignedCount > 0 && errorCount === 0),
      assigned: assignedCount,
      alreadyAssigned: alreadyAssignedCount,
      errors: errorCount,
      errorMessages: errors,
      message: message,
    }
  } catch (error: any) {
    console.error('Error assigning orders to supplier:', error)
    console.error('Error stack:', error.stack)
    return {
      success: false,
      assigned: 0,
      errors: 0,
      error: error?.message || 'Failed to assign orders to supplier',
      errorMessages: [error?.message || 'An unexpected error occurred'],
      message: error?.message || 'An unexpected error occurred',
    }
  }
}

export async function getOrderSupplierAssignments(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data, error } = await supabase
      .from('supplier_order_assignments')
      .select(`
        *,
        profiles (
          id,
          company_name,
          first_name,
          last_name,
          email
        )
      `)
      .eq('order_id', orderId)

    if (error) {
      console.error('Error fetching order assignments:', error)
      return { data: [], error: error.message }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Error in getOrderSupplierAssignments:', error)
    return { data: [], error: error.message || 'Failed to fetch assignments' }
  }
}

/**
 * Get orders that have no linked customer (user_id is null).
 * Used on Admin > Customers to show "Guest orders without customer account".
 */
export async function getOrdersWithoutCustomer(limit = 200) {
  try {
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return { data: [], error: 'Not authenticated', total: 0 }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') return { data: [], error: 'Unauthorized', total: 0 }

    const supabase = createAdminSupabaseClient()
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_first_name, customer_last_name, total, created_at')
      .is('user_id', null)
      .not('customer_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { data: [], error: error.message, total: 0 }

    // Filter out orders that already have a matching customer profile by email.
    // These can appear temporarily when user_id wasn't written yet, but should not be
    // shown as "without customer account".
    const emailToHasProfile = new Map<string, boolean>()
    const normalizedEmails = Array.from(
      new Set(
        (orders || [])
          .map((o: any) => String(o.customer_email || '').trim().toLowerCase())
          .filter(Boolean)
      )
    )

    for (let i = 0; i < normalizedEmails.length; i += 50) {
      const batch = normalizedEmails.slice(i, i + 50)
      if (!batch.length) continue

      const orFilter = batch.map((e) => `email.ilike.${e}`).join(',')
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .or(orFilter)

      for (const p of profiles || []) {
        const k = String((p as any).email || '').trim().toLowerCase()
        if (k) emailToHasProfile.set(k, true)
      }
    }

    const unresolvedOrders = (orders || []).filter((o: any) => {
      const normalized = String(o.customer_email || '').trim().toLowerCase()
      return normalized && !emailToHasProfile.get(normalized)
    })

    const list = unresolvedOrders.map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerEmail: o.customer_email,
      customerName: [o.customer_first_name, o.customer_last_name].filter(Boolean).join(' ').trim() || '—',
      total: o.total,
      createdAt: o.created_at,
    }))
    return { data: list, error: null, total: list.length }
  } catch (e: any) {
    return { data: [], error: e?.message || 'Failed to fetch', total: 0 }
  }
}

/** Find auth user by email by paginating listUsers (default only returns first 50). */
async function findAuthUserByEmail(supabase: Awaited<ReturnType<typeof createAdminSupabaseClient>>, email: string): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, per_page: perPage })
    if (error || !data?.users?.length) break
    const found = data.users.find((u: any) => u.email?.toLowerCase() === normalized)
    if (found) return { id: found.id }
    const nextPage = (data as any).nextPage ?? (data.users.length === perPage ? page + 1 : null)
    if (nextPage == null) break
    page = nextPage
  }
  return null
}

export async function backfillCustomersFromOrders() {
  try {
    // Verify admin authentication
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        created: 0,
        updated: 0,
        errors: 0,
        error: 'Not authenticated',
      }
    }

    // Verify admin role
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        success: false,
        created: 0,
        updated: 0,
        errors: 0,
        error: 'Unauthorized - Admin access required',
      }
    }

    const supabase = createAdminSupabaseClient()
    
    // Get all orders without user_id but with customer email
    const { data: ordersWithoutUsers, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_first_name, customer_last_name, customer_phone, shipping_address, billing_address')
      .is('user_id', null)
      .not('customer_email', 'is', null)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return { 
        success: false, 
        error: ordersError.message || 'Failed to fetch orders', 
        created: 0,
        updated: 0,
        errors: 0,
        errorMessages: [ordersError.message || 'Failed to fetch orders'],
      }
    }

    if (!ordersWithoutUsers || ordersWithoutUsers.length === 0) {
      return { 
        success: true, 
        created: 0, 
        updated: 0,
        errors: 0,
        message: 'No orders without customer accounts found' 
      }
    }

    let createdCount = 0
    let updatedCount = 0
    let errorCount = 0
    const errors: string[] = []

    console.log(`Found ${ordersWithoutUsers.length} orders without customer accounts`)

    for (const order of ordersWithoutUsers) {
      if (!order.customer_email) {
        console.warn(`Skipping order ${order.order_number}: no customer email`)
        continue
      }

      console.log(`Processing order ${order.order_number} for email: ${order.customer_email}`)

      try {
        // Check if user already exists in profiles table (case-insensitive email match)
        const emailTrimmed = order.customer_email.trim()
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', emailTrimmed)
          .limit(1)

        const existingProfile = existingProfiles?.[0]

        let userId: string

        if (existingProfile?.id) {
          // User exists in profiles - use the profile ID as userId
          userId = existingProfile.id
          console.log(`User exists in profiles for order ${order.order_number}, linking order`)
          
          // Update order with user_id
          const { error: updateError } = await supabase
            .from('orders')
            .update({ user_id: userId })
            .eq('id', order.id)

          if (updateError) {
            console.error(`Error updating order ${order.order_number}:`, updateError)
            errors.push(`Order ${order.order_number}: ${updateError.message}`)
            errorCount++
          } else {
            updatedCount++
          }
        } else {
          // Profile doesn't exist - check if user exists in auth
          console.log(`Profile not found for ${order.order_number}, checking auth...`)
          
          // Avoid expensive full auth scans in serverless (can time out on large user bases).
          // We attempt createUser directly and fall back to profile-only linking if needed.
          let existingAuthUser: { id: string } | null = null
          let userId: string | null = null
          let profileAlreadyCreated = false
          {
            // Validate email before creating user
            if (!order.customer_email || !order.customer_email.includes('@')) {
              console.error(`Invalid email for order ${order.order_number}:`, order.customer_email)
              errors.push(`Order ${order.order_number}: Invalid email address`)
              errorCount++
              continue
            }
            // Create new user account
            const tempPassword = randomBytes(16).toString('hex')
            
            console.log(`Creating user for order ${order.order_number} with email:`, order.customer_email)
            
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email: order.customer_email.trim().toLowerCase(),
              password: tempPassword,
              email_confirm: true,
              user_metadata: {
                first_name: order.customer_first_name || '',
                last_name: order.customer_last_name || '',
                phone: order.customer_phone || '',
              },
            })

            if (createError) {
              console.error(`Error creating user for order ${order.order_number}:`, {
                error: createError,
                message: createError.message,
                status: createError.status,
                email: order.customer_email,
              })
              
              // If user already exists in auth, link by profile if present; otherwise
              // create a profile-only customer to allow order linking without timeout.
              if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
                try {
                  const { data: profilesByEmail } = await supabase
                    .from('profiles')
                    .select('id')
                    .ilike('email', emailTrimmed)
                    .limit(1)
                  const profileByEmail = profilesByEmail?.[0]
                  if (profileByEmail?.id) {
                    const { error: linkErr } = await supabase.from('orders').update({ user_id: profileByEmail.id }).eq('id', order.id)
                    if (linkErr) {
                      errors.push(`Order ${order.order_number}: ${linkErr.message}`)
                      errorCount++
                    } else {
                      updatedCount++
                    }
                    continue
                  }

                  // No profile row found yet; create a profile-only user for deterministic linking.
                  const profileOnlyId = randomUUID()
                  const { error: profileOnlyErr } = await supabase
                    .from('profiles')
                    .insert({
                      id: profileOnlyId,
                      email: order.customer_email.trim().toLowerCase(),
                      first_name: order.customer_first_name || null,
                      last_name: order.customer_last_name || null,
                      phone: order.customer_phone || null,
                      role: 'customer',
                    })
                  if (profileOnlyErr) {
                    errors.push(`Order ${order.order_number}: auth user exists; fallback profile failed: ${profileOnlyErr.message}`)
                    errorCount++
                    continue
                  }
                  userId = profileOnlyId
                  profileAlreadyCreated = true
                } catch (findErr) {
                  errors.push(`Order ${order.order_number}: ${createError.message || 'Failed to create user'}`)
                  errorCount++
                  continue
                }
              } else {
                // Fallback: create profile-only customer so order can still be linked.
                // This keeps Customers/Orders consistent even if Supabase Auth creation fails.
                const profileOnlyId = randomUUID()
                const { error: profileOnlyErr } = await supabase
                  .from('profiles')
                  .insert({
                    id: profileOnlyId,
                    email: order.customer_email.trim().toLowerCase(),
                    first_name: order.customer_first_name || null,
                    last_name: order.customer_last_name || null,
                    phone: order.customer_phone || null,
                    role: 'customer',
                  })

                if (profileOnlyErr) {
                  errors.push(`Order ${order.order_number}: ${createError.message || 'Failed to create user'}; fallback profile failed: ${profileOnlyErr.message}`)
                  errorCount++
                  continue
                }

                userId = profileOnlyId
                profileAlreadyCreated = true
                console.warn(`Order ${order.order_number}: auth user create failed, created profile-only customer ${profileOnlyId}`)
              }
            } else if (!newUser || !newUser.user) {
              // Rare edge case: auth returned success-ish but no user payload.
              // Fall back to profile-only creation so order can still be linked.
              const profileOnlyId = randomUUID()
              const { error: profileOnlyErr } = await supabase
                .from('profiles')
                .insert({
                  id: profileOnlyId,
                  email: order.customer_email.trim().toLowerCase(),
                  first_name: order.customer_first_name || null,
                  last_name: order.customer_last_name || null,
                  phone: order.customer_phone || null,
                  role: 'customer',
                })
              if (profileOnlyErr) {
                errors.push(`Order ${order.order_number}: Failed to create auth user and fallback profile: ${profileOnlyErr.message}`)
                errorCount++
                continue
              }
              userId = profileOnlyId
              profileAlreadyCreated = true
            } else {
              userId = newUser.user.id
              console.log(`Successfully created user ${userId} for order ${order.order_number}`)
            }
          }

          // Create profile (for both new users and existing auth users without profiles)
          let profileError: any = null
          if (!profileAlreadyCreated) {
            console.log(`Creating profile for user ${userId} from order ${order.order_number}`)
            const profileInsert = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: order.customer_email.trim().toLowerCase(),
                first_name: order.customer_first_name || null,
                last_name: order.customer_last_name || null,
                phone: order.customer_phone || null,
                role: 'customer',
              })
            profileError = profileInsert.error
          }

          if (profileError) {
            const isDuplicate = profileError.code === '23505' || /duplicate|unique|already exists/i.test(profileError.message || '')
            if (isDuplicate && userId) {
              const { data: existingByEmailRows } = await supabase
                .from('profiles')
                .select('id')
                .ilike('email', emailTrimmed)
                .limit(1)
              const existingByEmail = existingByEmailRows?.[0]
              if (existingByEmail?.id) {
                const { error: linkErr } = await supabase.from('orders').update({ user_id: existingByEmail.id }).eq('id', order.id)
                if (!linkErr) {
                  updatedCount++
                  console.log(`Order ${order.order_number}: linked to existing profile after duplicate insert`)
                  // Skip address creation and order update below; we already updated
                  continue
                }
              }
            }
            console.error(`Error creating profile for order ${order.order_number}:`, profileError)
            const wasExistingAuthUser = existingAuthUser !== null
            if (!wasExistingAuthUser && userId) {
              try {
                await supabase.auth.admin.deleteUser(userId)
              } catch (deleteErr) {
                console.error('Error deleting auth user after profile creation failure:', deleteErr)
              }
            }
            errors.push(`Order ${order.order_number}: ${profileError.message}`)
            errorCount++
            continue
          }
          
          console.log(`Successfully created profile for user ${userId} from order ${order.order_number}`)

          // Create addresses if available
          if (order.shipping_address && typeof order.shipping_address === 'object') {
            const shippingAddr = order.shipping_address as any
            try {
              const { error: addrError } = await supabase.from('addresses').insert({
                user_id: userId,
                type: 'shipping',
                is_default: true,
                address_line1: shippingAddr.address_line1 || '',
                address_line2: shippingAddr.address_line2 || null,
                city: shippingAddr.city || '',
                state: shippingAddr.state || '',
                postal_code: shippingAddr.postal_code || '',
                country: shippingAddr.country || 'US',
              })
              if (addrError) {
                console.error('Error creating shipping address:', addrError)
              }
            } catch (err) {
              console.error('Error creating shipping address:', err)
            }
          }

          if (order.billing_address && typeof order.billing_address === 'object') {
            const billingAddr = order.billing_address as any
            try {
              const { error: addrError } = await supabase.from('addresses').insert({
                user_id: userId,
                type: 'billing',
                is_default: true,
                address_line1: billingAddr.address_line1 || '',
                address_line2: billingAddr.address_line2 || null,
                city: billingAddr.city || '',
                state: billingAddr.state || '',
                postal_code: billingAddr.postal_code || '',
                country: billingAddr.country || 'US',
              })
              if (addrError) {
                console.error('Error creating billing address:', addrError)
              }
            } catch (err) {
              console.error('Error creating billing address:', err)
            }
          }

          // Update order with user_id
          const { error: updateError } = await supabase
            .from('orders')
            .update({ user_id: userId })
            .eq('id', order.id)

          if (updateError) {
            console.error(`Error updating order ${order.order_number}:`, updateError)
            errors.push(`Order ${order.order_number}: ${updateError.message}`)
            errorCount++
          } else {
            createdCount++
          }
        }
      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error)
        errors.push(`Order ${order.order_number}: ${error.message || 'Unexpected error'}`)
        errorCount++
      }
    }

    // Build response message
    let message = ''
    if (createdCount > 0 && updatedCount > 0) {
      message = `Created ${createdCount} customer account(s) and updated ${updatedCount} order(s).`
    } else if (createdCount > 0) {
      message = `Created ${createdCount} customer account(s).`
    } else if (updatedCount > 0) {
      message = `Updated ${updatedCount} order(s).`
    } else {
      message = 'No changes made.'
    }
    
    if (errorCount > 0) {
      message += ` ${errorCount} error(s) occurred.`
      if (createdCount === 0 && updatedCount === 0 && errorCount > 0) {
        message += ' Supabase Auth could not create new users (check Supabase dashboard for "Database error creating new user"). Use "Orders without customer account" below to view and open these orders.'
      }
    }

    const success = createdCount > 0 || updatedCount > 0
    return {
      success,
      created: createdCount,
      updated: updatedCount,
      errors: errorCount,
      error: success ? undefined : message,
      errorMessages: errors.length > 0 ? errors : undefined,
      message,
    }
  } catch (error: any) {
    console.error('Error in backfillCustomersFromOrders:', error)
    const errorMessage = error?.message || error?.toString() || 'Failed to backfill customers'
    return {
      success: false,
      created: 0,
      updated: 0,
      errors: 0,
      error: errorMessage,
      errorMessages: [errorMessage],
    }
  }
}

export async function sendOrderConfirmationEmail(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get order details with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_title,
          variant_color,
          sku,
          quantity,
          unit_price,
          line_total,
          purchase_type
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    const customerEmail = order.customer_email
    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Customer'
    const orderNumber = order.order_number

    if (!customerEmail) {
      return { success: false, error: 'Customer email not found' }
    }

    // Import email functions
    const { 
      sendOrderConfirmationEmail, 
      sendOrderConfirmationWithMagicLink, 
      sendOrderConfirmationForExistingAccount 
    } = await import('@/lib/email')

    // Fetch tracking information if order is fulfilled
    let trackingInfo = null
    if (order.fulfillment_status === 'fulfilled') {
      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('carrier, tracking_number, status')
        .eq('order_id', orderId)
        .not('tracking_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (trackingData && trackingData.tracking_number) {
        const { getTrackingUrl } = await import('@/lib/tracking-urls')
        trackingInfo = {
          carrier: trackingData.carrier,
          trackingNumber: trackingData.tracking_number,
          trackingUrl: getTrackingUrl(trackingData.carrier, trackingData.tracking_number),
        }
      }
    }

    // Prepare order details with items for email
    const orderDetails = {
      total: parseFloat(order.total || '0').toFixed(2),
      subtotal: parseFloat(order.subtotal || '0').toFixed(2),
      discountAmount: parseFloat(order.discount_amount || '0').toFixed(2),
      shippingCost: parseFloat(order.shipping_cost || '0').toFixed(2),
      taxAmount: parseFloat(order.tax_amount || '0').toFixed(2),
      paymentStatus: order.payment_status || 'pending',
      fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
      items: order.order_items || [],
      shippingAddress: order.shipping_address,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      tracking: trackingInfo,
    }

    // Send order confirmation email (no magic links - customers use temporary passwords if needed)
    await sendOrderConfirmationEmail(
      customerEmail,
      order.customer_first_name || 'Customer',
      orderNumber,
      orderDetails
    )

    await logOrderAction(
      'confirmation_email_sent',
      `Order confirmation email sent to ${customerEmail}`,
      orderId,
      orderNumber,
      { email: customerEmail }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error sending order confirmation email:', error)
    return { success: false, error: error.message || 'Failed to send email' }
  }
}

/**
 * Send invoice email to customer (invoice-only, no order confirmation text)
 */
export async function sendInvoiceEmail(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get order details with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_title,
          variant_color,
          sku,
          quantity,
          unit_price,
          line_total,
          purchase_type
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    const customerEmail = order.customer_email
    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Customer'
    const orderNumber = order.order_number

    if (!customerEmail) {
      return { success: false, error: 'Customer email not found' }
    }

    // Import email function
    const { sendInvoiceEmail } = await import('@/lib/email')

    // Prepare order details with items for invoice email
    const orderDetails = {
      total: parseFloat(order.total || '0').toFixed(2),
      subtotal: parseFloat(order.subtotal || '0').toFixed(2),
      discountAmount: parseFloat(order.discount_amount || '0').toFixed(2),
      shippingCost: parseFloat(order.shipping_cost || '0').toFixed(2),
      taxAmount: parseFloat(order.tax_amount || '0').toFixed(2),
      paymentStatus: order.payment_status || 'pending',
      fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
      items: order.order_items || [],
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      trackingNumber: order.tracking_number,
      shippingCarrier: order.shipping_carrier,
      orderNumber: order.order_number,
      createdAt: order.created_at,
    }

    // Send invoice email
    await sendInvoiceEmail(
      customerEmail,
      customerName,
      orderNumber,
      orderDetails
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error sending invoice email:', error)
    return { success: false, error: error.message || 'Failed to send invoice email' }
  }
}

/**
 * Add a new item to an order
 */
export async function addOrderItem(
  orderId: string,
  data: {
    productId: string
    variantId: string
    quantity: number
    unitPrice?: number
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get order to verify it exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    // Get product and variant details
    const [productResult, variantResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, title')
        .eq('id', data.productId)
        .single(),
      supabase
        .from('product_variants')
        .select('id, color, sku, price')
        .eq('id', data.variantId)
        .single(),
    ])

    if (productResult.error || !productResult.data) {
      return { success: false, error: 'Product not found' }
    }

    if (variantResult.error || !variantResult.data) {
      return { success: false, error: 'Product variant not found' }
    }

    const product = productResult.data
    const variant = variantResult.data
    const unitPrice = data.unitPrice || parseFloat(variant.price?.toString() || '0')
    const lineTotal = (unitPrice * data.quantity).toFixed(2)

    // Insert order item
    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        product_id: data.productId,
        variant_id: data.variantId,
        product_title: product.title || 'Product',
        variant_color: variant.color || 'Unknown',
        sku: variant.sku || 'N/A',
        quantity: data.quantity,
        unit_price: unitPrice.toFixed(2),
        line_total: lineTotal,
        purchase_type: 'one-time',
      })
      .select()
      .single()

    if (itemError) {
      console.error('Error adding order item:', itemError)
      return { success: false, error: itemError.message }
    }

    // Recalculate order totals
    await recalculateOrderTotals(orderId)

    return { success: true, data: orderItem }
  } catch (error: any) {
    console.error('Error in addOrderItem:', error)
    return { success: false, error: error.message || 'Failed to add order item' }
  }
}

/**
 * Update an order item (quantity or price)
 */
export async function updateOrderItem(
  itemId: string,
  data: {
    quantity?: number
    unitPrice?: number
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get current item
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('*')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return { success: false, error: 'Order item not found' }
    }

    const quantity = data.quantity ?? item.quantity
    const unitPrice = data.unitPrice ?? parseFloat(item.unit_price || '0')
    const lineTotal = (unitPrice * quantity).toFixed(2)

    // Update item
    const { error: updateError } = await supabase
      .from('order_items')
      .update({
        quantity,
        unit_price: unitPrice.toFixed(2),
        line_total: lineTotal,
      })
      .eq('id', itemId)

    if (updateError) {
      console.error('Error updating order item:', updateError)
      return { success: false, error: updateError.message }
    }

    // Recalculate order totals
    await recalculateOrderTotals(item.order_id)

    return { success: true }
  } catch (error: any) {
    console.error('Error in updateOrderItem:', error)
    return { success: false, error: error.message || 'Failed to update order item' }
  }
}

/**
 * Delete an order item
 */
export async function deleteOrderItem(itemId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get item to get order_id
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('id', itemId)
      .single()

    if (itemError || !item) {
      return { success: false, error: 'Order item not found' }
    }

    // Delete item
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId)

    if (deleteError) {
      console.error('Error deleting order item:', deleteError)
      return { success: false, error: deleteError.message }
    }

    // Recalculate order totals
    await recalculateOrderTotals(item.order_id)

    return { success: true }
  } catch (error: any) {
    console.error('Error in deleteOrderItem:', error)
    return { success: false, error: error.message || 'Failed to delete order item' }
  }
}

/**
 * Recalculate order totals based on current order items
 */
export async function recalculateOrderTotals(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get all order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('line_total, quantity, unit_price')
      .eq('order_id', orderId)

    if (itemsError) {
      console.error('Error fetching order items:', itemsError)
      return { success: false, error: itemsError.message }
    }

    // Calculate subtotal
    const subtotal = items?.reduce((sum, item) => 
      sum + parseFloat(item.line_total || '0'), 0) || 0

    // Get current order to preserve discount, shipping, and tax
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('discount_amount, shipping_cost, tax_amount, shipping_address')
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      return { success: false, error: orderError.message }
    }

    // Recalculate tax on new subtotal (after discount)
    const discountAmount = parseFloat(order.discount_amount?.toString() || '0')
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
    const shipAddr = order.shipping_address as { country?: string; state?: string } | null
    const exemptions = await fetchTaxExemptionEntries()
    const taxAmount = taxAmountForCheckout(
      subtotalAfterDiscount,
      shipAddr?.country,
      shipAddr?.state,
      exemptions
    )
    const shippingCost = parseFloat(order.shipping_cost?.toString() || '0')
    const total = subtotalAfterDiscount + shippingCost + taxAmount

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax_amount: parseFloat(taxAmount.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order totals:', updateError)
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in recalculateOrderTotals:', error)
    return { success: false, error: error.message || 'Failed to recalculate order totals' }
  }
}

/**
 * Convert an order to a subscription without charging the customer
 * The subscription will start billing from the next cycle
 */
export async function convertOrderToSubscription(
  orderId: string,
  data: {
    subscriptionProductId: string
    frequencyMonths: number
    purchaseType: 'ongoing' | 'prepaid'
    quantity: number
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    if (!order.user_id) {
      return { success: false, error: 'Order must have a customer (user_id) to convert to subscription' }
    }

    // Get subscription product details
    const { data: subscriptionProduct, error: productError } = await supabase
      .from('subscription_products')
      .select('*, products (id, title), product_variants (id, sku, color, price)')
      .eq('id', data.subscriptionProductId)
      .single()

    if (productError || !subscriptionProduct) {
      return { success: false, error: 'Subscription product not found' }
    }

    // Calculate price per cycle
    const pricePerCycle = data.purchaseType === 'prepaid'
      ? (subscriptionProduct.prepaid_price || subscriptionProduct.subscription_price || 0)
      : (subscriptionProduct.subscription_price || 0)

    // Calculate shipping days
    const shippingDays = subscriptionProduct.shipping_days || 14

    // Calculate next billing and shipment dates (start from next cycle)
    const now = new Date()
    const billingIntervalDays = shippingDays * data.frequencyMonths
    const nextBillingDate = new Date(now.getTime() + billingIntervalDays * 24 * 60 * 60 * 1000)
    const nextShipmentDate = new Date(now.getTime() + shippingDays * 24 * 60 * 60 * 1000)

    // ---------------------------------------------
    // Stripe subscription setup (for ongoing only)
    // ---------------------------------------------

    // We only need a Stripe subscription for ongoing billing.
    // Prepaid conversions keep billing inside Brevi only.
    let stripeCustomerId: string | null = null
    let stripeSubscriptionId: string | null = null

    if (data.purchaseType === 'ongoing') {
      // Get Stripe configuration
      const { data: stripeSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'stripe')
        .single()

      const stripeSettings = stripeSetting?.setting_value as any
      const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

      if (!stripeSecretKey) {
        return { success: false, error: 'Stripe is not configured for subscriptions' }
      }

      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-10-29.clover',
      })

      // Get or create Stripe customer for this user
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email, first_name, last_name')
        .eq('id', order.user_id)
        .single()

      const customerEmail = profile?.email || order.customer_email
      const customerName =
        `${profile?.first_name || order.customer_first_name || ''} ${profile?.last_name || order.customer_last_name || ''}`.trim() ||
        order.customer_email

      if (!customerEmail) {
        return { success: false, error: 'Customer email is required to create Stripe subscription' }
      }

      try {
        // Reuse existing Stripe customer if present and valid
        if (profile?.stripe_customer_id) {
          try {
            const existing = await stripe.customers.retrieve(profile.stripe_customer_id)
            if (!('deleted' in existing && existing.deleted)) {
              stripeCustomerId = profile.stripe_customer_id
            }
          } catch {
            stripeCustomerId = null
          }
        }

        // If no valid customer, find or create by email
        if (!stripeCustomerId) {
          const list = await stripe.customers.list({ email: customerEmail, limit: 1 })
          if (list.data.length > 0) {
            stripeCustomerId = list.data[0].id
          } else {
            const created = await stripe.customers.create({
              email: customerEmail,
              name: customerName,
              metadata: {
                userId: order.user_id,
              },
            })
            stripeCustomerId = created.id
          }

          // Persist customer id on profile if we have one
          if (stripeCustomerId && profile) {
            await supabase
              .from('profiles')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', order.user_id)
          }
        }
      } catch (stripeCustomerError: any) {
        console.error('Error ensuring Stripe customer for converted subscription:', stripeCustomerError)
        return { success: false, error: 'Failed to create Stripe customer for subscription billing' }
      }

      // Ensure we have a Stripe Price with the correct billing interval for the chosen frequency
      const productTitle = (subscriptionProduct.products as any)?.title || 'Subscription'
      const variant = (subscriptionProduct.product_variants as any) || null
      const variantColor = variant?.color || ''
      const unitAmountCents = Math.round(
        (subscriptionProduct.subscription_price || subscriptionProduct.prepaid_price || 0) * 100
      )

      let stripePriceId: string | null = (subscriptionProduct.stripe_price_id as string) || null
      if (stripePriceId) {
        // Existing price may be for a different interval (e.g. 3 months). Use it only if it matches.
        try {
          const existingPrice = await stripe.prices.retrieve(stripePriceId)
          const existingIntervalCount = existingPrice.recurring?.interval_count ?? 0
          if (existingIntervalCount !== data.frequencyMonths) {
            stripePriceId = null // Force create of a price with the correct interval
          }
        } catch {
          stripePriceId = null
        }
      }

      if (!stripePriceId) {
        try {
          const stripePrice = await stripe.prices.create({
            currency: 'usd',
            unit_amount: unitAmountCents,
            recurring: {
              interval: 'month',
              interval_count: data.frequencyMonths,
            },
            product_data: {
              name: `${productTitle}${variantColor ? ` (${variantColor})` : ''} - Subscription`,
              metadata: {
                subscription_product_id: subscriptionProduct.id,
              },
            },
            metadata: {
              subscription_product_id: subscriptionProduct.id,
              frequency_months: data.frequencyMonths.toString(),
            },
          })
          stripePriceId = stripePrice.id
          // Only persist when we had no existing price; otherwise keep existing stripe_price_id for other frequencies
          if (!subscriptionProduct.stripe_price_id) {
            await supabase
              .from('subscription_products')
              .update({ stripe_price_id: stripePriceId })
              .eq('id', subscriptionProduct.id)
          }
        } catch (priceError: any) {
          console.error('Error creating Stripe price for converted subscription:', priceError)
          return { success: false, error: 'Failed to create Stripe price for subscription billing' }
        }
      }

      if (!stripePriceId || !stripeCustomerId) {
        return { success: false, error: 'Missing Stripe price or customer for subscription billing' }
      }

      // Create a Stripe subscription that will start billing from the next billing date
      try {
        const billingAnchor = Math.floor(nextBillingDate.getTime() / 1000)
        const stripeSub = await stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [
            {
              price: stripePriceId,
              quantity: data.quantity,
            },
          ],
          billing_cycle_anchor: billingAnchor,
          proration_behavior: 'none',
          collection_method: 'charge_automatically',
          metadata: {
            converted_from_order_id: order.id,
            subscription_product_id: data.subscriptionProductId,
          },
        })

        stripeSubscriptionId = stripeSub.id
      } catch (subError: any) {
        console.error('Error creating Stripe subscription for converted order:', subError)
        return { success: false, error: 'Failed to create Stripe subscription in Stripe' }
      }
    }

    // For prepaid subscriptions
    let totalPrepaidAmount: number | null = null
    let prepaidCyclesRemaining: number = 0

    if (data.purchaseType === 'prepaid' && data.frequencyMonths) {
      totalPrepaidAmount = pricePerCycle * data.quantity * data.frequencyMonths
      prepaidCyclesRemaining = data.frequencyMonths
    }

    // Get shipping address from order
    let shippingAddressId = null
    if (order.shipping_address) {
      // Try to find existing address or create one
      const shippingAddr = order.shipping_address as any
      const { data: existingAddress } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', order.user_id)
        .eq('type', 'shipping')
        .eq('address_line1', shippingAddr.address_line1)
        .eq('city', shippingAddr.city)
        .eq('postal_code', shippingAddr.postal_code)
        .maybeSingle()

      if (existingAddress) {
        shippingAddressId = existingAddress.id
      } else {
        // Create new address
        const { data: newAddress } = await supabase
          .from('addresses')
          .insert({
            user_id: order.user_id,
            type: 'shipping',
            is_default: true,
            address_line1: shippingAddr.address_line1 || '',
            address_line2: shippingAddr.address_line2 || null,
            city: shippingAddr.city || '',
            state: shippingAddr.state || '',
            postal_code: shippingAddr.postal_code || '',
            country: shippingAddr.country || 'US',
          })
          .select()
          .single()

        if (newAddress) {
          shippingAddressId = newAddress.id
        }
      }
    }

    // Create customer subscription (linking to Stripe subscription for ongoing, or Brevi-only for prepaid)
    // Note: shipping_days is stored in subscription_products, not customer_subscriptions
    const { data: customerSubscription, error: subscriptionError } = await supabase
      .from('customer_subscriptions')
      .insert({
        user_id: order.user_id,
        subscription_product_id: data.subscriptionProductId,
        frequency_months: data.frequencyMonths,
        purchase_type: data.purchaseType,
        quantity: data.quantity,
        price_per_cycle: pricePerCycle,
        shipping_address_id: shippingAddressId,
        status: 'active',
        next_billing_date: nextBillingDate.toISOString().split('T')[0],
        next_shipment_date: nextShipmentDate.toISOString().split('T')[0],
        total_prepaid_amount: totalPrepaidAmount,
        prepaid_cycles_remaining: prepaidCyclesRemaining,
        stripe_subscription_id: stripeSubscriptionId || null,
        stripe_customer_id: stripeCustomerId,
      })
      .select()
      .single()

    if (subscriptionError || !customerSubscription) {
      console.error('Error creating subscription:', subscriptionError)
      return { success: false, error: subscriptionError?.message || 'Failed to create subscription' }
    }

    // Link the existing paid order as the FIRST subscription cycle
    // This order is already billed and (typically) fulfilled; Stripe subscription will bill from the NEXT cycle.
    await supabase
      .from('subscription_orders')
      .insert({
        subscription_id: customerSubscription.id,
        order_id: orderId,
        cycle_number: 1, // Treat the converted order as cycle 1
        billing_date: now.toISOString().split('T')[0],
        shipment_date: now.toISOString().split('T')[0],
        status: 'completed', // This cycle is already paid/fulfilled
      })

    // Update order items to mark as subscription
    if (order.order_items && order.order_items.length > 0) {
      const itemIds = order.order_items.map((item: any) => item.id)
      await supabase
        .from('order_items')
        .update({
          purchase_type: data.purchaseType === 'prepaid' ? 'prepaid' : 'subscription',
        })
        .in('id', itemIds)
    }

    // Send email to customer that their order was converted to a subscription
    const customerEmail = order.customer_email || (order as any).customer_email
    if (customerEmail) {
      try {
        const customerName =
          `${(order as any).customer_first_name || ''} ${(order as any).customer_last_name || ''}`.trim() ||
          'Customer'
        const productTitle = (subscriptionProduct.products as any)?.title || 'Subscription'
        const variantColor = (subscriptionProduct.product_variants as any)?.color || ''
        const productName = variantColor ? `${productTitle} (${variantColor})` : productTitle
        const frequencyLabel =
          data.frequencyMonths === 1 ? '1 month' : `${data.frequencyMonths} months`
        const { sendOrderConvertedToSubscriptionEmail } = await import('@/lib/email')
        await sendOrderConvertedToSubscriptionEmail(
          customerEmail,
          customerName,
          productName,
          order.order_number || orderId,
          frequencyLabel,
          nextBillingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        )
      } catch (emailErr) {
        console.error('Error sending order-converted-to-subscription email:', emailErr)
        // Don't fail the conversion if email fails
      }
    }

    return { 
      success: true, 
      data: {
        subscriptionId: customerSubscription.id,
        nextBillingDate: nextBillingDate.toISOString().split('T')[0],
        nextShipmentDate: nextShipmentDate.toISOString().split('T')[0],
      }
    }
  } catch (error: any) {
    console.error('Error in convertOrderToSubscription:', error)
    return { success: false, error: error.message || 'Failed to convert order to subscription' }
  }
}

/**
 * Backfill orders that were fulfilled by suppliers before the fix
 * This updates orders with tracking info from supplier assignments and optionally sends emails
 */
export async function backfillSupplierFulfilledOrders(options?: {
  sendEmails?: boolean
  dryRun?: boolean
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const sendEmails = options?.sendEmails ?? false
    const dryRun = options?.dryRun ?? false

    // Find all supplier assignments that are shipped
    // Note: We'll fetch order details separately since orders table might not have tracking_number/shipping_carrier columns
    const { data: shippedAssignments, error: assignmentsError } = await supabase
      .from('supplier_order_assignments')
      .select(`
        id,
        order_id,
        assignment_status,
        carrier,
        tracking_number,
        shipped_at
      `)
      .eq('assignment_status', 'shipped')
      .not('tracking_number', 'is', null)

    if (assignmentsError) {
      console.error('Error fetching shipped assignments:', assignmentsError)
      return {
        success: false,
        error: assignmentsError.message,
        updated: 0,
        emailsSent: 0,
        errors: []
      }
    }

    if (!shippedAssignments || shippedAssignments.length === 0) {
      return {
        success: true,
        message: 'No shipped assignments found',
        updated: 0,
        emailsSent: 0,
        errors: []
      }
    }

    const results = {
      updated: 0,
      emailsSent: 0,
      skipped: 0,
      errors: [] as string[]
    }

    console.log(`Found ${shippedAssignments.length} shipped assignments to process`)

    for (const assignment of shippedAssignments) {
      try {
        // Fetch order details separately
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, order_number, fulfillment_status, customer_email, customer_first_name, customer_last_name, user_id')
          .eq('id', assignment.order_id)
          .single()

        if (orderError || !order) {
          results.errors.push(`Assignment ${assignment.id}: Order not found`)
          continue
        }

        // Check if order_tracking record exists for this tracking number
        const { data: existingTracking } = await supabase
          .from('order_tracking')
          .select('id')
          .eq('order_id', order.id)
          .eq('tracking_number', assignment.tracking_number || '')
          .maybeSingle()

        // Check if order needs updating (fulfillment_status not 'fulfilled' or missing order_tracking record)
        const needsUpdate = order.fulfillment_status !== 'fulfilled' || !existingTracking
        
        if (!needsUpdate) {
          results.skipped++
          continue
        }

        const orderUpdate: any = {
          updated_at: new Date().toISOString()
        }

        // Ensure fulfillment_status is 'fulfilled'
        if (order.fulfillment_status !== 'fulfilled') {
          orderUpdate.fulfillment_status = 'fulfilled'
          // Note: We'll set fulfilled_at from shipped_at if available
          // But first check if order has fulfilled_at column by trying to update it
        }

        // Try to update fulfilled_at if shipped_at is available
        // (This will fail silently if column doesn't exist, which is fine)
        if (assignment.shipped_at) {
          orderUpdate.fulfilled_at = assignment.shipped_at
        }

        if (!dryRun) {
          // Update the order
          const { error: updateError } = await supabase
            .from('orders')
            .update(orderUpdate)
            .eq('id', order.id)

          if (updateError) {
            results.errors.push(`Order ${order.order_number}: ${updateError.message}`)
            continue
          }

          // Ensure order_tracking record exists
          if (assignment.tracking_number) {
            const { error: trackingError } = await supabase.from('order_tracking').insert({
              order_id: order.id,
              carrier: assignment.carrier || '',
              tracking_number: assignment.tracking_number || '',
              status: 'shipped'
            })

            // Ignore error if tracking record already exists (unique constraint)
            if (trackingError && !trackingError.message.includes('duplicate') && !trackingError.message.includes('unique')) {
              console.warn(`Error creating order_tracking for order ${order.order_number}:`, trackingError)
            }
          }

          results.updated++
        } else {
          // Dry run - just count what would be updated
          results.updated++
        }

        // Send email if requested and order has customer email
        if (sendEmails && order.customer_email && !dryRun) {
          try {
            const { sendShippingNotificationEmail } = await import('@/lib/email')
            const customerName = order.customer_first_name || order.customer_last_name 
              ? `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim()
              : 'Customer'

            await sendShippingNotificationEmail(
              order.customer_email,
              customerName,
              order.order_number,
              assignment.tracking_number || undefined,
              assignment.carrier || undefined
            )

            const { markShippingNotificationSent } = await import('@/lib/order-shipping-notification')
            await markShippingNotificationSent(order.id)

            // Send in-app notification if user_id exists
            if (order.user_id) {
              const { sendNotification } = await import('@/app/actions/notifications')
              await sendNotification(order.user_id, {
                title: 'Order Shipped!',
                message: `Your order #${order.order_number} has been shipped.${assignment.tracking_number ? ` Tracking: ${assignment.tracking_number}` : ''}`,
                type: 'success',
                link: `/account/orders/${order.id}`,
                metadata: { orderId: order.id, trackingNumber: assignment.tracking_number },
              })
            }

            results.emailsSent++
            console.log(`Sent fulfillment email for order ${order.order_number}`)
          } catch (emailError: any) {
            console.error(`Error sending email for order ${order.order_number}:`, emailError)
            results.errors.push(`Order ${order.order_number}: Email failed - ${emailError.message}`)
          }
        }
      } catch (error: any) {
        console.error(`Error processing assignment ${assignment.id}:`, error)
        results.errors.push(`Assignment ${assignment.id}: ${error.message}`)
      }
    }

    return {
      success: true,
      message: dryRun 
        ? `Dry run: Would update ${results.updated} orders${sendEmails ? ` and send ${results.emailsSent} emails` : ''}`
        : `Updated ${results.updated} orders${sendEmails ? ` and sent ${results.emailsSent} emails` : ''}. Skipped ${results.skipped} already up-to-date.`,
      updated: results.updated,
      emailsSent: results.emailsSent,
      skipped: results.skipped,
      errors: results.errors
    }
  } catch (error: any) {
    console.error('Error in backfillSupplierFulfilledOrders:', error)
    return {
      success: false,
      error: error.message || 'Failed to backfill orders',
      updated: 0,
      emailsSent: 0,
      errors: [error.message]
    }
  }
}

/**
 * Send shipping notification emails only for fulfilled orders that are still marked as
 * never having received that email (`shipping_notification_sent_at` IS NULL).
 * Requires scripts/add-shipping-notification-sent-at.sql applied to the database.
 *
 * Use dryRun first. To exclude customers you know already got the email (e.g. from your ESP logs),
 * run SQL: UPDATE orders SET shipping_notification_sent_at = now() WHERE order_number IN (...);
 *
 * If `orderIds` is provided and non-empty, only those orders are considered (they must still pass
 * the same fulfillment / tracking / email rules). Otherwise every matching order in the store is included.
 */
export async function sendPendingShippingNotificationEmails(options?: {
  dryRun?: boolean
  orderIds?: string[]
}) {
  const dryRun = options?.dryRun ?? false
  const filteredOrderIds =
    options?.orderIds?.filter((id) => typeof id === 'string' && id.length > 0) ?? []
  const restrictIds = filteredOrderIds.length > 0 ? new Set(filteredOrderIds) : null

  try {
    const serverSupabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
        sent: 0,
        skipped: 0,
        errors: [] as string[],
        pendingOrderNumbers: [] as string[],
      }
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        success: false,
        error: 'Unauthorized',
        sent: 0,
        skipped: 0,
        errors: [] as string[],
        pendingOrderNumbers: [] as string[],
      }
    }

    const supabase = createAdminSupabaseClient()

    const ASSIGNMENT_IN_CHUNK = 100
    let assignments: { order_id: string; carrier: string | null; tracking_number: string | null }[] = []

    if (restrictIds && restrictIds.size > 0) {
      const idList = [...restrictIds]
      for (let i = 0; i < idList.length; i += ASSIGNMENT_IN_CHUNK) {
        const batch = idList.slice(i, i + ASSIGNMENT_IN_CHUNK)
        const { data: batchRows, error: assignError } = await supabase
          .from('supplier_order_assignments')
          .select('order_id, carrier, tracking_number')
          .eq('assignment_status', 'shipped')
          .not('tracking_number', 'is', null)
          .in('order_id', batch)

        if (assignError) {
          return {
            success: false,
            error: assignError.message,
            sent: 0,
            skipped: 0,
            errors: [assignError.message],
            pendingOrderNumbers: [],
          }
        }
        assignments = assignments.concat(batchRows || [])
      }
    } else {
      const { data: allRows, error: assignError } = await supabase
        .from('supplier_order_assignments')
        .select('order_id, carrier, tracking_number')
        .eq('assignment_status', 'shipped')
        .not('tracking_number', 'is', null)

      if (assignError) {
        return {
          success: false,
          error: assignError.message,
          sent: 0,
          skipped: 0,
          errors: [assignError.message],
          pendingOrderNumbers: [],
        }
      }
      assignments = allRows || []
    }

    const trackingByOrderId = new Map<
      string,
      { carrier?: string; trackingNumber?: string }
    >()
    for (const a of assignments) {
      if (!a.order_id) continue
      if (!trackingByOrderId.has(a.order_id)) {
        trackingByOrderId.set(a.order_id, {
          carrier: a.carrier || undefined,
          trackingNumber: a.tracking_number || undefined,
        })
      }
    }

    const candidateOrderIds = [...trackingByOrderId.keys()]
    if (candidateOrderIds.length === 0) {
      return {
        success: true,
        message: restrictIds?.size
          ? 'None of the selected orders have a shipped supplier assignment with tracking.'
          : 'No shipped assignments with tracking found.',
        sent: 0,
        skipped: 0,
        errors: [],
        pendingOrderNumbers: [],
      }
    }

    const scopeHint = restrictIds?.size
      ? `among ${restrictIds.size} selected order(s)`
      : 'across all orders in your store'

    const pendingOrderNumbers: string[] = []
    const toSend: Array<{
      id: string
      order_number: string
      customer_email: string
      customer_first_name: string | null
      customer_last_name: string | null
      user_id: string | null
      trackingNumber?: string
      carrier?: string
    }> = []

    const chunkSize = 80
    for (let i = 0; i < candidateOrderIds.length; i += chunkSize) {
      const chunk = candidateOrderIds.slice(i, i + chunkSize)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(
          'id, order_number, fulfillment_status, customer_email, customer_first_name, customer_last_name, user_id, shipping_notification_sent_at'
        )
        .in('id', chunk)
        .eq('fulfillment_status', 'fulfilled')
        .is('shipping_notification_sent_at', null)
        .not('customer_email', 'is', null)

      if (ordersError) {
        if (
          ordersError.message?.includes('shipping_notification_sent_at') ||
          ordersError.message?.includes('column')
        ) {
          return {
            success: false,
            error:
              'Database column shipping_notification_sent_at is missing. Run scripts/add-shipping-notification-sent-at.sql in Supabase, then try again.',
            sent: 0,
            skipped: 0,
            errors: [ordersError.message],
            pendingOrderNumbers: [],
          }
        }
        return {
          success: false,
          error: ordersError.message,
          sent: 0,
          skipped: 0,
          errors: [ordersError.message],
          pendingOrderNumbers: [],
        }
      }

      for (const order of orders || []) {
        const t = trackingByOrderId.get(order.id)
        if (!t?.trackingNumber) continue
        toSend.push({
          id: order.id,
          order_number: order.order_number,
          customer_email: order.customer_email,
          customer_first_name: order.customer_first_name,
          customer_last_name: order.customer_last_name,
          user_id: order.user_id,
          trackingNumber: t.trackingNumber,
          carrier: t.carrier,
        })
        pendingOrderNumbers.push(order.order_number)
      }
    }

    if (dryRun) {
      return {
        success: true,
        message: `Dry run: ${toSend.length} order(s) would receive a shipping notification email (${scopeHint}).`,
        sent: 0,
        skipped: candidateOrderIds.length - toSend.length,
        errors: [],
        pendingOrderNumbers,
      }
    }

    const { sendShippingNotificationEmail } = await import('@/lib/email')
    const { markShippingNotificationSent } = await import('@/lib/order-shipping-notification')
    const { sendNotification } = await import('@/app/actions/notifications')

    let sent = 0
    const errors: string[] = []

    for (const order of toSend) {
      try {
        const customerName =
          order.customer_first_name && order.customer_last_name
            ? `${order.customer_first_name} ${order.customer_last_name}`
            : order.customer_first_name || 'Customer'

        await sendShippingNotificationEmail(
          order.customer_email,
          customerName,
          order.order_number,
          order.trackingNumber,
          order.carrier
        )

        await markShippingNotificationSent(order.id)

        await logOrderAction(
          'shipping_notification_sent',
          `Shipping notification email sent to ${order.customer_email}`,
          order.id,
          order.order_number,
          { email: order.customer_email, source: 'admin_pending_send' }
        )

        if (order.user_id) {
          try {
            await sendNotification(order.user_id, {
              title: 'Order Shipped!',
              message: `Your order #${order.order_number} has been shipped.${order.trackingNumber ? ` Tracking: ${order.trackingNumber}` : ''}`,
              type: 'success',
              link: `/account/orders/${order.id}`,
              metadata: { orderId: order.id, trackingNumber: order.trackingNumber },
            })
          } catch (e: any) {
            console.warn('In-app notification failed for', order.order_number, e)
          }
        }

        sent++
      } catch (e: any) {
        console.error('sendPendingShippingNotificationEmails', order.order_number, e)
        errors.push(`${order.order_number}: ${e?.message || 'send failed'}`)
      }
    }

    revalidatePath('/admin/orders')

    return {
      success: true,
      message: `Sent ${sent} shipping notification email(s) (${scopeHint}).`,
      sent,
      skipped: candidateOrderIds.length - toSend.length,
      errors,
      pendingOrderNumbers,
    }
  } catch (error: any) {
    console.error('sendPendingShippingNotificationEmails:', error)
    return {
      success: false,
      error: error.message || 'Failed to send emails',
      sent: 0,
      skipped: 0,
      errors: [error.message],
      pendingOrderNumbers: [],
    }
  }
}

/**
 * Create a manual order for a customer (admin/partner only)
 */
export async function createManualOrder(orderData: {
  customerId?: string | null
  customerEmail: string
  customerFirstName: string
  customerLastName: string
  customerPhone?: string
  shippingAddress: {
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  billingAddress?: {
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  items: Array<{
    variantId: string
    quantity: number
    unitPrice?: number
    purchaseType?: 'one-time' | 'subscription' | 'prepaid'
    subscriptionProductId?: string | null
    frequencyMonths?: number
    prepaidCycles?: number
  }>
  shippingCost?: number
  taxAmount?: number
  discountAmount?: number
  notes?: string
  sendPaymentLink?: boolean
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user is admin or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
      return { success: false, error: 'Unauthorized. Only admin and partner can create manual orders.' }
    }

    // Validate items
    if (!orderData.items || orderData.items.length === 0) {
      return { success: false, error: 'Order must have at least one item' }
    }

    // Fetch variant details and calculate totals
    const variantIds = orderData.items.map(item => item.variantId)
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select(`
        id,
        price,
        sku,
        products (
          id,
          title,
          status
        )
      `)
      .in('id', variantIds)

    if (variantsError || !variants || variants.length === 0) {
      return { success: false, error: 'Failed to fetch product variants' }
    }

    // Check if any products are inactive
    const inactiveProducts = variants.filter((v: any) => !v.products || v.products.status !== 'active')
    if (inactiveProducts.length > 0) {
      return { success: false, error: 'Some products are inactive' }
    }

    // Calculate subtotal
    let subtotal = 0
    const orderItems: any[] = []
    
    for (const item of orderData.items) {
      const variant = variants.find((v: any) => v.id === item.variantId)
      if (!variant) {
        return { success: false, error: `Variant ${item.variantId} not found` }
      }

      const unitPrice = item.unitPrice || parseFloat(variant.price || '0')
      const prepaidCycles = (item as any).prepaidCycles ?? null
      const isPrepaid = (item.purchaseType === 'prepaid') && prepaidCycles != null && prepaidCycles >= 1
      const lineTotal = isPrepaid
        ? unitPrice * item.quantity * (prepaidCycles || 1)
        : unitPrice * item.quantity
      subtotal += lineTotal

      orderItems.push({
        variant,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        purchaseType: item.purchaseType || 'one-time',
        subscriptionProductId: item.subscriptionProductId ?? null,
        frequencyMonths: item.frequencyMonths ?? null,
        prepaidCycles: item.prepaidCycles ?? null,
      })
    }

    const shippingCost = orderData.shippingCost || 0
    const discountAmount = orderData.discountAmount || 0
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
    // Calculate tax automatically: 8% of subtotal after discount (same as checkout)
    // If taxAmount is provided and > 0, use it; otherwise calculate it
    const taxAmount = orderData.taxAmount !== undefined && orderData.taxAmount !== null 
      ? orderData.taxAmount 
      : subtotalAfterDiscount * 0.08
    const total = subtotalAfterDiscount + shippingCost + taxAmount

    // Generate order number
    const orderNumber = `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Determine payment status
    const paymentStatus = total < 1.0 ? 'pending' : (orderData.sendPaymentLink ? 'pending' : 'pending')

    // Create order
    const orderRecord: any = {
      order_number: orderNumber,
      user_id: orderData.customerId || null,
      customer_email: orderData.customerEmail.trim(),
      customer_first_name: orderData.customerFirstName.trim(),
      customer_last_name: orderData.customerLastName.trim(),
      customer_phone: orderData.customerPhone?.trim() || null,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      shipping_cost: parseFloat(shippingCost.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      shipping_address: orderData.shippingAddress,
      billing_address: orderData.billingAddress || orderData.shippingAddress,
      payment_status: paymentStatus,
      fulfillment_status: 'unfulfilled',
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderRecord)
      .select()
      .single()

    if (orderError || !order) {
      console.error('Error creating manual order:', orderError)
      return { success: false, error: orderError?.message || 'Failed to create order' }
    }

    // Create order items
    const orderItemsData = orderItems.map(item => {
      const purchaseType = (item as any).purchaseType || 'one-time'
      const subscriptionProductId = (item as any).subscriptionProductId || null
      const frequencyMonths = (item as any).frequencyMonths ?? null
      const prepaidCycles = (item as any).prepaidCycles ?? null
      return {
        order_id: order.id,
        product_id: item.variant.products.id,
        variant_id: item.variant.id,
        product_title: item.variant.products.title || 'Product',
        variant_color: item.variant.color || 'Unknown',
        sku: item.variant.sku || 'N/A',
        quantity: item.quantity,
        unit_price: item.unitPrice.toFixed(2),
        line_total: item.lineTotal.toFixed(2),
        purchase_type: purchaseType,
        ...(subscriptionProductId && { subscription_product_id: subscriptionProductId }),
        ...(frequencyMonths != null && { frequency_months: frequencyMonths }),
        ...(prepaidCycles != null && { prepaid_cycles_remaining: prepaidCycles }),
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      // Try to delete the order
      await supabase.from('orders').delete().eq('id', order.id)
      return { success: false, error: `Failed to create order items: ${itemsError.message}` }
    }

    // Store order notes in order_tracking table if provided
    if (orderData.notes) {
      const creationNote = `[Manual Order Created - ${new Date().toISOString()}]\n` +
        `Created by: ${user.email}\n` +
        `Notes: ${orderData.notes}`
      
      await supabase.from('order_tracking').insert({
        order_id: order.id,
        status: 'created',
        notes: creationNote,
      })
    }

    // Assign order to suppliers
    try {
      const variantIdsForAssignment = orderItems.map(item => item.variant.id)
      const { data: supplierLinks } = await supabase
        .from('product_supplier_links')
        .select('supplier_id, variant_id')
        .in('variant_id', variantIdsForAssignment)
        .eq('is_primary_supplier', true)

      if (supplierLinks && supplierLinks.length > 0) {
        const uniqueSupplierIds = [...new Set(supplierLinks.map(link => link.supplier_id))]
        const assignments = uniqueSupplierIds.map(supplierId => ({
          order_id: order.id,
          supplier_id: supplierId,
          assignment_status: 'pending',
        }))

        for (const assignment of assignments) {
          await supabase
            .from('supplier_order_assignments')
            .insert(assignment)
        }
      }
    } catch (assignmentError) {
      console.error('Error assigning order to suppliers:', assignmentError)
      // Don't fail order creation if assignment fails
    }

    // Create payment link if requested
    let paymentLink: string | null = null
    let paymentLinkEmailSent = false
    let paymentLinkEmailSkipped = false
    let paymentLinkEmailError: string | null = null
    if (orderData.sendPaymentLink && total >= 1.0) {
      try {
        const linkResult = await createPaymentLinkForOrder(order.id)
        if (linkResult.success && linkResult.paymentLink) {
          paymentLink = linkResult.paymentLink
          paymentLinkEmailSent = !!linkResult.paymentLinkEmailSent
          paymentLinkEmailSkipped = !!linkResult.paymentLinkEmailSkipped
          paymentLinkEmailError = linkResult.paymentLinkEmailError || null
        }
      } catch (linkError) {
        console.error('Error creating payment link:', linkError)
        // Don't fail order creation if payment link creation fails
      }
    }

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${order.id}`)

    // Send admin notification email for manual orders
    try {
      const { sendAdminNewOrderEmail } = await import('@/lib/email')
      
      // Get order items for admin email
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('product_title, variant_color, quantity, unit_price, line_total')
        .eq('order_id', order.id)

      if (orderItemsData && orderItemsData.length > 0) {
        await sendAdminNewOrderEmail(
          order.order_number,
          `${orderData.customerFirstName} ${orderData.customerLastName}`,
          orderData.customerEmail,
          total.toFixed(2),
          orderItemsData.map(item => ({
            product_title: item.product_title,
            variant_color: item.variant_color || undefined,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
          }))
        )
        console.log(`[Manual Order] Admin notification email sent for order ${order.order_number}`)
      }
    } catch (error) {
      console.error('Error sending admin notification email for manual order:', error)
      // Don't fail order creation if email fails
    }

    // Log the action
    await logOrderAction(
      'created_manually',
      `Manual order ${order.order_number} created for ${orderData.customerEmail}`,
      order.id,
      order.order_number,
      {
        customer_email: orderData.customerEmail,
        customer_name: `${orderData.customerFirstName} ${orderData.customerLastName}`,
        total: total.toFixed(2),
        items_count: orderItems.length,
        send_payment_link: orderData.sendPaymentLink || false,
        payment_status: paymentStatus,
      }
    )

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentLink,
      paymentLinkEmailSent,
      paymentLinkEmailSkipped,
      paymentLinkEmailError,
    }
  } catch (error: any) {
    console.error('Error in createManualOrder:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'order_created_manually',
      actionCategory: 'order_management',
      actionDescription: `Failed to create manual order: ${error.message}`,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to create manual order' }
  }
}

/**
 * Create a Stripe payment link for an order
 */
export async function createPaymentLinkForOrder(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user is admin or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    // Check if order is already paid
    if (order.payment_status === 'paid') {
      return { success: false, error: 'Order is already paid' }
    }

    // Check if order total is valid for payment
    const orderTotal = parseFloat(order.total?.toString() || '0')
    if (orderTotal < 1.0) {
      return { success: false, error: 'Order total is too low for payment link' }
    }

    // Get Stripe configuration
    const { data: stripeSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeSettings = stripeSetting?.setting_value as any
    const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY
    const stripeEnabled = stripeSettings?.enabled !== false

    if (!stripeEnabled || !stripeSecretKey) {
      return { success: false, error: 'Stripe is not configured' }
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })

    // Get or create Stripe customer
    let customerId: string | null = null
    if (order.customer_email) {
      const customers = await stripe.customers.list({
        email: order.customer_email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: order.customer_email,
          name: `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || undefined,
          phone: order.customer_phone || undefined,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
          },
        })
        customerId = customer.id
      }
    }

    // Create payment link
    // Note: Payment Links API doesn't support 'customer' parameter directly
    // Customer will be collected during checkout
    const amountInCents = Math.round(orderTotal * 100)
    const paymentLinkParams: Stripe.PaymentLinkCreateParams = {
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Order ${order.order_number}`,
              description: `Payment for order ${order.order_number}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        type: 'manual_order',
        customer_id: customerId || '',
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/account/orders/${order.id}?payment=success`,
        },
      },
    }
    
    const paymentLink = await stripe.paymentLinks.create(paymentLinkParams)

    // Store payment link in order (if there's a column for it, or in notes)
    // For now, we'll store it in a separate table or return it
    // The payment link URL will be returned and can be sent to customer

    // Log the action
    await logOrderAction(
      'payment_link_created',
      `Payment link created for order ${order.order_number}`,
      orderId,
      order.order_number,
      {
        payment_link_id: paymentLink.id,
        order_total: orderTotal.toFixed(2),
      }
    )

    // Auto-email payment link once per order unless explicitly re-enabled by clearing timestamp.
    let paymentLinkEmailSent = false
    let paymentLinkEmailSkipped = false
    let paymentLinkEmailError: string | null = null
    const alreadySentAt = (order as any).payment_link_email_sent_at
    if (order.customer_email) {
      if (alreadySentAt) {
        paymentLinkEmailSkipped = true
      } else {
        try {
          const { sendOrderPaymentLinkEmail } = await import('@/lib/email')
          const customerName =
            order.customer_first_name && order.customer_last_name
              ? `${order.customer_first_name} ${order.customer_last_name}`
              : order.customer_first_name || 'Customer'

          await sendOrderPaymentLinkEmail(
            order.customer_email,
            customerName,
            order.order_number,
            paymentLink.url
          )

          const sentAt = new Date().toISOString()
          const { error: sentAtError } = await supabase
            .from('orders')
            .update({
              payment_link_email_sent_at: sentAt,
              updated_at: sentAt,
            })
            .eq('id', order.id)

          if (sentAtError) {
            console.warn('Could not set payment_link_email_sent_at:', sentAtError.message)
          }

          await logOrderAction(
            'payment_link_email_sent',
            `Payment link email sent to ${order.customer_email}`,
            order.id,
            order.order_number,
            { email: order.customer_email, payment_link_id: paymentLink.id }
          )

          paymentLinkEmailSent = true
        } catch (emailError: any) {
          paymentLinkEmailError = emailError?.message || 'Failed to send payment link email'
          console.error('Error sending payment link email:', emailError)
        }
      }
    }

    return {
      success: true,
      paymentLink: paymentLink.url,
      paymentLinkId: paymentLink.id,
      paymentLinkEmailSent,
      paymentLinkEmailSkipped,
      paymentLinkEmailError,
    }
  } catch (error: any) {
    console.error('Error creating payment link:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'order_payment_link_created',
      actionCategory: 'order_management',
      actionDescription: `Failed to create payment link for order ${orderId}: ${error.message}`,
      resourceType: 'order',
      resourceId: orderId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to create payment link' }
  }
}

/**
 * Mark an order as paid manually (admin/partner only)
 */
export async function markOrderAsPaid(
  orderId: string,
  paymentDetails: {
    paymentMethod?: string
    transactionId?: string
    paymentDate?: string
    comments?: string
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user is admin or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
      return { success: false, error: 'Unauthorized. Only admin and partner can mark orders as paid.' }
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return { success: false, error: 'Order not found' }
    }

    // Check if already paid
    if (order.payment_status === 'paid') {
      return { success: false, error: 'Order is already marked as paid' }
    }

    // Update order
    const updateData: any = {
      payment_status: 'paid',
      updated_at: new Date().toISOString(),
    }

    // Store payment details in order_tracking table (notes column exists there)
    const paymentNote = `[Manual Payment - ${new Date().toISOString()}]\n` +
      `Marked as paid by: ${user.email}\n` +
      (paymentDetails.paymentMethod ? `Payment Method: ${paymentDetails.paymentMethod}\n` : '') +
      (paymentDetails.transactionId ? `Transaction ID: ${paymentDetails.transactionId}\n` : '') +
      (paymentDetails.paymentDate ? `Payment Date: ${paymentDetails.paymentDate}\n` : '') +
      (paymentDetails.comments ? `Comments: ${paymentDetails.comments}\n` : '')

    // Store payment note in order_tracking table
    await supabase.from('order_tracking').insert({
      order_id: orderId,
      status: 'paid',
      notes: paymentNote,
    })

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Error marking order as paid:', updateError)
      return { success: false, error: updateError.message || 'Failed to mark order as paid' }
    }

    // Award loyalty points if applicable
    try {
      const orderTotal = parseFloat(order.total?.toString() || '0')
      if (orderTotal >= 1.0 && order.user_id) {
        const { awardLoyaltyPoints } = await import('@/app/actions/loyalty')
        await awardLoyaltyPoints(order.user_id, orderTotal, order.id)
      }
    } catch (loyaltyError) {
      console.error('Error awarding loyalty points:', loyaltyError)
      // Don't fail the operation if loyalty points fail
    }

    // Send confirmation email to customer
    try {
      if (order.customer_email) {
        const { sendOrderConfirmationEmail } = await import('@/app/actions/orders')
        await sendOrderConfirmationEmail(orderId)
      }
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError)
      // Don't fail the operation if email fails
    }

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/supplier/orders')
    if (order.user_id) {
      revalidatePath('/account/orders')
    }

    // Log the action
    await logOrderAction(
      'marked_as_paid',
      `Order ${order.order_number} marked as paid manually`,
      orderId,
      order.order_number,
      {
        payment_method: paymentDetails.paymentMethod,
        transaction_id: paymentDetails.transactionId,
        payment_date: paymentDetails.paymentDate,
        comments: paymentDetails.comments,
      }
    )

    return { success: true, message: 'Order marked as paid successfully' }
  } catch (error: any) {
    console.error('Error in markOrderAsPaid:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'order_marked_as_paid',
      actionCategory: 'order_management',
      actionDescription: `Failed to mark order ${orderId} as paid: ${error.message}`,
      resourceType: 'order',
      resourceId: orderId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to mark order as paid' }
  }
}

/**
 * Get order activity timeline for admin (order events from system_logs)
 */
export async function getOrderActivitiesForAdmin(orderId: string) {
  try {
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) {
      return { data: [], error: 'Not authenticated' }
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'partner' && profile?.role !== 'supplier') {
      return { data: [], error: 'Unauthorized' }
    }

    const supabase = createAdminSupabaseClient()
    const { data: logs, error } = await supabase
      .from('system_logs')
      .select('id, action_type, action_description, action_details, created_at, status, user_name, user_email')
      .eq('resource_type', 'order')
      .eq('resource_id', orderId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return { data: [], error: error.message }
    }
    return { data: logs || [], error: null }
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch order activities' }
  }
}
