'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ImpersonateCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleImpersonation = async () => {
      try {
        // Extract token from URL hash (Supabase magic links put it there)
        const hash = window.location.hash.substring(1)
        const hashParams = new URLSearchParams(hash)
        
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const targetUserId = searchParams.get('user_id')

        if (!accessToken) {
          setError('No access token found in URL')
          setLoading(false)
          setTimeout(() => router.push('/admin?error=no_token'), 2000)
          return
        }

        // Check if we're returning to admin (no user_id means we're stopping impersonation)
        const isReturningToAdmin = !targetUserId
        
        // If returning to admin, we should clear the impersonation cookie
        if (isReturningToAdmin) {
          // Clear the impersonation cookie by setting it to expire
          document.cookie = 'admin_original_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        } else {
          // Verify we have an active impersonation cookie when starting impersonation
          const hasImpersonationCookie = document.cookie.includes('admin_original_user_id')
          if (!hasImpersonationCookie) {
            setError('No active impersonation session')
            setLoading(false)
            setTimeout(() => router.push('/admin?error=no_impersonation_session'), 2000)
            return
          }
        }

        // Set the session using the Supabase client
        const supabase = createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })

        if (sessionError || !session) {
          console.error('Error setting session:', sessionError)
          setError('Failed to set session')
          setLoading(false)
          setTimeout(() => router.push('/admin?error=session_failed'), 2000)
          return
        }

        // Get user profile to determine redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        // Determine redirect path based on user role
        // If returning to admin, always go to admin panel
        let redirectPath = isReturningToAdmin ? '/admin' : '/account'
        
        if (!isReturningToAdmin) {
          if (profile?.role === 'admin') {
            redirectPath = '/admin'
          } else if (profile?.role === 'supplier') {
            redirectPath = '/supplier'
          } else {
            redirectPath = '/account'
          }
        }

        // Small delay to ensure session is set, then redirect
        setTimeout(() => {
          // Force a full page reload to ensure session is properly set
          window.location.href = redirectPath
        }, 500)
      } catch (err: any) {
        console.error('Error in impersonation callback:', err)
        setError(err.message || 'Failed to complete impersonation')
        setLoading(false)
        setTimeout(() => router.push('/admin?error=callback_failed'), 2000)
      }
    }

    handleImpersonation()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <p className="text-sm text-gray-600">Redirecting to admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Switching to user account...</p>
      </div>
    </div>
  )
}

export default function ImpersonateCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ImpersonateCallbackContent />
    </Suspense>
  )
}

