'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { X, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export function ImpersonationBanner() {
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [originalAdminId, setOriginalAdminId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    checkImpersonationStatus()
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    // Add padding to main content when impersonating
    if (isImpersonating) {
      document.body.style.paddingTop = '73px'
    } else {
      document.body.style.paddingTop = ''
    }
    return () => {
      document.body.style.paddingTop = ''
    }
  }, [mounted, isImpersonating])

  const checkImpersonationStatus = async () => {
    try {
      const response = await fetch('/api/admin/impersonate')
      const data = await response.json()
      setIsImpersonating(data.isImpersonating || false)
      setOriginalAdminId(data.originalAdminId || null)
    } catch (error) {
      console.error('Error checking impersonation status:', error)
    } finally {
      setLoading(false)
    }
  }

  const stopImpersonation = async () => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success && data.redirectUrl) {
        // Redirect to the magic link to restore admin session
        // The magic link will redirect to our callback page which handles the session
        window.location.href = data.redirectUrl
      } else {
        // Fallback: redirect to admin panel
        router.push('/admin')
        router.refresh()
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error)
      // Fallback: redirect to admin panel
      router.push('/admin')
      router.refresh()
    }
  }

  // Don't render until mounted - but don't block on authLoading to prevent hydration issues
  // Only check impersonation status, not auth loading state
  if (!mounted || loading || !isImpersonating) {
    return null
  }
  
  // Don't render if auth is still loading (to prevent accessing user before ready)
  if (authLoading || !user) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-orange-500 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5" />
          <div>
            <p className="font-semibold">Impersonating User</p>
            <p className="text-sm text-orange-100">
              You are currently viewing as {user?.email || 'this user'}
            </p>
          </div>
        </div>
        <Button
          onClick={stopImpersonation}
          variant="outline"
          size="sm"
          className="bg-white text-orange-600 hover:bg-orange-50 border-white"
        >
          <X className="w-4 h-4 mr-2" />
          Return to Admin
        </Button>
      </div>
    </div>
  )
}

