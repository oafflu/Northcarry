"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Mail,
  MessageSquare,
  Tag,
  Menu,
  X,
  Home,
  LogOut,
  Users,
  Warehouse,
  Settings,
  ChevronDown,
  Globe,
  DollarSign,
  Languages,
  Bell,
  CreditCard,
  Image as ImageIcon,
  Repeat,
  RotateCcw,
  Truck,
  Building2,
  Clock,
  Send,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  XCircle,
  UserCheck,
  Gift,
  ShoppingBag,
  Zap,
  Layers,
  BarChart3,
  Star,
  FlaskConical,
  Percent,
} from "lucide-react"
import { NotificationsBell } from "@/components/notifications-bell"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { canAccessRoute, getAllowedNavigationItems, type UserRole } from "@/lib/permissions"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { name: "Create Invoice", href: "/admin/invoices/create", icon: FileText },
  { name: "Inventory", href: "/admin/inventory", icon: Warehouse },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Suppliers", href: "/admin/suppliers", icon: Building2 },
  { name: "Payments", href: "/admin/payments", icon: DollarSign },
  { name: "Incomplete Payments", href: "/admin/payments/incomplete", icon: XCircle },
  { name: "CMS", href: "/admin/cms", icon: FileText },
  { name: "Media Library", href: "/admin/media", icon: ImageIcon },
  { name: "Reviews", href: "/admin/reviews", icon: Star },
  { name: "Loyalty", href: "/admin/loyalty", icon: Gift },
  { name: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { name: "Support", href: "/admin/support", icon: MessageSquare },
  { name: "Sample Requests", href: "/admin/sample-requests", icon: FlaskConical },
  { name: "Returns", href: "/admin/returns", icon: RotateCcw },
]

// Helper function to check if a navigation item should be shown for partner role
function shouldShowNavItemForPartner(href: string): boolean {
  // Partner cannot access these pages
  const blockedRoutes = [
    '/admin/payments',
    '/admin/payments/incomplete',
    '/admin/users',
    '/admin/inventory',
  ]
  
  // Partner CAN access these pages
  const allowedRoutes = [
    '/admin/cms', // CMS is now allowed for partners
    '/admin/media', // Media Library is now allowed for partners
    '/admin/sample-requests', // Sample Requests is now allowed for partners
    '/admin/returns', // Returns is now allowed for partners
    '/admin/loyalty', // Loyalty program is now allowed for partners
  ]
  
  // Check if it's in allowed routes first
  if (allowedRoutes.some(route => href.startsWith(route))) {
    return true
  }
  
  return !blockedRoutes.some(route => href.startsWith(route))
}

const analyticsMenu = {
  name: "Analytics",
  icon: TrendingUp,
  children: [
    { name: "Dashboard", href: "/admin/analytics", icon: LayoutDashboard },
    { name: "Reports", href: "/admin/analytics/reports", icon: FileText },
    { name: "Financials", href: "/admin/analytics/financials", icon: DollarSign },
  ],
}

const subscriptionsMenu = {
  name: "Subscriptions",
  icon: Repeat,
  children: [
    { name: "Create Subscription", href: "/admin/subscriptions/create", icon: Package },
    { name: "Subscription Products", href: "/admin/subscriptions/products", icon: Package },
    { name: "Linked Subscriptions", href: "/admin/subscriptions/linked", icon: Repeat },
    { name: "All Subscriptions", href: "/admin/subscriptions", icon: Repeat },
    { name: "Analytics", href: "/admin/subscriptions/analytics", icon: LayoutDashboard },
    { name: "Settings", href: "/admin/subscriptions/settings", icon: Settings },
  ],
}

const emailMarketingMenu = {
  name: "Email Marketing",
  icon: Mail,
  children: [
    { name: "Campaigns", href: "/admin/email-marketing", icon: Send },
    { name: "Segments", href: "/admin/email-marketing/segments", icon: Users },
    { name: "Automations", href: "/admin/email-marketing/automations", icon: Repeat },
    { name: "Templates", href: "/admin/email-marketing/templates", icon: FileText },
    { name: "Analytics", href: "/admin/email-marketing/analytics", icon: TrendingUp },
  ],
}

const marketingMenu = {
  name: "Marketing",
  icon: TrendingUp,
  children: [
    { name: "Dashboard", href: "/admin/marketing", icon: LayoutDashboard },
    { name: "Meta", href: "/admin/marketing/meta", icon: TrendingUp },
    { name: "Google", href: "/admin/marketing/google", icon: TrendingUp },
    { name: "TikTok", href: "/admin/marketing/tiktok", icon: TrendingUp },
    { name: "Affiliate", href: "/admin/marketing/affiliate", icon: UserCheck },
  ],
}

