'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCart } from '@/lib/cart-context'
import { trackUpsellEvent } from '@/app/actions/upsells'
import Image from 'next/image'

interface CartUpsellWidgetProps {
  upsell: {
    id: string
    name: string
    headline?: string
    description?: string
    cta_text?: string
    image_url?: string
    discount_type?: string
    discount_value?: number
    upsell_products: Array<{product_id: string, variant_id?: string, purchase_type?: 'one-time' | 'subscription' | 'prepaid', frequency?: number}>
    position?: string
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
  cartValue: number
}

export function CartUpsellWidget({ upsell, products, cartValue }: CartUpsellWidgetProps) {
  const { addItem } = useCart()
  const [adding, setAdding] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))
  
  // Group upsell products by product_id and track selections
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [selectedPurchaseTypes, setSelectedPurchaseTypes] = useState<Record<string, 'one-time' | 'subscription' | 'prepaid'>>({})
  const [selectedFrequencies, setSelectedFrequencies] = useState<Record<string, number>>({})
  
  // Initialize selections with first variant and default purchase type
  useEffect(() => {
    const groupedProducts = new Map<string, typeof upsell.upsell_products>()
    upsell.upsell_products.forEach(up => {
      if (!groupedProducts.has(up.product_id)) {
        groupedProducts.set(up.product_id, [])
      }
      groupedProducts.get(up.product_id)!.push(up)
    })
    
    const newSelectedVariants: Record<string, string> = {}
    const newSelectedPurchaseTypes: Record<string, 'one-time' | 'subscription' | 'prepaid'> = {}
    const newSelectedFrequencies: Record<string, number> = {}
    
    groupedProducts.forEach((variants, productId) => {
      const product = products.find(p => p.id === productId)
      const firstVariant = variants[0]
      if (firstVariant?.variant_id) {
        newSelectedVariants[productId] = firstVariant.variant_id
      }
      
      // Check if product has subscription
      const variant = product?.product_variants?.find(v => v.id === firstVariant?.variant_id)
      const subscriptionProduct = variant?.subscription_products?.[0]
      
      if (subscriptionProduct?.is_subscription_enabled) {
        newSelectedPurchaseTypes[productId] = 'subscription'
        newSelectedFrequencies[productId] = subscriptionProduct.available_frequencies?.[0] || 1
      } else {
        newSelectedPurchaseTypes[productId] = 'one-time'
      }
    })
    
    setSelectedVariants(newSelectedVariants)
    setSelectedPurchaseTypes(newSelectedPurchaseTypes)
    setSelectedFrequencies(newSelectedFrequencies)
  }, [upsell.upsell_products, products])

  useEffect(() => {
    if (!dismissed) {
      // Track view
      trackUpsellEvent({
        campaign_id: upsell.campaign_id,
        upsell_type: 'cart_upsell',
        upsell_id: upsell.id,
        event_type: 'view',
        session_id: sessionId,
        cart_value: cartValue,
      })
    }
  }, [dismissed, upsell.campaign_id, upsell.id, sessionId, cartValue])

  const handleAddToCart = async () => {
    setAdding(true)
    
    try {
      // Track click
      await trackUpsellEvent({
        campaign_id: upsell.campaign_id,
        upsell_type: 'cart_upsell',
        upsell_id: upsell.id,
        event_type: 'click',
        session_id: sessionId,
        cart_value: cartValue,
      })

      // Group products by product_id and add only selected variants
      const groupedProducts = new Map<string, typeof upsell.upsell_products>()
      upsell.upsell_products.forEach(up => {
        if (!groupedProducts.has(up.product_id)) {
          groupedProducts.set(up.product_id, [])
        }
        groupedProducts.get(up.product_id)!.push(up)
      })

      // Add selected products to cart
      for (const [productId, variants] of groupedProducts) {
        const product = products.find(p => p.id === productId)
        if (!product) continue
        
        const selectedVariantId = selectedVariants[productId]
        const variant = product.product_variants?.find(v => v.id === selectedVariantId)
        if (!variant) continue
        
        const purchaseType = selectedPurchaseTypes[productId] || 'one-time'
        const subscriptionProduct = variant.subscription_products?.[0]
        
        if (purchaseType !== 'one-time' && subscriptionProduct?.is_subscription_enabled) {
          const frequency = selectedFrequencies[productId] || subscriptionProduct.available_frequencies?.[0] || 1
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

      // Track add to cart
      await trackUpsellEvent({
        campaign_id: upsell.campaign_id,
        upsell_type: 'cart_upsell',
        upsell_id: upsell.id,
        event_type: 'add_to_cart',
        session_id: sessionId,
        cart_value: cartValue,
      })
    } catch (error) {
      console.error('Error adding cart upsell:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleDismiss = async () => {
    setDismissed(true)
    await trackUpsellEvent({
      campaign_id: upsell.campaign_id,
      upsell_type: 'cart_upsell',
      upsell_id: upsell.id,
      event_type: 'dismiss',
      session_id: sessionId,
      cart_value: cartValue,
    })
  }

  if (dismissed) return null

  const calculatePrice = () => {
    let total = 0
    
    // Group products by product_id and calculate price for selected variant
    const groupedProducts = new Map<string, typeof upsell.upsell_products>()
    upsell.upsell_products.forEach(up => {
      if (!groupedProducts.has(up.product_id)) {
        groupedProducts.set(up.product_id, [])
      }
      groupedProducts.get(up.product_id)!.push(up)
    })
    
    groupedProducts.forEach((variants, productId) => {
      const product = products.find(p => p.id === productId)
      if (!product) return
      
      const selectedVariantId = selectedVariants[productId]
      const variant = product.product_variants?.find(v => v.id === selectedVariantId)
      if (!variant) return
      
      const purchaseType = selectedPurchaseTypes[productId] || 'one-time'
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
    })
    
    return total
  }

  const price = calculatePrice()
  
  // Group products by product_id for display
  const groupedProducts = new Map<string, { product: typeof products[0], variants: typeof upsell.upsell_products }>()
  upsell.upsell_products.forEach(up => {
    const product = products.find(p => p.id === up.product_id)
    if (!product) return
    
    if (!groupedProducts.has(up.product_id)) {
      groupedProducts.set(up.product_id, { product, variants: [] })
    }
    groupedProducts.get(up.product_id)!.variants.push(up)
  })

  return (
    <Card className="border-teal-200 bg-teal-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {upsell.image_url && (
            <div className="w-20 h-20 relative rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={upsell.image_url}
                alt={upsell.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-gray-900">{upsell.headline || upsell.name}</h4>
                {upsell.description && (
                  <p className="text-sm text-gray-600 mt-1">{upsell.description}</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Product selection dropdowns */}
            <div className="space-y-3 mb-3">
              {Array.from(groupedProducts.entries()).map(([productId, { product, variants }]) => {
                const availableVariants = product.product_variants?.filter(v => 
                  variants.some(up => up.variant_id === v.id)
                ) || []
                const selectedVariant = availableVariants.find(v => v.id === selectedVariants[productId])
                const subscriptionProduct = selectedVariant?.subscription_products?.[0]
                const hasSubscription = subscriptionProduct?.is_subscription_enabled
                
                return (
                  <div key={productId} className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{product.title}</label>
                    
                    {/* Variant Selection */}
                    {availableVariants.length > 1 && (
                      <select
                        value={selectedVariants[productId] || ''}
                        onChange={(e) => {
                          setSelectedVariants({ ...selectedVariants, [productId]: e.target.value })
                          // Reset purchase type and frequency when variant changes
                          const newVariant = availableVariants.find(v => v.id === e.target.value)
                          const newSubProduct = newVariant?.subscription_products?.[0]
                          if (newSubProduct?.is_subscription_enabled) {
                            setSelectedPurchaseTypes({ ...selectedPurchaseTypes, [productId]: 'subscription' })
                            setSelectedFrequencies({ ...selectedFrequencies, [productId]: newSubProduct.available_frequencies?.[0] || 1 })
                          } else {
                            setSelectedPurchaseTypes({ ...selectedPurchaseTypes, [productId]: 'one-time' })
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {availableVariants.map(variant => (
                          <option key={variant.id} value={variant.id}>
                            {variant.color || 'Default'} - ${parseFloat(variant.price.toString()).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    )}
                    
                    {/* Purchase Type Selection (for subscription products) */}
                    {hasSubscription && (
                      <select
                        value={selectedPurchaseTypes[productId] || 'one-time'}
                        onChange={(e) => {
                          setSelectedPurchaseTypes({ ...selectedPurchaseTypes, [productId]: e.target.value as 'one-time' | 'subscription' | 'prepaid' })
                          if (e.target.value !== 'one-time' && subscriptionProduct?.available_frequencies?.[0]) {
                            setSelectedFrequencies({ ...selectedFrequencies, [productId]: subscriptionProduct.available_frequencies[0] })
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="one-time">One-time Purchase</option>
                        {subscriptionProduct?.subscription_price && (
                          <option value="subscription">Subscribe (${parseFloat(subscriptionProduct.subscription_price.toString()).toFixed(2)}/delivery)</option>
                        )}
                        {subscriptionProduct?.prepaid_price && (
                          <option value="prepaid">Prepay (${parseFloat(subscriptionProduct.prepaid_price.toString()).toFixed(2)})</option>
                        )}
                      </select>
                    )}
                    
                    {/* Frequency Selection (for subscription/prepaid) */}
                    {hasSubscription && selectedPurchaseTypes[productId] !== 'one-time' && subscriptionProduct?.available_frequencies && subscriptionProduct.available_frequencies.length > 1 && (
                      <select
                        value={selectedFrequencies[productId] || subscriptionProduct.available_frequencies[0]}
                        onChange={(e) => setSelectedFrequencies({ ...selectedFrequencies, [productId]: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        {subscriptionProduct.available_frequencies.map(freq => (
                          <option key={freq} value={freq}>
                            Every {freq} month{freq !== 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
            
            {price > 0 && (
              <div className="mb-3">
                <span className="text-lg font-bold text-teal-600">${price.toFixed(2)}</span>
                {upsell.discount_type && upsell.discount_value && (
                  <span className="text-sm text-gray-500 ml-2">
                    {upsell.discount_type === 'percentage' 
                      ? `${upsell.discount_value}% OFF` 
                      : `$${upsell.discount_value} OFF`}
                  </span>
                )}
              </div>
            )}

            <Button
              onClick={handleAddToCart}
              disabled={adding}
              size="sm"
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {adding ? 'Adding...' : (upsell.cta_text || 'Add to Cart')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

