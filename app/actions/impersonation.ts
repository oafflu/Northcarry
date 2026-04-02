'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Start impersonating a user (admin only)
 */
export async function startImpersonation(targetUserId: string) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if current user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Only admins can impersonate users' }
    }

    // Get target user profile
    const adminSupabase = createAdminSupabaseClient()
    const { data: targetProfile, error: targetError } = await adminSupabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', targetUserId)
      .single()

    if (targetError || !targetProfile) {
      return { success: false, error: 'Target user not found' }
    }

    // Generate a session for the target user using admin client
    const { data: authUser } = await adminSupabase.auth.admin.getUserById(targetUserId)
    
    if (!authUser?.user) {
      return { success: false, error: 'Target user auth record not found' }
    }

    // Create a session token for the target user
    const { data: sessionData, error: sessionError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email!,
    })

    if (sessionError || !sessionData) {
      return { success: false, error: 'Failed to generate session' }
    }

    // Store original admin session info in a secure cookie
    const cookieStore = await cookies()
    cookieStore.set('admin_original_user_id', currentUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    // Use generateLink to create a magic link for impersonation
    // The callback route will handle setting the session
    if (sessionError || !sessionData) {
      return { success: false, error: 'Failed to generate impersonation link' }
    }

    // Return the magic link URL for the callback route to handle
    // The actual session will be set in the callback route

    return {
      success: true,
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        firstName: targetProfile.first_name,
        lastName: targetProfile.last_name,
        role: targetProfile.role,
      },
    }
  } catch (error: any) {
    console.error('Error starting impersonation:', error)
    return { success: false, error: error.message || 'Failed to start impersonation' }
  }
}

/**
 * Stop impersonation and return to admin account
 */
export async function stopImpersonation() {
  try {
    const cookieStore = await cookies()
    const originalAdminId = cookieStore.get('admin_original_user_id')?.value

    if (!originalAdminId) {
      return { success: false, error: 'No active impersonation session found' }
    }

    // Get original admin user
    const adminSupabase = createAdminSupabaseClient()
    const { data: adminUser } = await adminSupabase.auth.admin.getUserById(originalAdminId)

    if (!adminUser?.user) {
      return { success: false, error: 'Original admin user not found' }
    }

    // Generate magic link to restore admin session
    const { data: adminLinkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: adminUser.user.email!,
    })

    if (linkError || !adminLinkData) {
      return { success: false, error: 'Failed to generate admin restoration link' }
    }

    // Return the link URL - the callback route will handle setting the session

    // Clear impersonation cookie
    cookieStore.delete('admin_original_user_id')

    return {
      success: true,
      user: {
        id: adminUser.user.id,
        email: adminUser.user.email!,
      },
    }
  } catch (error: any) {
    console.error('Error stopping impersonation:', error)
    return { success: false, error: error.message || 'Failed to stop impersonation' }
  }
}

/**
 * Check if current session is an impersonation
 */
export async function isImpersonating() {
  try {
    const cookieStore = await cookies()
    const originalAdminId = cookieStore.get('admin_original_user_id')?.value
    return { isImpersonating: !!originalAdminId, originalAdminId: originalAdminId || null }
  } catch (error) {
    return { isImpersonating: false, originalAdminId: null }
  }
}

