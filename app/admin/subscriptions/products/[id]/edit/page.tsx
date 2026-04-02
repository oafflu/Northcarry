'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { 
  getSubscriptionProductsByProductId, 
  bulkUpdateSubscriptionProducts,
  deleteSubscriptionProduct
} from '@/app/actions/subscriptions'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { Trash2 } from 'lucide-react'

export default function EditSubscriptionProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [product, setProduct] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [existingSubscriptions, setExistingSubscriptions] = useState<any[]>([])
  const [selectedVariants, setSelectedVariants] = useState<string[]>([])
  const [formData, setFormData] = useState({
    is_subscription_enabled: true,
    shipping_days: 14,
    subscription_discount_percent: '',
    prepaid_discount_percent: '',
    available_frequencies: [1] as number[],
    status: 'active' as 'active' | 'inactive',
  })

  useEffect(() => {
    loadData()
  }, [productId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load product and variants
      const [productsResult, variantsResult, subscriptionsResult] = await Promise.all([
        getActiveProductsForAdmin(),
        getProductVariantsForAdmin(productId),
        getSubscriptionProductsByProductId(productId),
      ])

      if (productsResult.error || variantsResult.error) {
        toast.error('Failed to load product data')
        router.push('/admin/subscriptions/products')
        return
      }

      const foundProduct = productsResult.data.find((p: any) => p.id === productId)
      if (!foundProduct) {
        toast.error('Product not found')
        router.push('/admin/subscriptions/products')
        return
      }

      setProduct(foundProduct)
      setVariants(variantsResult.data || [])
      setExistingSubscriptions(subscriptionsResult.data || [])

      // Pre-select variants that have existing subscriptions
      const existingVariantIds = subscriptionsResult.data.map((sub: any) => sub.variant_id).filter(Boolean)
      setSelectedVariants(existingVariantIds)

      // Load form data from first existing subscription (assuming all have same config)
      if (subscriptionsResult.data.length > 0) {
        const firstSub = subscriptionsResult.data[0]
        const comparePrice = foundProduct.compare_at_price 
          ? parseFloat(foundProduct.compare_at_price.toString())
          : null
        const basePrice = foundProduct.base_price 
          ? parseFloat(foundProduct.base_price.toString())
          : null

        // Calculate discount percentages from existing prices
        const variantPrice = firstSub.one_time_price || 0
        const basePriceForSavings = (comparePrice && comparePrice > (basePrice || 0)) ? comparePrice : variantPrice

        const subscriptionDiscount = firstSub.subscription_price && basePriceForSavings > 0
          ? ((basePriceForSavings - parseFloat(firstSub.subscription_price.toString())) / basePriceForSavings) * 100
          : 0

        const prepaidDiscount = firstSub.prepaid_price && basePriceForSavings > 0
          ? ((basePriceForSavings - parseFloat(firstSub.prepaid_price.toString())) / basePriceForSavings) * 100
          : 0

        setFormData({
          is_subscription_enabled: firstSub.is_subscription_enabled || true,
          shipping_days: firstSub.shipping_days || 14,
          subscription_discount_percent: subscriptionDiscount > 0 ? subscriptionDiscount.toFixed(1) : '',
          prepaid_discount_percent: prepaidDiscount > 0 ? prepaidDiscount.toFixed(1) : '',
          available_frequencies: firstSub.available_frequencies || [1],
          status: firstSub.status || 'active',
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load product data')
    } finally {
      setLoading(false)
    }
  }

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

  // Get base price for savings calculation
  const getBasePriceForSavings = (variantPrice: number) => {
    if (!product) return variantPrice
    const comparePrice = product.compare_at_price 
      ? parseFloat(product.compare_at_price.toString())
      : null
    const basePrice = product.base_price 
      ? parseFloat(product.base_price.toString())
      : null
    // Use compare_at_price if it's higher than base_price, otherwise use variant price
    if (comparePrice && comparePrice > (basePrice || 0)) {
      return comparePrice
    }
    return variantPrice
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedVariants.length === 0) {
      toast.error('Please select at least one variant')
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

    const subscriptionDiscount = parseFloat(formData.subscription_discount_percent) || 0
    const prepaidDiscount = parseFloat(formData.prepaid_discount_percent) || 0

    if (subscriptionDiscount < 0 || subscriptionDiscount > 100) {
      toast.error('Subscription discount must be between 0 and 100%')
      return
    }

    if (prepaidDiscount < 0 || prepaidDiscount > 100) {
      toast.error('Prepaid discount must be between 0 and 100%')
      return
    }

    setSaving(true)
    try {
      const result = await bulkUpdateSubscriptionProducts(
        productId,
        selectedVariants,
        {
          is_subscription_enabled: formData.is_subscription_enabled,
          shipping_days: formData.shipping_days,
          subscription_discount_percent: subscriptionDiscount > 0 ? subscriptionDiscount : undefined,
          prepaid_discount_percent: prepaidDiscount > 0 ? prepaidDiscount : undefined,
          available_frequencies: formData.available_frequencies,
          status: formData.status,
        }
      )

      if (result.success) {
        toast.success(`Successfully updated ${result.successCount} subscription${result.successCount > 1 ? 's' : ''}!`)
        router.push('/admin/subscriptions/products')
      } else {
        toast.error(result.error || 'Failed to update subscriptions')
      }
    } catch (error: any) {
      console.error('Error updating subscriptions:', error)
      toast.error(error.message || 'Failed to update subscriptions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading product data...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Product not found</p>
        </div>
      </div>
    )
  }

  const subscriptionDiscount = parseFloat(formData.subscription_discount_percent) || 0
  const prepaidDiscount = parseFloat(formData.prepaid_discount_percent) || 0
  const priceRange = getPriceRange()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Subscription Product</h1>
        <p className="text-gray-600 mt-1">{product.title}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Variant Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Variant Selection</CardTitle>
            <CardDescription>Select variants to update subscription settings for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.length > 0 ? (
              <>
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
                  {variants.map(variant => {
                    const existingSub = existingSubscriptions.find((sub: any) => sub.variant_id === variant.id)
                    return (
                      <div key={variant.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
                        <div className="flex items-center space-x-3 flex-1">
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
                              {existingSub && (
                                <span className="ml-2 text-green-600">(Has subscription)</span>
                              )}
                            </div>
                          </label>
                        </div>
                        {existingSub && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to delete the subscription for ${variant.color || 'this variant'}? This will only work if there are no active subscriptions.`)) {
                                return
                              }
                              
                              try {
                                const result = await deleteSubscriptionProduct(existingSub.id)
                                if (result.success) {
                                  toast.success('Subscription deleted successfully')
                                  loadData() // Reload to refresh the list
                                } else {
                                  toast.error(result.error || 'Failed to delete subscription')
                                }
                              } catch (error: any) {
                                toast.error(error.message || 'Failed to delete subscription')
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete subscription for this variant"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedVariants.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedVariants.length} variant{selectedVariants.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">No variants available for this product</p>
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
                <CardDescription>Set discount percentages for subscription options</CardDescription>
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
                        {subscriptionDiscount}% off from {product.compare_at_price ? 'compare price' : 'one-time price'}
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
                        {prepaidDiscount}% off from {product.compare_at_price ? 'compare price' : 'one-time price'}
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
              <Button type="submit" disabled={saving}>
                {saving 
                  ? `Updating ${selectedVariants.length} subscription${selectedVariants.length > 1 ? 's' : ''}...` 
                  : `Update ${selectedVariants.length} Subscription${selectedVariants.length > 1 ? 's' : ''}`
                }
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/subscriptions/products')}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
