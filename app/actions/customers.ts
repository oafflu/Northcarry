'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'

/**
 * Send magic link to a single customer
 */
export async function sendMagicLinkToCustomer(customerId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get customer profile
    const { data: customer, error: customerError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', customerId)
      .eq('role', 'customer')
      .single()

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' }
    }

    if (!customer.email) {
      return { success: false, error: 'Customer email not found' }
    }

    // Generate magic link with proper redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
    const { data: magicLink, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: customer.email,
      options: {
        redirectTo: `${siteUrl}/auth/magic-link?redirect_to=/account`,
      },
    })

    if (linkError || !magicLink?.properties?.action_link) {
      return { success: false, error: linkError?.message || 'Failed to generate magic link' }
    }

    // Send email with magic link
    // The action_link from Supabase contains hash fragments that need to be processed client-side
    const customerName = customer.first_name || customer.email.split('@')[0] || 'Customer'
    // Normalize the magic link URL to use production domain
    let normalizedMagicLink = magicLink.properties.action_link
    
    // Replace localhost with production URL
    normalizedMagicLink = normalizedMagicLink.replace(/https?:\/\/localhost:\d+/g, siteUrl)
    
    // Ensure the redirect goes through our magic-link handler
    // If the link doesn't already point to our handler, we need to modify it
    // Supabase magic links typically go to /auth/v1/verify or similar, but we want /auth/magic-link
    // However, Supabase's action_link should already have the correct redirectTo in the hash
    // So we just need to make sure it's normalized

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Access Your Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #14b8a6;">Access Your Account</h1>
          </div>
          
          <p>Hi ${customerName},</p>
          <p>You've been sent a secure link to access your BREVI account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${normalizedMagicLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Access Your Account
            </a>
          </div>
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            This secure link will expire in 24 hours. You can set a password after logging in.
          </p>
          
          <p>Best regards,<br>The BREVI™ Team</p>
        </body>
      </html>
    `

    await sendEmail({
      to: customer.email,
      subject: 'Access Your BREVI Account',
      html,
    })

    return { success: true, message: 'Magic link sent successfully' }
  } catch (error: any) {
    console.error('Error sending magic link to customer:', error)
    return { success: false, error: error.message || 'Failed to send magic link' }
  }
}

/**
 * Send magic links to multiple customers
 */
export async function sendBulkMagicLinks(customerIds: string[]) {
  try {
    const supabase = createAdminSupabaseClient()
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const customerId of customerIds) {
      const result = await sendMagicLinkToCustomer(customerId)
      if (result.success) {
        results.success++
      } else {
        results.failed++
        results.errors.push(`${customerId}: ${result.error}`)
      }
    }

    return {
      success: true,
      message: `Sent magic links to ${results.success} customer(s). ${results.failed} failed.`,
      results,
    }
  } catch (error: any) {
    console.error('Error sending bulk magic links:', error)
    return { success: false, error: error.message || 'Failed to send bulk magic links' }
  }
}

/**
 * Send magic links to all customers (with optional filters)
 */
export async function sendMagicLinksToAllCustomers(filters?: {
  hasOrders?: boolean
  minSpent?: number
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Build query to get all customers
    let query = supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('role', 'customer')
      .not('email', 'is', null)
      .like('email', '%@%')

    // Apply filters if provided
    if (filters?.hasOrders === false) {
      // Get customers with 0 orders
      const { data: customersWithOrders } = await supabase
        .from('orders')
        .select('user_id')
        .not('user_id', 'is', null)

      const userIdsWithOrders = new Set(customersWithOrders?.map(o => o.user_id) || [])
      
      const { data: allCustomers } = await query
      const customersWithoutOrders = allCustomers?.filter(c => !userIdsWithOrders.has(c.id)) || []
      
      const customerIds = customersWithoutOrders.map(c => c.id)
      return await sendBulkMagicLinks(customerIds)
    }

    if (filters?.minSpent !== undefined) {
      // Get customers by total spent
      const { data: orders } = await supabase
        .from('orders')
        .select('user_id, total')
        .eq('payment_status', 'paid')
        .not('user_id', 'is', null)

      const customerSpending = new Map<string, number>()
      orders?.forEach(order => {
        const current = customerSpending.get(order.user_id) || 0
        customerSpending.set(order.user_id, current + parseFloat(order.total || '0'))
      })

      const { data: allCustomers } = await query
      const matchingCustomers = allCustomers?.filter(c => {
        const spent = customerSpending.get(c.id) || 0
        return spent >= (filters.minSpent || 0)
      }) || []

      const customerIds = matchingCustomers.map(c => c.id)
      return await sendBulkMagicLinks(customerIds)
    }

    // No filters - send to all customers
    const { data: allCustomers } = await query
    if (!allCustomers || allCustomers.length === 0) {
      return { success: false, error: 'No customers found' }
    }

    const customerIds = allCustomers.map(c => c.id)
    return await sendBulkMagicLinks(customerIds)
  } catch (error: any) {
    console.error('Error sending magic links to all customers:', error)
    return { success: false, error: error.message || 'Failed to send magic links' }
  }
}

/**
 * Create segment for customers with 0 orders or 0 spent
 */
export async function createSegmentForZeroCustomers(segmentName: string, segmentType: 'orders' | 'spent') {
  try {
    const supabase = createAdminSupabaseClient()
    
    let customerIds: string[] = []

    if (segmentType === 'orders') {
      // Get all customers
      const { data: allCustomers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'customer')
        .not('email', 'is', null)
        .like('email', '%@%')

      // Get customers with orders
      const { data: customersWithOrders } = await supabase
        .from('orders')
        .select('user_id')
        .not('user_id', 'is', null)

      const userIdsWithOrders = new Set(customersWithOrders?.map(o => o.user_id) || [])
      customerIds = allCustomers?.filter(c => !userIdsWithOrders.has(c.id)).map(c => c.id) || []
    } else {
      // Get customers with 0 spent
      const { data: orders } = await supabase
        .from('orders')
        .select('user_id, total')
        .eq('payment_status', 'paid')
        .not('user_id', 'is', null)

      const customerSpending = new Map<string, number>()
      orders?.forEach(order => {
        const current = customerSpending.get(order.user_id) || 0
        customerSpending.set(order.user_id, current + parseFloat(order.total || '0'))
      })

      const { data: allCustomers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'customer')
        .not('email', 'is', null)
        .like('email', '%@%')

      customerIds = allCustomers?.filter(c => {
        const spent = customerSpending.get(c.id) || 0
        return spent === 0
      }).map(c => c.id) || []
    }

    if (customerIds.length === 0) {
      return { success: false, error: `No customers found with ${segmentType === 'orders' ? '0 orders' : '$0 spent'}` }
    }

    // Create segment
    const segmentData = {
      name: segmentName,
      description: `Customers with ${segmentType === 'orders' ? '0 orders' : '$0 spent'} (${customerIds.length} customers)`,
      conditions: [
        {
          field: 'user_id',
          operator: 'in',
          value: customerIds,
        },
      ],
      subscriber_count: customerIds.length,
    }

    const { data: segment, error: segmentError } = await supabase
      .from('email_segments')
      .insert(segmentData)
      .select()
      .single()

    if (segmentError) {
      console.error('Error creating segment:', segmentError)
      return { success: false, error: segmentError.message || 'Failed to create segment' }
    }

    revalidatePath('/admin/email-marketing/segments')
    return { success: true, data: segment, message: `Segment created with ${customerIds.length} customers` }
  } catch (error: any) {
    console.error('Error creating segment for zero customers:', error)
    return { success: false, error: error.message || 'Failed to create segment' }
  }
}

/**
 * Generate a secure temporary password
 */
function generateTemporaryPassword(): string {
  // Generate a secure random password: 12 characters with mix of letters, numbers, and symbols
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%&*'
  const allChars = lowercase + uppercase + numbers + symbols
  
  // Ensure at least one of each type
  let password = ''
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

/**
 * Send temporary password to a customer
 * This is an alternative to magic links that provides a temporary password
 * that must be changed on first login
 */
export async function sendTemporaryPasswordToCustomer(customerId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get customer profile
    const { data: customer, error: customerError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .eq('id', customerId)
      .eq('role', 'customer')
      .single()

    if (customerError || !customer) {
      return { success: false, error: 'Customer not found' }
    }

    if (!customer.email) {
      return { success: false, error: 'Customer email not found' }
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword()
    
    // Update user's password in Supabase Auth
    const { data: authUser } = await supabase.auth.admin.getUserById(customer.id)
    
    if (!authUser?.user) {
      // User doesn't exist in auth - create account
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: customer.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: customer.first_name,
          last_name: customer.last_name,
          force_password_change: true,
          temp_password_set_at: new Date().toISOString(),
        },
      })
      
      if (createError || !newUser.user) {
        return { success: false, error: createError?.message || 'Failed to create user account' }
      }
    } else {
      // Update existing user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        customer.id,
        { 
          password: tempPassword,
          user_metadata: {
            ...authUser.user.user_metadata,
            force_password_change: true,
            temp_password_set_at: new Date().toISOString(),
          }
        }
      )
      
      if (updateError) {
        return { success: false, error: updateError.message || 'Failed to update password' }
      }
    }

    // Send email with temporary password
    const customerName = customer.first_name || customer.email.split('@')[0] || 'Customer'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
    const loginUrl = `${siteUrl}/login`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Account Access</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #14b8a6;">Your BREVI Account Access</h1>
          </div>
          
          <p>Hi ${customerName},</p>
          <p>You've been provided with temporary credentials to access your BREVI account. For security, you'll be required to change your password when you first log in.</p>
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #111827;">Your Temporary Credentials:</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${customer.email}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${tempPassword}</code></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Log In to Your Account
            </a>
          </div>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">⚠️ Important Security Notice:</p>
            <p style="margin: 10px 0 0 0; color: #78350f; font-size: 14px;">
              For your security, you <strong>must change this temporary password</strong> when you first log in. This password will expire in 7 days if not changed.
            </p>
          </div>
          
          <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">
            If you didn't request this access, please contact our support team immediately.
          </p>
          
          <p>Best regards,<br>The BREVI™ Team</p>
        </body>
      </html>
    `

    await sendEmail({
      to: customer.email,
      subject: 'Your BREVI Account Access - Temporary Password',
      html,
    })

    return { success: true, message: 'Temporary password sent successfully' }
  } catch (error: any) {
    console.error('Error sending temporary password to customer:', error)
    return { success: false, error: error.message || 'Failed to send temporary password' }
  }
}

/**
 * Send temporary passwords to multiple customers
 */
export async function sendBulkTemporaryPasswords(customerIds: string[]) {
  try {
    const supabase = createAdminSupabaseClient()
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const customerId of customerIds) {
      const result = await sendTemporaryPasswordToCustomer(customerId)
      if (result.success) {
        results.success++
      } else {
        results.failed++
        results.errors.push(`${customerId}: ${result.error}`)
      }
    }

    return {
      success: true,
      message: `Sent temporary passwords to ${results.success} customer(s). ${results.failed} failed.`,
      results,
    }
  } catch (error: any) {
    console.error('Error sending bulk temporary passwords:', error)
    return { success: false, error: error.message || 'Failed to send bulk temporary passwords' }
  }
}

