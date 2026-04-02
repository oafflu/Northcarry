'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendReplacementShippedEmail } from '@/lib/email'

export async function getCustomerReturns() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      orders:order_id (
        order_number
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching returns:', error)
    return { data: [], error: error.message }
  }

  // Ensure replacement tracking fields are included
  const returnsWithOrderNumbers = (data || []).map((ret: any) => ({
    ...ret,
    order_number: ret.orders?.order_number || 'N/A',
    replacement_tracking_number: ret.replacement_tracking_number || null,
    replacement_carrier: ret.replacement_carrier || null,
    replacement_shipped_at: ret.replacement_shipped_at || null,
  }))

  return { data: returnsWithOrderNumbers, error: null }
}

export async function createReturnRequest(data: {
  order_id: string
  order_item_id?: string
  reason: string
  detailed_reason?: string
  quantity: number
  customer_images?: string[]
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get order to verify ownership
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id')
    .eq('id', data.order_id)
    .single()

  if (!order || order.user_id !== user.id) {
    return { success: false, error: 'Order not found or unauthorized' }
  }

  // Generate return number
  const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`

  const { data: returnData, error } = await supabase
    .from('returns')
    .insert({
      return_number: returnNumber,
      order_id: data.order_id,
      order_item_id: data.order_item_id,
      customer_id: user.id,
      reason: data.reason,
      detailed_reason: data.detailed_reason,
      quantity: data.quantity,
      customer_images: data.customer_images || [],
      status: 'requested',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating return:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/account/returns')
  return { success: true, returnNumber }
}

// Admin/Partner action to create return request (replacement)
export async function createAdminReturnRequest(data: {
  order_id: string
  order_item_id: string
  reason: string
  detailed_reason?: string
  quantity: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const adminSupabase = await createAdminSupabaseClient()

  // Get order to find customer and supplier
  const { data: order } = await adminSupabase
    .from('orders')
    .select('id, user_id')
    .eq('id', data.order_id)
    .single()

  if (!order) {
    return { success: false, error: 'Order not found' }
  }

  // Find supplier for this return in multiple ways:
  // 1. From supplier_order_assignments (if order is already assigned)
  // 2. From order item's variant via product_supplier_links (fallback)
  let supplierId: string | null = null

  // Try to get supplier from order assignment first
  const { data: assignment } = await adminSupabase
    .from('supplier_order_assignments')
    .select('supplier_id')
    .eq('order_id', data.order_id)
    .limit(1)
    .maybeSingle() // Use maybeSingle() instead of single() to avoid error if no assignment

  if (assignment?.supplier_id) {
    supplierId = assignment.supplier_id
  } else {
    // Fallback: Get supplier from order item's variant
    const { data: orderItem } = await adminSupabase
      .from('order_items')
      .select('variant_id')
      .eq('id', data.order_item_id)
      .single()

    if (orderItem?.variant_id) {
      const { data: supplierLink } = await adminSupabase
        .from('product_supplier_links')
        .select('supplier_id')
        .eq('variant_id', orderItem.variant_id)
        .eq('is_primary_supplier', true)
        .limit(1)
        .maybeSingle()

      if (supplierLink?.supplier_id) {
        supplierId = supplierLink.supplier_id
      }
    }
  }

  // Generate return number
  const returnNumber = `RET-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`

  const { data: returnData, error } = await adminSupabase
    .from('returns')
    .insert({
      return_number: returnNumber,
      order_id: data.order_id,
      order_item_id: data.order_item_id,
      customer_id: order.user_id,
      supplier_id: supplierId,
      reason: data.reason,
      detailed_reason: data.detailed_reason,
      quantity: data.quantity,
      status: 'requested',
      requested_by_admin: profile.role === 'admin',
      requested_by_partner: profile.role === 'partner',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating admin return request:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/returns')
  revalidatePath('/supplier/returns')
  return { success: true, returnNumber }
}

export async function getAdminReturns() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  // Check if user is admin or partner
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return { data: [], error: 'Unauthorized' }
  }

  const adminSupabase = await createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('returns')
    .select(`
      *,
      orders:order_id (
        order_number
      ),
      profiles:customer_id (
        email,
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching returns:', error)
    return { data: [], error: error.message }
  }

  const returnsWithOrderNumbers = (data || []).map((ret: any) => ({
    ...ret,
    order_number: ret.orders?.order_number || 'N/A',
  }))

  return { data: returnsWithOrderNumbers, error: null }
}

// Update replacement shipping (supplier action)
export async function updateReplacementShipping(
  returnId: string,
  data: {
    tracking_number: string
    carrier: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify supplier has access to this return (same logic as detail page)
  const { data: returnData } = await supabase
    .from('returns')
    .select('supplier_id, customer_id, order_id, order_item_id, return_number')
    .eq('id', returnId)
    .single()

  if (!returnData) {
    return { success: false, error: 'Return not found' }
  }

  // Check if supplier has access: either supplier_id matches OR order is assigned to supplier OR order item variant is linked to supplier
  let hasAccess = returnData.supplier_id === user.id

  if (!hasAccess && returnData.order_id) {
    // Check if order is assigned to this supplier
    const { data: assignment } = await supabase
      .from('supplier_order_assignments')
      .select('supplier_id')
      .eq('order_id', returnData.order_id)
      .eq('supplier_id', user.id)
      .single()
    
    hasAccess = !!assignment
  }

  // If still no access, check if the order item's variant is linked to this supplier
  if (!hasAccess && returnData.order_item_id) {
    // Get the order item's variant_id
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('variant_id')
      .eq('id', returnData.order_item_id)
      .single()

    if (orderItem?.variant_id) {
      // Check if this variant is linked to this supplier
      const { data: supplierLink } = await supabase
        .from('product_supplier_links')
        .select('supplier_id')
        .eq('variant_id', orderItem.variant_id)
        .eq('supplier_id', user.id)
        .eq('is_primary_supplier', true)
        .single()
      
      hasAccess = !!supplierLink
    }
  }

  if (!hasAccess) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('returns')
    .update({
      replacement_tracking_number: data.tracking_number,
      replacement_carrier: data.carrier,
      replacement_shipped_at: new Date().toISOString(),
      status: 'return_shipped', // Mark as return_shipped when replacement is shipped (so it shows in the tab)
    })
    .eq('id', returnId)

  if (error) {
    console.error('Error updating replacement shipping:', error)
    return { success: false, error: error.message }
  }

  // Send email notifications to customer, admin, and partner
  const emailErrors: string[] = []
  try {
    const adminSupabase = await createAdminSupabaseClient()
    
    // Get return details with order and customer info
    const { data: returnDetails, error: fetchError } = await adminSupabase
      .from('returns')
      .select(`
        *,
        orders:order_id (
          order_number
        ),
        profiles:customer_id (
          email,
          first_name,
          last_name
        ),
        order_items (
          product_title,
          variant_color
        )
      `)
      .eq('id', returnId)
      .single()

    if (fetchError) {
      console.error('Error fetching return details for email:', fetchError)
      emailErrors.push(`Failed to fetch return details: ${fetchError.message}`)
    } else if (returnDetails) {
      const productName = (returnDetails.order_items as any)?.product_title || 'Product'
      const orderNumber = (returnDetails.orders as any)?.order_number || 'N/A'
      const customerEmail = (returnDetails.profiles as any)?.email
      const customerName = (returnDetails.profiles as any) 
        ? `${(returnDetails.profiles as any).first_name || ''} ${(returnDetails.profiles as any).last_name || ''}`.trim() || 'Customer'
        : 'Customer'

      // Send to customer
      if (customerEmail) {
        try {
          console.log('Sending replacement email to customer:', customerEmail)
          const emailResult = await sendReplacementShippedEmail(
            customerEmail,
            customerName,
            returnDetails.return_number,
            orderNumber,
            productName,
            data.tracking_number,
            data.carrier
          )
          console.log('Customer email sent successfully:', emailResult)
        } catch (emailError: any) {
          const errorMsg = `Error sending replacement email to customer ${customerEmail}: ${emailError.message || emailError}`
          console.error(errorMsg, emailError)
          emailErrors.push(errorMsg)
        }
      } else {
        console.warn('No customer email found for return:', returnId)
        emailErrors.push('No customer email found')
      }

      // Get all admin and partner emails
      const { data: adminPartnerUsers, error: usersError } = await adminSupabase
        .from('profiles')
        .select('email, first_name, last_name, role')
        .in('role', ['admin', 'partner'])

      if (usersError) {
        console.error('Error fetching admin/partner users:', usersError)
        emailErrors.push(`Failed to fetch admin/partner users: ${usersError.message}`)
      } else if (adminPartnerUsers && adminPartnerUsers.length > 0) {
        console.log(`Sending emails to ${adminPartnerUsers.length} admin/partner users`)
        for (const user of adminPartnerUsers) {
          if (!user.email) {
            console.warn(`User ${user.first_name} ${user.last_name} (${user.role}) has no email`)
            continue
          }
          try {
            const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Admin'
            console.log(`Sending replacement email to ${user.role}:`, user.email)
            const emailResult = await sendReplacementShippedEmail(
              user.email,
              recipientName,
              returnDetails.return_number,
              orderNumber,
              productName,
              data.tracking_number,
              data.carrier
            )
            console.log(`Email sent successfully to ${user.email}:`, emailResult)
          } catch (emailError: any) {
            const errorMsg = `Error sending replacement email to ${user.role} ${user.email}: ${emailError.message || emailError}`
            console.error(errorMsg, emailError)
            emailErrors.push(errorMsg)
          }
        }
      } else {
        console.warn('No admin or partner users found to send emails to')
        emailErrors.push('No admin or partner users found')
      }
    } else {
      console.error('Return details not found for email notification')
      emailErrors.push('Return details not found')
    }
  } catch (emailError: any) {
    const errorMsg = `Error in email notification process: ${emailError.message || emailError}`
    console.error(errorMsg, emailError)
    emailErrors.push(errorMsg)
  }

  // Log email errors but don't fail the update
  if (emailErrors.length > 0) {
    console.error('Email notification errors:', emailErrors)
  } else {
    console.log('All replacement shipping emails sent successfully')
  }

  revalidatePath('/supplier/returns')
  revalidatePath('/admin/returns')
  revalidatePath('/account/returns')

  return { success: true, emailErrors: emailErrors.length > 0 ? emailErrors : undefined }
}

// Resend replacement shipped emails
export async function resendReplacementShippedEmails(returnId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is admin, partner, or supplier with access
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdminOrPartner = profile?.role === 'admin' || profile?.role === 'partner'

  // Verify access
  const { data: returnData } = await supabase
    .from('returns')
    .select('supplier_id, order_id, order_item_id, replacement_tracking_number, replacement_carrier')
    .eq('id', returnId)
    .single()

  if (!returnData) {
    return { success: false, error: 'Return not found' }
  }

  // Check if supplier has access (if not admin/partner)
  if (!isAdminOrPartner) {
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

    if (!hasAccess && returnData.order_item_id) {
      const { data: orderItem } = await supabase
        .from('order_items')
        .select('variant_id')
        .eq('id', returnData.order_item_id)
        .single()

      if (orderItem?.variant_id) {
        const { data: supplierLink } = await supabase
          .from('product_supplier_links')
          .select('supplier_id')
          .eq('variant_id', orderItem.variant_id)
          .eq('supplier_id', user.id)
          .eq('is_primary_supplier', true)
          .single()
        
        hasAccess = !!supplierLink
      }
    }

    if (!hasAccess) {
      return { success: false, error: 'Unauthorized' }
    }
  }

  // Check if replacement has been shipped
  if (!returnData.replacement_tracking_number || !returnData.replacement_carrier) {
    return { success: false, error: 'Replacement has not been shipped yet' }
  }

  // Send emails using the same logic as updateReplacementShipping
  const emailErrors: string[] = []
  try {
    const adminSupabase = await createAdminSupabaseClient()
    
    const { data: returnDetails, error: fetchError } = await adminSupabase
      .from('returns')
      .select(`
        *,
        orders:order_id (
          order_number
        ),
        profiles:customer_id (
          email,
          first_name,
          last_name
        ),
        order_items (
          product_title,
          variant_color
        )
      `)
      .eq('id', returnId)
      .single()

    if (fetchError) {
      console.error('Error fetching return details for resend email:', fetchError)
      return { success: false, error: `Failed to fetch return details: ${fetchError.message}` }
    }

    if (!returnDetails) {
      return { success: false, error: 'Return details not found' }
    }

    const productName = (returnDetails.order_items as any)?.product_title || 'Product'
    const orderNumber = (returnDetails.orders as any)?.order_number || 'N/A'
    const customerEmail = (returnDetails.profiles as any)?.email
    const customerName = (returnDetails.profiles as any) 
      ? `${(returnDetails.profiles as any).first_name || ''} ${(returnDetails.profiles as any).last_name || ''}`.trim() || 'Customer'
      : 'Customer'

    // Send to customer
    if (customerEmail) {
      try {
        console.log('Resending replacement email to customer:', customerEmail)
        await sendReplacementShippedEmail(
          customerEmail,
          customerName,
          returnDetails.return_number,
          orderNumber,
          productName,
          returnData.replacement_tracking_number,
          returnData.replacement_carrier
        )
        console.log('Customer email resent successfully')
      } catch (emailError: any) {
        const errorMsg = `Error resending email to customer ${customerEmail}: ${emailError.message || emailError}`
        console.error(errorMsg, emailError)
        emailErrors.push(errorMsg)
      }
    } else {
      emailErrors.push('No customer email found')
    }

    // Get all admin and partner emails
    const { data: adminPartnerUsers, error: usersError } = await adminSupabase
      .from('profiles')
      .select('email, first_name, last_name, role')
      .in('role', ['admin', 'partner'])

    if (usersError) {
      console.error('Error fetching admin/partner users:', usersError)
      emailErrors.push(`Failed to fetch admin/partner users: ${usersError.message}`)
    } else if (adminPartnerUsers && adminPartnerUsers.length > 0) {
      console.log(`Resending emails to ${adminPartnerUsers.length} admin/partner users`)
      for (const user of adminPartnerUsers) {
        if (!user.email) {
          console.warn(`User ${user.first_name} ${user.last_name} (${user.role}) has no email`)
          continue
        }
        try {
          const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Admin'
          console.log(`Resending replacement email to ${user.role}:`, user.email)
          await sendReplacementShippedEmail(
            user.email,
            recipientName,
            returnDetails.return_number,
            orderNumber,
            productName,
            returnData.replacement_tracking_number,
            returnData.replacement_carrier
          )
          console.log(`Email resent successfully to ${user.email}`)
        } catch (emailError: any) {
          const errorMsg = `Error resending email to ${user.role} ${user.email}: ${emailError.message || emailError}`
          console.error(errorMsg, emailError)
          emailErrors.push(errorMsg)
        }
      }
    } else {
      emailErrors.push('No admin or partner users found')
    }

  } catch (emailError: any) {
    const errorMsg = `Error in resend email process: ${emailError.message || emailError}`
    console.error(errorMsg, emailError)
    return { success: false, error: errorMsg }
  }

  if (emailErrors.length > 0) {
    return { 
      success: false, 
      error: `Some emails failed to send: ${emailErrors.join('; ')}`,
      emailErrors 
    }
  }

  return { success: true, message: 'All emails resent successfully' }
}