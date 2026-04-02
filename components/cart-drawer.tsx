"use client"

import { X, ShoppingBag, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { PayPalButton } from "@/components/paypal-button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createOrder } from "@/app/actions/checkout"
import { getSetting } from "@/app/actions/settings"
import { CartUpsellWidget } from "@/components/upsells/cart-upsell-widget"

export function CartDrawer() {
  const { items, isDrawerOpen, setIsDrawerOpen, removeItem, updateQuantity, subtotal } = useCart()
  const router = useRouter()
  const [paypalEnabled, setPaypalEnabled] = useState(false)
  const [cartUpsells, setCartUpsells] = useState<any[]>([])
  const [upsellProducts, setUpsellProducts] = useState<any[]>([])

  // Check if PayPal is enabled
  useEffect(() => {
    const checkPayPalEnabled = async () => {
      try {
        const result = await getSetting('paypal')
        if (result.data) {
          const settings = result.data as any
          setPaypalEnabled(settings.enabled === true && !!settings.client_id)
        }
      } catch (error) {
        console.error('Error checking PayPal settings:', error)
        setPaypalEnabled(false)
      }
    }
    checkPayPalEnabled()
  }, [])

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden"
      loadCartUpsells()
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isDrawerOpen, items])

  const loadCartUpsells = async () => {
    if (items.length === 0) return
    
    try {
      const productIds = items.map(item => item.variantId).filter(Boolean).join(',')
      const response = await fetch(`/api/upsells/cart?cart_value=${subtotal}&product_ids=${productIds}`)
      const data = await response.json()
      
      if (data.upsells && data.upsells.length > 0) {
        setCartUpsells(data.upsells)
        
        // Load product data for upsells
        const upsellProductIds = new Set<string>()
        data.upsells.forEach((upsell: any) => {
          upsell.upsell_products?.forEach((up: any) => upsellProductIds.add(up.product_id))
        })
        
        if (upsellProductIds.size > 0) {
          const productsResponse = await fetch(`/api/products?ids=${Array.from(upsellProductIds).join(',')}`)
          const productsData = await productsResponse.json()
          setUpsellProducts(productsData.products || [])
        }
      }
    } catch (error) {
      console.error('Error loading cart upsells:', error)
    }
  }

  if (!isDrawerOpen) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50 transition-opacity" onClick={() => setIsDrawerOpen(false)} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            <h2 className="text-xl font-bold">Your Cart ({items.length})</h2>
          </div>
          <button onClick={() => setIsDrawerOpen(false)} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 border-b pb-4">
                  <Image
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    width={80}
                    height={80}
                    className="rounded object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1">{item.name}</h3>
                    <p className="text-xs text-gray-500 mb-1">Color: {item.color}</p>
                    {(item.purchaseType === 'subscription' || item.purchaseType === 'prepaid') && (
                      <p className="text-xs text-teal-600 font-medium mb-1">
                        {item.purchaseType === 'prepaid' ? 'Prepaid Subscription' : 'Subscription'}
                        {item.frequency && ` • Every ${item.frequency} ${item.frequency === 1 ? 'Month' : 'Months'}`}
                      </p>
                    )}
                    <p className="text-sm mb-2">
                      <span className="font-bold">
                        ${item.price.toFixed(2)}
                        {/* For prepaid subscriptions, price already includes frequency, so this is the total prepaid amount */}
                        {item.purchaseType === 'prepaid' && item.frequency && (
                          <span className="text-xs text-gray-500 font-normal ml-1">
                            (for {item.frequency} {item.frequency === 1 ? 'month' : 'months'})
                          </span>
                        )}
                      </span>
                      {item.originalPrice > item.price && (
                        <span className="text-gray-400 line-through ml-2">${item.originalPrice.toFixed(2)}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="p-1 rounded border border-gray-300 hover:bg-gray-100"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 rounded border border-gray-300 hover:bg-gray-100"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)} 
                    className="text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove item"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Cart Upsells */}
          {cartUpsells.length > 0 && items.length > 0 && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">You might also like:</h3>
              {cartUpsells.map((upsell) => (
                <CartUpsellWidget
                  key={upsell.id}
                  upsell={upsell}
                  products={upsellProducts}
                  cartValue={subtotal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-6 space-y-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            
            {/* PayPal Buy Now Button - Only show if PayPal is enabled */}
            {paypalEnabled && (
              <Button
                onClick={() => {
                  setIsDrawerOpen(false)
                  router.push('/checkout?payment=paypal')
                }}
                className="w-full bg-[#FFC439] hover:bg-[#FFB300] text-[#003087] h-12 text-base font-semibold mb-2 flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path d="M7.076 18.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a.695.695 0 0 0-.679-.796H15.25c-.281 0-.52.21-.56.49l-.647 4.103a.933.933 0 0 0 .92 1.07h3.155c.281 0 .52-.21.56-.49l.647-4.103a.933.933 0 0 0-.92-1.07z" fill="currentColor"/>
                </svg>
                Buy Now with PayPal
              </Button>
            )}
            
            <Link href="/checkout" onClick={() => setIsDrawerOpen(false)}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base">Proceed to Checkout</Button>
            </Link>
            <Button
              variant="outline"
              className="w-full h-12 text-base bg-transparent"
              onClick={() => setIsDrawerOpen(false)}
            >
              Continue Shopping
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
