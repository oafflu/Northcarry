"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Package, FileText, Home, ShoppingBag, HelpCircle, Mail, Scale, Repeat } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface LinkOption {
  type: 'page' | 'product' | 'collection' | 'category' | 'subscription'
  label: string
  url: string
  icon: any
}

export function MenuLinkAutocomplete({ 
  value, 
  onChange 
}: { 
  value: string
  onChange: (url: string) => void 
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<LinkOption[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Static pages
  const staticPages: LinkOption[] = [
    { type: 'page', label: 'Home', url: '/', icon: Home },
    { type: 'page', label: 'Shop / Products', url: '/product', icon: ShoppingBag },
    { type: 'page', label: 'About Us', url: '/about', icon: FileText },
    { type: 'page', label: 'Contact', url: '/contact', icon: Mail },
    { type: 'page', label: 'FAQ', url: '/faq', icon: HelpCircle },
    { type: 'page', label: 'Privacy Policy', url: '/privacy', icon: Scale },
    { type: 'page', label: 'Terms of Service', url: '/terms', icon: Scale },
    { type: 'page', label: 'Refund Policy', url: '/refund', icon: Scale },
  ]

  useEffect(() => {
    loadProducts()
    loadSubscriptionProducts()
  }, [])

  useEffect(() => {
    if (searchQuery || showSuggestions) {
      updateSuggestions()
    }
  }, [searchQuery, products, subscriptionProducts])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, title, slug, status')
        .eq('status', 'active')
        .order('title', { ascending: true })
        .limit(50)

      if (data) {
        setProducts(data.map(p => ({
          ...p,
          url: p.slug ? `/product/${p.slug}` : `/product/${p.id}`,
        })))
      }
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadSubscriptionProducts = async () => {
    try {
      const { data } = await supabase
        .from('subscription_products')
        .select(`
          id,
          products!inner(id, title, slug, status)
        `)
        .eq('status', 'active')
        .eq('is_subscription_enabled', true)
        .eq('products.status', 'active')
        .order('created_at', { ascending: false })
        .limit(50)

      if (data) {
        // Group by product to avoid duplicates
        const uniqueProducts = new Map()
        data.forEach((sub: any) => {
          const product = sub.products
          if (product && !uniqueProducts.has(product.id)) {
            uniqueProducts.set(product.id, {
              id: product.id,
              title: product.title,
              slug: product.slug,
              url: product.slug ? `/product/${product.slug}` : `/product/${product.id}`,
            })
          }
        })
        setSubscriptionProducts(Array.from(uniqueProducts.values()))
      }
    } catch (error) {
      console.error('Error loading subscription products:', error)
    }
  }

  const updateSuggestions = () => {
    const query = searchQuery.toLowerCase().trim()
    const allSuggestions: LinkOption[] = []

    // Add static pages
    if (!query || staticPages.some(p => p.label.toLowerCase().includes(query) || p.url.includes(query))) {
      allSuggestions.push(...staticPages)
    }

    // Add products
    const matchingProducts = products
      .filter(p => !query || p.title.toLowerCase().includes(query) || p.slug?.toLowerCase().includes(query))
      .slice(0, 10)
      .map(p => ({
        type: 'product' as const,
        label: p.title,
        url: `/product/${p.slug || p.id}`,
        icon: Package,
      }))

    allSuggestions.push(...matchingProducts)

    // Add subscription products
    const matchingSubscriptionProducts = subscriptionProducts
      .filter(p => !query || p.title.toLowerCase().includes(query) || p.slug?.toLowerCase().includes(query))
      .slice(0, 10)
      .map(p => ({
        type: 'subscription' as const,
        label: `${p.title} (Subscription)`,
        url: `/product/${p.slug || p.id}`,
        icon: Repeat,
      }))

    allSuggestions.push(...matchingSubscriptionProducts)

    // Filter by search query if present
    const filtered = query
      ? allSuggestions.filter(s => 
          s.label.toLowerCase().includes(query) || 
          s.url.toLowerCase().includes(query)
        )
      : allSuggestions

    setSuggestions(filtered.slice(0, 15))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    setShowSuggestions(true)
    onChange(newValue)
  }

  const handleSelect = (option: LinkOption) => {
    onChange(option.url)
    setSearchQuery("")
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  const handleFocus = () => {
    setShowSuggestions(true)
    updateSuggestions()
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder="Search pages, products, or enter URL..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          <div className="p-2">
            {suggestions.map((option, index) => {
              const Icon = option.icon
              return (
                <button
                  key={`${option.type}-${index}`}
                  onClick={() => handleSelect(option)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{option.label}</p>
                    <p className="text-xs text-gray-500 truncate">{option.url}</p>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{option.type}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

