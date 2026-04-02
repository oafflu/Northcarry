'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendWelcomeEmail, sendAdminWelcomeEmail, sendSupplierWelcomeEmail } from '@/lib/email'
import { triggerAutomation } from '@/app/actions/email-automations'
import { logCustomerAction } from '@/lib/system-logger'

interface CreateUserData {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'customer' | 'admin' | 'supplier' | 'marketer' | 'support' | 'partner' | 'partner'
  phone?: string
  companyName?: string
  businessAddress?: any
  taxId?: string
  contactPerson?: string
}

interface UpdateUserData extends Partial<CreateUserData> {
  email?: string // Allow email updates for suppliers
}

export async function createUser(data: CreateUserData) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables')
      return { success: false, error: 'Server configuration error. Please contact support.' }
    }

    const supabase = createAdminSupabaseClient()

    // Check if user already exists by checking profiles table
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', data.email)
      .maybeSingle()
    
    // If profile exists, user already exists
    if (existingProfile) {
      return { success: false, error: 'User with this email already exists' }
    }
    
    // If there was an error other than "not found", return it
    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('Error checking for existing user:', profileCheckError)
      return { success: false, error: 'Error checking if user exists' }
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return { success: false, error: authError.message || 'Failed to create user account' }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // Create profile
    const profileData: any = {
      id: authData.user.id,
      email: authData.user.email!,
      first_name: data.firstName,
      last_name: data.lastName,
      role: data.role,
      phone: data.phone || null,
    }

    // Add supplier-specific fields if role is supplier
    if (data.role === 'supplier') {
      profileData.company_name = data.companyName || null
      // Only set business_address if it's provided and is a valid object
      if (data.businessAddress && typeof data.businessAddress === 'object') {
        profileData.business_address = data.businessAddress
      } else {
        profileData.business_address = null
      }
      profileData.tax_id = data.taxId || null
      profileData.contact_person = data.contactPerson || null
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id)
      } catch (deleteError) {
        console.error('Error cleaning up auth user:', deleteError)
      }
      return { success: false, error: profileError.message || 'Failed to create user profile' }
    }

    // Create loyalty member for customers
    if (data.role === 'customer') {
      try {
        const { data: bronzeTier } = await supabase
          .from('loyalty_tiers')
          .select('id')
          .eq('name', 'Bronze')
          .single()

        if (bronzeTier) {
          const referralCode = `REF-${authData.user.id.substring(0, 8).toUpperCase()}`
          const { error: loyaltyError } = await supabase.from('loyalty_members').insert({
            user_id: authData.user.id,
            tier_id: bronzeTier.id,
            points_balance: 0,
            lifetime_points: 0,
            referral_code: referralCode,
          })
          
          if (loyaltyError) {
            console.error('Error creating loyalty member:', loyaltyError)
            // Don't fail the whole operation if loyalty member creation fails
          }
        }
      } catch (loyaltyError) {
        console.error('Error setting up loyalty member:', loyaltyError)
        // Don't fail the whole operation if loyalty member creation fails
      }
    }

    // Send welcome emails based on role
    try {
      // Get email template settings using admin client (no session required)
      const { data: emailTemplateSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'email_templates')
        .single()

      const templates = (emailTemplateSetting?.setting_value as any) || {}
      const welcomeEnabled = templates.welcome !== false // Default to true if not set

      if (welcomeEnabled) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
        const loginUrl = `${siteUrl}/login`
        const fullName = `${data.firstName} ${data.lastName}`

        if (data.role === 'customer') {
          // Send customer welcome email (system email via Microsoft 365)
          await sendWelcomeEmail(authData.user.email!, fullName)
          
          // Trigger new_subscriber automation (marketing email via Mailgun)
          try {
            await triggerAutomation('new_subscriber', authData.user.email!, {
              userId: authData.user.id,
              name: fullName,
            })
          } catch (automationError) {
            console.error('Error triggering new_subscriber automation:', automationError)
            // Don't fail user creation if automation fails
          }
        } else if (data.role === 'admin') {
          // Send admin welcome email with credentials
          await sendAdminWelcomeEmail(
            authData.user.email!,
            fullName,
            data.password, // Include password in email for admin/supplier accounts
            loginUrl
          )
        } else if (data.role === 'supplier') {
          // Send supplier welcome email with credentials
          await sendSupplierWelcomeEmail(
            authData.user.email!,
            fullName,
            data.companyName || null,
            data.password, // Include password in email for admin/supplier accounts
            loginUrl
          )
        } else if (data.role === 'marketer' || data.role === 'support') {
          // Send admin-style welcome email with credentials for marketer and support roles
          await sendAdminWelcomeEmail(
            authData.user.email!,
            fullName,
            data.password,
            loginUrl
          )
        }
      }
    } catch (emailError) {
      // Don't fail user creation if email fails
      console.error('Error sending welcome email:', emailError)
    }

    revalidatePath('/admin/users')
    
    // Log the action
    await logCustomerAction(
      'created',
      `User account created for ${data.email} (${data.role})`,
      authData.user.id,
      data.email,
      {
        role: data.role,
        first_name: data.firstName,
        last_name: data.lastName,
        company_name: data.companyName || null,
      }
    )
    
    return { success: true, userId: authData.user.id }
  } catch (error: any) {
    console.error('Unexpected error in createUser:', error)
    
    // Log the error
    await logSystemAction({
      actionType: 'customer_created',
      actionCategory: 'customer_management',
      actionDescription: `Failed to create user account: ${error.message}`,
      status: 'error',
      errorMessage: error.message,
    })
    
    return { success: false, error: error.message || 'An unexpected error occurred while creating the user' }
  }
}

