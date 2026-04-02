'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getSubscriptionSettings } from '@/app/actions/subscription-settings'
import { getSubscriptionProducts } from '@/app/actions/subscriptions'
import { updateSubscriptionQuantity, updateSubscriptionFrequency, swapSubscriptionProduct } from '@/app/actions/customer-subscriptions'
import { ArrowLeft, Loader2, Plus, Minus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SubscriptionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const subscriptionId = params.id as string
  
  const [subscription, setSubscription] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [frequency, setFrequency] = useState(1)
  const [selectedProductId, setSelectedProductId] = useState('')

  useEffect(() => {
    if (subscriptionId && user?.id) {
      loadData()
    }
  }, [subscriptionId, user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load subscription, settings, and available products
      const [settingsResult, productsResult] = await Promise.all([
        getSubscriptionSettings(),
        getSubscriptionProducts(true), // Use admin client to get all products
      ])
      
      if (settingsResult.data) {
        setSettings(settingsResult.data)
      }
      
      if (productsResult.data) {
        setAvailableProducts(productsResult.data)
      }
      
      // Load subscription details
      const response = await fetch(`/api/customer/subscriptions/${subscriptionId}`)
      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
        setQuantity(data.quantity || 1)
        setFrequency(data.frequency_months || 1)
        setSelectedProductId(data.subscription_product_id || '')
      } else {
        toast.error('Failed to load subscription')
        router.push('/account/subscriptions')
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error('Failed to load subscription details')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQuantity = async () => {
    if (!subscription) return
    
    setSaving(true)
    try {
      const result = await updateSubscriptionQuantity(subscriptionId, quantity)
      if (result.success) {
        toast.success('Quantity updated successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to update quantity')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quantity')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateFrequency = async () => {
    if (!subscription) return
    
    setSaving(true)
    try {
      const result = await updateSubscriptionFrequency(subscriptionId, frequency)
      if (result.success) {
        toast.success('Delivery frequency updated successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to update frequency')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update frequency')
    } finally {
      setSaving(false)
    }
  }

  const handleSwapProduct = async () => {
    if (!subscription || !selectedProductId) return
    
    if (!confirm('Are you sure you want to swap this product? This will change your subscription product.')) return
    
    setSaving(true)
    try {
      const result = await swapSubscriptionProduct(subscriptionId, selectedProductId)
      if (result.success) {
        toast.success('Product swapped successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to swap product')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to swap product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="mt-4 text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">
          <p className="text-gray-500">Subscription not found</p>
          <Button asChild className="mt-4">
            <Link href="/account/subscriptions">Back to Subscriptions</Link>
          </Button>
        </div>
      </div>
    )
  }

  const product = subscription.subscription_products?.products
  const variant = subscription.subscription_products?.product_variants
  const availableFrequencies = subscription.subscription_products?.available_frequencies || []

  // Filter available products for swapping based on settings
  const getSwappableProducts = () => {
    if (!settings) return []
    
    if (settings.allowSwappingProducts === 'none') return []
    
    if (settings.allowSwappingProducts === 'same_plan') {
      // Only show products with same product_id
      return availableProducts.filter((sp: any) => 
        sp.product_id === product?.id && sp.id !== subscription.subscription_product_id
      )
    }
    
    // 'any_plan' - show all products
    return availableProducts.filter((sp: any) => sp.id !== subscription.subscription_product_id)
  }

  const swappableProducts = getSwappableProducts()

  return (
    <div className="lg:col-span-2">
      <div className="mb-8">
        <Link href="/account/subscriptions">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subscriptions
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Manage Subscription</h1>
        <p className="mt-1 text-gray-600">Update your subscription details</p>
      </div>

      <div className="space-y-6">
        {/* Current Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Product:</strong> {product?.title || 'N/A'}</p>
              {variant && (
                <p><strong>Variant:</strong> {variant.color} • SKU: {variant.sku}</p>
              )}
              <p><strong>Quantity:</strong> {subscription.quantity}</p>
              <p><strong>Frequency:</strong> Every {subscription.frequency_months} {subscription.frequency_months === 1 ? 'month' : 'months'}</p>
              <p><strong>Price per cycle:</strong> ${subscription.price_per_cycle.toFixed(2)}</p>
              <p><strong>Status:</strong> {subscription.status}</p>
            </div>
          </CardContent>
        </Card>

        {/* Change Quantity */}
        {settings?.allowChangingQuantity !== 'none' && (
          <Card>
            <CardHeader>
              <CardTitle>Change Quantity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="quantity">Quantity</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={saving || (settings.allowChangingQuantity === 'increase_only' && quantity <= subscription.quantity)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        if (settings.allowChangingQuantity === 'increase_only' && val < subscription.quantity) {
                          setQuantity(subscription.quantity)
                        } else if (settings.allowChangingQuantity === 'decrease_only' && val > subscription.quantity) {
                          setQuantity(subscription.quantity)
                        } else {
                          setQuantity(val)
                        }
                      }}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={saving || (settings.allowChangingQuantity === 'decrease_only' && quantity >= subscription.quantity)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {quantity !== subscription.quantity && (
                    <p className="text-sm text-gray-500 mt-2">
                      Current: {subscription.quantity} → New: {quantity}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleUpdateQuantity}
                  disabled={saving || quantity === subscription.quantity}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Quantity
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Frequency */}
        {settings?.allowChangingSellingPlans && (
          <Card>
            <CardHeader>
              <CardTitle>Change Delivery Frequency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={frequency.toString()} onValueChange={(val) => setFrequency(parseInt(val))}>
                    <SelectTrigger id="frequency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFrequencies.map((freq: number) => (
                        <SelectItem key={freq} value={freq.toString()}>
                          Every {freq} {freq === 1 ? 'month' : 'months'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {frequency !== subscription.frequency_months && (
                    <p className="text-sm text-gray-500 mt-2">
                      Current: Every {subscription.frequency_months} {subscription.frequency_months === 1 ? 'month' : 'months'} → New: Every {frequency} {frequency === 1 ? 'month' : 'months'}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleUpdateFrequency}
                  disabled={saving || frequency === subscription.frequency_months}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Frequency
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Swap Product */}
        {settings?.allowSwappingProducts !== 'none' && swappableProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Swap Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="product">Select New Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger id="product" className="mt-2">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {swappableProducts.map((sp: any) => {
                        const prod = sp.products
                        const varnt = sp.product_variants
                        return (
                          <SelectItem key={sp.id} value={sp.id}>
                            {prod?.title || 'Product'} - {varnt?.color || 'Variant'} (${sp.subscription_price?.toFixed(2) || '0.00'}/cycle)
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {selectedProductId && selectedProductId !== subscription.subscription_product_id && (
                    <p className="text-sm text-gray-500 mt-2">
                      This will replace your current product with the selected one.
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSwapProduct}
                  disabled={saving || !selectedProductId || selectedProductId === subscription.subscription_product_id}
                  variant="outline"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Swapping...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Swap Product
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

