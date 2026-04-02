"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  RotateCcw,
  MessageSquare,
  Menu,
  X,
  Home,
  LogOut,
  TrendingUp,
  DollarSign,
  CreditCard,
  FileText,
  FlaskConical,
  Bell,
} from "lucide-react"
import { NotificationsBell } from "@/components/notifications-bell"
import { SupplierTranslationProvider, useTranslation } from "@/lib/translations/supplier/context"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navigation = [
  { nameKey: "common.dashboard", href: "/supplier", icon: LayoutDashboard },
  { nameKey: "common.notifications", href: "/supplier/notifications", icon: Bell },
  { nameKey: "common.messages", href: "/supplier/messages", icon: MessageSquare },
  { nameKey: "common.inventory", href: "/supplier/inventory", icon: Package },
  { nameKey: "common.orders", href: "/supplier/orders", icon: ShoppingCart },
  { nameKey: "common.returns", href: "/supplier/returns", icon: RotateCcw },
  { nameKey: "common.performance", href: "/supplier/performance", icon: TrendingUp },
  { nameKey: "common.payment", href: "/supplier/payment", icon: DollarSign },
  {
    nameKey: "common.researchAndUpdates",
    href: "/supplier/research-updates",
    icon: FlaskConical,
    /** Detail pages stay under /supplier/sample-requests/[id] */
    activePathPrefixes: ["/supplier/sample-requests"],
  },
]

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SupplierTranslationProvider>
      <SupplierLayoutContent>{children}</SupplierLayoutContent>
    </SupplierTranslationProvider>
  )
}

function SupplierLayoutContent({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()
  const { t, locale, setLocale } = useTranslation()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return // Wait for mount
    
    // Only redirect if we're sure the user is not authenticated (not just loading)
    // Add a small delay to prevent race conditions during session refresh
    const timeoutId = setTimeout(() => {
      if (!loading && !user) {
        router.push('/login')
        return
      }
      
      if (!loading && user && user.role !== 'supplier') {
        router.push('/')
        return
      }
    }, 100) // Small delay to allow session refresh
    
    return () => clearTimeout(timeoutId)
  }, [mounted, user, loading, router])

  // Stable blocking states to avoid hydration mismatch: render a single loader until mounted AND not loading
  const showLoading = !mounted || loading
  if (showLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // After loading completes, handle unauth/role cases with a stable render
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  if (user.role !== 'supplier') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await logout()
      // Don't call router.push here - logout() already handles navigation
    } catch (error) {
      console.error('Logout error:', error)
      // Fallback navigation
      router.push("/")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#1a1a1a] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
            <Link href="/supplier" className="text-white font-bold text-xl">
              {t('layout.title')}
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const extraActive =
                "activePathPrefixes" in item && item.activePathPrefixes
                  ? item.activePathPrefixes.some((p) => pathname.startsWith(p))
                  : false
              const isActive =
                pathname === item.href ||
                extraActive ||
                (item.href !== "/supplier" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.nameKey}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  {t(item.nameKey)}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName && user?.lastName 
                    ? `${user.firstName} ${user.lastName}` 
                    : t('layout.supplierUser')}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email || 'supplier@brevi.com'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('common.signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <NotificationsBell />
              
              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Globe className="w-4 h-4" />
                    <span className="hidden sm:inline">{locale === 'zh' ? '中文' : 'English'}</span>
                    <span className="sm:hidden">{locale === 'zh' ? '中' : 'EN'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setLocale('zh')}
                    className={locale === 'zh' ? 'bg-gray-100' : ''}
                  >
                    中文
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocale('en')}
                    className={locale === 'en' ? 'bg-gray-100' : ''}
                  >
                    English
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Link
                href="/"
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.viewStore')}</span>
                <span className="sm:hidden">{t('common.store')}</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