export async function updateUser(userId: string, updates: UpdateUserData) {
  const supabase = createAdminSupabaseClient()

  // Get current user to check role
  const { data: currentUser } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .single()

  // Check if email update is requested
  if (updates.email !== undefined) {
    // Check if new email already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', updates.email)
      .neq('id', userId)
      .maybeSingle()

    if (existingUser) {
      return { success: false, error: 'Email address is already in use by another user' }
    }

    // Update auth user email (works for all roles including admin)
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email: updates.email,
      email_confirm: true, // Auto-confirm the new email
    })

    if (authError) {
      console.error('Error updating auth email:', authError)
      return { success: false, error: authError.message || 'Failed to update email address' }
    }
  }

  // Update profile
  const profileUpdates: any = {}
  if (updates.firstName !== undefined) profileUpdates.first_name = updates.firstName
  if (updates.lastName !== undefined) profileUpdates.last_name = updates.lastName
  if (updates.phone !== undefined) profileUpdates.phone = updates.phone
  if (updates.role !== undefined) profileUpdates.role = updates.role
  
  // Update email in profile if provided (for all roles including admin)
  if (updates.email !== undefined) {
    profileUpdates.email = updates.email
  }

  // Supplier-specific updates
  if (updates.role === 'supplier' || updates.companyName !== undefined) {
    if (updates.companyName !== undefined) profileUpdates.company_name = updates.companyName
    if (updates.businessAddress !== undefined) profileUpdates.business_address = updates.businessAddress
    if (updates.taxId !== undefined) profileUpdates.tax_id = updates.taxId
    if (updates.contactPerson !== undefined) profileUpdates.contact_person = updates.contactPerson
  }

  const { error } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)

  if (error) {
    console.error('Error updating user:', error)
    return { success: false, error: error.message }
  }

  // Update password if provided
  if (updates.password) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(userId, {
      password: updates.password
    })

    if (passwordError) {
      console.error('Error updating password:', passwordError)
      return { success: false, error: passwordError.message }
    }
  }

  revalidatePath('/admin/users')
  
  // Get user email for logging
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, role')
    .eq('id', userId)
    .single()
  
  // Log the action
  await logCustomerAction(
    'updated',
    `User account updated for ${userProfile?.email || userId}`,
    userId,
    userProfile?.email,
    {
      updated_fields: Object.keys(updates),
      role: updates.role || userProfile?.role,
    }
  )
  
  return { success: true }
}

export async function deleteUser(userId: string) {
  const supabase = createAdminSupabaseClient()

  // Delete profile first (cascade should handle this, but being explicit)
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (profileError) {
    console.error('Error deleting profile:', profileError)
  }

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(userId)

  if (authError) {
    console.error('Error deleting auth user:', authError)
    return { success: false, error: authError.message }
  }

  // Get user email before deletion for logging
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, role')
    .eq('id', userId)
    .single()
  
  revalidatePath('/admin/users')
  
  // Log the action (before deletion)
  await logCustomerAction(
    'deleted',
    `User account deleted: ${userProfile?.email || userId}`,
    userId,
    userProfile?.email || 'Unknown',
    {
      role: userProfile?.role || 'unknown',
    }
  )
  
  return { success: true }
}

