"use client"

import { useState, useMemo, useEffect } from "react"
import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/lib/cart-context"
import { QuantityBreakBadge } from "@/components/upsells/quantity-break-badge"

const defaultColorVariants = [
  { name: "Black", value: "black", color: "#000000", images: ["/placeholder.svg?height=600&width=600"] },
  { name: "White", value: "white", color: "#FFFFFF", images: ["/placeholder.svg?height=600&width=600"] },
  { name: "Green", value: "green", color: "#98D8C8", images: ["/placeholder.svg?height=600&width=600"] },
  { name: "Pink", value: "pink", color: "#F7CAC9", images: ["/placeholder.svg?height=600&width=600"] },
  { name: "Bamboo", value: "bamboo", color: "#D4A574", images: ["/placeholder.svg?height=600&width=600"] },
]

interface ProductHeroProps {
  product?: {
    id: string
    title: string
    base_price: number
    compare_at_price?: number
  }
  variants?: Array<{
    id: string
    color: string
    price: number
    image_url?: string
    color_image_url?: string | null
  }>
  images?: Array<{
    image_url: string
    alt_text?: string
    variant_id?: string | null
    is_primary?: boolean
    sort_order?: number
  }>
  subscriptions?: Array<{
    id: string
    variant_id: string
    one_time_price: number
    subscription_price: number | null
    prepaid_price: number | null
    available_frequencies: number[]
    shipping_days: number
  }>
  subscriptionsByVariant?: Record<string, {
    id: string
    variant_id: string
    one_time_price: number
    subscription_price: number | null
    prepaid_price: number | null
    available_frequencies: number[]
    shipping_days: number
  }>
  linkedSubscriptions?: Array<{
    id: string
    trigger_product_id: string
    trigger_variant_id?: string | null
    subscription_product_id: string
    frequency_months: number
    purchase_type: 'ongoing' | 'prepaid'
    quantity: number
    start_after_months: number
    billing_days_before_delivery: number
    subscription_product?: {
      id: string
      variant_id: string
      subscription_price: number | null
      prepaid_price: number | null
      available_frequencies: number[]
      shipping_days: number
      products?: {
        id: string
        title: string
        slug: string
      }
      product_variants?: {
        id: string
        color: string
        sku: string
        price: number
      }
    }
  }>
  linkedSubscriptionsByVariant?: Record<string | null, Array<{
    id: string
    trigger_product_id: string
    trigger_variant_id?: string | null
    subscription_product_id: string
    frequency_months: number
    purchase_type: 'ongoing' | 'prepaid'
    quantity: number
    start_after_months: number
    billing_days_before_delivery: number
    subscription_product?: {
      id: string
      variant_id: string
      subscription_price: number | null
      prepaid_price: number | null
      available_frequencies: number[]
      shipping_days: number
      products?: {
        id: string
        title: string
        slug: string
      }
      product_variants?: {
        id: string
        color: string
        sku: string
        price: number
      }
    }
  }>>
  inventoryByVariant?: Record<string, {
    quantity_available: number
    quantity_reserved: number
    quantity_committed: number
    reorder_point: number
    status: string
  }>
  reviewCount?: number
  averageRating?: number
  cmsContent?: {
    saleBannerText?: string
    saleBannerEnabled?: boolean
    saleBannerBgColor?: string
    saleBannerTextColor?: string
    showRating?: boolean
    defaultReviewCount?: number
    defaultRating?: number
    paymentIcons?: Array<{ name: string; url: string; alt: string }>
    useVariantImages?: boolean
  }
}

