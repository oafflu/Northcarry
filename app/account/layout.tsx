'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { AccountSidebar } from '@/components/account-sidebar'

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return // Wait for mount
    
    // Only redirect if we're sure there's no user (after mount and loading complete)
    if (!loading && !user) {
      router.push('/login')
    }
  }, [mounted, user, loading, router])

  // Optimized: Only block on initial mount, allow pages to render while auth loads
  // This prevents blocking navigation between pages
  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // After mount, check auth but don't block if still loading (allow optimistic render)
  // Only redirect if we're certain there's no user
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-6 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">My Account</h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600">
              Welcome back, {user?.firstName || 'User'}!
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            <AccountSidebar />
            <div className="lg:col-span-2">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

