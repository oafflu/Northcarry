import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token = requestUrl.searchParams.get('token')
  const type = requestUrl.searchParams.get('type')
  const redirectTo = requestUrl.searchParams.get('redirect_to')
  
  // If no token, redirect to login
  if (!token || !type) {
    const url = new URL('/login', request.url)
    return NextResponse.redirect(url)
  }

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
    // Verify the OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type as 'magiclink' | 'recovery' | 'email' | 'email_change' | 'phone_change',
    })

    if (error) {
      console.error('Error verifying OTP:', error)
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'invalid_token')
      return NextResponse.redirect(url)
    }

    if (data?.user) {
      // Successfully verified - determine redirect destination
      let finalRedirect = '/account' // Default
      
      if (redirectTo) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
        
        // Normalize redirect URL to remove localhost
        let normalizedRedirect = redirectTo.replace(/https?:\/\/localhost:\d+/, siteUrl)
        
        // If it's a full URL, extract the path
        try {
          const redirectUrlObj = new URL(normalizedRedirect)
          // If it's the same domain or localhost was replaced, use the path
          if (redirectUrlObj.origin === siteUrl || normalizedRedirect.includes(siteUrl)) {
            finalRedirect = redirectUrlObj.pathname + redirectUrlObj.search + redirectUrlObj.hash
          } else {
            // Different domain, use as-is
            finalRedirect = normalizedRedirect
          }
        } catch (e) {
          // Not a valid URL, treat as path
          finalRedirect = normalizedRedirect.startsWith('/') ? normalizedRedirect : '/' + normalizedRedirect
        }
        
        // Ensure it starts with / if it's a relative path
        if (!finalRedirect.startsWith('http') && !finalRedirect.startsWith('/')) {
          finalRedirect = '/' + finalRedirect
        }
      }
      
      // If finalRedirect is a full URL, use it directly, otherwise construct from request
      if (finalRedirect.startsWith('http')) {
        return NextResponse.redirect(finalRedirect)
      } else {
        const redirectUrl = new URL(finalRedirect, request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  } catch (error: any) {
    console.error('Error in auth verification:', error)
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'verification_failed')
    return NextResponse.redirect(url)
  }

  // Fallback: redirect to login
  const url = new URL('/login', request.url)
  return NextResponse.redirect(url)
}

