'use client'

import { useState, useEffect } from 'react'
import { Package, ShoppingCart, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCart } from '@/lib/cart-context'
import { trackUpsellEvent } from '@/app/actions/upsells'
import Image from 'next/image'

interface ProductBundleProps {
  bundle: {
    id: string
    name: string
    description?: string
    bundle_type: string
    main_products: Array<{product_id: string, variant_id?: string, quantity: number, purchase_type?: 'one-time' | 'subscription' | 'prepaid', frequency?: number}>
    bonus_products?: Array<{product_id: string, variant_id?: string, quantity: number, discount?: number, purchase_type?: 'one-time' | 'subscription' | 'prepaid', frequency?: number}>
    discount_type?: string
    discount_value?: number
    bundle_price?: number
    badge_text?: string
    image_url?: string
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
}

export function ProductBundle({ bundle, products }: ProductBundleProps) {
  const { addItem } = useCart()
  const [adding, setAdding] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    // Track view
    trackUpsellEvent({
      campaign_id: bundle.campaign_id,
      upsell_type: 'bundle',
      upsell_id: bundle.id,
      event_type: 'view',
      session_id: sessionId,
    })
  }, [])

  const handleAddBundle = async () => {
    setAdding(true)
    
    try {
      // Track click
      await trackUpsellEvent({
        campaign_id: bundle.campaign_id,
        upsell_type: 'bundle',
        upsell_id: bundle.id,
        event_type: 'click',
        session_id: sessionId,
      })

      // Add main products to cart
      for (const mainProduct of bundle.main_products) {
        const product = products.find(p => p.id === mainProduct.product_id)
        if (product) {
          const variant = product.product_variants?.find(v => v.id === mainProduct.variant_id) || product.product_variants?.[0]
          if (variant) {
            // Check if this product has subscription enabled and purchase type is subscription
            const subscriptionProduct = variant.subscription_products?.[0]
            const purchaseType = mainProduct.purchase_type || 'one-time'
            
            if (purchaseType !== 'one-time' && subscriptionProduct?.is_subscription_enabled) {
              const frequency = mainProduct.frequency || subscriptionProduct.available_frequencies?.[0] || 1
              const price = purchaseType === 'prepaid' && subscriptionProduct.prepaid_price
                ? parseFloat(subscriptionProduct.prepaid_price.toString())
                : subscriptionProduct.subscription_price
                  ? parseFloat(subscriptionProduct.subscription_price.toString())
                  : parseFloat(variant.price.toString())
              await addItem({
                id: `${variant.id}-${Date.now()}`,
                name: product.title,
                color: variant.color || '',
                quantity: mainProduct.quantity,
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
                quantity: mainProduct.quantity,
                price: parseFloat(variant.price.toString()),
                originalPrice: parseFloat(variant.price.toString()),
                image: variant.image_url || '/placeholder.jpg',
                variantId: variant.id,
              })
            }
          }
        }
      }

      // Add bonus products to cart
      if (bundle.bonus_products) {
        for (const bonusProduct of bundle.bonus_products) {
          const product = products.find(p => p.id === bonusProduct.product_id)
          if (product) {
            const variant = product.product_variants?.find(v => v.id === bonusProduct.variant_id) || product.product_variants?.[0]
            if (variant) {
              // Check if this product has subscription enabled and purchase type is subscription
              const subscriptionProduct = variant.subscription_products?.[0]
              const purchaseType = bonusProduct.purchase_type || 'one-time'
              
              if (purchaseType !== 'one-time' && subscriptionProduct?.is_subscription_enabled) {
                const frequency = bonusProduct.frequency || subscriptionProduct.available_frequencies?.[0] || 1
                const price = purchaseType === 'prepaid' && subscriptionProduct.prepaid_price
                  ? parseFloat(subscriptionProduct.prepaid_price.toString())
                  : subscriptionProduct.subscription_price
                    ? parseFloat(subscriptionProduct.subscription_price.toString())
                    : parseFloat(variant.price.toString())
                await addItem({
                  id: `${variant.id}-${Date.now()}`,
                  name: product.title,
                  color: variant.color || '',
                  quantity: bonusProduct.quantity,
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
                  quantity: bonusProduct.quantity,
                  price: parseFloat(variant.price.toString()),
                  originalPrice: parseFloat(variant.price.toString()),
                  image: variant.image_url || '/placeholder.jpg',
                  variantId: variant.id,
                })
              }
            }
          }
        }
      }

      // Track add to cart
      await trackUpsellEvent({
        campaign_id: bundle.campaign_id,
        upsell_type: 'bundle',
        upsell_id: bundle.id,
        event_type: 'add_to_cart',
        session_id: sessionId,
      })
    } catch (error) {
      console.error('Error adding bundle to cart:', error)
    } finally {
      setAdding(false)
    }
  }

  const calculateSavings = () => {
    let totalPrice = 0
    let savings = 0

    // Calculate main products price
    bundle.main_products.forEach(mp => {
      const product = products.find(p => p.id === mp.product_id)
      if (product) {
        const variant = product.product_variants?.find(v => v.id === mp.variant_id) || product.product_variants?.[0]
        if (variant) {
          const purchaseType = mp.purchase_type || 'one-time'
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
          
          totalPrice += price * mp.quantity
        }
      }
    })

    // Calculate bonus products price
    if (bundle.bonus_products) {
      bundle.bonus_products.forEach(bp => {
        const product = products.find(p => p.id === bp.product_id)
        if (product) {
          const variant = product.product_variants?.find(v => v.id === bp.variant_id) || product.product_variants?.[0]
          if (variant) {
            const purchaseType = bp.purchase_type || 'one-time'
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
            
            if (bundle.discount_type === 'percentage' && bundle.discount_value) {
              savings += (price * (bundle.discount_value / 100)) * bp.quantity
            } else if (bundle.discount_type === 'free') {
              savings += price * bp.quantity
            }
          }
        }
      })
    }

    return { totalPrice, savings }
  }

  const { totalPrice, savings } = calculateSavings()
  const finalPrice = bundle.bundle_price || (totalPrice - savings)

  return (
    <Card className="border-2 border-teal-200 hover:border-teal-400 transition-colors">
      <CardContent className="p-6">
        {bundle.badge_text && (
          <div className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">
            {bundle.badge_text}
          </div>
        )}
        
        <div className="flex items-start gap-4 mb-4">
          {bundle.image_url && (
            <div className="w-24 h-24 relative rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={bundle.image_url}
                alt={bundle.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{bundle.name}</h3>
            {bundle.description && (
              <p className="text-gray-600 text-sm mb-3">{bundle.description}</p>
            )}
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">
                  {bundle.main_products.length} main product{bundle.main_products.length > 1 ? 's' : ''}
                </span>
              </div>
              {bundle.bonus_products && bundle.bonus_products.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-gray-700">
                    {bundle.bonus_products.length} bonus item{bundle.bonus_products.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-3 mb-4">
              {savings > 0 && (
                <span className="text-lg text-gray-400 line-through">
                  ${totalPrice.toFixed(2)}
                </span>
              )}
              <span className="text-2xl font-bold text-teal-600">
                ${finalPrice.toFixed(2)}
              </span>
              {savings > 0 && (
                <span className="text-sm text-green-600 font-semibold">
                  Save ${savings.toFixed(2)}
                </span>
              )}
            </div>

            <Button
              onClick={handleAddBundle}
              disabled={adding}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {adding ? 'Adding...' : 'Add Bundle to Cart'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

