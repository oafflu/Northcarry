'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendContactFormEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'

export async function submitContactForm(data: {
  name: string
  email: string
  subject: string
  message: string
}) {
  // Use admin client to bypass RLS for public contact form
  const supabase = createAdminSupabaseClient()

  // Validate input
  if (!data.name || !data.email || !data.subject || !data.message) {
    return { success: false, error: 'All fields are required' }
  }

  if (!data.email.includes('@')) {
    return { success: false, error: 'Please provide a valid email address' }
  }

  try {
    // Check if customer exists by email
    let linkedUserId: string | undefined
    const { data: existingCustomer } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', data.email.toLowerCase().trim())
      .eq('role', 'customer')
      .single()
    
    if (existingCustomer) {
      linkedUserId = existingCustomer.id
    }

    // Save to database
    const { data: contactMessage, error: dbError } = await supabase
      .from('contact_messages')
      .insert({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        status: 'new',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving contact message:', dbError)
      return { success: false, error: 'Failed to save your message. Please try again.' }
    }

    // Automatically create a support ticket from the contact form
    try {
      const { createTicketFromContact } = await import('@/app/actions/tickets')
      const ticketResult = await createTicketFromContact({
        contactMessageId: contactMessage.id,
        customerName: data.name.trim(),
        customerEmail: data.email.toLowerCase().trim(),
        userId: linkedUserId,
        subject: data.subject.trim(),
        message: data.message.trim(),
      })
      
      if (ticketResult.success) {
        console.log(`Contact message automatically converted to ticket: ${ticketResult.ticketNumber}`)
      } else {
        console.error('Error creating ticket from contact form:', ticketResult.error)
        // Don't fail the contact form submission if ticket creation fails
      }
    } catch (ticketError) {
      console.error('Error creating ticket from contact form:', ticketError)
      // Don't fail the contact form submission if ticket creation fails
    }

    // Send email notification
    try {
      await sendContactFormEmail({
        to: 'hello@brevibrushes.com',
        from: data.email,
        name: data.name,
        subject: data.subject,
        message: data.message,
      })
    } catch (emailError) {
      console.error('Error sending contact email:', emailError)
      // Don't fail if email fails - message is saved in database
    }

    // Send confirmation email to user
    try {
      await sendContactFormConfirmation(data.email, data.name)
    } catch (confirmationError) {
      console.error('Error sending confirmation email:', confirmationError)
      // Don't fail if confirmation email fails
    }

    return { success: true, message: 'Thank you for contacting us! We\'ll get back to you soon.' }
  } catch (error: any) {
    console.error('Error in submitContactForm:', error)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function getContactMessages() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { data: [], error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contact messages:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function updateContactMessage(
  id: string,
  updates: {
    status?: 'new' | 'read' | 'replied' | 'archived'
    admin_notes?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const updateData: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (updates.status === 'replied') {
    updateData.replied_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('contact_messages')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating contact message:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/contact')
  return { success: true }
}

async function sendContactFormConfirmation(email: string, name: string) {
  // Import here to avoid circular dependencies
  const { sendEmail } = await import('@/lib/email')
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>We Received Your Message - BREVI</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Thank You for Contacting BREVI!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>We've received your message and will get back to you as soon as possible, typically within 24-48 hours.</p>
        <p>If you have any urgent questions, please contact us at hello@brevibrushes.com for support.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `
  
  await sendEmail({
    to: email,
    subject: 'We Received Your Message - BREVI',
    html,
  })
}

