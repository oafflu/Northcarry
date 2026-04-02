'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { createCartUpsell, getAllCampaigns } from '@/app/actions/upsells'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { ImagePicker } from '@/components/admin/image-picker'

export default function NewCartUpsellPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [minCartValue, setMinCartValue] = useState('')
  const [maxCartValue, setMaxCartValue] = useState('')
  const [requiredProductIds, setRequiredProductIds] = useState<string[]>([])
  const [excludedProductIds, setExcludedProductIds] = useState<string[]>([])
  const [upsellProducts, setUpsellProducts] = useState<Array<{product_id: string, variant_id?: string}>>([])
  const [position, setPosition] = useState('bottom')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [ctaText, setCtaText] = useState('Add to Cart')
  const [imageUrl, setImageUrl] = useState('')
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [status, setStatus] = useState('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [campaignId, setCampaignId] = useState('none')
  
  // Data
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedProductVariants, setSelectedProductVariants] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct)
    }
  }, [selectedProduct])

  const loadData = async () => {
    setLoading(true)
    try {
      const [campaignsResult, productsResponse] = await Promise.all([
        getAllCampaigns(),
        fetch('/api/admin/products')
      ])
      
      if (campaignsResult.data) setCampaigns(campaignsResult.data)
      
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        if (productsData.data) setProducts(productsData.data)
      } else {
        // Fallback to regular products
        const productsResult = await getActiveProductsForAdmin()
        if (productsResult.data) setProducts(productsResult.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      // Fallback to regular products
      try {
        const productsResult = await getActiveProductsForAdmin()
        if (productsResult.data) setProducts(productsResult.data)
      } catch (fallbackError) {
        console.error('Error loading fallback products:', fallbackError)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadVariants = async (productId: string) => {
    try {
      const result = await getProductVariantsForAdmin(productId)
      if (result.data) {
        setSelectedProductVariants(result.data)
      }
    } catch (error) {
      console.error('Error loading variants:', error)
    }
  }

  const addUpsellProduct = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }
    
    // Load all variants for the selected product
    const variantsResult = await getProductVariantsForAdmin(selectedProduct)
    const allVariants = variantsResult.data || []
    
    if (allVariants.length === 0) {
      toast.error('This product has no variants')
      return
    }
    
    // Add all variants of the product to upsell products
    const newUpsellProducts = allVariants.map((variant: any) => ({
      product_id: selectedProduct,
      variant_id: variant.id,
    }))
    
    setUpsellProducts([...upsellProducts, ...newUpsellProducts])
    setSelectedProduct('')
    setSelectedProductVariants([])
    toast.success(`Added ${allVariants.length} variant(s) for this product`)
  }

  const removeUpsellProduct = (index: number) => {
    setUpsellProducts(upsellProducts.filter((_, i) => i !== index))
  }

  const updateUpsellProduct = (index: number, updates: any) => {
    const updated = [...upsellProducts]
    updated[index] = { ...updated[index], ...updates }
    setUpsellProducts(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Upsell name is required')
      return
    }

    if (upsellProducts.length === 0) {
      toast.error('At least one upsell product is required')
      return
    }

    setSaving(true)
    try {
      const result = await createCartUpsell({
        campaign_id: campaignId && campaignId !== 'none' ? campaignId : undefined,
        name: name.trim(),
        min_cart_value: minCartValue ? parseFloat(minCartValue) : undefined,
        max_cart_value: maxCartValue ? parseFloat(maxCartValue) : undefined,
        required_products: requiredProductIds.length > 0 ? requiredProductIds : undefined,
        excluded_products: excludedProductIds.length > 0 ? excludedProductIds : undefined,
        upsell_products: upsellProducts,
        position: position,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        cta_text: ctaText.trim() || 'Add to Cart',
        image_url: imageUrl || undefined,
        discount_type: discountType || undefined,
        discount_value: discountValue ? parseFloat(discountValue) : undefined,
        status: status as 'active' | 'inactive',
        sort_order: parseInt(sortOrder) || 0,
      })

      if (result.success) {
        toast.success('Cart upsell created successfully')
        router.push('/admin/promos-upsells/cart-upsells')
      } else {
        toast.error(result.error || 'Failed to create cart upsell')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create cart upsell')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Cart Upsell</h1>
          <p className="text-gray-600 mt-1">Show upsell offers on the cart page</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Upsell Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Complete Your Order"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Position *</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger id="position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                    <SelectItem value="popup">Popup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="campaign">Campaign (Optional)</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger id="campaign">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Trigger Conditions</CardTitle>
            <CardDescription>When to show this upsell</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minCartValue">Min Cart Value ($)</Label>
                <Input
                  id="minCartValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minCartValue}
                  onChange={(e) => setMinCartValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="maxCartValue">Max Cart Value ($)</Label>
                <Input
                  id="maxCartValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxCartValue}
                  onChange={(e) => setMaxCartValue(e.target.value)}
                  placeholder="Leave empty for no limit"
                />
              </div>
            </div>
            <div>
              <Label>Required Products (Optional)</Label>
              <Select value={selectedProduct} onValueChange={(v) => {
                if (v && !requiredProductIds.includes(v) && !excludedProductIds.includes(v)) {
                  setRequiredProductIds([...requiredProductIds, v])
                }
                setSelectedProduct('')
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => !requiredProductIds.includes(p.id) && !excludedProductIds.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {requiredProductIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {requiredProductIds.map(id => {
                    const product = products.find(p => p.id === id)
                    return (
                      <span key={id} className="bg-blue-100 px-2 py-1 rounded text-sm flex items-center gap-2">
                        {product?.title}
                        <button
                          type="button"
                          onClick={() => setRequiredProductIds(requiredProductIds.filter(i => i !== id))}
                          className="text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <Label>Excluded Products (Optional)</Label>
              <Select value={selectedProduct} onValueChange={(v) => {
                if (v && !excludedProductIds.includes(v) && !requiredProductIds.includes(v)) {
                  setExcludedProductIds([...excludedProductIds, v])
                }
                setSelectedProduct('')
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => !excludedProductIds.includes(p.id) && !requiredProductIds.includes(p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {excludedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {excludedProductIds.map(id => {
                    const product = products.find(p => p.id === id)
                    return (
                      <span key={id} className="bg-red-100 px-2 py-1 rounded text-sm flex items-center gap-2">
                        {product?.title}
                        <button
                          type="button"
                          onClick={() => setExcludedProductIds(excludedProductIds.filter(i => i !== id))}
                          className="text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upsell Products */}
        <Card>
          <CardHeader>
            <CardTitle>Upsell Products *</CardTitle>
            <CardDescription>Products to offer as upsells</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addUpsellProduct}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            {upsellProducts.length > 0 && (
              <div className="space-y-4 border rounded-lg p-4">
                {/* Group products by product_id */}
                {Array.from(new Set(upsellProducts.map(p => p.product_id))).map(productId => {
                  const productData = products.find(p => p.id === productId)
                  const productVariants = upsellProducts.filter(p => p.product_id === productId)
                  const variantIds = productVariants.map(p => p.variant_id).filter(Boolean)
                  
                  return (
                    <div key={productId} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{productData?.title || 'Unknown Product'}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {variantIds.length} variant{variantIds.length !== 1 ? 's' : ''} included
                            {productData?.hasSubscription && ' • Subscription product'}
                          </p>
                          <p className="text-xs text-teal-600 mt-1">
                            Customers will select variant and subscription options on the cart page
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Remove all variants of this product
                            setUpsellProducts(upsellProducts.filter(p => p.product_id !== productId))
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g., Complete Your Order"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Upsell description..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="ctaText">Button Text</Label>
              <Input
                id="ctaText"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Add to Cart"
              />
            </div>
            <div>
              <Label>Upsell Image</Label>
              <ImagePicker
                value={imageUrl}
                onChange={setImageUrl}
              />
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
            </div>
          </CardContent>
        </Card>

        {/* Offer Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Offer Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discountType">Discount Type</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger id="discountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discountValue">
                  {discountType === 'percentage' ? 'Discount %' : 'Discount Amount ($)'}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
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
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Creating...' : 'Create Cart Upsell'}
          </Button>
        </div>
      </form>
    </div>
  )
}

