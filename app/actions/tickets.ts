'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logSupportAction } from '@/lib/system-logger'
import { sendEmail } from '@/lib/email'

/**
 * Create a new support ticket
 */
export async function createTicket(data: {
  customerName: string
  customerEmail: string
  userId?: string
  subject: string
  category: 'order' | 'product' | 'shipping' | 'technical' | 'other'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  initialMessage: string
  assignedTo?: string
}) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    // Generate ticket number
    const ticketNumber = `TICKET-${Date.now().toString().slice(-6)}`

    // Create ticket using admin client to bypass RLS
    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        user_id: data.userId || null,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        subject: data.subject,
        category: data.category,
        priority: data.priority || 'medium',
        status: 'open',
        assigned_to: data.assignedTo || user.id,
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error('Error creating ticket:', ticketError)
      return { success: false, error: ticketError?.message || 'Failed to create ticket' }
    }

    // Create initial message using admin client to bypass RLS
    const { error: messageError } = await adminSupabase
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_type: 'admin',
        message: data.initialMessage,
        is_internal_note: false,
      })

    if (messageError) {
      console.error('Error creating initial message:', messageError)
      // Don't fail ticket creation if message fails
    }

    // Send email to customer, admins, and system email
    try {
      const { sendTicketEmail } = await import('@/lib/email')
      const emailResult = await sendTicketEmail(
        data.customerEmail,
        data.customerName,
        ticket.ticket_number,
        data.subject,
        data.initialMessage,
        ticket.id
      )
      if (!emailResult?.success) {
        console.error('Email sending returned error:', emailResult)
      } else {
        console.log('Ticket emails sent successfully')
      }
    } catch (emailError: any) {
      console.error('Error sending ticket email:', emailError)
      console.error('Email error details:', {
        message: emailError?.message,
        stack: emailError?.stack,
      })
      // Don't fail ticket creation if email fails, but log it
    }

    revalidatePath('/admin/support')
    
    // Log the action
    await logSupportAction(
      'created',
      `Support ticket ${ticket.ticket_number} created for ${data.customerEmail}`,
      ticket.id,
      ticket.ticket_number,
      {
        customer_email: data.customerEmail,
        customer_name: data.customerName,
        subject: data.subject,
        category: data.category,
        priority: data.priority || 'medium',
        assigned_to: data.assignedTo || user.id,
      }
    )
    
    return { success: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number }
  } catch (error: any) {
    console.error('Error in createTicket:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'support_ticket_created',
      actionCategory: 'support',
      actionDescription: `Failed to create support ticket: ${error.message}`,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'Failed to create ticket' }
  }
}

/**
 * Create a support ticket from a contact form submission
 */
export async function createTicketFromContact(data: {
  contactMessageId: string
  customerName: string
  customerEmail: string
  userId?: string
  subject: string
  message: string
}) {
  try {
    const adminSupabase = createAdminSupabaseClient()

    // Generate ticket number
    const ticketNumber = `TICKET-${Date.now().toString().slice(-6)}`

    // Create ticket using admin client to bypass RLS
    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        user_id: data.userId || null,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        subject: data.subject,
        category: 'other', // Default category for contact form submissions
        priority: 'medium',
        status: 'open',
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error('Error creating ticket from contact form:', ticketError)
      return { success: false, error: ticketError?.message || 'Failed to create ticket' }
    }

    // Create initial message using admin client to bypass RLS
    const { error: messageError } = await adminSupabase
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: data.userId || null,
        sender_type: 'customer',
        message: data.message,
        is_internal_note: false,
      })

    if (messageError) {
      console.error('Error creating initial message from contact form:', messageError)
      // Don't fail ticket creation if message fails
    }

    // Link contact message to ticket
    await adminSupabase
      .from('contact_messages')
      .update({
        ticket_id: ticket.id,
        status: 'replied', // Mark as replied since it's now a ticket
      })
      .eq('id', data.contactMessageId)

    // Send email to customer, admins, and system email
    try {
      const { sendTicketEmail } = await import('@/lib/email')
      await sendTicketEmail(
        data.customerEmail,
        data.customerName,
        ticket.ticket_number,
        data.subject,
        data.message,
        ticket.id
      )
    } catch (emailError: any) {
      console.error('Error sending ticket email from contact form:', emailError)
      // Don't fail ticket creation if email fails
    }

    revalidatePath('/admin/support')
    return { success: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number }
  } catch (error: any) {
    console.error('Error in createTicketFromContact:', error)
    return { success: false, error: error.message || 'Failed to create ticket' }
  }
}

/**
 * Get all tickets with filters
 */
export async function getTickets(filters?: {
  status?: string
  priority?: string
  assignedTo?: string
  search?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()

    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        profiles!support_tickets_assigned_to_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.priority) {
      query = query.eq('priority', filters.priority)
    }

    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo)
    }

    if (filters?.search) {
      query = query.or(`subject.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%`)
    }

    const { data: tickets, error } = await query

    if (error) {
      console.error('Error fetching tickets:', error)
      return { data: [], error: error.message }
    }

    // Get message counts for each ticket
    const ticketIds = tickets?.map(t => t.id) || []
    if (ticketIds.length > 0) {
      const { data: messageCounts } = await supabase
        .from('support_messages')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
        .eq('is_internal_note', false)

      const counts = messageCounts?.reduce((acc: any, msg: any) => {
        acc[msg.ticket_id] = (acc[msg.ticket_id] || 0) + 1
        return acc
      }, {}) || {}

      tickets?.forEach((ticket: any) => {
        ticket.message_count = counts[ticket.id] || 0
      })
    }

    return { data: tickets || [], error: null }
  } catch (error: any) {
    console.error('Error in getTickets:', error)
    return { data: [], error: error.message }
  }
}