const promosUpsellsMenu = {
  name: "Promos & Upsells",
  icon: Gift,
  children: [
    { name: "Dashboard", href: "/admin/promos-upsells", icon: LayoutDashboard },
    { name: "Promo Codes", href: "/admin/promotions", icon: Tag },
    { name: "Product Bundles", href: "/admin/promos-upsells/bundles", icon: Package },
    { name: "Quantity Breaks", href: "/admin/promos-upsells/quantity-breaks", icon: Layers },
    { name: "Post-Purchase Upsells", href: "/admin/promos-upsells/post-purchase", icon: Zap },
    { name: "Cart Upsells", href: "/admin/promos-upsells/cart-upsells", icon: ShoppingCart },
    { name: "Frequently Bought Together", href: "/admin/promos-upsells/frequently-bought", icon: ShoppingBag },
    { name: "Campaigns", href: "/admin/promos-upsells/campaigns", icon: TrendingUp },
    { name: "Analytics", href: "/admin/promos-upsells/analytics", icon: BarChart3 },
  ],
}

const settingsMenu = {
  name: "Settings",
  icon: Settings,
  children: [
    { name: "General", href: "/admin/settings/general", icon: Settings },
    { name: "SEO & Website", href: "/admin/settings/seo", icon: Globe },
    { name: "Email", href: "/admin/settings/email", icon: Mail },
    { name: "Push Notifications", href: "/admin/settings/push", icon: Bell },
    { name: "Payment", href: "/admin/settings/payment", icon: CreditCard },
    { name: "Shipping", href: "/admin/settings/shipping", icon: Truck },
    { name: "Taxes", href: "/admin/settings/taxes", icon: Percent },
    { name: "Countries", href: "/admin/settings/countries", icon: Globe },
    { name: "Currencies", href: "/admin/settings/currencies", icon: DollarSign },
    { name: "Languages", href: "/admin/settings/languages", icon: Languages },
    { name: "Cron Jobs", href: "/admin/settings/cron", icon: Clock },
    { name: "System Logs", href: "/admin/settings/system-logs", icon: FileText },
  ],
}

