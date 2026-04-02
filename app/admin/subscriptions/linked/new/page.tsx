'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createLinkedSubscription } from '@/app/actions/subscriptions'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { getSubscriptionProducts } from '@/app/actions/subscriptions'

export default function NewLinkedSubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  
  // Data
  const [products, setProducts] = useState<any[]>([])
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const [triggerProductId, setTriggerProductId] = useState('')
  const [triggerVariantId, setTriggerVariantId] = useState('')
  const [triggerVariants, setTriggerVariants] = useState<any[]>([])
  const [subscriptionProductId, setSubscriptionProductId] = useState('')
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [frequencyMonths, setFrequencyMonths] = useState('2')
  const [purchaseType, setPurchaseType] = useState<'ongoing' | 'prepaid'>('ongoing')
  const [quantity, setQuantity] = useState('1')
  const [startAfterMonths, setStartAfterMonths] = useState('2')
  const [billingDaysBeforeDelivery, setBillingDaysBeforeDelivery] = useState('15')
  const [minQuantity, setMinQuantity] = useState('1')
  const [autoActivate, setAutoActivate] = useState(true)
  const [status, setStatus] = useState<'active' | 'inactive'>('active')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (triggerProductId) {
      loadTriggerVariants(triggerProductId)
    } else {
      setTriggerVariants([])
      setTriggerVariantId('')
    }
  }, [triggerProductId])

  const loadData = async () => {
    setLoadingData(true)
    try {
      const [productsResult, subscriptionProductsResult] = await Promise.all([
        getActiveProductsForAdmin(),
        getSubscriptionProducts(true)
      ])
      
      if (productsResult.error) {
        toast.error('Failed to load products')
      } else {
        setProducts(productsResult.data || [])
      }
      
      if (subscriptionProductsResult.error) {
        toast.error('Failed to load subscription products')
      } else {
        // Filter to only active subscription products
        const activeSubProducts = (subscriptionProductsResult.data || []).filter(
          (sp: any) => sp.is_subscription_enabled && sp.status === 'active'
        )
        setSubscriptionProducts(activeSubProducts)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoadingData(false)
    }
  }

  const loadTriggerVariants = async (productId: string) => {
    try {
      const result = await getProductVariantsForAdmin(productId)
      if (result.error) {
        toast.error('Failed to load variants')
        setTriggerVariants([])
      } else {
        setTriggerVariants(result.data || [])
      }
    } catch (error) {
      console.error('Error loading variants:', error)
      setTriggerVariants([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!triggerProductId) {
      toast.error('Please select a trigger product')
      return
    }
    
    if (!subscriptionProductId) {
      toast.error('Please select a subscription product')
      return
    }

    // Validate that selected frequency is in the available frequencies
    if (selectedSubscriptionProduct?.available_frequencies) {
      const selectedFreq = parseInt(frequencyMonths)
      if (!selectedSubscriptionProduct.available_frequencies.includes(selectedFreq)) {
        toast.error(`Selected frequency (${selectedFreq} months) is not available for this subscription product. Available frequencies: ${selectedSubscriptionProduct.available_frequencies.join(', ')} months.`)
        return
      }
    }

    setLoading(true)
    try {
      const result = await createLinkedSubscription({
        trigger_product_id: triggerProductId,
        trigger_variant_id: triggerVariantId || undefined,
        subscription_product_id: subscriptionProductId,
        frequency_months: parseInt(frequencyMonths) || 2,
        purchase_type: purchaseType,
        quantity: parseInt(quantity) || 1,
        start_after_months: parseInt(startAfterMonths) || 2,
        billing_days_before_delivery: parseInt(billingDaysBeforeDelivery) || 15,
        min_quantity: parseInt(minQuantity) || 1,
        auto_activate: autoActivate,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        status: status,
      })

      if (result.success) {
        toast.success('Linked subscription created successfully')
        router.push('/admin/subscriptions/linked')
      } else {
        toast.error(result.error || 'Failed to create linked subscription')
      }
    } catch (error: any) {
      console.error('Error creating linked subscription:', error)
      toast.error(error.message || 'Failed to create linked subscription')
    } finally {
      setLoading(false)
    }
  }

  const selectedSubscriptionProduct = subscriptionProducts.find(sp => sp.id === subscriptionProductId)
  const selectedTriggerProduct = products.find(p => p.id === triggerProductId)

  // Auto-select first available frequency when subscription product is selected
  useEffect(() => {
    if (selectedSubscriptionProduct?.available_frequencies && selectedSubscriptionProduct.available_frequencies.length > 0) {
      const firstFrequency = selectedSubscriptionProduct.available_frequencies[0]
      if (frequencyMonths !== firstFrequency.toString()) {
        setFrequencyMonths(firstFrequency.toString())
      }
    }
  }, [subscriptionProductId, selectedSubscriptionProduct, frequencyMonths])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Linked Subscription</h1>
        <p className="text-gray-600 mt-1">
          Automatically create a subscription for one product when another product is purchased
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Name and describe this linked subscription rule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sonic Brush Auto-Replacement Subscription"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when and why this subscription is created..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trigger Product — charged immediately */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Product charged immediately
              <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">Bundle: pay now</span>
            </CardTitle>
            <CardDescription>
              This product is charged in the initial order (e.g. brush). When purchased, a subscription for the other product is created and charged in future cycles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="triggerProduct">Product *</Label>
              <Select value={triggerProductId} onValueChange={setTriggerProductId} disabled={loadingData}>
                <SelectTrigger id="triggerProduct">
                  <SelectValue placeholder={loadingData ? "Loading..." : "Select trigger product"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {triggerProductId && triggerVariants.length > 0 && (
              <div>
                <Label htmlFor="triggerVariant">Variant (Optional)</Label>
                <Select value={triggerVariantId || 'all'} onValueChange={(value) => setTriggerVariantId(value === 'all' ? '' : value)}>
                  <SelectTrigger id="triggerVariant">
                    <SelectValue placeholder="All variants (leave empty for all)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All variants</SelectItem>
                    {triggerVariants.map(variant => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.color || 'Default'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="minQuantity">Minimum Quantity *</Label>
              <Input
                id="minQuantity"
                type="number"
                min="1"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Minimum quantity of trigger product required to activate subscription
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Product — charged in future */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Product charged in future (subscription)
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Bundle: pay later</span>
            </CardTitle>
            <CardDescription>
              This product is not charged at checkout. A subscription is created and the customer is charged at each cycle (e.g. replacement heads every 2 months).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subscriptionProduct">Subscription Product *</Label>
              <Select value={subscriptionProductId} onValueChange={setSubscriptionProductId} disabled={loadingData}>
                <SelectTrigger id="subscriptionProduct">
                  <SelectValue placeholder={loadingData ? "Loading..." : "Select subscription product"} />
                </SelectTrigger>
                <SelectContent>
                  {subscriptionProducts.map(subProduct => (
                    <SelectItem key={subProduct.id} value={subProduct.id}>
                      {subProduct.products?.title || 'Unknown'} - {subProduct.product_variants?.color || 'Default'}
                      {subProduct.subscription_price && ` ($${parseFloat(subProduct.subscription_price.toString()).toFixed(2)}/cycle)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subscriptionProducts.length === 0 && !loadingData && (
                <p className="text-sm text-red-500 mt-1">
                  No active subscription products found. Create a subscription product first.
                </p>
              )}
            </div>

            {selectedSubscriptionProduct && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">Subscription Details:</p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Subscription Price: ${selectedSubscriptionProduct.subscription_price ? parseFloat(selectedSubscriptionProduct.subscription_price.toString()).toFixed(2) : 'N/A'}</li>
                  {selectedSubscriptionProduct.prepaid_price && (
                    <li>• Prepaid Price: ${parseFloat(selectedSubscriptionProduct.prepaid_price.toString()).toFixed(2)}</li>
                  )}
                  <li>• Shipping Days: {selectedSubscriptionProduct.shipping_days || 14}</li>
                  <li>• Available Frequencies: {selectedSubscriptionProduct.available_frequencies?.join(', ') || '1'} month(s)</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Configuration</CardTitle>
            <CardDescription>Configure how the subscription will be created</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency (months) *</Label>
                {selectedSubscriptionProduct?.available_frequencies && selectedSubscriptionProduct.available_frequencies.length > 0 ? (
                  <Select value={frequencyMonths} onValueChange={setFrequencyMonths}>
                    <SelectTrigger id="frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSubscriptionProduct.available_frequencies.map((freq: number) => (
                        <SelectItem key={freq} value={freq.toString()}>
                          {freq} {freq === 1 ? 'month' : 'months'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="frequency"
                    type="number"
                    min="1"
                    value={frequencyMonths}
                    onChange={(e) => setFrequencyMonths(e.target.value)}
                    placeholder="2"
                    disabled={!subscriptionProductId}
                  />
                )}
                <p className="text-sm text-gray-500 mt-1">
                  {selectedSubscriptionProduct?.available_frequencies 
                    ? `Select from available frequencies: ${selectedSubscriptionProduct.available_frequencies.join(', ')} month(s)`
                    : 'Select a subscription product first'}
                </p>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity per cycle *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startAfterMonths">Start After (months) *</Label>
                <Select value={startAfterMonths} onValueChange={setStartAfterMonths}>
                  <SelectTrigger id="startAfterMonths">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 months</SelectItem>
                    <SelectItem value="3">3 months</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500 mt-1">
                  When to start the subscription (since product comes with initial supply)
                </p>
              </div>
              <div>
                <Label htmlFor="billingDaysBeforeDelivery">Billing Days Before Delivery *</Label>
                <Input
                  id="billingDaysBeforeDelivery"
                  type="number"
                  min="1"
                  value={billingDaysBeforeDelivery}
                  onChange={(e) => setBillingDaysBeforeDelivery(e.target.value)}
                  placeholder="15"
                />
                <p className="text-sm text-gray-500 mt-1">
                  How many days before delivery to charge (default: 15 days)
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="purchaseType">Purchase Type *</Label>
              <Select value={purchaseType} onValueChange={(v) => setPurchaseType(v as 'ongoing' | 'prepaid')}>
                <SelectTrigger id="purchaseType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ongoing">Ongoing Subscription</SelectItem>
                  <SelectItem value="prepaid">Prepaid Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoActivate">Auto-Activate</Label>
                <p className="text-sm text-gray-500">
                  Automatically activate subscription without customer confirmation
                </p>
              </div>
              <Switch
                id="autoActivate"
                checked={autoActivate}
                onCheckedChange={setAutoActivate}
              />
            </div>

            <div>
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading || loadingData}>
            {loading ? 'Creating...' : 'Create Linked Subscription'}
          </Button>
        </div>
      </form>
    </div>
  )
}

