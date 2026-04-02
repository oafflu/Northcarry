'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logSupportAction } from '@/lib/system-logger'

function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

async function getCustomerProfileForSupport() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { user: null as null, profile: null as null, error: 'Not authenticated' }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .eq('id', user.id)
    .single()

  if (error || !profile?.email) {
    return { user: null as null, profile: null as null, error: 'Profile or email not found' }
  }

  const staffRoles = ['admin', 'marketer', 'support']
  if (profile.role && staffRoles.includes(profile.role)) {
    return { user: null as null, profile: null as null, error: 'Use the admin support inbox' }
  }

  return { user, profile, error: null as null }
}

function customerCanAccessTicket(
  ticket: { user_id: string | null; customer_email: string | null },
  userId: string,
  profileEmail: string
): boolean {
  if (ticket.user_id && ticket.user_id === userId) return true
  const t = normalizeEmail(ticket.customer_email)
  const p = normalizeEmail(profileEmail)
  return t.length > 0 && p.length > 0 && t === p
}

/** Tickets visible to this account (by user_id or matching email). */
export async function getMySupportTickets() {
  try {
    const { user, profile, error } = await getCustomerProfileForSupport()
    if (error || !user || !profile) {
      return { data: [] as any[], error: error || 'Unauthorized' }
    }

    const admin = createAdminSupabaseClient()
    const listSelect = `
      id,
      ticket_number,
      subject,
      category,
      priority,
      status,
      created_at,
      updated_at,
      customer_email,
      user_id
    `

    const [byUser, byEmail] = await Promise.all([
      admin.from('support_tickets').select(listSelect).eq('user_id', user.id).order('updated_at', { ascending: false }),
      admin
        .from('support_tickets')
        .select(listSelect)
        .ilike('customer_email', profile.email)
        .order('updated_at', { ascending: false }),
    ])

    if (byUser.error) {
      console.error('getMySupportTickets by user:', byUser.error)
    }
    if (byEmail.error) {
      console.error('getMySupportTickets by email:', byEmail.error)
    }

    const map = new Map<string, any>()
    for (const row of [...(byUser.data || []), ...(byEmail.data || [])]) {
      if (customerCanAccessTicket(row, user.id, profile.email)) {
        map.set(row.id, row)
      }
    }

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    const ids = merged.map((t) => t.id)
    if (ids.length > 0) {
      const { data: counts } = await admin
        .from('support_messages')
        .select('ticket_id')
        .in('ticket_id', ids)
        .eq('is_internal_note', false)

      const c: Record<string, number> = {}
      for (const m of counts || []) {
        c[m.ticket_id] = (c[m.ticket_id] || 0) + 1
      }
      merged.forEach((t) => {
        t.message_count = c[t.id] || 0
      })
    }

    return { data: merged, error: null as null }
  } catch (e: any) {
    console.error('getMySupportTickets:', e)
    return { data: [], error: e.message || 'Failed to load tickets' }
  }
}

/** Single ticket + customer-visible messages only (no internal notes). */
export async function getMySupportTicketById(ticketId: string) {
  try {
    const { user, profile, error } = await getCustomerProfileForSupport()
    if (error || !user || !profile) {
      return { data: null, error: error || 'Unauthorized' }
    }

    const admin = createAdminSupabaseClient()
    const { data: ticket, error: ticketError } = await admin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      return { data: null, error: 'Ticket not found' }
    }

    if (!customerCanAccessTicket(ticket, user.id, profile.email)) {
      return { data: null, error: 'Not authorized' }
    }

    const { data: messages, error: msgError } = await admin
      .from('support_messages')
      .select('id, ticket_id, sender_id, sender_type, message, created_at, is_internal_note')
      .eq('ticket_id', ticketId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('getMySupportTicketById messages:', msgError)
    }

    return {
      data: {
        ...ticket,
        messages: messages || [],
      },
      error: null as null,
    }
  } catch (e: any) {
    console.error('getMySupportTicketById:', e)
    return { data: null, error: e.message || 'Failed to load ticket' }
  }
}

