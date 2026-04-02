'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logCustomerAction } from '@/lib/system-logger'

export async function loginAction(email: string, password: string) {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message, user: null }
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  // Check if user needs to change password (from user_metadata)
  const needsPasswordChange = data.user.user_metadata?.force_password_change === true

  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email!,
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      phone: profile?.phone || undefined,
      role: profile?.role || 'customer',
      avatarUrl: profile?.avatar_url,
      createdAt: data.user.created_at,
      needsPasswordChange, // Add flag for password change requirement
    },
    error: null,
  }
}

export async function registerAction(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const supabase = await createServerSupabaseClient()
  const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
  const adminSupabase = createAdminSupabaseClient()

  // Check if account already exists (from auto-creation at checkout or invitation)
  // Use admin client to bypass RLS and get accurate results
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existingProfile) {
    // Account already exists - could be from checkout, invitation, or previous registration
    // First, try to sign in with provided password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!signInError && signInData?.user) {
      // Successfully signed in - return user
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single()

      // Update profile if information is provided
      if (profile) {
        const updates: any = {}
        if (firstName && !profile.first_name) updates.first_name = firstName
        if (lastName && !profile.last_name) updates.last_name = lastName

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', signInData.user.id)
        }
      }

      return {
        success: true,
        user: {
          id: signInData.user.id,
          email: signInData.user.email!,
          firstName: profile?.first_name || firstName,
          lastName: profile?.last_name || lastName,
          phone: profile?.phone || undefined,
          role: profile?.role || 'customer',
          avatarUrl: profile?.avatar_url,
          createdAt: signInData.user.created_at,
        },
        error: null,
      }
    }

    // Sign in failed - check if user was created via invitation (no password set yet)
    // Use admin client to check and update password
    // adminSupabase already created above
    
    // Try to get the auth user by email using admin API
    const { data: usersList } = await adminSupabase.auth.admin.listUsers()
    const authUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
    
    if (authUser && authUser.id === existingProfile.id) {
      // User exists in auth but password doesn't match or wasn't set
      // Update the password for the existing user
      const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(
        authUser.id,
        { password: password }
      )

      if (updateError) {
        console.error('Error updating password:', updateError)
        return { 
          success: false, 
          error: 'An account with this email already exists. Please try logging in or use "Forgot Password" to reset your password.', 
          user: null 
        }
      }

      // Now sign in with the new password
      const { data: signInAfterUpdate, error: signInAfterUpdateError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInAfterUpdateError || !signInAfterUpdate?.user) {
        return { 
          success: false, 
          error: 'Failed to sign in after password update. Please try logging in.', 
          user: null 
        }
      }

      // Get updated profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInAfterUpdate.user.id)
        .single()

      // Update profile if information is provided
      if (profile) {
        const updates: any = {}
        if (firstName && !profile.first_name) updates.first_name = firstName
        if (lastName && !profile.last_name) updates.last_name = lastName

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('profiles')
            .update(updates)
            .eq('id', signInAfterUpdate.user.id)
        }
      }

      return {
        success: true,
        user: {
          id: signInAfterUpdate.user.id,
          email: signInAfterUpdate.user.email!,
          firstName: profile?.first_name || firstName,
          lastName: profile?.last_name || lastName,
          phone: profile?.phone || undefined,
          role: profile?.role || 'customer',
          avatarUrl: profile?.avatar_url,
          createdAt: signInAfterUpdate.user.created_at,
        },
        error: null,
      }
    }

    // Profile exists but we can't update password - user needs to use password reset
    return { 
      success: false, 
      error: 'An account with this email already exists. Please try logging in or use "Forgot Password" to reset your password.', 
      user: null 
    }
  }

  // No existing profile - create new account
  // But first check if auth user exists (might have been created during invitation)
  // adminSupabase already created above
  
  // Check if auth user already exists
  const { data: usersList } = await adminSupabase.auth.admin.listUsers()
  const existingAuthUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
  
  let authData: any
  let authError: any = null
  
  if (existingAuthUser) {
    // Auth user exists but profile doesn't (shouldn't happen, but handle it)
    // Update password and use existing user
    const { data: updatedUser, error: updateError } = await adminSupabase.auth.admin.updateUserById(
      existingAuthUser.id,
      { password: password }
    )
    
    if (updateError) {
      return { success: false, error: updateError.message || 'Failed to update password', user: null }
    }
    
    // Sign in with updated password
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (signInErr || !signInData?.user) {
      return { success: false, error: signInErr?.message || 'Failed to sign in after password update', user: null }
    }
    
    authData = { user: signInData.user }
  } else {
    // No existing auth user - create new one
    const signUpResult = await supabase.auth.signUp({
      email,
      password,
    })
    
    authData = signUpResult.data
    authError = signUpResult.error
  }

  if (authError) {
    return { success: false, error: authError.message, user: null }
  }

  if (!authData?.user) {
    return { success: false, error: 'Failed to create user', user: null }
  }

  // Check if profile already exists before creating (double-check to prevent duplicate key error)
  const { data: profileCheck } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileCheck) {
    // Profile already exists - just return the user
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    return {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        firstName: profile?.first_name || firstName,
        lastName: profile?.last_name || lastName,
        phone: profile?.phone || undefined,
        role: profile?.role || 'customer',
        avatarUrl: profile?.avatar_url,
        createdAt: authData.user.created_at,
      },
      error: null,
    }
  }

  // Create profile using admin client to bypass RLS
  // This is necessary because RLS policies may block profile creation for new users
  const { error: profileError } = await adminSupabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: authData.user.email!,
      first_name: firstName,
      last_name: lastName,
      role: 'customer',
    })

  if (profileError) {
    // Check if it's a duplicate key error - profile might have been created by a trigger
    if (profileError.code === '23505' || profileError.message.includes('duplicate key')) {
      // Profile was created by trigger or race condition - fetch it
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profile) {
        return {
          success: true,
          user: {
            id: authData.user.id,
            email: authData.user.email!,
            firstName: profile.first_name || firstName,
            lastName: profile.last_name || lastName,
            phone: profile.phone || undefined,
            role: profile.role || 'customer',
            avatarUrl: profile.avatar_url,
            createdAt: authData.user.created_at,
          },
          error: null,
        }
      }
    }
    
    // Profile creation failed - user will need to contact support
    console.error('Profile creation failed:', profileError)
    return { success: false, error: profileError.message, user: null }
  }

  return {
    success: true,
    user: {
      id: authData.user.id,
      email: authData.user.email!,
      firstName,
      lastName,
      createdAt: authData.user.created_at,
    },
    error: null,
  }
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/')
  return { success: true }
}