function SettingsDropdown({ 
  menu, 
  pathname, 
  onItemClick,
  hideIcons
}: { 
  menu: typeof settingsMenu
  pathname: string
  onItemClick: () => void
  hideIcons?: boolean
}) {
  // Determine if this menu is active based on its children
  const isActive = menu.children.some(child => pathname === child.href || pathname.startsWith(child.href + '/'))
  const [isOpen, setIsOpen] = useState(isActive)
  
  // Auto-open when on a page within this menu
  useEffect(() => {
    if (isActive) {
      setIsOpen(true)
    }
  }, [isActive])

  return (
    <div className="space-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`}
        title={hideIcons ? menu.name : undefined}
      >
        <div className="flex items-center gap-3">
          {!hideIcons && <menu.icon className="w-5 h-5 flex-shrink-0" />}
          {!hideIcons && <span>{menu.name}</span>}
          {hideIcons && <menu.icon className="w-5 h-5 mx-auto" />}
        </div>
        {!hideIcons && <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />}
      </button>
      {isOpen && !hideIcons && (
        <div className="ml-4 mt-1 space-y-1">
          {menu.children.map((child) => {
            const isChildActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isChildActive 
                    ? "bg-gray-800 text-white" 
                    : "text-gray-500 hover:bg-gray-800 hover:text-white"
                }`}
                onClick={onItemClick}
              >
                <child.icon className="w-4 h-4 flex-shrink-0" />
                {child.name}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [hideIcons, setHideIcons] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    setMounted(true)
    // Load sidebar preference from localStorage
    const savedPreference = localStorage.getItem('admin-sidebar-hide-icons')
    if (savedPreference === 'true') {
      setHideIcons(true)
    }
  }, [])

  const toggleIcons = () => {
    const newState = !hideIcons
    setHideIcons(newState)
    localStorage.setItem('admin-sidebar-hide-icons', newState.toString())
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new Event('admin-sidebar-toggle'))
  }

  useEffect(() => {
    if (!mounted) return // Wait for mount
    
    if (!loading && !user) {
      router.push('/login')
      return
    }
    
    // Allow admin, marketer, support, and partner roles to access admin panel
    const allowedRoles: UserRole[] = ['admin', 'marketer', 'support', 'partner']
    if (!loading && user && !allowedRoles.includes(user.role as UserRole)) {
      router.push('/')
      return
    }
  }, [mounted, user, loading, router])

  // Define handleLogout BEFORE any conditional returns to ensure hooks are always called in same order
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

  // Optimized: Only block on initial mount, allow pages to render while auth loads
  // This prevents blocking navigation between pages and Chrome hydration issues
  const allowedRoles: UserRole[] = ['admin', 'marketer', 'support', 'partner']
  
  // Stable blocking states to avoid hydration mismatch: render a single loader until mounted AND not loading
  const showLoading = !mounted || loading
  if (showLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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

  if (!allowedRoles.includes(user.role as UserRole)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  // All hooks must be called before conditional returns
  // Now render the main layout with ImpersonationBanner
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner - only render when auth is ready */}
      <ImpersonationBanner />
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-[#1a1a1a] transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${hideIcons ? "w-16" : "w-64"}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and Toggle */}
          <div className="flex items-center justify-between h-16 border-b border-gray-700">
            {!hideIcons ? (
              <>
                <Link href="/admin" className="flex-1 px-6 text-white font-bold text-xl">
                  BREVI Admin
                </Link>
                <button 
                  onClick={toggleIcons}
                  className="px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  title="Hide icons"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setSidebarOpen(false)} className="lg:hidden px-3 text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center w-full">
                <button 
                  onClick={toggleIcons}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors rounded"
                  title="Show icons"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
            {(() => {
              // Filter navigation based on user role
              const userRole = user?.role as UserRole
              const allowedItems = navigation.filter(item => {
                if (item.href === '/admin') return true // Dashboard always accessible
                
                // Special handling for partner role
                if (userRole === 'partner') {
                  return shouldShowNavItemForPartner(item.href) && canAccessRoute(userRole, item.href)
                }
                
                return canAccessRoute(userRole, item.href)
              })
              
              return allowedItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    } ${hideIcons ? "justify-center" : ""}`}
                    onClick={() => setSidebarOpen(false)}
                    title={hideIcons ? item.name : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!hideIcons && <span>{item.name}</span>}
                  </Link>
                )
              })
            })()}
            
                {/* Analytics Dropdown - Only show if user has access */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if (canAccessRoute(userRole, '/admin/analytics')) {
                    return (
                      <SettingsDropdown 
                        menu={analyticsMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}
            
                {/* Email Marketing Dropdown - Only show if user has access */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if (canAccessRoute(userRole, '/admin/email-marketing')) {
                    return (
                      <SettingsDropdown 
                        menu={emailMarketingMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}
            
                {/* Marketing Dropdown - Show for admin and partner (with restrictions) */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if (canAccessRoute(userRole, '/admin/marketing') || canAccessRoute(userRole, '/admin/marketing/affiliate')) {
                    // For partner, filter menu items to only show affiliate
                    const filteredMenu = userRole === 'partner'
                      ? {
                          ...marketingMenu,
                          children: marketingMenu.children.filter((item: any) => 
                            item.href === '/admin/marketing/affiliate'
                          )
                        }
                      : marketingMenu
                    
                    return (
                      <SettingsDropdown 
                        menu={filteredMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}
            
                {/* Subscriptions Dropdown - Show for admin and partner (with restrictions) */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if ((userRole === 'admin' || userRole === 'partner') && canAccessRoute(userRole, '/admin/subscriptions')) {
                    // For partner, filter menu items to only show allowed ones
                    const filteredMenu = userRole === 'partner'
                      ? {
                          ...subscriptionsMenu,
                          children: subscriptionsMenu.children.filter((item: any) => 
                            item.href === '/admin/subscriptions/analytics' || item.href === '/admin/subscriptions'
                          )
                        }
                      : subscriptionsMenu
                    
                    return (
                      <SettingsDropdown 
                        menu={filteredMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}

                {/* Promos & Upsells Dropdown - Show for admin and partner (with restrictions) */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if (canAccessRoute(userRole, '/admin/promos-upsells') || canAccessRoute(userRole, '/admin/promotions')) {
                    // For partner, filter menu items to only show allowed ones
                    const filteredMenu = userRole === 'partner'
                      ? {
                          ...promosUpsellsMenu,
                          children: promosUpsellsMenu.children.filter((item: any) => 
                            item.href === '/admin/promos-upsells' || item.href === '/admin/promotions'
                          )
                        }
                      : promosUpsellsMenu
                    
                    return (
                      <SettingsDropdown 
                        menu={filteredMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}
                
                {/* Settings Dropdown - Only show for admin */}
                {(() => {
                  const userRole = user?.role as UserRole
                  if (userRole === 'admin' && canAccessRoute(userRole, '/admin/settings')) {
                    return (
                      <SettingsDropdown 
                        menu={settingsMenu} 
                        pathname={pathname}
                        onItemClick={() => setSidebarOpen(false)}
                        hideIcons={hideIcons}
                      />
                    )
                  }
                  return null
                })()}
          </nav>

          {/* User section */}
          {!hideIcons && (
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center gap-3 px-3 py-2">
                {user?.avatarUrl ? (
                  <div className="relative h-8 w-8 overflow-hidden rounded-full border border-gray-600">
                    <Image
                      src={user.avatarUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                    {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}` 
                      : 'Admin User'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.email || 'admin@brevi.com'}</p>
                </div>
              </div>
              <Link
                href="/admin/profile"
                className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                Profile Settings
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
          {hideIcons && (
            <div className="p-2 border-t border-gray-700 space-y-2">
              <Link
                href="/admin/profile"
                className="flex items-center justify-center p-2 text-gray-400 hover:text-white transition-colors rounded"
                title="Profile Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center w-full p-2 text-gray-400 hover:text-white transition-colors rounded"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-300 ${hideIcons ? "lg:pl-16" : "lg:pl-64"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900">
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <Link
                href="/"
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">View Store</span>
                <span className="sm:hidden">Store</span>
              </Link>
              <NotificationsBell />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
