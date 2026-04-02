'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { canAccessRoute, type UserRole } from '@/lib/permissions'

interface RoleGuardProps {
  children: React.ReactNode
  requiredRole?: UserRole[]
  requiredRoute?: string
  fallback?: React.ReactNode
}

/**
 * Component to guard routes based on user role
 * Redirects to home if user doesn't have access
 */
export function RoleGuard({ 
  children, 
  requiredRole, 
  requiredRoute,
  fallback 
}: RoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    // If no user, redirect to login
    if (!user) {
      router.push('/login')
      return
    }

    const userRole = user.role as UserRole

    // Check role-based access
    if (requiredRole && !requiredRole.includes(userRole)) {
      router.push('/')
      return
    }

    // Check route-based access
    if (requiredRoute && !canAccessRoute(userRole, requiredRoute)) {
      router.push('/')
      return
    }
  }, [user, loading, router, requiredRole, requiredRoute])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return fallback || null
  }

  const userRole = user.role as UserRole

  // Check role-based access
  if (requiredRole && !requiredRole.includes(userRole)) {
    return fallback || (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  // Check route-based access
  if (requiredRoute && !canAccessRoute(userRole, requiredRoute)) {
    return fallback || (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

