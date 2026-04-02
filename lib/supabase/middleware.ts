import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
    headers: {
      // Allow unload event for PayPal SDK
      'Permissions-Policy': 'unload=*',
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
            headers: {
              // Allow unload event for PayPal SDK
              'Permissions-Policy': 'unload=*',
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect /account routes
  if (request.nextUrl.pathname.startsWith('/account') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('Permissions-Policy', 'unload=*')
    return redirectResponse
  }

  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Allow impersonation callback route - no auth check needed (handles magic link tokens)
    if (request.nextUrl.pathname.startsWith('/admin/impersonate/callback')) {
      return supabaseResponse
    }

    // Check for impersonation cookie first (allows access even if user role doesn't match)
    const isImpersonating = request.cookies.get('admin_original_user_id')?.value
    
    if (!user) {
      // If no user but impersonating cookie exists, allow through (session might be setting up)
      if (isImpersonating) {
        return supabaseResponse
      }
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.headers.set('Permissions-Policy', 'unload=*')
      return redirectResponse
    }

    // Check if user is admin, marketer, support, or partner
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Allow admin, marketer, support, and partner roles
    // Also allow if impersonating (cookie exists means admin is impersonating)
    const allowedRoles = ['admin', 'marketer', 'support', 'partner']
    
    if (profile?.role && !allowedRoles.includes(profile.role) && !isImpersonating) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.headers.set('Permissions-Policy', 'unload=*')
      return redirectResponse
    }
  }

  // Protect /supplier routes
  if (request.nextUrl.pathname.startsWith('/supplier')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.headers.set('Permissions-Policy', 'unload=*')
      return redirectResponse
    }

    // Check if user is supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'supplier') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.headers.set('Permissions-Policy', 'unload=*')
      return redirectResponse
    }
  }

  return supabaseResponse
}