export async function updateProfileAction(data: {
  firstName?: string
  lastName?: string
  phone?: string
  avatarUrl?: string
  companyName?: string
  email?: string
  taxId?: string
  businessAddress?: {
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
  businessRegistrationNumber?: string
}) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const updateData: any = {}
  if (data.firstName !== undefined) updateData.first_name = data.firstName
  if (data.lastName !== undefined) updateData.last_name = data.lastName
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl

  // Supplier-specific updates
  if (profile?.role === 'supplier') {
    if (data.companyName !== undefined) updateData.company_name = data.companyName
    if (data.taxId !== undefined) updateData.tax_id = data.taxId
    if (data.businessRegistrationNumber !== undefined) {
      // Note: business_registration_number might be stored in a different table
      // For now, we'll store it in a JSONB field or create a separate field
      // Check if this field exists in profiles table
    }
    
    // Update email if provided (for suppliers only)
    if (data.email !== undefined && data.email !== user.email) {
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', data.email)
        .neq('id', user.id)
        .maybeSingle()

      if (existingUser) {
        return { success: false, error: 'Email address is already in use' }
      }

      updateData.email = data.email
      
      // Update auth email
      const { error: authError } = await supabase.auth.updateUser({
        email: data.email,
      })

      if (authError) {
        console.error('Error updating auth email:', authError)
        return { success: false, error: authError.message || 'Failed to update email' }
      }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/account')
  revalidatePath('/supplier')
  revalidatePath('/supplier/payment/invoice')
  
  // Log the action
  await logCustomerAction(
    'profile_updated',
    `Profile updated for ${user.email}`,
    user.id,
    user.email,
    {
      updated_fields: Object.keys(data),
    }
  )
  
  return { success: true }
}

// Update supplier company information (for invoice generation)
export async function updateSupplierCompanyInfo(data: {
  company_name: string
  tax_id?: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  contact_number: string
  email: string
  business_registration_number?: string
}) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is supplier
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'supplier') {
    return { success: false, error: 'Unauthorized. Only suppliers can update company information.' }
  }

  // Update profile with company information
  const businessAddress = {
    address_line1: data.address_line1,
    address_line2: data.address_line2 || null,
    city: data.city,
    state: data.state,
    postal_code: data.postal_code,
    country: data.country,
  }

  const updateData: any = {
    company_name: data.company_name,
    tax_id: data.tax_id || null,
    phone: data.contact_number,
    email: data.email,
    business_address: businessAddress,
  }

  // Update email in auth if changed
  if (data.email !== user.email) {
    const { error: authError } = await supabase.auth.updateUser({
      email: data.email,
    })

    if (authError) {
      console.error('Error updating auth email:', authError)
      return { success: false, error: authError.message || 'Failed to update email' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/supplier/payment/invoice')
  revalidatePath('/supplier')
  return { success: true }
}

// DEPRECATED: Custom password reset using our email system
// This is no longer used - we now use Supabase's built-in resetPasswordForEmail
// which is configured with Custom SMTP in Supabase dashboard.
// Kept for reference/rollback purposes only.
// @deprecated Use Supabase's resetPasswordForEmail directly from client
export async function resetPasswordAction(email: string) {
  const supabase = await createServerSupabaseClient()
  const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
  const adminSupabase = createAdminSupabaseClient()
  
  try {
    // Check if user exists
    const { data: users } = await adminSupabase.auth.admin.listUsers()
    const user = users?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
    
    if (!user) {
      // Don't reveal if email exists for security
      return { success: true, message: 'If an account exists with this email, a password reset link has been sent.' }
    }
    
    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()
    
    const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''
    
    // Generate password reset link using Supabase admin API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
    const redirectTo = `${siteUrl}/reset-password`
    
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo,
      },
    })
    
    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating password reset link:', linkError)
      return { success: false, error: 'Failed to generate password reset link' }
    }
    
    // Send custom password reset email
    try {
      const { sendPasswordResetEmail } = await import('@/lib/email')
      const emailResult = await sendPasswordResetEmail(
        email,
        name || 'there',
        linkData.properties.action_link
      )
      
      // sendPasswordResetEmail returns the result from sendEmail
      // which is { success: true, messageId: ... } on success
      if (emailResult && emailResult.success !== false) {
        console.log('Password reset email sent successfully to:', email, 'Message ID:', emailResult.messageId)
        return { success: true, message: 'Password reset link has been sent to your email.' }
      } else {
        console.error('Failed to send password reset email - no success flag:', emailResult)
        throw new Error('Email sending returned unsuccessful result')
      }
    } catch (emailError: any) {
      console.error('Error sending password reset email:', emailError)
      // Log the full error for debugging
      console.error('Email error details:', {
        message: emailError.message,
        stack: emailError.stack,
        email: email,
        errorCode: emailError.code,
        responseCode: emailError.responseCode,
      })
      // Re-throw to be caught by outer catch
      throw emailError
    }
  } catch (error: any) {
    console.error('Error in password reset:', error)
    console.error('Full error:', {
      message: error.message,
      stack: error.stack,
      email: email,
    })
    // Don't reveal errors for security, but log them for debugging
    return { success: true, message: 'If an account exists with this email, a password reset link has been sent.' }
  }
}

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    phone: profile.phone || undefined,
    role: profile.role || 'customer',
    avatarUrl: profile.avatar_url,
    createdAt: user.created_at,
  }
}

