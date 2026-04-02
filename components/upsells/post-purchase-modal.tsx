'use client'

import { useState, useEffect } from 'react'
import { X, ShoppingCart, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCart } from '@/lib/cart-context'
import { trackUpsellEvent } from '@/app/actions/upsells'
import Image from 'next/image'

interface PostPurchaseUpsellModalProps {
  upsell: {
    id: string
    name: string
    headline?: string
    description?: string
    cta_text?: string
    image_url?: string
    discount_type?: string
    discount_value?: number
    urgency_text?: string
    upsell_products: Array<{product_id: string, variant_id?: string, discount?: number, purchase_type?: 'one-time' | 'subscription' | 'prepaid', frequency?: number}>
    campaign_id?: string
  }
  products: Array<{
    id: string
    title: string
    slug: string
    base_price: number
    product_variants?: Array<{
      id: string
      color: string
      price: number
      image_url?: string
      subscription_products?: Array<{
        id: string
        is_subscription_enabled: boolean
        subscription_price?: number
        prepaid_price?: number
        one_time_price?: number
        available_frequencies?: number[]
        shipping_days?: number
      }>
    }>
  }>
  orderValue?: number
  onClose: () => void
}

export function PostPurchaseUpsellModal({ upsell, products, orderValue, onClose }: PostPurchaseUpsellModalProps) {
  const { addItem } = useCart()
  const [adding, setAdding] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Track view
    trackUpsellEvent({
      campaign_id: upsell.campaign_id,
      upsell_type: 'post_purchase',
      upsell_id: upsell.id,
      event_type: 'view',
      session_id: sessionId,
      cart_value: orderValue,
    })
  }, [])

  const handleAddToOrder = async () => {
    setAdding(true)
    
    try {
      // Track click
      await trackUpsellEvent({
        campaign_id: upsell.campaign_id,
        upsell_type: 'post_purchase',
        upsell_id: upsell.id,
        event_type: 'click',
        session_id: sessionId,
        cart_value: orderValue,
      })

      // Add upsell products to cart
      for (const upsellProduct of upsell.upsell_products) {
        const product = products.find(p => p.id === upsellProduct.product_id)
        if (product) {
          const variant = product.product_variants?.find(v => v.id === upsellProduct.variant_id) || product.product_variants?.[0]
          if (variant) {
            // Check if this product has subscription enabled and purchase type is subscription
            const subscriptionProduct = variant.subscription_products?.[0]
            const purchaseType = upsellProduct.purchase_type || 'one-time'
            
            if (purchaseType !== 'one-time' && subscriptionProduct?.is_subscription_enabled) {
              const frequency = upsellProduct.frequency || subscriptionProduct.available_frequencies?.[0] || 1
              const price = purchaseType === 'prepaid' && subscriptionProduct.prepaid_price
                ? parseFloat(subscriptionProduct.prepaid_price.toString())
                : subscriptionProduct.subscription_price
                  ? parseFloat(subscriptionProduct.subscription_price.toString())
                  : parseFloat(variant.price.toString())
              await addItem({
                id: `${variant.id}-${Date.now()}`,
                name: product.title,
                color: variant.color || '',
                quantity: 1,
                price: price,
                originalPrice: parseFloat(variant.price.toString()),
                image: variant.image_url || '/placeholder.jpg',
                variantId: variant.id,
                purchaseType: purchaseType,
                subscriptionId: subscriptionProduct.id,
                frequency: frequency,
                shippingDays: subscriptionProduct.shipping_days,
              })
            } else {
              await addItem({
                id: `${variant.id}-${Date.now()}`,
                name: product.title,
                color: variant.color || '',
                quantity: 1,
                price: parseFloat(variant.price.toString()),
                originalPrice: parseFloat(variant.price.toString()),
                image: variant.image_url || '/placeholder.jpg',
                variantId: variant.id,
              })
            }
          }
        }
      }

      // Track add to cart
      await trackUpsellEvent({
        campaign_id: upsell.campaign_id,
        upsell_type: 'post_purchase',
        upsell_id: upsell.id,
        event_type: 'add_to_cart',
        session_id: sessionId,
        cart_value: orderValue,
      })

      onClose()
    } catch (error) {
      console.error('Error adding upsell to cart:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleDismiss = async () => {
    setDismissed(true)
    await trackUpsellEvent({
      campaign_id: upsell.campaign_id,
      upsell_type: 'post_purchase',
      upsell_id: upsell.id,
      event_type: 'dismiss',
      session_id: sessionId,
      cart_value: orderValue,
    })
    onClose()
  }

  if (dismissed) return null

  const calculatePrice = () => {
    let total = 0
    upsell.upsell_products.forEach(up => {
      const product = products.find(p => p.id === up.product_id)
      if (product) {
        const variant = product.product_variants?.find(v => v.id === up.variant_id) || product.product_variants?.[0]
        if (variant) {
          const purchaseType = up.purchase_type || 'one-time'
          const subscriptionProduct = variant.subscription_products?.[0]
          
          let price = parseFloat(variant.price.toString())
          // Use subscription price if applicable
          if (purchaseType !== 'one-time' && subscriptionProduct?.is_subscription_enabled) {
            if (purchaseType === 'prepaid' && subscriptionProduct.prepaid_price) {
              price = parseFloat(subscriptionProduct.prepaid_price.toString())
            } else if (subscriptionProduct.subscription_price) {
              price = parseFloat(subscriptionProduct.subscription_price.toString())
            }
          }
          
          if (upsell.discount_type === 'percentage' && upsell.discount_value) {
            price = price * (1 - upsell.discount_value / 100)
          } else if (upsell.discount_type === 'fixed' && upsell.discount_value) {
            price = price - upsell.discount_value
          }
          total += price
        }
      }
    })
    return total
  }

  const price = calculatePrice()

  return (
    <Dialog open={true} onOpenChange={handleDismiss}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{upsell.headline || upsell.name}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          {upsell.description && (
            <DialogDescription>{upsell.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {upsell.image_url && (
            <div className="relative w-full h-48 rounded-lg overflow-hidden">
              <Image
                src={upsell.image_url}
                alt={upsell.name}
                fill
                className="object-cover"
              />
            </div>
          )}

          {upsell.urgency_text && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-700 font-medium">{upsell.urgency_text}</span>
            </div>
          )}

          <div className="space-y-2">
            <p className="font-semibold">Products:</p>
            {upsell.upsell_products.map((up, index) => {
              const product = products.find(p => p.id === up.product_id)
              return product ? (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span>• {product.title}</span>
                </div>
              ) : null
            })}
          </div>

          {price > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600">${price.toFixed(2)}</p>
              {upsell.discount_type && upsell.discount_value && (
                <p className="text-sm text-gray-500">
                  {upsell.discount_type === 'percentage' 
                    ? `${upsell.discount_value}% OFF` 
                    : `$${upsell.discount_value} OFF`}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleAddToOrder}
              disabled={adding}
              className="flex-1 bg-teal-600 hover:bg-teal-700"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {adding ? 'Adding...' : (upsell.cta_text || 'Add to Order')}
            </Button>
            <Button variant="outline" onClick={handleDismiss}>
              No Thanks
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

