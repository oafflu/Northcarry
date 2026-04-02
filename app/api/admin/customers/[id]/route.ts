import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const { data: currentCustomer, error: currentCustomerError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', customerId)
      .eq('role', 'customer')
      .single()

    if (currentCustomerError || !currentCustomer) {
      return NextResponse.json(
        { error: currentCustomerError?.message || 'Customer not found' },
        { status: 404 }
      )
    }

    const normalizedEmail =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null

    if (body.email !== undefined && normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    const currentEmail = currentCustomer.email?.toLowerCase().trim() || null
    const emailChanged = normalizedEmail !== null && normalizedEmail !== currentEmail

    if (emailChanged) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .neq('id', customerId)
        .maybeSingle()

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email address is already in use by another user' },
          { status: 400 }
        )
      }

      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(customerId)
      if (!authUserError && authUserData?.user) {
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(customerId, {
          email: normalizedEmail,
          email_confirm: true,
        })

        if (authUpdateError) {
          console.error('Error updating auth email:', authUpdateError)
          return NextResponse.json(
            { error: authUpdateError.message || 'Failed to update customer auth email' },
            { status: 500 }
          )
        }
      }
    }

    const profileUpdates: Record<string, string | null> = {
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      phone: body.phone || null,
    }

    if (emailChanged) {
      profileUpdates.email = normalizedEmail
    }

    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', customerId)

    if (error) {
      console.error('Error updating customer:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update customer' },
        { status: 500 }
      )
    }

    if (emailChanged && normalizedEmail) {
      const { data: subscriberByNewEmail } = await supabase
        .from('email_subscribers')
        .select('id, user_id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (subscriberByNewEmail?.id) {
        if (!subscriberByNewEmail.user_id || subscriberByNewEmail.user_id === customerId) {
          await supabase
            .from('email_subscribers')
            .update({ user_id: customerId })
            .eq('id', subscriberByNewEmail.id)

          await supabase
            .from('email_subscribers')
            .delete()
            .eq('user_id', customerId)
            .neq('id', subscriberByNewEmail.id)
        }
      } else {
        const { data: currentSubscriber } = await supabase
          .from('email_subscribers')
          .select('id')
          .eq('user_id', customerId)
          .maybeSingle()

        if (currentSubscriber?.id) {
          await supabase
            .from('email_subscribers')
            .update({ email: normalizedEmail })
            .eq('id', currentSubscriber.id)
        } else if (currentEmail) {
          await supabase
            .from('email_subscribers')
            .update({ email: normalizedEmail, user_id: customerId })
            .eq('email', currentEmail)
            .is('user_id', null)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = createAdminSupabaseClient()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    console.log('Fetching customer with ID:', customerId)

    // Get customer profile
    const { data: customer, error: customerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError) {
      console.error('Error fetching customer:', customerError)
      return NextResponse.json(
        { error: customerError.message || 'Customer not found' },
        { status: 404 }
      )
    }

    if (!customer) {
      console.log('Customer not found for ID:', customerId)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get customer orders - check both user_id and customer_email
    const customerEmail = customer.email?.toLowerCase().trim()
    
    let ordersQuery = supabase
      .from('orders')
      .select('id, order_number, total, fulfillment_status, created_at, shipping_address, billing_address, customer_phone')
      .or(`user_id.eq.${customerId},customer_email.ilike.%${customerEmail}%`)
      .order('created_at', { ascending: false })
      .limit(50) // Increased limit to get more orders for address extraction

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      // Don't fail the request if orders can't be fetched
    }

    // Remove duplicate orders (in case an order matches both user_id and email)
    const uniqueOrders = orders ? Array.from(
      new Map(orders.map(order => [order.id, order])).values()
    ) : []

    // Get customer addresses from addresses table
    const { data: addresses, error: addressesError } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (addressesError) {
      console.error('Error fetching addresses:', addressesError)
      // Don't fail the request if addresses can't be fetched
    }

    // Extract addresses from orders (orders store addresses as JSONB)
    // This ensures we show all addresses that exist in the system, even if not migrated
    const orderAddresses: any[] = []
    const addressKeyMap = new Map<string, any>()
    
    // Add existing addresses to the map
    ;(addresses || []).forEach(addr => {
      const key = `${(addr.address_line1 || '').toLowerCase().trim()}|${(addr.city || '').toLowerCase().trim()}|${(addr.postal_code || '').toLowerCase().trim()}|${(addr.country || '').toLowerCase().trim()}`
      addressKeyMap.set(key, { ...addr, from_order: false })
    })
    
    // Extract addresses from orders
    uniqueOrders.forEach((order: any) => {
      // Process shipping address
      if (order.shipping_address && typeof order.shipping_address === 'object') {
        const shipAddr = order.shipping_address as any
        const key = `${(shipAddr.address_line1 || shipAddr.addressLine1 || '').toLowerCase().trim()}|${(shipAddr.city || '').toLowerCase().trim()}|${(shipAddr.postal_code || shipAddr.postalCode || shipAddr.zip || '').toLowerCase().trim()}|${(shipAddr.country || '').toLowerCase().trim()}`
        
        if (key !== '|||' && !addressKeyMap.has(key)) {
          addressKeyMap.set(key, {
            id: `order-${order.id}-shipping`,
            user_id: null,
            type: 'shipping',
            is_default: false,
            address_line1: shipAddr.address_line1 || shipAddr.addressLine1 || '',
            address_line2: shipAddr.address_line2 || shipAddr.addressLine2 || null,
            city: shipAddr.city || '',
            state: shipAddr.state || shipAddr.province || '',
            postal_code: shipAddr.postal_code || shipAddr.postalCode || shipAddr.zip || '',
            country: shipAddr.country || 'US',
            phone: shipAddr.phone || order.customer_phone || null,
            created_at: order.created_at,
            from_order: true,
          })
        }
      }
      
      // Process billing address
      if (order.billing_address && typeof order.billing_address === 'object') {
        const billAddr = order.billing_address as any
        const key = `${(billAddr.address_line1 || billAddr.addressLine1 || '').toLowerCase().trim()}|${(billAddr.city || '').toLowerCase().trim()}|${(billAddr.postal_code || billAddr.postalCode || billAddr.zip || '').toLowerCase().trim()}|${(billAddr.country || '').toLowerCase().trim()}`
        
        if (key !== '|||' && !addressKeyMap.has(key)) {
          addressKeyMap.set(key, {
            id: `order-${order.id}-billing`,
            user_id: null,
            type: 'billing',
            is_default: false,
            address_line1: billAddr.address_line1 || billAddr.addressLine1 || '',
            address_line2: billAddr.address_line2 || billAddr.addressLine2 || null,
            city: billAddr.city || '',
            state: billAddr.state || billAddr.province || '',
            postal_code: billAddr.postal_code || billAddr.postalCode || billAddr.zip || '',
            country: billAddr.country || 'US',
            phone: billAddr.phone || order.customer_phone || null,
            created_at: order.created_at,
            from_order: true,
          })
        }
      }
    })

    // Convert map to array and sort
    const finalAddresses = Array.from(addressKeyMap.values())
      .sort((a, b) => {
        // Sort by: user-linked addresses first, then is_default, then created_at
        if (a.user_id === customerId && b.user_id !== customerId) return -1
        if (a.user_id !== customerId && b.user_id === customerId) return 1
        if (a.is_default && !b.is_default) return -1
        if (!a.is_default && b.is_default) return 1
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      })

    return NextResponse.json({
      customer,
      orders: uniqueOrders,
      addresses: finalAddresses,
    })
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