export async function getUsers(role?: 'customer' | 'admin' | 'supplier' | 'marketer' | 'support' | 'partner', excludeCustomers: boolean = false) {
  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (excludeCustomers) {
    // Exclude customers from users page - they have their own page
    query = query.neq('role', 'customer')
  }

  if (role) {
    query = query.eq('role', role)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching users:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getSuppliers() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, company_name, first_name, last_name, email')
    .eq('role', 'supplier')
    .order('company_name', { ascending: true })

  if (error) {
    console.error('Error fetching suppliers:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getCustomerStats(customerId: string) {
  const supabase = createAdminSupabaseClient()

  // Get customer email to match orders (in case orders are linked by email)
  const { data: customer } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', customerId)
    .single()

  if (!customer || !customer.email) {
    return {
      orderCount: 0,
      totalSpent: 0,
      lastOrderDate: null,
    }
  }

  const customerEmail = customer.email.toLowerCase().trim()

  // Get all orders for this customer - check both user_id and customer_email
  // Use OR condition to get unique orders (avoid duplicates)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total, payment_status, created_at')
    .or(`user_id.eq.${customerId},customer_email.ilike.%${customerEmail}%`)

  if (error) {
    console.error('Error fetching customer orders:', error)
    return {
      orderCount: 0,
      totalSpent: 0,
      lastOrderDate: null,
    }
  }

  if (!orders || orders.length === 0) {
    return {
      orderCount: 0,
      totalSpent: 0,
      lastOrderDate: null,
    }
  }

  // Remove duplicates by order ID (in case an order matches both user_id and email)
  const uniqueOrders = Array.from(
    new Map(orders.map(order => [order.id, order])).values()
  )

  // Calculate order count
  const orderCount = uniqueOrders.length

  // Calculate total spent from paid orders only
  const totalSpent = uniqueOrders
    .filter(order => order.payment_status === 'paid')
    .reduce((sum, order) => 
      sum + parseFloat(order.total?.toString() || '0'), 0) || 0

  // Get last order date
  const sortedOrders = uniqueOrders.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const lastOrderDate = sortedOrders[0]?.created_at || null

  return {
    orderCount,
    totalSpent,
    lastOrderDate,
  }
}

export async function getCustomersWithStats(
  role?: 'customer' | 'admin' | 'supplier',
  options?: {
    page?: number
    pageSize?: number
    search?: string
  }
) {
  const supabase = createAdminSupabaseClient()
  const page = options?.page || 1
  const pageSize = options?.pageSize || 25
  const search = options?.search?.trim() || ''
  const offset = (page - 1) * pageSize

  // Build base query
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (role) {
    query = query.eq('role', role)
  }

  // Apply search filter if provided
  if (search) {
    query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1)

  const { data: customers, error, count } = await query

  if (error) {
    console.error('Error fetching customers:', error)
    return { data: [], total: 0, error: error.message }
  }

  if (!customers || customers.length === 0) {
    return { data: [], total: count || 0, error: null }
  }

  // Fetch stats for customers in current page only (much more efficient)
  const customersWithStats = await Promise.all(
    customers.map(async (customer) => {
      const stats = await getCustomerStats(customer.id)
      return {
        ...customer,
        ...stats,
      }
    })
  )

  return { data: customersWithStats, total: count || 0, error: null }
}

export async function getCustomerAggregateStats(role?: 'customer' | 'admin' | 'supplier') {
  const supabase = createAdminSupabaseClient()

  // Get total customer count
  let countQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (role) {
    countQuery = countQuery.eq('role', role)
  }

  const { count: totalCustomers } = await countQuery

  // Get aggregate order stats
  let totalOrders = 0
  let totalRevenue = 0

  // For customer dashboard KPIs, compute directly from orders.
  // This avoids large IN() filters and email OR chains that can silently fail at scale.
  if (!role || role === 'customer') {
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })

    totalOrders = ordersCount || 0

    let from = 0
    const pageSize = 1000
    for (;;) {
      const { data: paidOrders, error: paidOrdersError } = await supabase
        .from('orders')
        .select('total, total_amount, payment_status')
        .eq('payment_status', 'paid')
        .range(from, from + pageSize - 1)

      if (paidOrdersError || !paidOrders || paidOrders.length === 0) break

      totalRevenue += paidOrders.reduce((sum: number, order: any) => {
        const raw = order.total_amount ?? order.total ?? 0
        const parsed = parseFloat(raw?.toString?.() || '0')
        return sum + (Number.isFinite(parsed) ? parsed : 0)
      }, 0)

      if (paidOrders.length < pageSize) break
      from += pageSize
    }
  }

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return {
    totalCustomers: totalCustomers || 0,
    totalOrders,
    totalRevenue,
    avgOrderValue,
  }
}

