"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { addToCart, removeFromCart, updateCartItemQuantity, getCart, clearCart as clearCartAction } from "@/app/actions/cart"
import { useRouter } from "next/navigation"

export interface CartItem {
  id: string
  name: string
  color: string
  quantity: number
  price: number
  originalPrice: number
  image: string
  variantId?: string // Internal: variant ID from database
  cartItemId?: string // Internal: cart item ID from database
  // Subscription fields
  purchaseType?: 'one-time' | 'subscription' | 'prepaid'
  subscriptionId?: string
  frequency?: number
  prepaidCycles?: number
  shippingDays?: number
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => Promise<void>
  removeItem: (id: string) => Promise<void>
  updateQuantity: (id: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  totalItems: number
  subtotal: number
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  showNotification: boolean
  setShowNotification: (show: boolean) => void
  loading: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  
  // Memoize router to prevent recreation
  const router = useRouter()
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load cart from database on mount
  useEffect(() => {
    // Don't run until mounted to prevent hydration issues
    if (!mounted) return
    
    const loadCart = async () => {
      try {
        const { data } = await getCart()
        if (data) {
          const mappedItems: CartItem[] = data.map((item: any) => {
            const variant = item.product_variants
            const product = variant?.products
            const subscriptionProduct = item.subscription_products
            const purchaseType = item.purchase_type || 'one-time'
            
            // Determine price based on purchase type
            let price = parseFloat(variant?.price || 0)
            let originalPrice = parseFloat(product?.base_price || variant?.price || 0)
            
            // For subscription items, use subscription price
            if ((purchaseType === 'subscription' || purchaseType === 'prepaid') && subscriptionProduct) {
              if (purchaseType === 'prepaid' && subscriptionProduct.prepaid_price) {
                const prepaidPricePerCycle = parseFloat(subscriptionProduct.prepaid_price.toString())
                  const prepaidCycles = item.prepaid_cycles || 1
                  // For prepaid subscriptions, show total upfront amount (price per cycle * cycles).
                  price = prepaidPricePerCycle * prepaidCycles
              } else if (subscriptionProduct.subscription_price) {
                price = parseFloat(subscriptionProduct.subscription_price.toString())
              }
              // Use one_time_price or base_price as original price for comparison
              originalPrice = parseFloat(
                (subscriptionProduct.one_time_price || product?.base_price || variant?.price || 0).toString()
              )
            }
            
            return {
              id: `${variant?.color}-${item.id}`,
              cartItemId: item.id,
              variantId: variant?.id,
              name: product?.title || 'Product',
              color: variant?.color?.toUpperCase() || '',
              quantity: item.quantity,
              price: price,
              originalPrice: originalPrice,
              image: variant?.image_url || '/placeholder.jpg',
              // Subscription metadata
              purchaseType: purchaseType,
              subscriptionId: item.subscription_product_id,
              frequency: item.frequency_months,
              prepaidCycles: item.prepaid_cycles,
              shippingDays: item.shipping_days,
            }
          })
          setItems(mappedItems)
        }
      } catch (error) {
        console.error('Error loading cart:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCart()
  }, [mounted])

  const addItem = async (newItem: CartItem) => {
    // If variantId is provided, use it; otherwise we need to find it
    // For now, we'll use optimistic update and sync with server
    if (newItem.variantId) {
      try {
        // Prepare subscription metadata if this is a subscription item
        const subscriptionMetadata = (newItem.purchaseType === 'subscription' || newItem.purchaseType === 'prepaid') && newItem.subscriptionId
          ? {
              purchaseType: newItem.purchaseType === 'prepaid' ? 'prepaid' : 'subscription',
              subscriptionProductId: newItem.subscriptionId,
              frequencyMonths: newItem.frequency,
              prepaidCycles: newItem.prepaidCycles,
              shippingDays: newItem.shippingDays,
            }
          : undefined

        const result = await addToCart(newItem.variantId, newItem.quantity, subscriptionMetadata)
        if (result.success) {
          // Reload cart from server
          const { data } = await getCart()
          if (data) {
            const mappedItems: CartItem[] = data.map((item: any) => {
              const variant = item.product_variants
              const product = variant?.products
              const subscriptionProduct = item.subscription_products
              const purchaseType = item.purchase_type || 'one-time'
              
              // Determine price based on purchase type
              let price = parseFloat(variant?.price || 0)
              let originalPrice = parseFloat(product?.base_price || variant?.price || 0)
              
              // For subscription items, use subscription price
              if ((purchaseType === 'subscription' || purchaseType === 'prepaid') && subscriptionProduct) {
                if (purchaseType === 'prepaid' && subscriptionProduct.prepaid_price) {
                  const prepaidPricePerCycle = parseFloat(subscriptionProduct.prepaid_price.toString())
                  const prepaidCycles = item.prepaid_cycles || 1
                  price = prepaidPricePerCycle * prepaidCycles
                } else if (subscriptionProduct.subscription_price) {
                  price = parseFloat(subscriptionProduct.subscription_price.toString())
                }
                // Use one_time_price or base_price as original price for comparison
                originalPrice = parseFloat(
                  (subscriptionProduct.one_time_price || product?.base_price || variant?.price || 0).toString()
                )
              }
              
              return {
                id: `${variant?.color}-${item.id}`,
                cartItemId: item.id,
                variantId: variant?.id,
                name: product?.title || 'Product',
                color: variant?.color?.toUpperCase() || '',
                quantity: item.quantity,
                price: price,
                originalPrice: originalPrice,
                image: variant?.image_url || '/placeholder.jpg',
                // Preserve subscription metadata from database
                purchaseType: purchaseType,
                subscriptionId: item.subscription_product_id,
                frequency: item.frequency_months,
                prepaidCycles: item.prepaid_cycles,
                shippingDays: item.shipping_days,
              }
            })
            setItems(mappedItems)
          }
          setShowNotification(true)
          setTimeout(() => setShowNotification(false), 3000)
          setIsDrawerOpen(true)
          router.refresh()
        } else {
          console.error('Failed to add to cart:', result.error)
          alert(result.error || 'Failed to add item to cart')
        }
      } catch (error) {
        console.error('Error adding to cart:', error)
        alert('An error occurred while adding item to cart')
      }
    } else {
      // Fallback to local state if variantId not available (for backward compatibility)
      setItems((currentItems) => {
        const existingItem = currentItems.find((item) => item.id === newItem.id && item.color === newItem.color)

        if (existingItem) {
          return currentItems.map((item) =>
            item.id === newItem.id && item.color === newItem.color
              ? { ...item, quantity: item.quantity + newItem.quantity }
              : item,
          )
        }

        return [...currentItems, newItem]
      })
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
      setIsDrawerOpen(true)
    }
  }

  const removeItem = async (id: string) => {
    const item = items.find((item) => item.id === id)
    if (item?.cartItemId) {
      const result = await removeFromCart(item.cartItemId)
      if (result.success) {
        setItems((currentItems) => currentItems.filter((item) => item.id !== id))
        router.refresh()
      }
    } else {
      setItems((currentItems) => currentItems.filter((item) => item.id !== id))
    }
  }

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return
    
    const item = items.find((item) => item.id === id)
    if (item?.cartItemId) {
      const result = await updateCartItemQuantity(item.cartItemId, quantity)
      if (result.success) {
        setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, quantity } : item)))
        router.refresh()
      }
    } else {
      setItems((currentItems) => currentItems.map((item) => (item.id === id ? { ...item, quantity } : item)))
    }
  }

  const clearCart = async () => {
    const result = await clearCartAction()
    if (result.success) {
      setItems([])
      router.refresh()
    }
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  // For prepaid items, `price` is already the per-line upfront amount (all cycles) for qty=1.
  // Multiplying by `quantity` still yields the correct line total.
  const subtotal = items.reduce((sum, item) => {
    return sum + item.price * item.quantity
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        isDrawerOpen,
        setIsDrawerOpen,
        showNotification,
        setShowNotification,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }
  return context
}