/**
 * Get a single ticket with messages
 */
export async function getTicketById(ticketId: string) {
  try {
    const supabase = createAdminSupabaseClient()

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select(`
        *,
        profiles!support_tickets_assigned_to_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', ticketId)
      .single()

    if (error || !ticket) {
      return { data: null, error: error?.message || 'Ticket not found' }
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('support_messages')
      .select(`
        *,
        profiles (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
    }

    return {
      data: {
        ...ticket,
        messages: messages || [],
      },
      error: null,
    }
  } catch (error: any) {
    console.error('Error in getTicketById:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Update ticket status, priority, or assignment
 */
export async function updateTicket(
  ticketId: string,
  updates: {
    status?: string
    priority?: string
    assignedTo?: string
  }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.status) {
      updateData.status = updates.status
      if (updates.status === 'resolved' || updates.status === 'closed') {
        updateData.resolved_at = new Date().toISOString()
      } else if (updates.status === 'open' || updates.status === 'pending') {
        // Clear resolved_at when reopening
        updateData.resolved_at = null
      }
    }

    if (updates.priority) {
      updateData.priority = updates.priority
    }

    if (updates.assignedTo !== undefined) {
      updateData.assigned_to = updates.assignedTo || null
    }

    // Use admin client to avoid any RLS/auth edge cases when updating status
    const { data: updatedTicket, error } = await adminSupabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select('id, status, resolved_at, updated_at')
      .single()

    if (error) {
      console.error('Error updating ticket:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/support')
    revalidatePath(`/admin/support/${ticketId}`)
    
    // Get ticket number for logging
    const { data: ticket } = await adminSupabase
      .from('support_tickets')
      .select('ticket_number')
      .eq('id', ticketId)
      .single()
    
    // Log the action
    await logSupportAction(
      'updated',
      `Support ticket ${ticket?.ticket_number || ticketId} updated`,
      ticketId,
      ticket?.ticket_number,
      {
        status: updates.status || null,
        priority: updates.priority || null,
        assigned_to: updates.assignedTo || null,
      }
    )
    
    return { success: true, ticket: updatedTicket }
  } catch (error: any) {
    console.error('Error in updateTicket:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'support_ticket_updated',
      actionCategory: 'support',
      actionDescription: `Failed to update ticket ${ticketId}: ${error.message}`,
      resourceType: 'ticket',
      resourceId: ticketId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message }
  }
}

/**
 * Send a message on a ticket
 */
export async function sendTicketMessage(
  ticketId: string,
  message: string,
  isInternalNote: boolean = false
) {
  try {
    const supabase = await createServerSupabaseClient()
    const adminSupabase = createAdminSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    // Get ticket details
    const { data: ticket, error: ticketError } = await adminSupabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' }
    }

    // Create message using admin client to bypass RLS
    const { error: messageError } = await adminSupabase
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: 'admin',
        message,
        is_internal_note: isInternalNote,
      })

    if (messageError) {
      console.error('Error creating message:', messageError)
      return { success: false, error: messageError.message }
    }

    // Update ticket updated_at
    await adminSupabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    // Send email to customer if not internal note
    if (!isInternalNote) {
      try {
        const { sendTicketReplyEmail } = await import('@/lib/email')
        await sendTicketReplyEmail(
          ticket.customer_email,
          ticket.customer_name,
          ticket.ticket_number,
          ticket.subject,
          message,
          ticketId
        )
      } catch (emailError) {
        console.error('Error sending ticket reply email:', emailError)
        // Don't fail message creation if email fails
      }
    }

    revalidatePath(`/admin/support/${ticketId}`)
    
    // Log the action
    await logSupportAction(
      'message_sent',
      `Message sent on ticket ${ticket.ticket_number}${isInternalNote ? ' (internal note)' : ''}`,
      ticketId,
      ticket.ticket_number,
      {
        is_internal_note: isInternalNote,
        message_length: message.length,
      }
    )
    
    return { success: true }
  } catch (error: any) {
    console.error('Error in sendTicketMessage:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'support_ticket_message_sent',
      actionCategory: 'support',
      actionDescription: `Failed to send message on ticket ${ticketId}: ${error.message}`,
      resourceType: 'ticket',
      resourceId: ticketId,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message }
  }
}

/**
 * Get customers for ticket creation (search by name or email)
 */
export async function searchCustomers(query: string) {
  try {
    const supabase = createAdminSupabaseClient()

    const { data: customers, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone')
      .or(`email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(10)

    if (error) {
      console.error('Error searching customers:', error)
      return { data: [], error: error.message }
    }

    return {
      data: customers?.map(c => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Customer',
        email: c.email || '',
        phone: c.phone || '',
      })) || [],
      error: null,
    }
  } catch (error: any) {
    console.error('Error in searchCustomers:', error)
    return { data: [], error: error.message }
  }
}

/**
 * Get customer orders for ticket reference
 */
export async function getCustomerOrders(userId: string) {
  try {
    const supabase = createAdminSupabaseClient()

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching customer orders:', error)
      return { data: [], error: error.message }
    }

    return { data: orders || [], error: null }
  } catch (error: any) {
    console.error('Error in getCustomerOrders:', error)
    return { data: [], error: error.message }
  }
}

