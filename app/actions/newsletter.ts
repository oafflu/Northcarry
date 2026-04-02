'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendNewsletterWelcomeEmail } from '@/lib/email'
import { triggerAutomation } from '@/app/actions/email-automations'

export async function subscribeToNewsletter(email: string, firstName?: string) {
  // Use admin client to bypass RLS for public newsletter subscription
  const supabase = createAdminSupabaseClient()

  // Validate email
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please provide a valid email address' }
  }

  try {
    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscriptions')
      .select('id, status')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existing) {
      if (existing.status === 'active') {
        return { success: false, error: 'This email is already subscribed to our newsletter' }
      } else {
        // Re-subscribe if previously unsubscribed
        const { error: updateError } = await supabase
          .from('newsletter_subscriptions')
          .update({
            status: 'active',
            subscribed_at: new Date().toISOString(),
            unsubscribed_at: null,
            first_name: firstName || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Error re-subscribing:', updateError)
          return { success: false, error: 'Failed to re-subscribe. Please try again.' }
        }

        // Send welcome email
        try {
          await sendNewsletterWelcomeEmail(email, firstName)
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError)
          // Don't fail the subscription if email fails
        }

        // Trigger new_subscriber automation (uses Mailgun)
        try {
          await triggerAutomation('new_subscriber', email, { name: firstName })
        } catch (automationError) {
          console.error('Error triggering automation:', automationError)
          // Don't fail the subscription if automation fails
        }

        return { success: true, message: 'Successfully re-subscribed to our newsletter!' }
      }
    }

    // Create new subscription
    const { data: subscription, error } = await supabase
      .from('newsletter_subscriptions')
      .insert({
        email: email.toLowerCase().trim(),
        first_name: firstName || null,
        status: 'active',
        source: 'website',
      })
      .select()
      .single()

    if (error) {
      console.error('Error subscribing to newsletter:', error)
      return { success: false, error: 'Failed to subscribe. Please try again.' }
    }

    // Send welcome email
    try {
      await sendNewsletterWelcomeEmail(email, firstName)
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail the subscription if email fails
    }

    // Trigger new_subscriber automation (uses SendGrid)
    try {
      await triggerAutomation('new_subscriber', email, { name: firstName })
    } catch (automationError) {
      console.error('Error triggering automation:', automationError)
      // Don't fail the subscription if automation fails
    }

    return { success: true, message: 'Successfully subscribed to our newsletter!' }
  } catch (error: any) {
    console.error('Error in subscribeToNewsletter:', error)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

export async function getNewsletterSubscriptions() {
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
    .from('newsletter_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching newsletter subscriptions:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function updateNewsletterSubscription(
  id: string,
  updates: {
    status?: 'active' | 'unsubscribed' | 'bounced'
    first_name?: string
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

  if (updates.status === 'unsubscribed') {
    updateData.unsubscribed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('newsletter_subscriptions')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error('Error updating newsletter subscription:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/newsletter')
  return { success: true }
}

export async function deleteNewsletterSubscription(id: string) {
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

  const { error } = await supabase
    .from('newsletter_subscriptions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting newsletter subscription:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/newsletter')
  return { success: true }
}

