'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Create a sample request (admin only)
 */
export async function createSampleRequest(data: {
  request_type: 'existing_product' | 'custom_product'
  supplier_id: string
  // Single product fields (for backward compatibility)
  supplier_inventory_id?: string
  product_id?: string
  variant_id?: string
  // Multiple product fields
  supplier_inventory_ids?: string[]
  product_ids?: string[]
  variant_ids?: string[]
  quantities?: number[]
  custom_product_name?: string
  custom_product_description?: string
  custom_product_images?: string[]
  custom_product_links?: string[]
  shipping_address: {
    name: string
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
    phone?: string
  }
  shipping_notes?: string
  admin_notes?: string
}) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify admin or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'partner') {
      return { success: false, error: 'Unauthorized' }
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    // Prepare product arrays - prioritize multiple product arrays, fallback to single product fields
    const supplierInventoryIds = data.supplier_inventory_ids && data.supplier_inventory_ids.length > 0
      ? data.supplier_inventory_ids
      : data.supplier_inventory_id
        ? [data.supplier_inventory_id]
        : []
    
    const productIds = data.product_ids && data.product_ids.length > 0
      ? data.product_ids
      : data.product_id
        ? [data.product_id]
        : []
    
    const variantIds = data.variant_ids && data.variant_ids.length > 0
      ? data.variant_ids
      : data.variant_id
        ? [data.variant_id]
        : []

    // Prepare quantities array - default to 1 for each product if not provided
    const quantities = data.quantities && data.quantities.length > 0
      ? data.quantities
      : (supplierInventoryIds.length + productIds.length > 0)
        ? Array(supplierInventoryIds.length + productIds.length).fill(1)
        : []

    // Keep single product fields for backward compatibility (use first item if arrays exist)
    const supplierInventoryId = supplierInventoryIds.length > 0 ? supplierInventoryIds[0] : null
    const productId = productIds.length > 0 ? productIds[0] : null
    const variantId = variantIds.length > 0 ? variantIds[0] : null

    const { data: sampleRequest, error } = await adminSupabase
      .from('sample_requests')
      .insert({
        request_type: data.request_type,
        admin_id: user.id,
        supplier_id: data.supplier_id,
        // Single product fields (for backward compatibility)
        supplier_inventory_id: data.request_type === 'existing_product' ? supplierInventoryId : null,
        product_id: data.request_type === 'existing_product' ? productId : null,
        variant_id: data.request_type === 'existing_product' ? variantId : null,
        // Multiple product arrays
        supplier_inventory_ids: data.request_type === 'existing_product' ? supplierInventoryIds : [],
        product_ids: data.request_type === 'existing_product' ? productIds : [],
        variant_ids: data.request_type === 'existing_product' ? variantIds : [],
        quantities: data.request_type === 'existing_product' ? quantities : [],
        custom_product_name: data.request_type === 'custom_product' ? data.custom_product_name : null,
        custom_product_description: data.request_type === 'custom_product' ? data.custom_product_description : null,
        custom_product_images: data.request_type === 'custom_product' && data.custom_product_images ? data.custom_product_images : [],
        custom_product_links: data.request_type === 'custom_product' && data.custom_product_links ? data.custom_product_links : [],
        shipping_address: data.shipping_address,
        shipping_notes: data.shipping_notes || null,
        admin_notes: data.admin_notes || null,
        status: 'pending',
        pricing_model: 'free', // Default, supplier will update
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating sample request:', error)
      return { success: false, error: error.message }
    }

    // Send email notification to supplier
    try {
      // Get supplier information
      const { data: supplier } = await adminSupabase
        .from('profiles')
        .select('email, company_name, first_name, last_name')
        .eq('id', data.supplier_id)
        .single()

      // Get admin information
      const { data: admin } = await adminSupabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single()

      if (supplier?.email) {
        const supplierName = supplier.company_name || 
          `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim() || 
          supplier.email || 'Supplier'
        
        const adminName = admin ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email : 'Admin'
        
        // Get all products for email
        const emailProducts: Array<{
          type: 'inventory' | 'product'
          name: string
          sku?: string
          quantity: number
          variant?: {
            color?: string
            sku?: string
          }
        }> = []

        let productName: string | undefined
        if (data.request_type === 'custom_product' && data.custom_product_name) {
          productName = data.custom_product_name
        } else if (data.request_type === 'existing_product') {
          // Fetch all products for email
          let quantityIndex = 0
          
          // Fetch supplier inventory items
          if (supplierInventoryIds.length > 0) {
            const inventoryIds = supplierInventoryIds.filter((id: any) => id && typeof id === 'string')
            if (inventoryIds.length > 0) {
              const { data: inventoryItems } = await adminSupabase
                .from('supplier_inventory')
                .select('product_name, sku')
                .in('id', inventoryIds)

              if (inventoryItems) {
                for (const item of inventoryItems) {
                  emailProducts.push({
                    type: 'inventory',
                    name: item.product_name,
                    sku: item.sku,
                    quantity: quantities[quantityIndex] || 1,
                  })
                  quantityIndex++
                }
              }
            }
          }

          // Fetch products from catalog
          if (productIds.length > 0) {
            const productIdsFiltered = productIds.filter((id: any) => id && typeof id === 'string')
            const variantIdsFiltered = variantIds.filter((id: any) => id && typeof id === 'string')
            
            if (productIdsFiltered.length > 0) {
              const { data: products } = await adminSupabase
                .from('products')
                .select('title')
                .in('id', productIdsFiltered)

              if (products) {
                for (let i = 0; i < products.length; i++) {
                  const product = products[i]
                  const variantId = variantIdsFiltered[i]
                  
                  let variant: any = undefined
                  if (variantId) {
                    const { data: variantData } = await adminSupabase
                      .from('product_variants')
                      .select('color, sku')
                      .eq('id', variantId)
                      .single()
                    variant = variantData
                  }

                  emailProducts.push({
                    type: 'product',
                    name: product.title,
                    quantity: quantities[quantityIndex] || 1,
                    variant: variant ? {
                      color: variant.color,
                      sku: variant.sku,
                    } : undefined,
                  })
                  quantityIndex++
                }
              }
            }
          }

          // Set product name for backward compatibility
          if (emailProducts.length > 0) {
            productName = emailProducts[0].name
          }
        }

        const { sendSampleRequestNotificationEmail } = await import('@/lib/email')
        await sendSampleRequestNotificationEmail(
          supplier.email,
          supplierName,
          sampleRequest.id,
          data.request_type,
          productName,
          adminName,
          emailProducts.length > 0 ? emailProducts : undefined
        )
        console.log(`Sample request notification email sent to supplier: ${supplier.email}`)
      }
    } catch (emailError) {
      console.error('Error sending sample request notification email:', emailError)
      // Don't fail the request creation if email fails
    }

    try {
      const { sendNotification } = await import('@/app/actions/notifications')
      const typeLabel =
        data.request_type === 'custom_product' ? 'New product research' : 'Existing product sample'
      await sendNotification(data.supplier_id, {
        title: 'New sample request',
        message: `${typeLabel} — open your portal to review pricing and status.`,
        type: 'info',
        link: `/supplier/sample-requests/${sampleRequest.id}`,
        metadata: { entityType: 'sample_request', entityId: sampleRequest.id },
      })
    } catch (pushErr) {
      console.warn('Sample request supplier push:', pushErr)
    }

    revalidatePath('/admin/sample-requests')
    revalidatePath('/supplier/sample-requests')
    revalidatePath('/supplier/research-updates')

    return { success: true, data: sampleRequest }
  } catch (error: any) {
    console.error('Error in createSampleRequest:', error)
    return { success: false, error: error.message || 'Failed to create sample request' }
  }
}

/**
 * Get sample requests for admin
 */
export async function getAdminSampleRequests() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: [], error: 'Not authenticated' }
    }

    // Verify admin or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'partner') {
      return { data: [], error: 'Unauthorized' }
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    // For both admin and partner roles, show all sample requests (not just ones created by current user)
    // This allows partners to see requests created by admins and vice versa
    const { data, error } = await adminSupabase
      .from('sample_requests')
      .select(`
        *,
        supplier:supplier_id (
          id,
          company_name,
          first_name,
          last_name,
          email
        ),
        supplier_inventory (
          id,
          product_name,
          sku
        ),
        products (
          id,
          title
        ),
        product_variants (
          id,
          color,
          sku
        )
      `)
      .order('created_at', { ascending: false })

    // For requests with multiple products, we need to fetch additional data
    // The arrays are stored in supplier_inventory_ids, product_ids, variant_ids
    // We'll handle this in the display components

    if (error) {
      console.error('Error fetching sample requests:', error)
      return { data: [], error: error.message }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Error in getAdminSampleRequests:', error)
    return { data: [], error: error.message || 'Failed to fetch sample requests' }
  }
}

/**
 * Get sample requests for supplier
 */
export async function getSupplierSampleRequests() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: [], error: 'Not authenticated' }
    }

    // Verify supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'supplier') {
      return { data: [], error: 'Unauthorized' }
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    const { data, error } = await adminSupabase
      .from('sample_requests')
      .select(`
        *,
        admin:admin_id (
          id,
          first_name,
          last_name,
          email
        ),
        supplier_inventory (
          id,
          product_name,
          sku
        ),
        products (
          id,
          title
        ),
        product_variants (
          id,
          color,
          sku
        )
      `)
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sample requests:', error)
      return { data: [], error: error.message }
    }

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Error in getSupplierSampleRequests:', error)
    return { data: [], error: error.message || 'Failed to fetch sample requests' }
  }
}

/**
 * Update sample request pricing (supplier only)
 */
export async function updateSampleRequestPricing(
  requestId: string,
  data: {
    sample_price: number
    shipping_cost: number
    pricing_model: 'free' | 'free_sample_paid_shipping' | 'paid_sample_free_shipping' | 'paid_sample_paid_shipping'
    supplier_notes?: string
  }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'supplier') {
      return { success: false, error: 'Unauthorized' }
    }

    // Calculate total amount based on pricing model
    let totalAmount = 0.00
    if (data.pricing_model === 'free_sample_paid_shipping') {
      totalAmount = data.shipping_cost
    } else if (data.pricing_model === 'paid_sample_free_shipping') {
      totalAmount = data.sample_price
    } else if (data.pricing_model === 'paid_sample_paid_shipping') {
      totalAmount = data.sample_price + data.shipping_cost
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    // Verify the request belongs to this supplier
    const { data: request } = await adminSupabase
      .from('sample_requests')
      .select('supplier_id')
      .eq('id', requestId)
      .single()

    if (!request || request.supplier_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data: updatedRequest, error } = await adminSupabase
      .from('sample_requests')
      .update({
        sample_price: data.sample_price,
        shipping_cost: data.shipping_cost,
        pricing_model: data.pricing_model,
        total_amount: totalAmount,
        supplier_notes: data.supplier_notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) {
      console.error('Error updating sample request pricing:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/sample-requests')
    revalidatePath('/supplier/sample-requests')
    revalidatePath('/supplier/research-updates')
    revalidatePath(`/supplier/sample-requests/${requestId}`)

    return { success: true, data: updatedRequest }
  } catch (error: any) {
    console.error('Error in updateSampleRequestPricing:', error)
    return { success: false, error: error.message || 'Failed to update pricing' }
  }
}

/**
 * Update sample request status (supplier only)
 */
export async function updateSampleRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected' | 'shipped' | 'delivered' | 'cancelled',
  data?: {
    tracking_number?: string
    shipping_carrier?: string
    supplier_notes?: string
  }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'supplier') {
      return { success: false, error: 'Unauthorized' }
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    // Get the full request to check total amount
    const { data: request } = await adminSupabase
      .from('sample_requests')
      .select('supplier_id, total_amount, admin_id, payment_id')
      .eq('id', requestId)
      .single()

    if (!request || request.supplier_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (data?.tracking_number) {
      updateData.tracking_number = data.tracking_number
    }
    if (data?.shipping_carrier) {
      updateData.shipping_carrier = data.shipping_carrier
    }
    if (data?.supplier_notes) {
      updateData.supplier_notes = data.supplier_notes
    }
    if (status === 'shipped') {
      updateData.shipped_at = new Date().toISOString()
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    // If approving and total amount > 0, create a payment record
    if (status === 'approved' && parseFloat(request.total_amount || '0') > 0 && !request.payment_id) {
      // Get admin profile for payment record
      const { data: adminProfile } = await adminSupabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', request.admin_id)
        .single()

      // Create payment record
      const { data: payment, error: paymentError } = await adminSupabase
        .from('payments')
        .insert({
          user_id: request.admin_id,
          customer_email: adminProfile?.email || null,
          customer_name: adminProfile ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() : null,
          payment_amount: request.total_amount,
          currency: 'usd',
          payment_method: 'sample_request',
          payment_status: 'pending',
          sample_request_id: requestId,
          metadata: {
            type: 'sample_request',
            sample_request_id: requestId,
          },
        })
        .select()
        .single()

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
        // Don't fail the approval if payment creation fails
      } else if (payment) {
        updateData.payment_id = payment.id
        updateData.payment_status = 'pending'
      }
    }

    const { data: updatedRequest, error } = await adminSupabase
      .from('sample_requests')
      .update(updateData)
      .eq('id', requestId)
      .select(`
        *,
        admin:admin_id (
          email,
          first_name,
          last_name
        ),
        supplier:supplier_id (
          email,
          company_name,
          first_name,
          last_name
        ),
        supplier_inventory (
          product_name
        ),
        products (
          title
        )
      `)
      .single()

    if (error) {
      console.error('Error updating sample request status:', error)
      return { success: false, error: error.message }
    }

    // Send email notifications to admin and partner when status is 'shipped' or 'delivered'
    if ((status === 'shipped' || status === 'delivered') && updatedRequest) {
      try {
        const { getAdminAndPartnerEmails, sendSampleRequestStatusUpdateEmail } = await import('@/lib/email')
        const adminPartnerEmails = await getAdminAndPartnerEmails()
        
        // Get all products for email
        const emailProducts: Array<{
          type: 'inventory' | 'product'
          name: string
          sku?: string
          quantity: number
          variant?: {
            color?: string
            sku?: string
          }
        }> = []

        let productName: string | undefined
        if (updatedRequest.request_type === 'custom_product' && updatedRequest.custom_product_name) {
          productName = updatedRequest.custom_product_name
        } else if (updatedRequest.request_type === 'existing_product') {
          const quantities = (updatedRequest.quantities || []) as number[]
          let quantityIndex = 0

          // Fetch supplier inventory items
          if (updatedRequest.supplier_inventory_ids && Array.isArray(updatedRequest.supplier_inventory_ids) && updatedRequest.supplier_inventory_ids.length > 0) {
            const inventoryIds = updatedRequest.supplier_inventory_ids.filter((id: any) => id && typeof id === 'string')
            if (inventoryIds.length > 0) {
              const { data: inventoryItems } = await adminSupabase
                .from('supplier_inventory')
                .select('product_name, sku')
                .in('id', inventoryIds)

              if (inventoryItems) {
                for (const item of inventoryItems) {
                  emailProducts.push({
                    type: 'inventory',
                    name: item.product_name,
                    sku: item.sku,
                    quantity: quantities[quantityIndex] || 1,
                  })
                  quantityIndex++
                }
              }
            }
          }

          // Fetch products from catalog
          if (updatedRequest.product_ids && Array.isArray(updatedRequest.product_ids) && updatedRequest.product_ids.length > 0) {
            const productIds = updatedRequest.product_ids.filter((id: any) => id && typeof id === 'string')
            const variantIds = ((updatedRequest.variant_ids || []) as string[]).filter((id: any) => id && typeof id === 'string')
            
            if (productIds.length > 0) {
              const { data: products } = await adminSupabase
                .from('products')
                .select('title')
                .in('id', productIds)

              if (products) {
                for (let i = 0; i < products.length; i++) {
                  const product = products[i]
                  const variantId = variantIds[i]
                  
                  let variant: any = undefined
                  if (variantId) {
                    const { data: variantData } = await adminSupabase
                      .from('product_variants')
                      .select('color, sku')
                      .eq('id', variantId)
                      .single()
                    variant = variantData
                  }

                  emailProducts.push({
                    type: 'product',
                    name: product.title,
                    quantity: quantities[quantityIndex] || 1,
                    variant: variant ? {
                      color: variant.color,
                      sku: variant.sku,
                    } : undefined,
                  })
                  quantityIndex++
                }
              }
            }
          }

          // Set product name for backward compatibility
          if (emailProducts.length > 0) {
            productName = emailProducts[0].name
          } else if (updatedRequest.supplier_inventory) {
            productName = (updatedRequest.supplier_inventory as any).product_name
          } else if (updatedRequest.products) {
            productName = (updatedRequest.products as any).title
          }
        }

        // Send email to all admin and partner users
        for (const email of adminPartnerEmails) {
          try {
            const recipientName = email === (updatedRequest.admin as any)?.email 
              ? `${(updatedRequest.admin as any).first_name || ''} ${(updatedRequest.admin as any).last_name || ''}`.trim() || 'Admin'
              : 'Admin'
            
            await sendSampleRequestStatusUpdateEmail(
              email,
              recipientName,
              requestId,
              status,
              productName,
              data?.tracking_number,
              data?.shipping_carrier,
              emailProducts.length > 0 ? emailProducts : undefined
            )
            console.log(`Sample request ${status} notification sent to ${email}`)
          } catch (emailError) {
            console.error(`Error sending sample request ${status} email to ${email}:`, emailError)
            // Continue sending to other recipients even if one fails
          }
        }

        // Also send to system email
        try {
          await sendSampleRequestStatusUpdateEmail(
            'hello@brevibrushes.com',
            'BREVI™ Team',
            requestId,
            status,
            productName,
            data?.tracking_number,
            data?.shipping_carrier,
            emailProducts.length > 0 ? emailProducts : undefined
          )
          console.log(`Sample request ${status} notification sent to system email`)
        } catch (emailError) {
          console.error('Error sending sample request status email to system email:', emailError)
        }
      } catch (emailError) {
        console.error('Error sending sample request status update emails:', emailError)
        // Don't fail the status update if email fails
      }
    }

    // Email + push for other supplier-driven outcomes (research / rebranding workflow)
    if (
      updatedRequest &&
      (status === 'approved' || status === 'rejected' || status === 'cancelled')
    ) {
      try {
        const sup = updatedRequest.supplier as any
        const supplierLabel =
          sup?.company_name ||
          `${sup?.first_name || ''} ${sup?.last_name || ''}`.trim() ||
          sup?.email ||
          'Supplier'
        let productSummary: string | undefined
        if (updatedRequest.request_type === 'custom_product') {
          productSummary = updatedRequest.custom_product_name || undefined
        } else {
          productSummary =
            (updatedRequest.supplier_inventory as any)?.product_name ||
            (updatedRequest.products as any)?.title
        }
        const rtLabel =
          updatedRequest.request_type === 'custom_product'
            ? 'New product research'
            : 'Existing product / rebrand & version updates'

        const { getAdminAndPartnerEmails, sendSampleRequestStatusBroadcastEmail } =
          await import('@/lib/email')
        const emails = await getAdminAndPartnerEmails()
        for (const email of emails) {
          try {
            await sendSampleRequestStatusBroadcastEmail(
              email,
              'Team',
              requestId,
              status,
              supplierLabel,
              rtLabel,
              productSummary
            )
          } catch (emailError) {
            console.error('Sample request broadcast email:', emailError)
          }
        }

        const { notifyAdminsAndPartners } = await import('@/app/actions/notifications')
        await notifyAdminsAndPartners({
          title: `Sample request ${status}`,
          message: `${supplierLabel} — ${productSummary || requestId.slice(0, 8) + '…'}`,
          type: 'info',
          link: `/admin/sample-requests/${requestId}`,
          metadata: { entityType: 'sample_request', entityId: requestId },
        })
      } catch (e) {
        console.error('Sample request approved/rejected/cancelled notifications:', e)
      }
    }

    if (updatedRequest && (status === 'shipped' || status === 'delivered')) {
      try {
        const sup = updatedRequest.supplier as any
        const supplierLabel =
          sup?.company_name ||
          `${sup?.first_name || ''} ${sup?.last_name || ''}`.trim() ||
          sup?.email ||
          'Supplier'
        const { notifyAdminsAndPartners } = await import('@/app/actions/notifications')
        await notifyAdminsAndPartners({
          title: `Sample ${status}`,
          message: `${supplierLabel} — request ${requestId.slice(0, 8)}…`,
          type: 'success',
          link: `/admin/sample-requests/${requestId}`,
          metadata: { entityType: 'sample_request', entityId: requestId },
        })
      } catch (e) {
        console.warn('Sample shipped/delivered push:', e)
      }
    }

    revalidatePath('/admin/sample-requests')
    revalidatePath('/supplier/sample-requests')
    revalidatePath('/supplier/research-updates')
    revalidatePath(`/supplier/sample-requests/${requestId}`)
    revalidatePath('/admin/payments')
    if (updatedRequest?.supplier_id) {
      revalidatePath(`/admin/suppliers/${updatedRequest.supplier_id}`)
    }

    return { success: true, data: updatedRequest }
  } catch (error: any) {
    console.error('Error in updateSampleRequestStatus:', error)
    return { success: false, error: error.message || 'Failed to update status' }
  }
}

/**
 * Get sample request by ID
 */
export async function getSampleRequestById(requestId: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminSupabaseClient()

    const { data, error } = await adminSupabase
      .from('sample_requests')
      .select(`
        *,
        admin:admin_id (
          id,
          first_name,
          last_name,
          email
        ),
        supplier:supplier_id (
          id,
          company_name,
          first_name,
          last_name,
          email
        ),
        supplier_inventory (
          id,
          product_name,
          sku,
          description
        ),
        products (
          id,
          title,
          description
        ),
        product_variants (
          id,
          color,
          sku,
          image_url
        )
      `)
      .eq('id', requestId)
      .single()

    if (error) {
      console.error('Error fetching sample request:', error)
      return { data: null, error: error.message }
    }

    // Verify access (admin, partner, or supplier who owns the request)
    if (data.admin_id !== user.id && data.supplier_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin' && profile?.role !== 'partner') {
        return { data: null, error: 'Unauthorized' }
      }
    }

    // Fetch all products from arrays if they exist
    const allProducts: Array<{
      type: 'inventory' | 'product'
      id: string
      name: string
      sku?: string
      quantity: number
      variant?: {
        id: string
        color?: string
        sku?: string
      }
    }> = []

    if (data.request_type === 'existing_product') {
      const quantities = (data.quantities || []) as number[]
      let quantityIndex = 0

      // Fetch supplier inventory items
      if (data.supplier_inventory_ids && Array.isArray(data.supplier_inventory_ids) && data.supplier_inventory_ids.length > 0) {
        const inventoryIds = data.supplier_inventory_ids.filter((id: any) => id && typeof id === 'string')
        if (inventoryIds.length > 0) {
          const { data: inventoryItems } = await adminSupabase
            .from('supplier_inventory')
            .select('id, product_name, sku')
            .in('id', inventoryIds)

          if (inventoryItems) {
            for (const item of inventoryItems) {
              allProducts.push({
                type: 'inventory',
                id: item.id,
                name: item.product_name,
                sku: item.sku,
                quantity: quantities[quantityIndex] || 1,
              })
              quantityIndex++
            }
          }
        }
      }

      // Fetch products from catalog
      if (data.product_ids && Array.isArray(data.product_ids) && data.product_ids.length > 0) {
        const productIds = data.product_ids.filter((id: any) => id && typeof id === 'string')
        const variantIds = (data.variant_ids || []) as string[]
        
        if (productIds.length > 0) {
          const { data: products } = await adminSupabase
            .from('products')
            .select('id, title')
            .in('id', productIds)

          if (products) {
            for (let i = 0; i < products.length; i++) {
              const product = products[i]
              const variantId = variantIds[i]
              
              let variant: any = undefined
              if (variantId) {
                const { data: variantData } = await adminSupabase
                  .from('product_variants')
                  .select('id, color, sku')
                  .eq('id', variantId)
                  .single()
                variant = variantData
              }

              allProducts.push({
                type: 'product',
                id: product.id,
                name: product.title,
                quantity: quantities[quantityIndex] || 1,
                variant: variant ? {
                  id: variant.id,
                  color: variant.color,
                  sku: variant.sku,
                } : undefined,
              })
              quantityIndex++
            }
          }
        }
      }
    }

    // Add products list to the data
    return { data: { ...data, allProducts }, error: null }
  } catch (error: any) {
    console.error('Error in getSampleRequestById:', error)
    return { data: null, error: error.message || 'Failed to fetch sample request' }
  }
}