export function ProductHero({ 
  product, 
  variants = [], 
  images = [], 
  subscriptions = [],
  subscriptionsByVariant = {},
  linkedSubscriptions = [],
  linkedSubscriptionsByVariant = {},
  inventoryByVariant = {},
  reviewCount = 233,
  averageRating = 5,
  cmsContent
}: ProductHeroProps) {
  // Build color variants from database or use defaults
  const colorVariants = useMemo(() => {
    // Prepare globally sorted images (primary first, then sort_order)
    // Always ensure primary image is first, then sort by sort_order
    const sortedImages = [...images].sort((a, b) => {
      // Primary images always come first
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      // If both are primary or both are not, sort by sort_order
      return (a.sort_order ?? 999) - (b.sort_order ?? 999)
    })

    if (variants.length > 0) {
      // Filter variants to only show those with available inventory
      const availableVariants = variants.filter((variant: any) => {
        const variantInventory = inventoryByVariant[variant.id]
        // Check supplier inventory first
        if (variantInventory) {
          const available = variantInventory.quantity_available || 0
          const status = variantInventory.status || 'active'
          // Only show variants with active status and available inventory
          return status === 'active' && available > 0
        }
        // Fallback to variant's own inventory_quantity
        const variantQty = variant.inventory_quantity || 0
        return variantQty > 0
      })
      
      return availableVariants.map((variant: any) => {
        // Prefer images explicitly linked to this variant
        const variantSpecificImages = sortedImages
          .filter((img) => img.variant_id === variant.id)
          .map((img) => img.image_url)

        // Fallback to color-matched images via alt_text
        const colorMatchedImages = sortedImages
          .filter((img) => !img.variant_id && img.alt_text && img.alt_text.toLowerCase().includes(variant.color.toLowerCase()))
          .map((img) => img.image_url)

        // Fallback to main gallery images (primary-first order)
        const mainGalleryImages = sortedImages
          .filter((img) => !img.variant_id)
          .map((img) => img.image_url)

        // Map color names to hex values
        const colorMap: Record<string, string> = {
          black: "#000000",
          white: "#FFFFFF",
          green: "#98D8C8",
          pink: "#F7CAC9",
          bamboo: "#D4A574",
        }

        // Build final list with fallbacks
        // Priority: variant-specific images > color-matched images > variant.image_url > main gallery images
        // Remove duplicates while preserving order
        const imageSet = new Set<string>()
        const validVariantImages: string[] = []
        
        // Add variant-specific images first (highest priority)
        variantSpecificImages.forEach(img => {
          if (img && img.trim() && !imageSet.has(img)) {
            imageSet.add(img)
            validVariantImages.push(img)
          }
        })
        
        // Add color-matched images
        colorMatchedImages.forEach(img => {
          if (img && img.trim() && !imageSet.has(img)) {
            imageSet.add(img)
            validVariantImages.push(img)
          }
        })
        
        // Add variant.image_url if not already included
        if (variant.image_url && variant.image_url.trim() && !imageSet.has(variant.image_url)) {
          imageSet.add(variant.image_url)
          validVariantImages.push(variant.image_url)
        }
        
        // Add main gallery images (primary first)
        mainGalleryImages.forEach(img => {
          if (img && img.trim() && !imageSet.has(img)) {
            imageSet.add(img)
            validVariantImages.push(img)
          }
        })

        // Fallback: use primary image from main gallery, or variant image_url, or placeholder
        const fallbackImage = mainGalleryImages[0] || 
          (variant.image_url && variant.image_url.trim() ? variant.image_url : null) ||
          "/placeholder.svg?height=600&width=600"

        return {
          name: variant.color.charAt(0).toUpperCase() + variant.color.slice(1),
          value: variant.color.toLowerCase(),
          color: colorMap[variant.color.toLowerCase()] || "#000000",
          images: validVariantImages.length > 0 ? validVariantImages : [fallbackImage],
          colorImageUrl: variant.color_image_url && variant.color_image_url.trim() ? variant.color_image_url : null, // Separate color selection image
          variantId: variant.id,
          price: variant.price,
        }
      })
    }
    return defaultColorVariants.map((v) => ({ ...v, variantId: undefined, price: 0, colorImageUrl: null }))
  }, [variants, images])

  const productTitle = product?.title || "BREVI™ Nordic-Inspired Premium Nano Toothbrush"
  const basePrice = product ? parseFloat(product.base_price.toString()) : 13.96
  const comparePrice = product?.compare_at_price ? parseFloat(product.compare_at_price.toString()) : basePrice

  const [selectedColor, setSelectedColor] = useState(colorVariants[0])
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [purchaseType, setPurchaseType] = useState<'one-time' | 'subscription' | 'prepaid'>('one-time')
  const [selectedFrequency, setSelectedFrequency] = useState<number | null>(null)
  const [selectedPrepaidCycles, setSelectedPrepaidCycles] = useState<number>(3)
  const { addItem } = useCart()

  // Reset image index when variant changes
  useEffect(() => {
    setSelectedImageIndex(0)
  }, [selectedColor.variantId])

  // Get subscription data for selected variant
  const currentSubscription = selectedColor.variantId 
    ? subscriptionsByVariant[selectedColor.variantId] 
    : null

  // Get linked subscriptions for selected variant (or all variants if none specified)
  const currentLinkedSubscriptions = useMemo(() => {
    if (!selectedColor.variantId) return []
    
    // First check for variant-specific linked subscriptions
    const variantLinked = linkedSubscriptionsByVariant[selectedColor.variantId] || []
    // Then check for all-variants linked subscriptions (null key)
    const allVariantsLinked = linkedSubscriptionsByVariant[null] || []
    
    return [...variantLinked, ...allVariantsLinked]
  }, [selectedColor.variantId, linkedSubscriptionsByVariant])

  // Get the first linked subscription (if any) for display
  const currentLinkedSubscription = currentLinkedSubscriptions[0] || null

  // Auto-select frequency for mandatory linked subscriptions
  useEffect(() => {
    if (currentLinkedSubscription && !currentSubscription && !selectedFrequency) {
      // Use subscription product's available frequencies, or fallback to linked subscription's frequency
      const availableFreqs = currentLinkedSubscription.subscription_product?.available_frequencies
      const freq = availableFreqs && availableFreqs.length > 0 
        ? availableFreqs[0] 
        : (currentLinkedSubscription.frequency_months || 2)
      setSelectedFrequency(freq)
    }
  }, [currentLinkedSubscription, currentSubscription, selectedFrequency])

  // Get inventory data for selected variant
  const currentInventory = selectedColor.variantId 
    ? inventoryByVariant[selectedColor.variantId] 
    : null

  // Calculate inventory level status
  const getInventoryLevel = () => {
    if (!currentInventory) {
      // Fallback to variant's inventory_quantity if no supplier inventory
      const variant = variants.find(v => v.id === selectedColor.variantId)
      const variantQty = (variant as any)?.inventory_quantity || 0
      if (variantQty === 0) return { level: 'Out of Stock', color: 'text-red-600' }
      if (variantQty <= 10) return { level: 'Low Stock', color: 'text-orange-600' }
      return { level: 'In Stock', color: 'text-green-600' }
    }

    const available = currentInventory.quantity_available || 0
    const reorderPoint = currentInventory.reorder_point || 10

    if (available === 0) {
      return { level: 'Out of Stock', color: 'text-red-600' }
    } else if (available <= reorderPoint) {
      return { level: 'Low Stock', color: 'text-orange-600' }
    } else {
      return { level: 'In Stock', color: 'text-green-600' }
    }
  }

  const inventoryStatus = getInventoryLevel()

  // Calculate savings for subscription options (using compare_at_price as base)
  const calculateSavings = (basePrice: number, subscriptionPrice: number) => {
    if (!basePrice || !subscriptionPrice || basePrice <= subscriptionPrice) return 0
    return Math.round(((basePrice - subscriptionPrice) / basePrice) * 100)
  }

  // Calculate savings for one-time purchase (using compare_at_price)
  const calculateOneTimeSavings = () => {
    if (purchaseType !== 'one-time') return 0
    const variantPrice = selectedColor.price || basePrice
    if (!comparePrice || comparePrice <= variantPrice) return 0
    return Math.round(((comparePrice - variantPrice) / comparePrice) * 100)
  }

  const currentImages = selectedColor.images

  // Calculate price based on purchase type
  const getDisplayPrice = () => {
    if (purchaseType === 'one-time') {
      const variantPrice = selectedColor.price || basePrice
      return {
        price: (variantPrice * quantity).toFixed(2),
        originalPrice: (comparePrice * quantity).toFixed(2),
      }
    } else if (currentSubscription && selectedFrequency) {
      const subscriptionPrice = purchaseType === 'prepaid' 
        ? currentSubscription.prepaid_price 
        : currentSubscription.subscription_price
      const cycles = purchaseType === 'prepaid' ? selectedPrepaidCycles : 1
      // Use compare_at_price as the base for savings calculation, fallback to one_time_price
      const basePriceForSavings = comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice)
      return {
        price: subscriptionPrice ? (subscriptionPrice * quantity * cycles).toFixed(2) : '0.00',
        originalPrice: (basePriceForSavings * quantity).toFixed(2),
      }
    }
    return { price: '0.00', originalPrice: '0.00' }
  }

  const { price: totalPrice, originalPrice: totalOriginalPrice } = getDisplayPrice()

  const handleAddToCart = async () => {
    // Validate variant ID is available
    if (!selectedColor.variantId) {
      console.error('Cannot add to cart: variant ID is missing')
      alert('Unable to add item to cart. Please refresh the page and try again.')
      return
    }

    // If there's a linked subscription (mandatory replacement heads), validate frequency is selected
    if (currentLinkedSubscription && !currentSubscription && !selectedFrequency) {
      alert('Please select a delivery frequency for replacement heads subscription.')
      return
    }

    if (purchaseType === 'one-time') {
      const variantPrice = selectedColor.price || basePrice
      
      // If there's a mandatory linked subscription, add both items
      if (currentLinkedSubscription && !currentSubscription && currentLinkedSubscription.subscription_product) {
        const linkedSubProduct = currentLinkedSubscription.subscription_product
        const frequencyToUse = selectedFrequency || currentLinkedSubscription.frequency_months || 2
        
        // Add trigger product as one-time purchase
        await addItem({
          id: `${selectedColor.value}-${Date.now()}`,
          name: productTitle,
          color: selectedColor.name.toUpperCase(),
          quantity: quantity,
          price: variantPrice,
          originalPrice: comparePrice,
          image: currentImages[0],
          variantId: selectedColor.variantId,
          purchaseType: 'one-time',
        })
        
        // Add linked subscription product as subscription
        const subscriptionPrice = linkedSubProduct.subscription_price || 0
        if (subscriptionPrice > 0) {
          await addItem({
            id: `${selectedColor.value}-linked-sub-${Date.now()}`,
            name: linkedSubProduct.products?.title || 'Replacement Heads',
            color: linkedSubProduct.product_variants?.color?.toUpperCase() || '',
            quantity: currentLinkedSubscription.quantity || 1,
            price: subscriptionPrice,
            originalPrice: linkedSubProduct.product_variants?.price || subscriptionPrice,
            image: currentImages[0], // Use trigger product image
            variantId: linkedSubProduct.product_variants?.id || '',
            purchaseType: 'subscription',
            subscriptionId: linkedSubProduct.id,
            frequency: frequencyToUse,
            shippingDays: linkedSubProduct.shipping_days || 14,
          })
        }
      } else {
        // Regular one-time purchase without linked subscription
        await addItem({
          id: `${selectedColor.value}-${Date.now()}`,
          name: productTitle,
          color: selectedColor.name.toUpperCase(),
          quantity: quantity,
          price: variantPrice,
          originalPrice: comparePrice,
          image: currentImages[0],
          variantId: selectedColor.variantId,
          purchaseType: 'one-time',
        })
      }
    } else if (currentSubscription) {
      // For subscriptions, ensure frequency is set
      // If only one frequency is available, use it automatically
      const frequencyToUse = selectedFrequency || currentSubscription.available_frequencies[0] || 1
      
      if (!frequencyToUse) {
        alert('Please select a delivery frequency for your subscription.')
        return
      }
      
      // For subscriptions, add to cart with subscription metadata
      const subscriptionPrice = purchaseType === 'prepaid' 
        ? currentSubscription.prepaid_price 
        : currentSubscription.subscription_price
      
      if (!subscriptionPrice) {
        alert('Subscription price not available. Please try again.')
        return
      }
      
      await addItem({
        id: `${selectedColor.value}-sub-${Date.now()}`,
        name: productTitle,
        color: selectedColor.name.toUpperCase(),
        quantity: quantity,
        price: subscriptionPrice,
        originalPrice: comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
        image: currentImages[0],
        variantId: selectedColor.variantId,
        purchaseType: purchaseType,
        subscriptionId: currentSubscription.id,
        frequency: frequencyToUse,
        prepaidCycles: purchaseType === 'prepaid' ? selectedPrepaidCycles : undefined,
        shippingDays: currentSubscription.shipping_days,
      })
    } else if (currentLinkedSubscription && currentLinkedSubscription.subscription_product) {
      // Handle linked subscription - add trigger product with subscription metadata
      const linkedSubProduct = currentLinkedSubscription.subscription_product
      const frequencyToUse = selectedFrequency || currentLinkedSubscription.frequency_months || 2
      
      if (!frequencyToUse) {
        alert('Please select a delivery frequency for your subscription.')
        return
      }
      
      const subscriptionPrice = purchaseType === 'prepaid' 
        ? linkedSubProduct.prepaid_price 
        : linkedSubProduct.subscription_price
      
      if (!subscriptionPrice) {
        alert('Subscription price not available. Please try again.')
        return
      }
      
      await addItem({
        id: `${selectedColor.value}-linked-sub-${Date.now()}`,
        name: productTitle,
        color: selectedColor.name.toUpperCase(),
        quantity: quantity,
        price: subscriptionPrice,
        originalPrice: selectedColor.price || basePrice,
        image: currentImages[0],
        variantId: selectedColor.variantId,
        purchaseType: purchaseType,
        subscriptionId: linkedSubProduct.id,
        frequency: frequencyToUse,
        shippingDays: linkedSubProduct.shipping_days,
      })
    } else {
      alert('Subscription option is not available for this product variant.')
    }
  }

  return (
    <section className="py-4 sm:py-8 md:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4 sm:mb-6 text-xs sm:text-sm text-gray-500">
          <span>Home</span>
          <span className="mx-1 sm:mx-2">›</span>
          <span>Products</span>
          <span className="mx-1 sm:mx-2">›</span>
          <span className="text-gray-900 truncate">{productTitle}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden">
              <Image
                src={currentImages[selectedImageIndex] && currentImages[selectedImageIndex].trim() ? currentImages[selectedImageIndex] : "/placeholder.svg"}
                alt="Product Image"
                fill
                className="object-contain p-8"
              />
            </div>

            {/* Thumbnail Images */}
            <div className="grid grid-cols-4 gap-3">
              {currentImages.map((image, index) => {
                const imageSrc = image && image.trim() ? image : "/placeholder.svg"
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative aspect-square bg-gray-50 rounded-lg overflow-hidden border-2 ${
                      selectedImageIndex === index ? "border-black" : "border-transparent"
                    }`}
                  >
                    <Image
                      src={imageSrc}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-contain p-2"
                    />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-4 sm:space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3">{productTitle}</h1>

              {/* Rating */}
              {cmsContent?.showRating !== false && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>{i < Math.floor(averageRating) ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">({reviewCount})</span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl font-bold">${totalPrice}</span>
                {parseFloat(totalPrice) < parseFloat(totalOriginalPrice) && (
                  <>
                    <span className="text-xl text-gray-400 line-through">${totalOriginalPrice}</span>
                    {purchaseType === 'one-time' && calculateOneTimeSavings() > 0 && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                        Save {calculateOneTimeSavings()}%
                      </span>
                    )}
                  </>
                )}
                {(purchaseType === 'subscription' || purchaseType === 'prepaid') && currentSubscription && selectedFrequency && (
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                    Save {calculateSavings(
                      comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
                      purchaseType === 'prepaid' ? currentSubscription.prepaid_price! : currentSubscription.subscription_price!
                    )}%
                  </span>
                )}
                {/* Quantity Break Badge */}
                {selectedColor.variantId && (
                  <QuantityBreakBadge
                    productId={product.id}
                    variantId={selectedColor.variantId}
                    quantity={quantity}
                  />
                )}
              </div>

              {/* Sale Banner */}
              {cmsContent?.saleBannerEnabled !== false && (
                <div 
                  className="px-4 py-2 rounded-lg inline-block mb-6"
                  style={{ 
                    backgroundColor: cmsContent?.saleBannerBgColor || '#3B82F6',
                    color: cmsContent?.saleBannerTextColor || '#FFFFFF'
                  }}
                >
                  <span className="font-bold">
                    {(() => {
                      // Dynamic savings (always prefer dynamic discount if available)
                      let savings = 0
                      if (purchaseType === 'one-time') {
                        savings = calculateOneTimeSavings()
                      } else if ((purchaseType === 'subscription' || purchaseType === 'prepaid') && currentSubscription && selectedFrequency) {
                        const subscriptionPrice = purchaseType === 'prepaid' ? currentSubscription.prepaid_price! : currentSubscription.subscription_price!
                        const baseForSavings = comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice)
                        savings = calculateSavings(baseForSavings, subscriptionPrice)
                      }

                      // If we have a meaningful savings, show full text with discount
                      if (savings > 0) {
                        return `${savings}% OFF FOR LIMITED TIME`
                      }

                      // Otherwise fall back to CMS text or generic
                      return cmsContent?.saleBannerText || 'On Sale'
                    })()}
                  </span>
                </div>
              )}
            </div>

                {/* Purchase Type Selection */}
            {(currentSubscription || currentLinkedSubscription) && (
              <div className="mb-4 sm:mb-6">
                {currentSubscription && (
                  <>
                    <label className="block text-sm font-medium mb-2 sm:mb-3">Purchase Option:</label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          setPurchaseType('one-time')
                          setSelectedFrequency(null)
                        }}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                          purchaseType === 'one-time'
                            ? "border-black bg-gray-50"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <div className="font-bold text-sm">One-Time</div>
                        <div className="text-xs text-gray-600 mt-1">
                          ${(selectedColor.price || basePrice).toFixed(2)}
                        </div>
                      </button>
                      {currentSubscription?.subscription_price && (
                    <button
                      onClick={() => {
                        setPurchaseType('subscription')
                        const sub = currentSubscription || currentLinkedSubscription?.subscription_product
                        const frequencies = currentSubscription?.available_frequencies || (currentLinkedSubscription ? [currentLinkedSubscription.frequency_months] : [])
                        setSelectedFrequency(frequencies[0] || null)
                      }}
                      className={`p-3 border-2 rounded-lg text-center transition-all ${
                        purchaseType === 'subscription'
                          ? "border-black bg-gray-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="font-bold text-sm">Subscribe</div>
                      <div className="text-xs text-gray-600 mt-1">
                        ${(currentSubscription?.subscription_price || currentLinkedSubscription?.subscription_product?.subscription_price || 0).toFixed(2)}
                      </div>
                      {currentSubscription && calculateSavings(
                        comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
                        currentSubscription.subscription_price!
                      ) > 0 && (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          Save {calculateSavings(
                            comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
                            currentSubscription.subscription_price!
                          )}%
                        </div>
                      )}
                      {currentLinkedSubscription && !currentSubscription && (
                        <div className="text-xs text-gray-500 mt-1">
                          {currentLinkedSubscription.subscription_product?.products?.title || 'Auto-renewal'}
                        </div>
                      )}
                      </button>
                    )}
                    {currentSubscription?.prepaid_price && (
                      <button
                        onClick={() => {
                          setPurchaseType('prepaid')
                          const frequencies = currentSubscription.available_frequencies || []
                          setSelectedFrequency(frequencies[0] || null)
                        }}
                        className={`p-3 border-2 rounded-lg text-center transition-all ${
                          purchaseType === 'prepaid'
                            ? "border-black bg-gray-50"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        <div className="font-bold text-sm">Prepaid</div>
                        <div className="text-xs text-gray-600 mt-1">
                          ${currentSubscription.prepaid_price.toFixed(2)}
                        </div>
                        {calculateSavings(
                          comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
                          currentSubscription.prepaid_price!
                        ) > 0 && (
                          <div className="text-xs text-green-600 font-medium mt-1">
                            Save {calculateSavings(
                              comparePrice > basePrice ? comparePrice : (currentSubscription.one_time_price || basePrice),
                              currentSubscription.prepaid_price!
                            )}%
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                    <div
                      className="mt-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 sm:px-4 sm:py-3"
                      role="note"
                    >
                      <p className="text-[11px] sm:text-xs font-medium text-gray-800 mb-1.5">
                        What these options mean
                      </p>
                      <ul className="text-[11px] sm:text-xs text-gray-600 space-y-1.5 list-none">
                        <li>
                          <span className="font-semibold text-gray-800">One-Time — </span>
                          Single purchase today. No subscription or automatic refills.
                        </li>
                        {currentSubscription?.subscription_price && (
                          <li>
                            <span className="font-semibold text-gray-800">Subscribe — </span>
                            Recurring deliveries on the schedule you choose. You are billed each
                            cycle at the subscribe price until you cancel.
                          </li>
                        )}
                        {currentSubscription?.prepaid_price && (
                          <li>
                            <span className="font-semibold text-gray-800">Prepaid — </span>
                            One upfront payment covers the number of deliveries (cycles) you choose.
                            Frequency controls the delivery interval only (for example, every 2 months).
                          </li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
                
                {/* Show linked subscription info when there's no regular subscription */}
                {currentLinkedSubscription && !currentSubscription && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      Includes Mandatory Replacement Heads Subscription
                    </p>
                    <p className="text-xs text-blue-800">
                      This product includes a mandatory subscription for replacement heads. 
                      Select your delivery frequency below.
                    </p>
                  </div>
                )}

                {/* Frequency Selection for Subscriptions */}
                {/* Show frequency selection if subscription/prepaid is selected OR if linked subscription is mandatory */}
                {((purchaseType === 'subscription' || purchaseType === 'prepaid') || (currentLinkedSubscription && !currentSubscription)) && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">
                      {currentLinkedSubscription && !currentSubscription 
                        ? "Replacement Heads Delivery Frequency *" 
                        : "Delivery Frequency:"}
                    </label>
                    {(() => {
                      // For linked subscriptions, use the subscription product's available frequencies
                      // For regular subscriptions, use the subscription's available frequencies
                      const frequencies = currentSubscription?.available_frequencies || 
                        (currentLinkedSubscription?.subscription_product?.available_frequencies || 
                          (currentLinkedSubscription ? [currentLinkedSubscription.frequency_months] : []))
                      if (frequencies.length > 1) {
                        return (
                          <div className="flex flex-wrap gap-2">
                            {frequencies.map((freq) => (
                              <button
                                key={freq}
                                type="button"
                                onClick={() => setSelectedFrequency(freq)}
                                className={`px-4 py-2 border rounded-lg text-sm transition-all ${
                                  selectedFrequency === freq
                                    ? "border-black bg-black text-white"
                                    : "border-gray-300 hover:border-gray-400"
                                }`}
                              >
                                Every {freq} {freq === 1 ? 'Month' : 'Months'}
                              </button>
                            ))}
                          </div>
                        )
                      } else {
                        const freq = frequencies[0] || (currentLinkedSubscription?.frequency_months || 2)
                        // Auto-select frequency if linked subscription is mandatory
                        if (currentLinkedSubscription && !currentSubscription && !selectedFrequency) {
                          setSelectedFrequency(freq)
                        }
                        return (
                          <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50">
                            Every {freq} {freq === 1 ? 'Month' : 'Months'}
                            {currentLinkedSubscription && !currentSubscription && (
                              <div className="text-xs text-gray-500 mt-1">
                                Auto-starts {currentLinkedSubscription.start_after_months} months after purchase
                              </div>
                            )}
                          </div>
                        )
                      }
                    })()}
                    {currentLinkedSubscription && !currentSubscription && (
                      <p className="text-xs text-gray-500 mt-2">
                        * Required: Replacement heads subscription is mandatory with this purchase
                      </p>
                    )}
                  </div>
                )}

                {purchaseType === 'prepaid' && currentSubscription && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">Number of deliveries (cycles):</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 6, 12].map((cycles) => (
                        <button
                          key={cycles}
                          type="button"
                          onClick={() => setSelectedPrepaidCycles(cycles)}
                          className={`px-4 py-2 border rounded-lg text-sm transition-all ${
                            selectedPrepaidCycles === cycles
                              ? "border-black bg-black text-white"
                              : "border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {cycles} {cycles === 1 ? 'delivery' : 'deliveries'}
                        </button>
                      ))}
                    </div>
                    {selectedFrequency && (
                      <p className="text-xs text-gray-500 mt-2">
                        Duration: {selectedPrepaidCycles * selectedFrequency} month
                        {selectedPrepaidCycles * selectedFrequency === 1 ? '' : 's'} total
                        ({selectedPrepaidCycles} deliveries every {selectedFrequency}{' '}
                        {selectedFrequency === 1 ? 'month' : 'months'}).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Color/Variant Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Color: <span className="font-bold">{selectedColor.name.toUpperCase()}</span>
              </label>
              <div className="flex gap-3">
                {colorVariants.map((variant) => {
                  const useImages = cmsContent?.useVariantImages !== false
                  // Priority: color_image_url > first variant image > color circle
                  const displayImage = useImages 
                    ? (variant.colorImageUrl || (variant.images && variant.images.length > 0 ? variant.images[0] : null))
                    : null
                  
                  return (
                    <button
                      key={variant.value}
                      onClick={() => {
                        setSelectedColor(variant)
                        setSelectedImageIndex(0)
                      }}
                      className={`relative w-12 h-12 rounded-full border-2 overflow-hidden ${
                        selectedColor.value === variant.value
                          ? "border-black ring-2 ring-offset-2 ring-black"
                          : "border-gray-300"
                      } ${variant.value === "white" ? "border-gray-400" : ""}`}
                      style={useImages && displayImage ? {} : { backgroundColor: variant.color }}
                      title={variant.name}
                    >
                      {useImages && displayImage && displayImage.trim() ? (
                        <Image
                          src={displayImage.trim()}
                          alt={variant.name}
                          fill
                          className="object-cover"
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium mb-3">Quantity:</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="h-10 w-10"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)} className="h-10 w-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Add to Cart */}
            <Button
              onClick={handleAddToCart}
              disabled={!selectedColor.variantId || 
                ((purchaseType === 'subscription' || purchaseType === 'prepaid') && !selectedFrequency && !(currentLinkedSubscription?.frequency_months)) ||
                (currentLinkedSubscription && !currentSubscription && !selectedFrequency)}
              className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {currentLinkedSubscription && !currentSubscription
                ? 'Add to Cart'
                : purchaseType === 'one-time' 
                ? 'Add to Cart' 
                : purchaseType === 'subscription'
                ? 'Subscribe Now'
                : 'Buy Prepaid Subscription'}
            </Button>
            
            {(purchaseType === 'subscription' || purchaseType === 'prepaid') && currentSubscription && selectedFrequency && (
              <p className="text-xs text-gray-500 text-center mt-2">
                {purchaseType === 'subscription' 
                  ? `Billed every ${selectedFrequency} ${selectedFrequency === 1 ? 'month' : 'months'}. Cancel anytime.`
                  : `Prepaid for ${selectedPrepaidCycles} ${selectedPrepaidCycles === 1 ? 'delivery' : 'deliveries'} every ${selectedFrequency} ${selectedFrequency === 1 ? 'month' : 'months'} (total ${selectedPrepaidCycles * selectedFrequency} months).`}
              </p>
            )}

            {/* Inventory Level */}
            <p className={`text-center text-sm ${inventoryStatus.color}`}>
              Inventory Level: {inventoryStatus.level}
            </p>

            {/* Payment Methods */}
            <div className="flex items-center justify-center gap-2 pt-4 border-t">
              {(cmsContent?.paymentIcons || [
                { name: 'Visa', url: '/placeholder.svg?height=24&width=40', alt: 'Visa' },
                { name: 'Mastercard', url: '/placeholder.svg?height=24&width=40', alt: 'Mastercard' },
                { name: 'Amex', url: '/placeholder.svg?height=24&width=40', alt: 'Amex' },
                { name: 'PayPal', url: '/placeholder.svg?height=24&width=40', alt: 'PayPal' },
                { name: 'Apple Pay', url: '/placeholder.svg?height=24&width=40', alt: 'Apple Pay' },
              ]).map((icon, index) => {
                const iconUrl = icon.url && icon.url.trim() ? icon.url.trim() : '/placeholder.svg?height=24&width=40'
                return (
                  <Image 
                    key={index}
                    src={iconUrl} 
                    alt={icon.alt || icon.name} 
                    width={40} 
                    height={24}
                    className="object-contain"
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
