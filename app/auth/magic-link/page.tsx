'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function MagicLinkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    
    const handleMagicLink = async () => {
      try {
        // Extract tokens from URL hash (Supabase magic links put them there)
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        const redirectTo = searchParams.get('redirect_to') || '/account'

        // Also check for error in hash
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')
        
        if (error) {
          console.error('Magic link error:', error, errorDescription)
          if (!isMounted) return
          setError(errorDescription || error || 'Authentication failed')
          setLoading(false)
          setTimeout(() => {
            if (isMounted) window.location.href = `/login?error=${encodeURIComponent(error)}`
          }, 3000)
          return
        }

        if (!accessToken || !refreshToken) {
          // If no hash tokens, check for query parameters (fallback)
          const token = searchParams.get('token')
          const tokenHash = searchParams.get('token_hash')
          const queryType = searchParams.get('type')
          
          if (token || tokenHash) {
            // Redirect to server-side callback handler
            const callbackUrl = new URL('/auth/callback', window.location.origin)
            if (tokenHash) callbackUrl.searchParams.set('token_hash', tokenHash)
            if (token) callbackUrl.searchParams.set('token', token)
            if (queryType) callbackUrl.searchParams.set('type', queryType)
            callbackUrl.searchParams.set('redirect_to', redirectTo)
            window.location.href = callbackUrl.toString()
            return
          }
          
          // No tokens found - redirect to login
          if (!isMounted) return
          setError('No authentication tokens found in URL')
          setLoading(false)
          setTimeout(() => {
            if (isMounted) window.location.href = '/login?error=invalid_link'
          }, 3000)
          return
        }

        // Set the session using the Supabase client
        const supabase = createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          console.error('Error setting session:', sessionError)
          if (!isMounted) return
          setError(sessionError.message || 'Failed to authenticate')
          setLoading(false)
          setTimeout(() => {
            if (isMounted) window.location.href = '/login?error=authentication_failed'
          }, 3000)
          return
        }

        if (!session) {
          console.error('No session after setSession')
          if (!isMounted) return
          setError('Failed to create session')
          setLoading(false)
          setTimeout(() => {
            if (isMounted) window.location.href = '/login?error=session_failed'
          }, 3000)
          return
        }

        // Verify authentication by calling getUser() (more secure than relying on session object)
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error('Error verifying user:', userError)
          if (!isMounted) return
          setError(userError?.message || 'Failed to verify authentication')
          setLoading(false)
          setTimeout(() => {
            if (isMounted) window.location.href = '/login?error=verification_failed'
          }, 3000)
          return
        }

        // Successfully authenticated - redirect immediately
        if (!isMounted) return
        setLoading(false)
        const finalRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
        // Use replace to avoid adding to history
        window.location.replace(finalRedirect)
      } catch (error: any) {
        console.error('Error handling magic link:', error)
        if (!isMounted) return
        setError(error.message || 'An unexpected error occurred')
        setLoading(false)
        setTimeout(() => {
          if (isMounted) window.location.href = '/login?error=unexpected_error'
        }, 3000)
      }
    }

    // Small delay to ensure component is mounted and hash is available
    const timer = setTimeout(() => {
      handleMagicLink()
    }, 100)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Signing you in...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Authentication Error</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <p className="text-sm text-red-600">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <MagicLinkContent />
    </Suspense>
  )
}

