'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createSubscriptionProduct } from '@/app/actions/subscriptions'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'

export default function CreateSubscriptionPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [selectedProductData, setSelectedProductData] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [selectedVariants, setSelectedVariants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [formData, setFormData] = useState({
    is_subscription_enabled: true,
    shipping_days: 14,
    subscription_discount_percent: '',
    prepaid_discount_percent: '',
    available_frequencies: [1] as number[],
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct)
      setSelectedProductData(product || null)
      loadVariants(selectedProduct)
    } else {
      setSelectedProductData(null)
      setVariants([])
      setSelectedVariants([])
    }
  }, [selectedProduct, products])

  // Calculate prices based on percentage discounts
  const calculateSubscriptionPrice = (oneTimePrice: number, discountPercent: number) => {
    if (!oneTimePrice || !discountPercent) return 0
    return oneTimePrice * (1 - discountPercent / 100)
  }

  // Get price range for selected variants
  const getPriceRange = () => {
    if (selectedVariants.length === 0) return { min: 0, max: 0 }
    const prices = selectedVariants
      .map(id => variants.find(v => v.id === id)?.price)
      .filter((p): p is number => p !== undefined)
      .map(p => parseFloat(p.toString()))
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    }
  }

  // Get base price for savings calculation (use compare_at_price if available, otherwise one-time price)
  const getBasePriceForSavings = (variantPrice: number) => {
    if (!selectedProductData) return variantPrice
    const comparePrice = selectedProductData.compare_at_price 
      ? parseFloat(selectedProductData.compare_at_price.toString())
      : null
    // Use compare_at_price if it's higher than base_price, otherwise use variant price
    if (comparePrice && comparePrice > parseFloat(selectedProductData.base_price?.toString() || '0')) {
      return comparePrice
    }
    return variantPrice
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const result = await getActiveProductsForAdmin()
      if (result.error) {
        console.error('Error loading products:', result.error)
        toast.error('Failed to load products')
        setProducts([])
      } else {
        setProducts(result.data || [])
      }
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Failed to load products')
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const loadVariants = async (productId: string) => {
    try {
      const result = await getProductVariantsForAdmin(productId)
      if (result.error) {
        console.error('Error loading variants:', result.error)
        toast.error('Failed to load variants')
        setVariants([])
      } else {
        setVariants(result.data || [])
      }
    } catch (error) {
      console.error('Error loading variants:', error)
      toast.error('Failed to load variants')
      setVariants([])
    }
  }

  const handleFrequencyToggle = (frequency: number) => {
    setFormData(prev => {
      const frequencies = [...prev.available_frequencies]
      const index = frequencies.indexOf(frequency)
      if (index > -1) {
        frequencies.splice(index, 1)
      } else {
        frequencies.push(frequency)
        frequencies.sort((a, b) => a - b)
      }
      return { ...prev, available_frequencies: frequencies }
    })
  }

  const calculateSavings = (oneTimePrice: number, subscriptionPrice: number) => {
    if (!oneTimePrice || !subscriptionPrice || oneTimePrice <= subscriptionPrice) return 0
    return Math.round(((oneTimePrice - subscriptionPrice) / oneTimePrice) * 100)
  }

  const handleVariantToggle = (variantId: string) => {
    setSelectedVariants(prev => {
      if (prev.includes(variantId)) {
        return prev.filter(id => id !== variantId)
      } else {
        return [...prev, variantId]
      }
    })
  }

  const handleSelectAllVariants = () => {
    if (selectedVariants.length === variants.length) {
      setSelectedVariants([])
    } else {
      setSelectedVariants(variants.map(v => v.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProduct || selectedVariants.length === 0) {
      toast.error('Please select a product and at least one variant')
      return
    }

    if (formData.available_frequencies.length === 0) {
      toast.error('Please select at least one frequency option')
      return
    }

    if (!formData.subscription_discount_percent && !formData.prepaid_discount_percent) {
      toast.error('Please set at least one discount percentage (ongoing or prepaid)')
      return
    }

    if (subscriptionDiscount < 0 || subscriptionDiscount > 100) {
      toast.error('Subscription discount must be between 0 and 100%')
      return
    }

    if (prepaidDiscount < 0 || prepaidDiscount > 100) {
      toast.error('Prepaid discount must be between 0 and 100%')
      return
    }

    setLoading(true)
    try {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      const subscriptionDiscount = parseFloat(formData.subscription_discount_percent) || 0
      const prepaidDiscount = parseFloat(formData.prepaid_discount_percent) || 0

      // Create subscription for each selected variant
      for (const variantId of selectedVariants) {
        const variant = variants.find(v => v.id === variantId)
        if (!variant) continue

        const oneTimePrice = parseFloat(variant.price?.toString() || '0')
        const basePriceForSavings = getBasePriceForSavings(oneTimePrice)
        
        // Calculate subscription prices based on percentage discounts (using compare_at_price as base if available)
        const subscriptionPrice = subscriptionDiscount > 0
          ? calculateSubscriptionPrice(basePriceForSavings, subscriptionDiscount)
          : null
        
        const prepaidPrice = prepaidDiscount > 0
          ? calculateSubscriptionPrice(basePriceForSavings, prepaidDiscount)
          : null

        const result = await createSubscriptionProduct({
          product_id: selectedProduct,
          variant_id: variantId,
          is_subscription_enabled: formData.is_subscription_enabled,
          shipping_days: formData.shipping_days,
          one_time_price: oneTimePrice,
          subscription_price: subscriptionPrice,
          prepaid_price: prepaidPrice,
          available_frequencies: formData.available_frequencies,
          status: formData.status,
        })

        if (result.success) {
          successCount++
        } else {
          errorCount++
          errors.push(`${variant.color || variant.sku}: ${result.error || 'Failed'}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully created ${successCount} subscription${successCount > 1 ? 's' : ''}!`)
        router.push('/admin/subscriptions')
      } else {
        toast.error(`Failed to create subscriptions. ${errors.join('; ')}`)
      }
    } catch (error: any) {
      console.error('Error creating subscriptions:', error)
      toast.error(error.message || 'Failed to create subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const subscriptionDiscount = parseFloat(formData.subscription_discount_percent) || 0
  const prepaidDiscount = parseFloat(formData.prepaid_discount_percent) || 0
  const priceRange = getPriceRange()

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Create Subscription</h1>
            <p className="text-gray-600 mt-1">Configure subscription options for one or more product variants</p>
          </div>
          <Link href="/admin/subscriptions/linked/new">
            <Button variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create Linked Subscription
            </Button>
          </Link>
        </div>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Need to create a subscription that automatically starts when another product is purchased? 
            Use <Link href="/admin/subscriptions/linked" className="underline font-medium">Linked Subscriptions</Link> instead.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Product Selection</CardTitle>
            <CardDescription>Select a product and one or more variants to enable subscriptions for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="product">Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={loadingProducts}>
                <SelectTrigger id="product">
                  <SelectValue placeholder={loadingProducts ? "Loading products..." : "Select a product"} />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 && !loadingProducts ? (
                    <SelectItem value="no-products" disabled>No products available</SelectItem>
                  ) : (
                    products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && variants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="variants">Variants</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllVariants}
                    className="text-xs"
                  >
                    {selectedVariants.length === variants.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="border rounded-md p-4 space-y-3 max-h-64 overflow-y-auto">
                  {variants.map(variant => (
                    <div key={variant.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`variant-${variant.id}`}
                        checked={selectedVariants.includes(variant.id)}
                        onCheckedChange={() => handleVariantToggle(variant.id)}
                      />
                      <label
                        htmlFor={`variant-${variant.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <div className="font-medium">{variant.color || 'No color'}</div>
                        <div className="text-xs text-gray-500">
                          ${variant.price} • SKU: {variant.sku}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                {selectedVariants.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedVariants.length} variant{selectedVariants.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedVariants.length > 0 && (
          <>
            {/* Subscription Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Configuration</CardTitle>
                <CardDescription>Configure subscription settings and pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enabled">Enable Subscriptions</Label>
                    <p className="text-sm text-gray-500">Allow customers to subscribe to this product</p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={formData.is_subscription_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_subscription_enabled: checked }))}
                  />
                </div>

                <div>
                  <Label htmlFor="shipping_days">Shipping Days</Label>
                  <p className="text-sm text-gray-500 mb-2">
                    Number of days to ship the product. This is used to calculate billing intervals.
                  </p>
                  <Input
                    id="shipping_days"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.shipping_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_days: parseInt(e.target.value) || 14 }))}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Example: If set to 14 days and customer chooses 1 month, billing will occur 16 days after first purchase (30 - 14 = 16) so product arrives at month end.
                  </p>
                </div>

                <div>
                  <Label htmlFor="frequencies">Available Frequencies</Label>
                  <p className="text-sm text-gray-500 mb-2">Select which subscription frequencies customers can choose</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 6, 12].map(freq => (
                      <Button
                        key={freq}
                        type="button"
                        variant={formData.available_frequencies.includes(freq) ? "default" : "outline"}
                        onClick={() => handleFrequencyToggle(freq)}
                      >
                        {freq} {freq === 1 ? 'Month' : 'Months'}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Set prices for different purchase options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="one_time_price">One-Time Purchase Price Reference</Label>
                  <Input
                    id="one_time_price"
                    type="text"
                    value={selectedVariants.length > 0 
                      ? priceRange.min === priceRange.max
                        ? `$${priceRange.min.toFixed(2)}`
                        : `$${priceRange.min.toFixed(2)} - $${priceRange.max.toFixed(2)}`
                      : ''
                    }
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Each variant will use its own one-time purchase price. Discount percentages below will be applied to calculate subscription prices for all selected variants.
                  </p>
                </div>

                <div>
                  <Label htmlFor="subscription_discount">Ongoing Subscription Discount (%)</Label>
                  <Input
                    id="subscription_discount"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.subscription_discount_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscription_discount_percent: e.target.value }))}
                    placeholder="0.0"
                  />
                  {subscriptionDiscount > 0 && priceRange.min > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-gray-700">Calculated Prices:</p>
                      {priceRange.min === priceRange.max ? (
                        <p className="text-sm text-green-600">
                          ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.min), subscriptionDiscount).toFixed(2)} per variant
                        </p>
                      ) : (
                        <p className="text-sm text-green-600">
                          ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.min), subscriptionDiscount).toFixed(2)} - ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.max), subscriptionDiscount).toFixed(2)} per variant
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {subscriptionDiscount}% off from {selectedProductData?.compare_at_price ? 'compare price' : 'one-time price'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="prepaid_discount">Prepaid Subscription Discount (%)</Label>
                  <Input
                    id="prepaid_discount"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.prepaid_discount_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, prepaid_discount_percent: e.target.value }))}
                    placeholder="0.0"
                  />
                  {prepaidDiscount > 0 && priceRange.min > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-medium text-gray-700">Calculated Prices:</p>
                      {priceRange.min === priceRange.max ? (
                        <p className="text-sm text-green-600">
                          ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.min), prepaidDiscount).toFixed(2)} per variant
                        </p>
                      ) : (
                        <p className="text-sm text-green-600">
                          ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.min), prepaidDiscount).toFixed(2)} - ${calculateSubscriptionPrice(getBasePriceForSavings(priceRange.max), prepaidDiscount).toFixed(2)} per variant
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {prepaidDiscount}% off from {selectedProductData?.compare_at_price ? 'compare price' : 'one-time price'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.status} onValueChange={(value: 'active' | 'inactive') => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading 
                  ? `Creating ${selectedVariants.length} subscription${selectedVariants.length > 1 ? 's' : ''}...` 
                  : `Create ${selectedVariants.length} Subscription${selectedVariants.length > 1 ? 's' : ''}`
                }
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

