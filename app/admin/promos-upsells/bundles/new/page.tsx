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
import { createBundle, getAllCampaigns } from '@/app/actions/upsells'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { ImagePicker } from '@/components/admin/image-picker'

export default function NewBundlePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [bundleType, setBundleType] = useState('buy_x_get_y')
  const [campaignId, setCampaignId] = useState('none')
  const [mainProducts, setMainProducts] = useState<Array<{product_id: string, variant_id?: string, quantity: number, required: boolean}>>([])
  const [bonusProducts, setBonusProducts] = useState<Array<{product_id: string, variant_id?: string, quantity: number, discount?: number}>>([])
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [bundlePrice, setBundlePrice] = useState('')
  const [minQuantity, setMinQuantity] = useState('1')
  const [maxQuantity, setMaxQuantity] = useState('')
  const [badgeText, setBadgeText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [status, setStatus] = useState('active')
  
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
      const [campaignsResult, productsResult] = await Promise.all([
        getAllCampaigns(),
        getActiveProductsForAdmin()
      ])
      
      if (campaignsResult.data) setCampaigns(campaignsResult.data)
      if (productsResult.data) setProducts(productsResult.data)
    } catch (error) {
      console.error('Error loading data:', error)
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

  const addMainProduct = () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }
    
    setMainProducts([...mainProducts, {
      product_id: selectedProduct,
      variant_id: selectedProductVariants.length > 0 ? selectedProductVariants[0].id : undefined,
      quantity: 1,
      required: true
    }])
    setSelectedProduct('')
  }

  const addBonusProduct = () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }
    
    setBonusProducts([...bonusProducts, {
      product_id: selectedProduct,
      variant_id: selectedProductVariants.length > 0 ? selectedProductVariants[0].id : undefined,
      quantity: 1,
      discount: 0
    }])
    setSelectedProduct('')
  }

  const removeMainProduct = (index: number) => {
    setMainProducts(mainProducts.filter((_, i) => i !== index))
  }

  const removeBonusProduct = (index: number) => {
    setBonusProducts(bonusProducts.filter((_, i) => i !== index))
  }

  const updateMainProduct = (index: number, updates: any) => {
    const updated = [...mainProducts]
    updated[index] = { ...updated[index], ...updates }
    setMainProducts(updated)
  }

  const updateBonusProduct = (index: number, updates: any) => {
    const updated = [...bonusProducts]
    updated[index] = { ...updated[index], ...updates }
    setBonusProducts(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Bundle name is required')
      return
    }

    if (mainProducts.length === 0) {
      toast.error('At least one main product is required')
      return
    }

    setSaving(true)
    try {
      const result = await createBundle({
        campaign_id: campaignId && campaignId !== 'none' ? campaignId : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        bundle_type: bundleType,
        main_products: mainProducts,
        bonus_products: bonusProducts.length > 0 ? bonusProducts : undefined,
        discount_type: discountType || undefined,
        discount_value: discountValue ? parseFloat(discountValue) : undefined,
        bundle_price: bundlePrice ? parseFloat(bundlePrice) : undefined,
        min_quantity: parseInt(minQuantity) || 1,
        max_quantity: maxQuantity ? parseInt(maxQuantity) : undefined,
        badge_text: badgeText.trim() || undefined,
        image_url: imageUrl || undefined,
        status: status as 'active' | 'inactive',
      })

      if (result.success) {
        toast.success('Bundle created successfully')
        router.push('/admin/promos-upsells/bundles')
      } else {
        toast.error(result.error || 'Failed to create bundle')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create bundle')
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
          <h1 className="text-3xl font-bold text-gray-900">Create Product Bundle</h1>
          <p className="text-gray-600 mt-1">Create buy X get Y bundles and product combos</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Set up your bundle name and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Bundle Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Buy 2 Get 1 Free"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bundle description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bundleType">Bundle Type *</Label>
                <Select value={bundleType} onValueChange={setBundleType}>
                  <SelectTrigger id="bundleType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                    <SelectItem value="mix_match">Mix & Match</SelectItem>
                    <SelectItem value="combo">Combo</SelectItem>
                    <SelectItem value="gift_with_purchase">Gift with Purchase</SelectItem>
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

        {/* Main Products */}
        <Card>
          <CardHeader>
            <CardTitle>Main Products *</CardTitle>
            <CardDescription>Products customers must purchase</CardDescription>
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
              <Button type="button" onClick={addMainProduct}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>

            {mainProducts.length > 0 && (
              <div className="space-y-2 border rounded-lg p-4">
                {mainProducts.map((product, index) => {
                  const productData = products.find(p => p.id === product.product_id)
                  return (
                    <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{productData?.title || 'Unknown Product'}</p>
                        {selectedProductVariants.length > 0 && (
                          <Select
                            value={product.variant_id || ''}
                            onValueChange={(v) => updateMainProduct(index, { variant_id: v })}
                          >
                            <SelectTrigger className="w-48 mt-2">
                              <SelectValue placeholder="Select variant" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedProductVariants.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.color || v.sku}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Label>Qty:</Label>
                        <Input
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateMainProduct(index, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-20"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMainProduct(index)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bonus Products */}
        {bundleType === 'buy_x_get_y' || bundleType === 'gift_with_purchase' ? (
          <Card>
            <CardHeader>
              <CardTitle>Bonus Products</CardTitle>
              <CardDescription>Products customers get for free or discounted</CardDescription>
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
                <Button type="button" onClick={addBonusProduct}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              {bonusProducts.length > 0 && (
                <div className="space-y-2 border rounded-lg p-4">
                  {bonusProducts.map((product, index) => {
                    const productData = products.find(p => p.id === product.product_id)
                    return (
                      <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{productData?.title || 'Unknown Product'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateBonusProduct(index, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-20"
                          />
                        </div>
                        {bundleType === 'buy_x_get_y' && (
                          <div className="flex items-center gap-2">
                            <Label>Discount %:</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={product.discount || 0}
                              onChange={(e) => updateBonusProduct(index, { discount: parseFloat(e.target.value) || 0 })}
                              className="w-24"
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBonusProduct(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set bundle pricing and discounts</CardDescription>
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
                    <SelectItem value="free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType !== 'free' && (
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
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="bundlePrice">Fixed Bundle Price (Optional)</Label>
              <Input
                id="bundlePrice"
                type="number"
                min="0"
                step="0.01"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
                placeholder="Leave empty for calculated price"
              />
              <p className="text-xs text-gray-500 mt-1">Set a fixed price for the entire bundle</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minQuantity">Min Quantity</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="1"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="maxQuantity">Max Quantity (Optional)</Label>
                <Input
                  id="maxQuantity"
                  type="number"
                  min="1"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>Customize how the bundle appears</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="badgeText">Badge Text</Label>
              <Input
                id="badgeText"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g., Best Value, Save 20%"
              />
            </div>
            <div>
              <Label>Bundle Image</Label>
              <ImagePicker
                value={imageUrl}
                onChange={setImageUrl}
              />
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
            {saving ? 'Creating...' : 'Create Bundle'}
          </Button>
        </div>
      </form>
    </div>
  )
}