export async function createCustomerSupportTicket(data: {
  subject: string
  category: 'order' | 'product' | 'shipping' | 'technical' | 'other'
  initialMessage: string
  /** If set, must belong to the current user (verified server-side). */
  relatedOrderId?: string
}) {
  try {
    const { user, profile, error } = await getCustomerProfileForSupport()
    if (error || !user || !profile) {
      return { success: false, error: error || 'Unauthorized' }
    }

    const subject = (data.subject || '').trim()
    let body = (data.initialMessage || '').trim()
    if (!subject || !body) {
      return { success: false, error: 'Subject and message are required' }
    }

    const admin = createAdminSupabaseClient()

    if (data.relatedOrderId) {
      const { data: ord, error: ordErr } = await admin
        .from('orders')
        .select('id, order_number, user_id')
        .eq('id', data.relatedOrderId)
        .single()
      if (ordErr || !ord || ord.user_id !== user.id) {
        return { success: false, error: 'Invalid order reference' }
      }
      body = `Related order: ${ord.order_number}\n\n${body}`
    }

    const ticketNumber = `TICKET-${Date.now().toString().slice(-6)}`
    const customerName =
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Customer'
    const customerEmail = normalizeEmail(profile.email)

    const { data: ticket, error: ticketError } = await admin
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        user_id: user.id,
        customer_name: customerName,
        customer_email: customerEmail,
        subject,
        category: data.category,
        priority: 'medium',
        status: 'open',
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error('createCustomerSupportTicket:', ticketError)
      return { success: false, error: ticketError?.message || 'Failed to create ticket' }
    }

    const { error: messageError } = await admin.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_type: 'customer',
      message: body,
      is_internal_note: false,
    })

    if (messageError) {
      console.error('createCustomerSupportTicket message:', messageError)
    }

    try {
      const { sendTicketEmail } = await import('@/lib/email')
      await sendTicketEmail(customerEmail, customerName, ticket.ticket_number, subject, body, ticket.id)
    } catch (emailErr) {
      console.error('createCustomerSupportTicket email:', emailErr)
    }

    revalidatePath('/account/support')
    revalidatePath(`/account/support/${ticket.id}`)

    await logSupportAction(
      'customer_created',
      `Customer ${customerEmail} created ticket ${ticket.ticket_number} from account`,
      ticket.id,
      ticket.ticket_number,
      { category: data.category }
    )

    return { success: true, ticketId: ticket.id, ticketNumber: ticket.ticket_number }
  } catch (e: any) {
    console.error('createCustomerSupportTicket:', e)
    return { success: false, error: e.message || 'Failed to create ticket' }
  }
}

export async function addCustomerSupportMessage(ticketId: string, message: string) {
  try {
    const { user, profile, error } = await getCustomerProfileForSupport()
    if (error || !user || !profile) {
      return { success: false, error: error || 'Unauthorized' }
    }

    const text = (message || '').trim()
    if (!text) {
      return { success: false, error: 'Message is required' }
    }

    const admin = createAdminSupabaseClient()
    const { data: ticket, error: ticketError } = await admin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket not found' }
    }

    if (!customerCanAccessTicket(ticket, user.id, profile.email)) {
      return { success: false, error: 'Not authorized' }
    }

    const { error: messageError } = await admin.from('support_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      sender_type: 'customer',
      message: text,
      is_internal_note: false,
    })

    if (messageError) {
      return { success: false, error: messageError.message }
    }

    const reopen =
      ticket.status === 'resolved' || ticket.status === 'closed'
    const nextStatus = reopen ? 'open' : ticket.status

    const ticketUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: nextStatus,
    }
    if (reopen) {
      ticketUpdate.resolved_at = null
    }

    await admin.from('support_tickets').update(ticketUpdate).eq('id', ticketId)

    try {
      const { sendAdminNotificationCustomerPortalReply } = await import('@/lib/email')
      await sendAdminNotificationCustomerPortalReply({
        ticketId,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        customerName: ticket.customer_name,
        customerEmail: ticket.customer_email,
        message: text,
      })
    } catch (emailErr) {
      console.error('addCustomerSupportMessage admin notify:', emailErr)
    }

    revalidatePath('/account/support')
    revalidatePath(`/account/support/${ticketId}`)
    revalidatePath(`/admin/support/${ticketId}`)

    await logSupportAction(
      'customer_replied',
      `Customer replied on ticket ${ticket.ticket_number} via account`,
      ticketId,
      ticket.ticket_number,
      { message_length: text.length }
    )

    return { success: true }
  } catch (e: any) {
    console.error('addCustomerSupportMessage:', e)
    return { success: false, error: e.message || 'Failed to send message' }
  }
}
