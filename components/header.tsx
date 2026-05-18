"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ShoppingCart, Menu, X, LogIn, LogOut } from "lucide-react"
import Image from "next/image"
import { useCart } from "@/lib/cart-context"
import { useAuth } from "@/lib/auth-context"
import { getMenuItems, getTopBar, getCMSContent } from "@/app/actions/cms"
import {
  mergeBrandingCMSContent,
  type BrandingCMSContent,
} from "@/lib/branding-cms-defaults"

interface MenuItem {
  id: number
  label: string
  url: string
  order: number
  badge?: {
    text: string
    color: string
    bgColor?: string
    textColor?: string
  }
}

interface TopBarData {
  message: string
  enabled: boolean
  bgColor: string
  textColor: string
}

interface HeaderProps {
  initialMenuItems?: MenuItem[]
  initialTopBar?: TopBarData
  initialBranding?: BrandingCMSContent
}

export function Header({
  initialMenuItems,
  initialTopBar,
  initialBranding,
}: HeaderProps = {}) {
  const { totalItems, setIsDrawerOpen } = useCart()
  const { user, logout, loading: authLoading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Use initial data if provided (server-side), otherwise start with null to prevent flash
  const [menuItems, setMenuItems] = useState<MenuItem[] | null>(
    initialMenuItems || null
  )
  const [topBar, setTopBar] = useState<TopBarData | null>(
    initialTopBar || null
  )
  const [branding, setBranding] = useState<BrandingCMSContent | null>(
    initialBranding || null
  )

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Only load client-side if initial data wasn't provided
  useEffect(() => {
    if (!mounted) return
    
    if (!initialMenuItems) {
      loadMenuItems()
    } else {
      // If we have initial data, set it immediately
      setMenuItems(initialMenuItems)
    }
    
    if (!initialTopBar) {
      loadTopBar()
    } else {
      setTopBar(initialTopBar)
    }

    if (!initialBranding) {
      loadBranding()
    } else {
      setBranding(initialBranding)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  const loadMenuItems = async () => {
    try {
      const result = await getMenuItems()
      if (result.data?.items) {
        const sorted = result.data.items.sort((a: MenuItem, b: MenuItem) => a.order - b.order)
        setMenuItems(sorted)
      } else {
        // If no data, set default to prevent null state
        setMenuItems([
          { id: 1, label: "Home", url: "/", order: 1 },
          { id: 2, label: "Shop Now", url: "/product", order: 2 },
          { id: 3, label: "About Us", url: "#", order: 3 },
        ])
      }
    } catch (error) {
      console.error('Error loading menu items:', error)
      // Set default on error
      setMenuItems([
        { id: 1, label: "Home", url: "/", order: 1 },
        { id: 2, label: "Shop Now", url: "/product", order: 2 },
        { id: 3, label: "About Us", url: "#", order: 3 },
      ])
    }
  }

  const loadBranding = async () => {
    try {
      const result = await getCMSContent("branding")
      setBranding(mergeBrandingCMSContent(result.data))
    } catch (error) {
      console.error("Error loading branding:", error)
      setBranding(mergeBrandingCMSContent(null))
    }
  }

  const loadTopBar = async () => {
    try {
      const result = await getTopBar()
      if (result.data) {
        setTopBar({
          message: result.data.message || "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS",
          enabled: result.data.enabled !== false,
          bgColor: result.data.bgColor || "#000000",
          textColor: result.data.textColor || "#ffffff",
        })
      } else {
        // If no data, set default to prevent null state
        setTopBar({
          message: "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS",
          enabled: false, // Disable by default if no CMS data
          bgColor: "#000000",
          textColor: "#ffffff",
        })
      }
    } catch (error) {
      console.error('Error loading top bar:', error)
      // Set default on error
      setTopBar({
        message: "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS",
        enabled: false,
        bgColor: "#000000",
        textColor: "#ffffff",
      })
    }
  }

  // Don't render until we have data (prevents flash of hardcoded content)
  if (!menuItems || !topBar || !branding) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      {topBar.enabled && (
        <div 
          className="py-2"
          style={{ backgroundColor: topBar.bgColor, color: topBar.textColor }}
        >
          <div className="container mx-auto px-4 text-center">
            <p className="text-xs sm:text-sm font-medium">{topBar.message}</p>
          </div>
        </div>
      )}

      <div className="border-b">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-gray-900 hover:text-gray-600 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center">
              <Image
                src={branding.logo}
                alt={branding.siteName}
                width={140}
                height={50}
                className="h-10 sm:h-12 w-auto"
                priority
              />
            </Link>

            {/* Center Navigation - Hidden on mobile */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm lg:text-base">
              {menuItems?.map((item) => (
                <Link 
                  key={item.id} 
                  href={item.url} 
                  className="flex items-center gap-2 text-gray-900 hover:text-gray-600 transition-colors"
                >
                  <span>{item.label}</span>
                  {item.badge && item.badge.text && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        item.badge.bgColor || getBadgeColorClass(item.badge.color, 'bg')
                      } ${
                        item.badge.textColor || getBadgeColorClass(item.badge.color, 'text')
                      }`}
                      style={{
                        backgroundColor: item.badge.bgColor,
                        color: item.badge.textColor
                      }}
                    >
                      {item.badge.text}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Login/Logout Button */}
              {mounted && !authLoading && (
                <>
                  {user ? (
                    <button
                      onClick={logout}
                      className="p-2 -mr-2 sm:p-0 sm:mr-0 text-gray-900 hover:text-gray-600 transition-colors"
                      aria-label="Logout"
                      title="Logout"
                    >
                      <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="p-2 -mr-2 sm:p-0 sm:mr-0 text-gray-900 hover:text-gray-600 transition-colors"
                      aria-label="Login"
                      title="Login"
                    >
                      <LogIn className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Link>
                  )}
                </>
              )}
              {/* Cart Button */}
              <button onClick={() => setIsDrawerOpen(true)} className="relative p-2 -mr-2 sm:p-0 sm:mr-0">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900" />
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-black text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center font-medium">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Mobile Menu Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:hidden">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-4 border-b">
                <span className="font-bold text-lg">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-600 hover:text-gray-900"
                  aria-label="Close menu"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 px-4 py-6 space-y-2">
                {menuItems?.map((item) => (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span>{item.label}</span>
                    {item.badge && item.badge.text && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          item.badge.bgColor || getBadgeColorClass(item.badge.color, 'bg')
                        } ${
                          item.badge.textColor || getBadgeColorClass(item.badge.color, 'text')
                        }`}
                        style={{
                          backgroundColor: item.badge.bgColor,
                          color: item.badge.textColor
                        }}
                      >
                        {item.badge.text}
                      </span>
                    )}
                  </Link>
                ))}
                
                {/* Login/Logout in Mobile Menu */}
                {mounted && !authLoading && (
                  <div className="border-t pt-4 mt-4">
                    {user ? (
                      <button
                        onClick={() => {
                          logout()
                          setMobileMenuOpen(false)
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                      </button>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <LogIn className="h-5 w-5" />
                        <span>Login</span>
                      </Link>
                    )}
                  </div>
                )}
              </nav>

              {/* Footer */}
              <div className="p-4 border-t">
                <p className="text-xs text-gray-500 text-center">
                  © 2025 BREVI. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}

// Helper function to get badge color classes
function getBadgeColorClass(color: string, type: 'bg' | 'text'): string {
  const colorMap: Record<string, { bg: string; text: string }> = {
    red: { bg: 'bg-red-500', text: 'text-white' },
    green: { bg: 'bg-green-500', text: 'text-white' },
    blue: { bg: 'bg-blue-500', text: 'text-white' },
    orange: { bg: 'bg-orange-500', text: 'text-white' },
    purple: { bg: 'bg-purple-500', text: 'text-white' },
    teal: { bg: 'bg-teal-500', text: 'text-white' },
    yellow: { bg: 'bg-yellow-400', text: 'text-yellow-900' },
    pink: { bg: 'bg-pink-500', text: 'text-white' },
  }
  
  const colors = colorMap[color] || colorMap.red
  return type === 'bg' ? colors.bg : colors.text
}

export default Header
