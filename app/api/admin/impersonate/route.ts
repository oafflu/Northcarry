import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/admin/impersonate
 * Start impersonating a user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if current user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can impersonate users' }, { status: 403 })
    }

    const { targetUserId } = await request.json()

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 })
    }

    // Get target user
    const adminSupabase = createAdminSupabaseClient()
    const { data: targetUser, error: targetError } = await adminSupabase.auth.admin.getUserById(targetUserId)

    if (targetError || !targetUser?.user) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // Get target user profile
    const { data: targetProfile } = await adminSupabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', targetUserId)
      .single()

    // Store original admin user ID in a cookie first
    const cookieStore = await cookies()
    cookieStore.set('admin_original_user_id', currentUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    // Generate a magic link for the target user
    // The magic link will redirect to our client-side callback page which handles the hash fragment
    const callbackUrl = new URL('/admin/impersonate/callback', request.url)
    callbackUrl.searchParams.set('user_id', targetUserId)

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email!,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (linkError || !linkData) {
      return NextResponse.json({ error: 'Failed to generate impersonation link' }, { status: 500 })
    }

    // Return the magic link - it will redirect to our callback which handles the session
    return NextResponse.json({
      success: true,
      redirectUrl: linkData.properties.action_link,
      user: {
        id: targetProfile?.id || targetUser.user.id,
        email: targetUser.user.email,
        firstName: targetProfile?.first_name || '',
        lastName: targetProfile?.last_name || '',
        role: targetProfile?.role || 'customer',
      },
    })
  } catch (error: any) {
    console.error('Error in impersonate API:', error)
    return NextResponse.json({ error: error.message || 'Failed to impersonate user' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/impersonate
 * Stop impersonation and return to admin account
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const originalAdminId = cookieStore.get('admin_original_user_id')?.value

    if (!originalAdminId) {
      return NextResponse.json({ error: 'No active impersonation session' }, { status: 400 })
    }

    // Get original admin user
    const adminSupabase = createAdminSupabaseClient()
    const { data: adminUser } = await adminSupabase.auth.admin.getUserById(originalAdminId)

    if (!adminUser?.user) {
      return NextResponse.json({ error: 'Original admin user not found' }, { status: 404 })
    }

    // Generate a magic link for the admin to sign back in
    const callbackUrl = new URL('/admin/impersonate/callback', request.url)
    
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email: adminUser.user.email!,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (linkError || !linkData) {
      return NextResponse.json({ error: 'Failed to generate admin session' }, { status: 500 })
    }

    // Clear impersonation cookie
    cookieStore.delete('admin_original_user_id')

    return NextResponse.json({
      success: true,
      redirectUrl: linkData.properties.action_link,
    })
  } catch (error: any) {
    console.error('Error stopping impersonation:', error)
    return NextResponse.json({ error: error.message || 'Failed to stop impersonation' }, { status: 500 })
  }
}

/**
 * GET /api/admin/impersonate
 * Check if currently impersonating
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const originalAdminId = cookieStore.get('admin_original_user_id')?.value

    return NextResponse.json({
      isImpersonating: !!originalAdminId,
      originalAdminId: originalAdminId || null,
    })
  } catch (error: any) {
    return NextResponse.json({ isImpersonating: false, originalAdminId: null })
  }
}

