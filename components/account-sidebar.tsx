'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { User, Package, MapPin, CreditCard, RotateCcw, Gift, LogOut, Menu, X, TrendingUp, Bell, MessageSquare } from 'lucide-react'

export function AccountSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAffiliate, setIsAffiliate] = useState(false)
  const [showRewards, setShowRewards] = useState(false)
  
  // Check if user is an affiliate
  useEffect(() => {
    const checkAffiliateStatus = async () => {
      if (!user?.id) {
        setIsAffiliate(false)
        return
      }
      
      try {
        const response = await fetch(`/api/affiliates/check?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          setIsAffiliate(data.isAffiliate || false)
        }
      } catch (error) {
        console.error('Error checking affiliate status:', error)
        setIsAffiliate(false)
      }
    }
    
    checkAffiliateStatus()
  }, [user?.id])

  // Check if loyalty program is enabled and should show in account
  useEffect(() => {
    const checkLoyaltyStatus = async () => {
      try {
        const response = await fetch('/api/loyalty/status', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setShowRewards(data.showInAccount === true)
        } else {
          setShowRewards(false)
        }
      } catch (error) {
        console.error('Error checking loyalty status:', error)
        setShowRewards(false)
      }
    }
    
    checkLoyaltyStatus()
    
    // Re-check when page becomes visible (in case settings changed in another tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkLoyaltyStatus()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const navItems = [
    { href: '/account', label: 'Dashboard', icon: User },
    { href: '/account/notifications', label: 'Notifications', icon: Bell },
    { href: '/account/orders', label: 'Orders', icon: Package },
    { href: '/account/addresses', label: 'Addresses', icon: MapPin },
    { href: '/account/payment-methods', label: 'Payment Methods', icon: CreditCard },
    { href: '/account/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { href: '/account/returns', label: 'Returns', icon: RotateCcw },
    { href: '/account/support', label: 'Support', icon: MessageSquare },
    ...(showRewards ? [{ href: '/account/loyalty', label: 'Rewards', icon: Gift }] : []),
    ...(isAffiliate ? [{ href: '/account/affiliate', label: 'Affiliate Dashboard', icon: TrendingUp }] : []),
    { href: '/account/profile', label: 'Profile Settings', icon: User },
  ]

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden mb-4 w-full flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-gray-200"
      >
        <span className="font-medium text-gray-900">Menu</span>
        <Menu className="h-5 w-5 text-gray-600" />
      </button>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar - Mobile as drawer, Desktop as sidebar */}
      <div
        className={`lg:col-span-1 fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto w-64 lg:w-full transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full lg:h-auto rounded-lg bg-white shadow-sm lg:shadow-sm border-r lg:border-r-0 border-gray-200 lg:border-0">
          <div className="flex items-center justify-between p-4 lg:hidden border-b border-gray-200">
            <span className="font-semibold text-gray-900">Account Menu</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="p-4 lg:p-6 space-y-2 overflow-y-auto lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/account' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm sm:text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-black'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-sm sm:text-base text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              Logout
            </button>
          </nav>
        </div>
      </div>
    </>
  )
}

