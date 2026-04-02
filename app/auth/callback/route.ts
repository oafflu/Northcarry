import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const redirectTo = requestUrl.searchParams.get('redirect_to') || '/account'
  
  // Handle Supabase auth callbacks (magic links, password reset, etc.)
  // Supabase magic links can come with either 'token' or 'token_hash' parameter
  // OR they might come with hash fragments (which we can't read server-side)
  // In that case, redirect to client-side handler
  if ((token || tokenHash) && type) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    try {
      // Verify the token and exchange it for a session
      // For magic links, we use verifyOtp with the token_hash
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash || token || '',
        type: type as 'magiclink' | 'recovery' | 'email' | 'email_change' | 'phone_change',
      })

      if (error) {
        console.error('Error verifying auth token:', error)
        // Redirect to login with error
        const url = new URL('/login', request.url)
        url.searchParams.set('error', 'invalid_token')
        return NextResponse.redirect(url)
      }

      if (data?.user) {
        // Successfully verified - redirect to the intended destination
        // Normalize redirect URL to remove localhost
        let finalRedirect = redirectTo
        if (redirectTo.includes('localhost')) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
          finalRedirect = redirectTo.replace(/https?:\/\/localhost:\d+/, siteUrl)
        }
        
        const redirectUrl = new URL(finalRedirect, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (error: any) {
      console.error('Error in auth callback:', error)
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'verification_failed')
      return NextResponse.redirect(url)
    }
  }

  // If no token in query params, this might be a redirect from Supabase with hash fragments
  // OR Supabase might have redirected directly to the redirectTo URL with hash fragments
  // In either case, we need to redirect to our client-side handler
  // But first, check if we're already on the magic-link page (avoid redirect loop)
  if (requestUrl.pathname === '/auth/magic-link') {
    // Already on magic-link page, let it handle hash fragments client-side
    return NextResponse.next()
  }
  
  // Redirect to client-side handler which can read hash fragments
  const magicLinkUrl = new URL('/auth/magic-link', request.url)
  if (redirectTo) {
    magicLinkUrl.searchParams.set('redirect_to', redirectTo)
  }
  // Preserve any query params that might be useful
  requestUrl.searchParams.forEach((value, key) => {
    if (key !== 'redirect_to' && key !== 'token' && key !== 'token_hash' && key !== 'type') {
      magicLinkUrl.searchParams.set(key, value)
    }
  })
  
  return NextResponse.redirect(magicLinkUrl)
}

