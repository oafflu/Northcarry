'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logInventoryAction } from '@/lib/system-logger'
import { sendNotification, notifyAdmins } from '@/app/actions/notifications'
import { markShippingNotificationSent } from '@/lib/order-shipping-notification'

export async function linkProductToSupplier(data: {
  productId: string
  variantId: string
  supplierId: string
  supplierInventoryId: string
  leadTimeDays: number
  isPrimarySupplier: boolean
}) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('product_supplier_links')
    .insert({
      product_id: data.productId,
      variant_id: data.variantId,
      supplier_id: data.supplierId,
      supplier_inventory_id: data.supplierInventoryId,
      lead_time_days: data.leadTimeDays,
      is_primary_supplier: data.isPrimarySupplier
    })

  if (error) {
    console.error('Error linking product to supplier:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/products')
  return { success: true }
}

export async function unlinkProductFromSupplier(linkId: string) {
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('product_supplier_links')
    .delete()
    .eq('id', linkId)

  if (error) {
    console.error('Error unlinking product from supplier:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/products')
  return { success: true }
}

export async function updateInventory(
  inventoryId: string,
  updates: {
    product_name?: string
    quantity_available?: number
    cost_price?: number
    reorder_point?: number
    status?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get current inventory state
  const { data: currentInventory } = await supabase
    .from('supplier_inventory')
    .select('quantity_available, supplier_id')
    .eq('id', inventoryId)
    .single()

  if (!currentInventory) {
    return { success: false, error: 'Inventory item not found' }
  }

  // Verify supplier owns this inventory
  if (currentInventory.supplier_id !== user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('supplier_inventory')
    .update(updates)
    .eq('id', inventoryId)

  if (error) {
    console.error('Error updating inventory:', error)
    return { success: false, error: error.message }
  }

  // Log transaction if quantity changed
  if (updates.quantity_available !== undefined) {
    const quantityChange = updates.quantity_available - (currentInventory.quantity_available || 0)
    
    const { data: updatedInventory } = await supabase
      .from('supplier_inventory')
      .select('quantity_available')
      .eq('id', inventoryId)
      .single()

    await supabase.from('supplier_inventory_transactions').insert({
      supplier_inventory_id: inventoryId,
      transaction_type: 'adjustment',
      quantity_change: quantityChange,
      quantity_after: updatedInventory?.quantity_available || 0,
      created_by: user?.id || null
    })
  }

  revalidatePath('/supplier/inventory')
  
  // Get inventory item name for logging
  const { data: inventoryItem } = await supabase
    .from('supplier_inventory')
    .select('product_name, sku')
    .eq('id', inventoryId)
    .single()
  
  // Log the action
  await logInventoryAction(
    'updated',
    `Inventory item "${inventoryItem?.product_name || inventoryId}" updated`,
    inventoryId,
    inventoryItem?.product_name || inventoryItem?.sku,
    {
      quantity_change: updates.quantity_available !== undefined 
        ? updates.quantity_available - (currentInventory.quantity_available || 0)
        : null,
      new_quantity: updates.quantity_available,
    }
  )
  
  return { success: true }
}

export async function createInventoryItem(data: {
  sku: string
  product_name: string
  description?: string
  category?: string
  quantity_available: number
  cost_price: number
  reorder_point?: number
  reorder_quantity?: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: newItem, error } = await supabase
    .from('supplier_inventory')
    .insert({
      supplier_id: user.id,
      sku: data.sku,
      product_name: data.product_name,
      description: data.description,
      category: data.category,
      quantity_available: data.quantity_available,
      cost_price: data.cost_price,
      reorder_point: data.reorder_point || 10,
      reorder_quantity: data.reorder_quantity || 50,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating inventory item:', error)
    return { success: false, error: error.message }
  }

  // Log initial transaction
  await supabase.from('supplier_inventory_transactions').insert({
    supplier_inventory_id: newItem.id,
    transaction_type: 'restock',
    quantity_change: newItem.quantity_available,
    quantity_after: newItem.quantity_available,
    created_by: user.id
  })

  revalidatePath('/supplier/inventory')
  
  // Log the action
  await logInventoryAction(
    'created',
    `Inventory item "${data.product_name}" created`,
    newItem.id,
    data.product_name,
    {
      sku: data.sku,
      initial_quantity: data.quantity_available,
      cost_price: data.cost_price,
    }
  )
  
  return { success: true, data: newItem }
}

export async function deleteInventoryItem(inventoryId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify supplier owns this inventory
  const { data: currentInventory } = await supabase
    .from('supplier_inventory')
    .select('supplier_id, quantity_reserved, quantity_committed')
    .eq('id', inventoryId)
    .single()

  if (!currentInventory) {
    return { success: false, error: 'Inventory item not found' }
  }

  if (currentInventory.supplier_id !== user.id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if inventory is reserved or committed (can't delete if in use)
  if ((currentInventory.quantity_reserved || 0) > 0 || (currentInventory.quantity_committed || 0) > 0) {
    return { 
      success: false, 
      error: 'Cannot delete inventory item with reserved or committed quantities. Please wait for orders to complete or cancel them first.' 
    }
  }

  const { error } = await supabase
    .from('supplier_inventory')
    .delete()
    .eq('id', inventoryId)
    .eq('supplier_id', user.id)

  if (error) {
    console.error('Error deleting inventory item:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/supplier/inventory')
  revalidatePath('/admin/inventory')
  return { success: true }
}

export async function acknowledgeOrder(assignmentId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify supplier owns this assignment
  const { data: assignment } = await supabase
    .from('supplier_order_assignments')
    .select('supplier_id, order_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment || assignment.supplier_id !== user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('supplier_order_assignments')
    .update({
      assignment_status: 'acknowledged',
      acknowledged_at: new Date().toISOString()
    })
    .eq('id', assignmentId)

  if (error) {
    console.error('Error acknowledging order:', error)
    return { success: false, error: error.message }
  }

  // Get order details for notification
  const { data: orderData } = await supabase
    .from('orders')
    .select('id, order_number, user_id')
    .eq('id', assignment.order_id)
    .single()

  // Notify admins
  if (orderData) {
    await notifyAdmins({
      title: 'Order Acknowledged',
      message: `Supplier has acknowledged order #${orderData.order_number || orderData.id}.`,
      type: 'info',
      link: `/admin/orders/${orderData.id}`,
      metadata: { orderId: orderData.id },
    })
  }

  revalidatePath('/supplier/orders')
  return { success: true }
}

export async function bulkAcknowledgeOrders(assignmentIds: string[]) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!assignmentIds || assignmentIds.length === 0) {
    return { success: false, error: 'No orders selected' }
  }

  // Verify supplier owns all assignments and they are pending
  const { data: assignments, error: fetchError } = await supabase
    .from('supplier_order_assignments')
    .select('id, supplier_id, assignment_status, order_id')
    .in('id', assignmentIds)

  if (fetchError) {
    console.error('Error fetching assignments:', fetchError)
    return { success: false, error: fetchError.message }
  }

  if (!assignments || assignments.length === 0) {
    return { success: false, error: 'No assignments found' }
  }

  // Filter to only pending assignments owned by this supplier
  const validAssignments = assignments.filter(
    a => a.supplier_id === user.id && a.assignment_status === 'pending'
  )

  if (validAssignments.length === 0) {
    return { success: false, error: 'No pending orders found to acknowledge' }
  }

  const validIds = validAssignments.map(a => a.id)
  const now = new Date().toISOString()

  // Bulk update
  const { error: updateError } = await supabase
    .from('supplier_order_assignments')
    .update({
      assignment_status: 'acknowledged',
      acknowledged_at: now
    })
    .in('id', validIds)

  if (updateError) {
    console.error('Error bulk acknowledging orders:', updateError)
    return { success: false, error: updateError.message }
  }

  // Get order details for notifications
  const orderIds = validAssignments.map(a => a.order_id).filter(Boolean)
  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, order_number')
    .in('id', orderIds)

  // Notify admins for each acknowledged order
  if (ordersData && ordersData.length > 0) {
    for (const order of ordersData) {
      await notifyAdmins({
        title: 'Order Acknowledged',
        message: `Supplier has acknowledged order #${order.order_number || order.id}.`,
        type: 'info',
        link: `/admin/orders/${order.id}`,
        metadata: { orderId: order.id },
      })
    }
  }

  revalidatePath('/supplier/orders')
  return { 
    success: true, 
    acknowledged: validAssignments.length,
    total: assignmentIds.length 
  }
}

/**
 * Bulk update order status for multiple assignments
 */
export async function bulkUpdateOrderStatus(
  assignmentIds: string[],
  status: 'processing' | 'ready' | 'shipped' | 'acknowledged'
) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!assignmentIds || assignmentIds.length === 0) {
    return { success: false, error: 'No assignments provided' }
  }

  // Verify all assignments belong to this supplier
  const { data: assignments, error: fetchError } = await supabase
    .from('supplier_order_assignments')
    .select('id, supplier_id, assignment_status, order_id')
    .in('id', assignmentIds)
    .eq('supplier_id', user.id)

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  if (!assignments || assignments.length === 0) {
    return { success: false, error: 'No valid assignments found' }
  }

  // Filter assignments that can be updated to the target status
  const validAssignments = assignments.filter(assignment => {
    const currentStatus = assignment.assignment_status
    // Validate status transitions (allow backward transitions from 'ready')
    if (status === 'acknowledged') {
      // Allow from ready (backward transition) or pending
      return currentStatus === 'ready' || currentStatus === 'pending'
    } else if (status === 'processing') {
      // Allow from acknowledged, pending, or ready (backward transition)
      return currentStatus === 'acknowledged' || currentStatus === 'pending' || currentStatus === 'ready'
    } else if (status === 'ready') {
      return currentStatus === 'processing' || currentStatus === 'acknowledged'
    } else if (status === 'shipped') {
      return currentStatus === 'ready' || currentStatus === 'processing'
    }
    return false
  })

  if (validAssignments.length === 0) {
    return {
      success: false,
      error: 'No assignments can be updated to this status. Check current status of selected orders.',
      updated: 0,
      skipped: assignments.length
    }
  }

  const validAssignmentIds = validAssignments.map(a => a.id)
  const updates: any = {
    assignment_status: status,
    updated_at: new Date().toISOString()
  }

  // Set appropriate timestamp based on status
  if (status === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString()
  } else if (status === 'processing') {
    updates.processing_started_at = new Date().toISOString()
  } else if (status === 'ready') {
    updates.ready_at = new Date().toISOString()
  } else if (status === 'shipped') {
    updates.shipped_at = new Date().toISOString()
  }

  // Bulk update
  const { error: updateError } = await supabase
    .from('supplier_order_assignments')
    .update(updates)
    .in('id', validAssignmentIds)

  if (updateError) {
    return { success: false, error: updateError.message, updated: 0, skipped: validAssignments.length }
  }

  // If status is shipped, update main orders table and send emails
  if (status === 'shipped') {
    const orderIds = validAssignments.map(a => a.order_id).filter(Boolean)
    if (orderIds.length > 0) {
      const fulfilledAt = new Date().toISOString()
      const { error: fulfillOrdersError } = await adminSupabase
        .from('orders')
        .update({
          fulfillment_status: 'fulfilled',
          fulfilled_at: fulfilledAt,
          updated_at: fulfilledAt,
        })
        .in('id', orderIds)

      if (fulfillOrdersError) {
        console.error('bulkUpdateOrderStatus: failed to mark orders fulfilled', fulfillOrdersError)
      }

      // Send shipping notification emails to customers
      try {
        const { data: orders } = await adminSupabase
          .from('orders')
          .select('id, order_number, customer_email, customer_first_name, customer_last_name')
          .in('id', orderIds)

        if (orders && orders.length > 0) {
          const { sendShippingNotificationEmail } = await import('@/lib/email')
          const { sendNotification } = await import('@/app/actions/notifications')
          const { notifyAdmins } = await import('@/app/actions/notifications')

          // Get tracking info for each assignment
          const { data: assignmentsWithTracking } = await supabase
            .from('supplier_order_assignments')
            .select('order_id, carrier, tracking_number')
            .in('id', validAssignmentIds)

          const trackingMap = new Map<string, { carrier?: string; trackingNumber?: string }>()
          assignmentsWithTracking?.forEach(a => {
            if (a.order_id) {
              trackingMap.set(a.order_id, {
                carrier: a.carrier || undefined,
                trackingNumber: a.tracking_number || undefined
              })
            }
          })

          // Fetch user_ids for orders that need notifications
          const orderIdsForNotifications = orders.map(o => o.id)
          const { data: ordersWithUserIds } = await adminSupabase
            .from('orders')
            .select('id, user_id')
            .in('id', orderIdsForNotifications)

          const userIdMap = new Map<string, string>()
          ordersWithUserIds?.forEach(o => {
            if (o.user_id) {
              userIdMap.set(o.id, o.user_id)
            }
          })

          // Send emails and notifications for each order
          await Promise.allSettled(
            orders.map(async (order) => {
              if (!order.customer_email) return

              const tracking = trackingMap.get(order.id)
              const customerName = order.customer_first_name && order.customer_last_name
                ? `${order.customer_first_name} ${order.customer_last_name}`
                : order.customer_first_name || 'Customer'

              // Send email
              try {
                await sendShippingNotificationEmail(
                  order.customer_email,
                  customerName,
                  order.order_number,
                  tracking?.trackingNumber,
                  tracking?.carrier
                )
                await markShippingNotificationSent(order.id)
                console.log(`Shipping email sent to ${order.customer_email} for order ${order.order_number}`)
              } catch (emailError) {
                console.error(`Error sending email for order ${order.order_number}:`, emailError)
              }

              // Send in-app notification if user_id exists
              const userId = userIdMap.get(order.id)
              if (userId) {
                try {
                  await sendNotification(userId, {
                    title: 'Order Shipped!',
                    message: `Your order #${order.order_number} has been shipped.${tracking?.trackingNumber ? ` Tracking: ${tracking.trackingNumber}` : ''}`,
                    type: 'success',
                    link: `/account/orders/${order.id}`,
                    metadata: { orderId: order.id, trackingNumber: tracking?.trackingNumber },
                  })
                } catch (notifError) {
                  console.error(`Error sending notification for order ${order.order_number}:`, notifError)
                }
              }
            })
          )

          // Notify admins
          await notifyAdmins({
            title: 'Orders Shipped',
            message: `${orders.length} order(s) have been shipped by supplier.`,
            type: 'success',
            link: '/admin/orders',
            metadata: { orderIds: orderIds },
          })
        }
      } catch (emailError) {
        console.error('Error sending shipping emails:', emailError)
        // Don't fail the bulk update if emails fail
      }
    }
  }

  revalidatePath('/supplier/orders')
  if (status === 'shipped') {
    revalidatePath('/admin/orders')
  }

  return {
    success: true,
    updated: validAssignments.length,
    skipped: assignments.length - validAssignments.length,
    total: assignments.length
  }
}

export async function updateOrderStatus(
  assignmentId: string,
  status: 'processing' | 'ready' | 'shipped' | 'acknowledged',
  data?: {
    carrier?: string
    tracking_number?: string
    estimated_delivery_date?: string
    shipping_cost?: number
  }
) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify supplier owns this assignment
  const { data: assignment } = await supabase
    .from('supplier_order_assignments')
    .select('supplier_id, order_id')
    .eq('id', assignmentId)
    .single()

  if (!assignment || assignment.supplier_id !== user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const updates: any = {
    assignment_status: status,
    updated_at: new Date().toISOString()
  }

  if (status === 'acknowledged') {
    updates.acknowledged_at = new Date().toISOString()
  } else if (status === 'processing') {
    updates.processing_started_at = new Date().toISOString()
  } else if (status === 'ready') {
    updates.ready_at = new Date().toISOString()
  } else if (status === 'shipped') {
    updates.shipped_at = new Date().toISOString()
    if (data) {
      updates.carrier = data.carrier
      updates.tracking_number = data.tracking_number
      updates.estimated_delivery_date = data.estimated_delivery_date
      updates.shipping_cost = data.shipping_cost
    }

    // Generate tracking URL
    let trackingUrl: string | null = null
    if (data?.carrier && data?.tracking_number) {
      const { getTrackingUrl } = await import('@/lib/tracking-urls')
      trackingUrl = getTrackingUrl(data.carrier, data.tracking_number)
    }

    // Update main order tracking (use admin client for permissions)
    await adminSupabase.from('order_tracking').insert({
      order_id: assignment.order_id,
      carrier: data?.carrier || '',
      tracking_number: data?.tracking_number || '',
      status: 'shipped',
      notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null
    })

    // Update order fulfillment status to fulfilled when shipped
    // (Assuming shipped = fulfilled for single-supplier orders, or when all suppliers have shipped)
    // Note: tracking_number and shipping_carrier are stored in order_tracking table, not orders table
    const orderUpdate: any = {
      fulfillment_status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Note: If orders table has tracking_number and shipping_carrier columns, uncomment these:
    // if (data?.tracking_number) {
    //   orderUpdate.tracking_number = data.tracking_number
    // }
    // if (data?.carrier) {
    //   orderUpdate.shipping_carrier = data.carrier
    // }
    
    // Use admin client to update order (supplier client may not have permission)
    await adminSupabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', assignment.order_id)

    // Get order details for notification and email (use admin client for permissions)
    const { data: orderData } = await adminSupabase
      .from('orders')
      .select('id, order_number, user_id, customer_email, customer_first_name, customer_last_name')
      .eq('id', assignment.order_id)
      .single()
  }

  const { error } = await supabase
    .from('supplier_order_assignments')
    .update(updates)
    .eq('id', assignmentId)

  if (error) {
    console.error('Error updating order status:', error)
    return { success: false, error: error.message }
  }

  // Send email and notification AFTER successful update
  if (status === 'shipped' && data) {
    // Get order details again after update (use admin client for permissions)
    const { data: orderData } = await adminSupabase
      .from('orders')
      .select('id, order_number, user_id, customer_email, customer_first_name, customer_last_name')
      .eq('id', assignment.order_id)
      .single()

    if (orderData) {
      const customerName = orderData.customer_first_name && orderData.customer_last_name
        ? `${orderData.customer_first_name} ${orderData.customer_last_name}`
        : orderData.customer_first_name || 'Customer'
      const customerEmail = orderData.customer_email
      
      // Send email notification
      if (customerEmail) {
        try {
          const { sendShippingNotificationEmail } = await import('@/lib/email')
          await sendShippingNotificationEmail(
            customerEmail,
            customerName,
            orderData.order_number,
            data?.tracking_number,
            data?.carrier
          )
          await markShippingNotificationSent(orderData.id)
          console.log(`Shipping email sent to customer ${customerEmail} for order ${orderData.order_number}`)
        } catch (emailError) {
          console.error('Error sending shipping email to customer:', emailError)
          // Don't fail the status update if email fails
        }
      }
      
      // Send in-app notification
      if (orderData.user_id) {
        const { sendNotification } = await import('@/app/actions/notifications')
      await sendNotification(orderData.user_id, {
        title: 'Order Shipped!',
        message: `Your order #${orderData.order_number || orderData.id} has been shipped.${data?.tracking_number ? ` Tracking: ${data.tracking_number}` : ''}`,
        type: 'success',
        link: `/account/orders/${orderData.id}`,
        metadata: { orderId: orderData.id, trackingNumber: data?.tracking_number },
      })
    }

    // Notify admins
      const { notifyAdmins } = await import('@/app/actions/notifications')
      await notifyAdmins({
        title: 'Order Shipped',
        message: `Order #${orderData.order_number || orderData.id} has been shipped by supplier.`,
        type: 'success',
        link: `/admin/orders/${orderData.id}`,
        metadata: { orderId: orderData.id },
      })
    }
  }

  // Revalidate supplier orders page and admin order detail page
  revalidatePath('/supplier/orders')
  if (assignment?.order_id) {
    revalidatePath(`/admin/orders/${assignment.order_id}`)
  }
  
  // Log the action
  const { logOrderAction } = await import('@/lib/system-logger')
  const { data: order } = await adminSupabase
    .from('orders')
    .select('order_number')
    .eq('id', assignment.order_id)
    .single()
  
  await logOrderAction(
    `supplier_${status}`,
    `Supplier updated order ${order?.order_number || assignment.order_id} status to ${status}`,
    assignment.order_id,
    order?.order_number,
    {
      assignment_id: assignmentId,
      status: status,
      carrier: data?.carrier || null,
      tracking_number: data?.tracking_number || null,
      estimated_delivery_date: data?.estimated_delivery_date || null,
    }
  )
  
  return { success: true }
}

/**
 * Update shipping details for an already-shipped order
 * Allows suppliers to correct or update tracking information after an order has been shipped
 */
export async function updateShippingDetails(
  assignmentId: string,
  data: {
    carrier?: string
    tracking_number?: string
    estimated_delivery_date?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify supplier owns this assignment and it's already shipped
  const { data: assignment, error: assignmentError } = await supabase
    .from('supplier_order_assignments')
    .select('supplier_id, order_id, carrier, tracking_number')
    .eq('id', assignmentId)
    .single()

  if (assignmentError || !assignment) {
    return { success: false, error: 'Assignment not found' }
  }

  if (assignment.supplier_id !== user.id) {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if assignment is shipped
  const { data: currentAssignment } = await supabase
    .from('supplier_order_assignments')
    .select('assignment_status')
    .eq('id', assignmentId)
    .single()

  if (currentAssignment?.assignment_status !== 'shipped') {
    return { success: false, error: 'Order must be shipped before updating shipping details' }
  }

  // Prepare updates
  const updates: any = {
    updated_at: new Date().toISOString()
  }

  if (data.carrier !== undefined) {
    updates.carrier = data.carrier
  }
  if (data.tracking_number !== undefined) {
    updates.tracking_number = data.tracking_number
  }
  if (data.estimated_delivery_date !== undefined) {
    updates.estimated_delivery_date = data.estimated_delivery_date || null
  }

  // Update supplier_order_assignments
  const { error: updateError } = await supabase
    .from('supplier_order_assignments')
    .update(updates)
    .eq('id', assignmentId)

  if (updateError) {
    console.error('Error updating shipping details:', updateError)
    return { success: false, error: updateError.message }
  }

  // Get the final values (use new values if provided, otherwise keep existing)
  const finalCarrier = data.carrier ?? assignment.carrier
  const finalTrackingNumber = data.tracking_number ?? assignment.tracking_number

  // Update or insert order_tracking record
  if (finalCarrier && finalTrackingNumber) {
    // Check if tracking record exists
    const { data: existingTracking } = await adminSupabase
      .from('order_tracking')
      .select('id')
      .eq('order_id', assignment.order_id)
      .eq('tracking_number', finalTrackingNumber)
      .maybeSingle()

    // Generate tracking URL
    const { getTrackingUrl } = await import('@/lib/tracking-urls')
    const trackingUrl = getTrackingUrl(finalCarrier, finalTrackingNumber)

    if (existingTracking) {
      // Update existing tracking record
      await adminSupabase
        .from('order_tracking')
        .update({
          carrier: finalCarrier,
          tracking_number: finalTrackingNumber,
          notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTracking.id)
    } else {
      // Insert new tracking record (or update if same order but different tracking number)
      // First, try to find any existing tracking for this order
      const { data: orderTracking } = await adminSupabase
        .from('order_tracking')
        .select('id')
        .eq('order_id', assignment.order_id)
        .maybeSingle()

      if (orderTracking) {
        // Update existing record
        await adminSupabase
          .from('order_tracking')
          .update({
            carrier: finalCarrier,
            tracking_number: finalTrackingNumber,
            status: 'shipped',
            notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderTracking.id)
      } else {
        // Insert new record
        await adminSupabase.from('order_tracking').insert({
          order_id: assignment.order_id,
          carrier: finalCarrier,
          tracking_number: finalTrackingNumber,
          status: 'shipped',
          notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null
        })
      }
    }
  }

  // Get order details for notification
  const { data: orderData } = await adminSupabase
    .from('orders')
    .select('id, order_number, user_id, customer_email, customer_first_name, customer_last_name')
    .eq('id', assignment.order_id)
    .single()

  // Send notification to customer if tracking number changed
  const trackingChanged = data.tracking_number && data.tracking_number !== assignment.tracking_number
  if (trackingChanged && orderData) {
    const customerName = orderData.customer_first_name && orderData.customer_last_name
      ? `${orderData.customer_first_name} ${orderData.customer_last_name}`
      : orderData.customer_first_name || 'Customer'

    // Send email notification
    if (orderData.customer_email && finalTrackingNumber) {
      try {
        const { sendShippingNotificationEmail } = await import('@/lib/email')
        await sendShippingNotificationEmail(
          orderData.customer_email,
          customerName,
          orderData.order_number,
          finalTrackingNumber,
          finalCarrier || undefined
        )
        await markShippingNotificationSent(orderData.id)
        console.log(`Shipping update email sent to customer ${orderData.customer_email} for order ${orderData.order_number}`)
      } catch (emailError) {
        console.error('Error sending shipping update email:', emailError)
        // Don't fail the update if email fails
      }
    }

    // Send in-app notification
    if (orderData.user_id) {
      await sendNotification(orderData.user_id, {
        title: 'Shipping Details Updated',
        message: `Your order #${orderData.order_number || orderData.id} shipping details have been updated.${finalTrackingNumber ? ` New tracking: ${finalTrackingNumber}` : ''}`,
        type: 'info',
        link: `/account/orders/${orderData.id}`,
        metadata: { orderId: orderData.id, trackingNumber: finalTrackingNumber },
      })
    }
  }

  // Notify admins
  if (orderData) {
    await notifyAdmins({
      title: 'Shipping Details Updated',
      message: `Supplier has updated shipping details for order #${orderData.order_number || orderData.id}.`,
      type: 'info',
      link: `/admin/orders/${orderData.id}`,
      metadata: { orderId: orderData.id },
    })
  }

  revalidatePath('/supplier/orders')
  revalidatePath(`/supplier/orders/${assignment.order_id}`)
  if (assignment.order_id) {
    revalidatePath(`/admin/orders/${assignment.order_id}`)
  }

  return { success: true }
}

export async function processReturn(
  returnId: string,
  action: 'approve' | 'reject' | 'receive' | 'inspect' | 'refund',
  data?: {
    inspection_notes?: string
    condition?: string
    restockable?: boolean
    refund_amount?: number
    refund_method?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify supplier has access to this return
  const { data: returnData } = await supabase
    .from('returns')
    .select('supplier_id, order_id, order_item_id, quantity')
    .eq('id', returnId)
    .single()

  if (!returnData) {
    return { success: false, error: 'Return not found' }
  }

  // Check if supplier has access: either supplier_id matches OR order is assigned to supplier
  let hasAccess = returnData.supplier_id === user.id

  if (!hasAccess && returnData.order_id) {
    const { data: assignment } = await supabase
      .from('supplier_order_assignments')
      .select('supplier_id')
      .eq('order_id', returnData.order_id)
      .eq('supplier_id', user.id)
      .single()
    
    hasAccess = !!assignment
  }

  if (!hasAccess) {
    return { success: false, error: 'Unauthorized' }
  }

  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    receive: 'received',
    inspect: 'inspected',
    refund: 'refunded'
  }

  const updates: any = {
    status: statusMap[action]
  }

  if (action === 'approve') {
    updates.approved_at = new Date().toISOString()
  } else if (action === 'receive') {
    updates.received_at = new Date().toISOString()
  } else if (action === 'inspect') {
    updates.inspected_at = new Date().toISOString()
    if (data) {
      updates.inspection_notes = data.inspection_notes
      updates.condition = data.condition
      updates.restockable = data.restockable
    }
  } else if (action === 'refund') {
    updates.refunded_at = new Date().toISOString()
    if (data) {
      updates.refund_amount = data.refund_amount
      updates.refund_method = data.refund_method
    }
  }

  const { error, data: updatedReturns } = await supabase
    .from('returns')
    .update(updates)
    .eq('id', returnId)
    .select()

  if (error) {
    console.error('Error processing return:', error)
    return { success: false, error: error.message }
  }

  // Verify the update was successful
  if (!updatedReturns || updatedReturns.length === 0) {
    console.error('Return not found or update failed', { returnId })
    return { success: false, error: 'Return not found or update failed' }
  }

  const updatedReturn = updatedReturns[0]
  if (updatedReturn.status !== statusMap[action]) {
    console.error('Return status update verification failed', { updatedReturn, expectedStatus: statusMap[action] })
    return { success: false, error: 'Status update verification failed' }
  }

  // If restockable, add back to inventory
  if (action === 'inspect' && data?.restockable) {
    // Get order item to find variant
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('variant_id')
      .eq('id', returnData.order_item_id)
      .single()

    if (orderItem && user) {
      // Find supplier inventory via product link
      const { data: link } = await supabase
        .from('product_supplier_links')
        .select('supplier_inventory_id')
        .eq('variant_id', orderItem.variant_id)
        .eq('supplier_id', user.id)
        .single()

      if (link) {
        // Get current quantity
        const { data: currentInventory } = await supabase
          .from('supplier_inventory')
          .select('quantity_available')
          .eq('id', link.supplier_inventory_id)
          .single()

        if (currentInventory) {
          const newQuantity = (currentInventory.quantity_available || 0) + returnData.quantity
          
          // Add back to inventory
          await supabase
            .from('supplier_inventory')
            .update({
              quantity_available: newQuantity
            })
            .eq('id', link.supplier_inventory_id)

          // Log transaction
          await supabase.from('supplier_inventory_transactions').insert({
            supplier_inventory_id: link.supplier_inventory_id,
            transaction_type: 'return',
            quantity_change: returnData.quantity,
            quantity_after: newQuantity,
            reference_type: 'return',
            reference_id: returnId,
            created_by: user.id
          })
        }
      }
    }
  }

  revalidatePath('/supplier/returns')
  revalidatePath(`/supplier/returns/${returnId}`)
  return { success: true }
}

// Bulk update shipping information from Excel
export async function bulkUpdateShipping(
  updates: Array<{
    orderNumber: string
    carrier: string
    trackingNumber: string
    estimatedDeliveryDate?: string
  }>
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  }

  for (const update of updates) {
    try {
      // Find the assignment by order number
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', update.orderNumber)
        .single()

      if (!order) {
        results.failed++
        results.errors.push(`Order ${update.orderNumber} not found`)
        continue
      }

      // Find the assignment for this supplier
      const { data: assignment } = await supabase
        .from('supplier_order_assignments')
        .select('id, order_id')
        .eq('order_id', order.id)
        .eq('supplier_id', user.id)
        .single()

      if (!assignment) {
        results.failed++
        results.errors.push(`Order ${update.orderNumber} is not assigned to you`)
        continue
      }

      // Update the assignment
      const { error: updateError } = await supabase
        .from('supplier_order_assignments')
        .update({
          assignment_status: 'shipped',
          shipped_at: new Date().toISOString(),
          carrier: update.carrier,
          tracking_number: update.trackingNumber,
          estimated_delivery_date: update.estimatedDeliveryDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)

      if (updateError) {
        results.failed++
        results.errors.push(`Order ${update.orderNumber}: ${updateError.message}`)
        continue
      }

      // Order tracking + fulfillment must use admin client: suppliers have SELECT-only RLS on orders.
      const adminSupabase = createAdminSupabaseClient()
      const { getTrackingUrl } = await import('@/lib/tracking-urls')
      const trackingUrl = getTrackingUrl(update.carrier, update.trackingNumber)
      
      // Check if tracking record exists
      const { data: existingTracking } = await adminSupabase
        .from('order_tracking')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle()
      
      if (existingTracking) {
        // Update existing tracking record
        await adminSupabase
          .from('order_tracking')
          .update({
            carrier: update.carrier,
            tracking_number: update.trackingNumber,
            status: 'shipped',
            notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTracking.id)
      } else {
        // Insert new tracking record
        await adminSupabase.from('order_tracking').insert({
          order_id: order.id,
          carrier: update.carrier,
          tracking_number: update.trackingNumber,
          status: 'shipped',
          notes: trackingUrl ? `Tracking URL: ${trackingUrl}` : null
        })
      }

      const fulfilledAt = new Date().toISOString()
      const { error: orderFulfillError } = await adminSupabase
        .from('orders')
        .update({
          fulfillment_status: 'fulfilled',
          fulfilled_at: fulfilledAt,
          updated_at: fulfilledAt,
        })
        .eq('id', order.id)

      if (orderFulfillError) {
        results.failed++
        results.errors.push(`Order ${update.orderNumber}: could not mark fulfilled — ${orderFulfillError.message}`)
        continue
      }

      // Send email notification
      try {
        const { data: orderData } = await adminSupabase
          .from('orders')
          .select('customer_email, customer_first_name, customer_last_name, order_number, user_id')
          .eq('id', order.id)
          .single()

        if (orderData?.customer_email) {
          const { sendShippingNotificationEmail } = await import('@/lib/email')
          const customerName = orderData.customer_first_name && orderData.customer_last_name
            ? `${orderData.customer_first_name} ${orderData.customer_last_name}`
            : orderData.customer_first_name || 'Customer'
          
          await sendShippingNotificationEmail(
            orderData.customer_email,
            customerName,
            orderData.order_number,
            update.trackingNumber,
            update.carrier
          )
          await markShippingNotificationSent(order.id)

          // Send in-app notification if user_id exists
          if (orderData.user_id) {
            const { sendNotification } = await import('@/app/actions/notifications')
            await sendNotification(orderData.user_id, {
              title: 'Order Shipped!',
              message: `Your order #${orderData.order_number} has been shipped.${update.trackingNumber ? ` Tracking: ${update.trackingNumber}` : ''}`,
              type: 'success',
              link: `/account/orders/${order.id}`,
              metadata: { orderId: order.id, trackingNumber: update.trackingNumber },
            })
          }
        }
      } catch (emailError) {
        console.error(`Error sending email for order ${update.orderNumber}:`, emailError)
        // Don't fail the update if email fails
      }

      results.success++
    } catch (error: any) {
      results.failed++
      results.errors.push(`Order ${update.orderNumber}: ${error.message || 'Unexpected error'}`)
    }
  }

  revalidatePath('/supplier/orders')
  revalidatePath('/admin/orders')

  return {
    success: results.success > 0,
    successCount: results.success,
    failedCount: results.failed,
    errors: results.errors,
    message: `Updated ${results.success} order(s). ${results.failed} failed.`,
  }
}

// Calculate supplier cost for an order based on inventory prices
export async function getSupplierOrderCost(orderId: string, supplierId: string) {
  const supabase = await createServerSupabaseClient()
  
  // Get order items with variant IDs
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, variant_id, quantity, sku')
    .eq('order_id', orderId)

  if (itemsError || !orderItems || orderItems.length === 0) {
    return { success: false, error: 'Order items not found', cost: 0 }
  }

  // Get supplier inventory prices for these variants
  const variantIds = orderItems.map(item => item.variant_id).filter(Boolean)
  
  if (variantIds.length === 0) {
    return { success: false, error: 'No variants found', cost: 0 }
  }

  // Get product_supplier_links to find supplier_inventory_id
  const { data: links, error: linksError } = await supabase
    .from('product_supplier_links')
    .select('variant_id, supplier_inventory_id')
    .in('variant_id', variantIds)
    .eq('supplier_id', supplierId)

  if (linksError || !links || links.length === 0) {
    return { success: false, error: 'No supplier links found', cost: 0 }
  }

  // Get inventory prices
  const inventoryIds = links.map(link => link.supplier_inventory_id).filter(Boolean)
  const { data: inventory, error: inventoryError } = await supabase
    .from('supplier_inventory')
    .select('id, cost_price, sku')
    .in('id', inventoryIds)
    .eq('supplier_id', supplierId)

  if (inventoryError || !inventory) {
    return { success: false, error: 'Inventory not found', cost: 0 }
  }

  // Create a map of variant_id -> cost_price
  const variantToInventoryMap = new Map<string, string>()
  links.forEach(link => {
    const inv = inventory.find(i => i.id === link.supplier_inventory_id)
    if (inv) {
      variantToInventoryMap.set(link.variant_id, inv.cost_price)
    }
  })

  // Also create SKU-based map as fallback
  const skuToCostMap = new Map<string, string>()
  inventory.forEach(inv => {
    skuToCostMap.set(inv.sku, inv.cost_price)
  })

  // Calculate total cost
  let totalCost = 0
  const itemCosts: Array<{ itemId: string, quantity: number, unitCost: number, lineCost: number }> = []

  for (const item of orderItems) {
    let unitCost = 0
    
    // Try variant_id first
    if (item.variant_id && variantToInventoryMap.has(item.variant_id)) {
      unitCost = parseFloat(variantToInventoryMap.get(item.variant_id) || '0')
    } 
    // Fallback to SKU
    else if (item.sku && skuToCostMap.has(item.sku)) {
      unitCost = parseFloat(skuToCostMap.get(item.sku) || '0')
    }

    const lineCost = unitCost * item.quantity
    totalCost += lineCost
    
    itemCosts.push({
      itemId: item.id,
      quantity: item.quantity,
      unitCost,
      lineCost,
    })
  }

  return {
    success: true,
    cost: totalCost,
    itemCosts,
  }
}

// Get supplier costs for multiple orders
export async function getSupplierOrdersCosts(orderIds: string[], supplierId: string) {
  const costs = await Promise.all(
    orderIds.map(orderId => getSupplierOrderCost(orderId, supplierId))
  )

  const totalCost = costs.reduce((sum, result) => {
    return sum + (result.success ? result.cost : 0)
  }, 0)

  return {
    success: true,
    totalCost,
    orderCosts: costs.map((result, index) => ({
      orderId: orderIds[index],
      cost: result.success ? result.cost : 0,
      success: result.success,
    })),
  }
}

/** Supplier portal: conversations with admin users */
export async function getSupplierAdminChatsForPortal() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] as any[], error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'supplier') return { data: [] as any[], error: 'Unauthorized' }

  const admin = createAdminSupabaseClient()
  const { data: chats, error } = await admin
    .from('admin_supplier_chats')
    .select(`
      id,
      admin_id,
      subject,
      status,
      last_message_at,
      admin:admin_id ( first_name, last_name, email )
    `)
    .eq('supplier_id', user.id)
    .order('last_message_at', { ascending: false })

  if (error) return { data: [] as any[], error: error.message }
  return { data: chats || [], error: null }
}

export async function getSupplierAdminChatMessages(chatId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { messages: [] as any[], error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'supplier') return { messages: [] as any[], error: 'Unauthorized' }

  const admin = createAdminSupabaseClient()
  const { data: chat } = await admin
    .from('admin_supplier_chats')
    .select('id, supplier_id')
    .eq('id', chatId)
    .single()

  if (!chat || chat.supplier_id !== user.id) {
    return { messages: [] as any[], error: 'Chat not found' }
  }

  const { data: messages, error } = await admin
    .from('admin_supplier_messages')
    .select('id, message, sender_type, sender_id, created_at, is_read')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) return { messages: [] as any[], error: error.message }
  return {
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      message: m.message,
      senderType: m.sender_type,
      senderId: m.sender_id,
      createdAt: m.created_at,
    })),
    error: null,
  }
}

export async function sendSupplierAdminChatMessage(chatId: string, message: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_name, first_name, last_name, email')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'supplier') return { success: false, error: 'Unauthorized' }

  const text = message.trim()
  if (!text) return { success: false, error: 'Message is empty' }

  const admin = createAdminSupabaseClient()
  const { data: chat, error: chatErr } = await admin
    .from('admin_supplier_chats')
    .select('id, admin_id, supplier_id')
    .eq('id', chatId)
    .single()

  if (chatErr || !chat || chat.supplier_id !== user.id) {
    return { success: false, error: 'Chat not found' }
  }

  const now = new Date().toISOString()
  const { error: insErr } = await admin.from('admin_supplier_messages').insert({
    chat_id: chatId,
    sender_id: user.id,
    sender_type: 'supplier',
    message: text,
    is_read: false,
  })

  if (insErr) return { success: false, error: insErr.message }

  await admin
    .from('admin_supplier_chats')
    .update({ last_message_at: now })
    .eq('id', chatId)

  const supplierLabel =
    profile.company_name ||
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
    profile.email ||
    'Supplier'

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('email, first_name, last_name')
    .eq('id', chat.admin_id)
    .single()

  try {
    const { sendSupplierToAdminChatEmail, getAdminAndPartnerEmails } = await import('@/lib/email')
    const emails = await getAdminAndPartnerEmails()
    const unique = new Set<string>()
    if (adminProfile?.email) unique.add(adminProfile.email)
    emails.forEach((e) => unique.add(e))

    for (const to of unique) {
      if (!to || !to.includes('@')) continue
      const recipientName =
        to === adminProfile?.email
          ? `${adminProfile?.first_name || ''} ${adminProfile?.last_name || ''}`.trim() || 'Admin'
          : 'Team'
      try {
        await sendSupplierToAdminChatEmail(to, recipientName, supplierLabel, text)
      } catch (e) {
        console.warn('sendSupplierAdminChatMessage email to', to, e)
      }
    }
  } catch (e) {
    console.warn('sendSupplierAdminChatMessage emails:', e)
  }

  try {
    const { notifyAdminsAndPartners } = await import('@/app/actions/notifications')
    await notifyAdminsAndPartners({
      title: 'Supplier message',
      message: `${supplierLabel}: ${text.length > 80 ? `${text.slice(0, 77)}…` : text}`,
      type: 'info',
      link: `/admin/suppliers/${user.id}`,
      metadata: { entityType: 'supplier_chat', entityId: chatId },
    })
  } catch (e) {
    console.warn('sendSupplierAdminChatMessage notifyAdminsAndPartners:', e)
  }

  revalidatePath('/supplier/messages')
  revalidatePath('/admin/suppliers')
  revalidatePath(`/admin/suppliers/${user.id}`)

  return { success: true }
}

