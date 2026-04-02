import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// Use a configurable local part so replies go to a real mailbox that exists.
// Default to 'hello' so hello+{ticketId}@brevibrushes.com works with O365 plus-addressing.
const REPLY_LOCAL_PART = process.env.TICKET_REPLY_LOCAL_PART || 'hello'
const REPLY_DOMAIN =
  process.env.TICKET_REPLY_DOMAIN ||
  (process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com')
    .replace('https://', '')
    .replace('http://', '')

async function parseIncomingEmail(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  // Mailgun / most providers can post as JSON
  if (contentType.includes('application/json')) {
    return await request.json()
  }

  // Mailgun often posts form-data (multipart/form-data)
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const data: Record<string, any> = {}
    formData.forEach((value, key) => {
      data[key] = value
    })
    return data
  }

  // Fallback: try text then attempt to parse
  const text = await request.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

/**
 * Handle incoming email replies for support tickets
 * This endpoint should be called by your email service (e.g., Mailgun Routes, etc.)
 * 
 * The email address format is: ticket+{ticketId}@yourdomain.com
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the incoming email (supports JSON and multipart/form-data)
    const body = await parseIncomingEmail(request)
    const dryRun = request.nextUrl.searchParams.get('dryRun') === '1' || body?.dryRun === true
    
    // Extract ticket ID from the "To" or "Reply-To" field
    // Format: ticket+{ticketId}@domain.com
    const toEmail = body.to || body['reply-to'] || body.envelope?.to || body.recipient || ''
    const fromEmail = body.from || body.sender || body.envelope?.from || ''
    const subject = body.subject || body['message-headers']?.subject || ''
    const textBody = body['stripped-text'] || body.text || body['text-plain'] || ''
    const htmlBody = body['stripped-html'] || body.html || body['text-html'] || ''
    
    // Get ticket details by parsing email address first, then fallback to subject ticket number.
    const supabase = createAdminSupabaseClient()
    const ticketRegex = new RegExp(`${REPLY_LOCAL_PART}\\+([a-f0-9-]+)@`, 'i')
    const ticketMatch = toEmail.match(ticketRegex)
    let resolvedTicketId = ticketMatch?.[1] || null
    let ticket: any = null
    let ticketError: any = null

    if (resolvedTicketId) {
      const byIdResult = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', resolvedTicketId)
        .single()
      ticket = byIdResult.data
      ticketError = byIdResult.error
    }

    // Fallback: many providers collapse plus-address aliases and keep ticket number in subject.
    if (!ticket) {
      const subjectTicketMatch = String(subject || '').match(/\b(TICKET-\d{4,})\b/i)
      if (subjectTicketMatch?.[1]) {
        const ticketNumber = subjectTicketMatch[1].toUpperCase()
        const byNumberResult = await supabase
          .from('support_tickets')
          .select('*')
          .eq('ticket_number', ticketNumber)
          .single()
        ticket = byNumberResult.data
        ticketError = byNumberResult.error
        resolvedTicketId = byNumberResult.data?.id || null
      }
    }
    
    if (ticketError || !ticket) {
      console.error('Ticket not found from email reply:', {
        toEmail,
        subject,
        resolvedTicketId,
        ticketError,
      })
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    
    // Extract the actual reply message (remove quoted text)
    // This is a simple implementation - you may want to use a library like `email-reply-parser`
    let replyMessage = textBody || htmlBody.replace(/<[^>]*>/g, '')
    
    // Remove common email reply patterns
    replyMessage = replyMessage
      .split(/On .* wrote:/i)[0] // Remove "On [date] [person] wrote:"
      .split(/From:.*/i)[0] // Remove "From: ..."
      .split(/Sent:.*/i)[0] // Remove "Sent: ..."
      .split(/---.*Original Message.*---/i)[0] // Remove "--- Original Message ---"
      .trim()
    
    if (!replyMessage || replyMessage.length < 5) {
      return NextResponse.json({ error: 'No message content found' }, { status: 400 })
    }

    // Dry-run mode for admin diagnostics: parse and validate without writing to DB
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        data: {
          toEmail,
          fromEmail,
          subject,
          ticketId: ticket.id,
          replyPreview: replyMessage.slice(0, 500),
          matchedByRegex: Boolean(ticketMatch?.[1]),
        },
      })
    }
    
    // Get or create customer profile by email
    let customerUserId = ticket.user_id
    
    if (!customerUserId && fromEmail) {
      // Try to find user by email
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', fromEmail.toLowerCase())
        .single()
      
      if (profile) {
        customerUserId = profile.id
      }
    }
    
    // Create message in ticket
    const { error: messageError } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: customerUserId,
        sender_type: 'customer',
        message: replyMessage,
        is_internal_note: false,
      })
    
    if (messageError) {
      console.error('Error creating message:', messageError)
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
    }
    
    // Update ticket
    await supabase
      .from('support_tickets')
      .update({
        updated_at: new Date().toISOString(),
        status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'open' : ticket.status, // Reopen if closed
      })
      .eq('id', ticket.id)
    
    // Notify assigned admin (optional - you can add this later)
    // For now, just return success
    
    return NextResponse.json({ success: true, message: 'Reply added to ticket' })
  } catch (error: any) {
    console.error('Error processing email reply:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// Also support GET for webhook verification (some services require this)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'ok', message: 'Email webhook endpoint is active' })
}

