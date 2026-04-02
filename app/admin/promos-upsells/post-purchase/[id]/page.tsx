'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  getAllCampaigns,
  getPostPurchaseUpsell,
  getProductStorefrontLinks,
  updatePostPurchaseUpsell,
} from '@/app/actions/upsells'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { ImagePicker } from '@/components/admin/image-picker'
import { StorefrontLinksCard } from '@/components/admin/storefront-links-card'

export default function EditPostPurchaseUpsellPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] = useState('always')
  const [minOrderValue, setMinOrderValue] = useState('')
  const [requiredProductIds, setRequiredProductIds] = useState<string[]>([])
  const [upsellProducts, setUpsellProducts] = useState<Array<{product_id: string, variant_id?: string, discount?: number}>>([])
  const [displayDelay, setDisplayDelay] = useState('0')
  const [displayDuration, setDisplayDuration] = useState('')
  const [headline, setHeadline] = useState('')
  const [description, setDescription] = useState('')
  const [ctaText, setCtaText] = useState('Add to Order')
  const [imageUrl, setImageUrl] = useState('')
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [urgencyText, setUrgencyText] = useState('')
  const [status, setStatus] = useState('active')
  const [campaignId, setCampaignId] = useState('none')
  
  // Data
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedProductVariants, setSelectedProductVariants] = useState<any[]>([])
  const [storefrontLinks, setStorefrontLinks] = useState<
    Array<{ id: string; title: string; slug: string; url: string }>
  >([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [rowRes, campaignsResult, productsResult] = await Promise.all([
        getPostPurchaseUpsell(id),
        getAllCampaigns(),
        getActiveProductsForAdmin(),
      ])
      if (cancelled) return
      if (campaignsResult.data) setCampaigns(campaignsResult.data)
      if (productsResult.data) setProducts(productsResult.data)
      if (!rowRes.data) {
        toast.error(rowRes.error || 'Not found')
        router.replace('/admin/promos-upsells/post-purchase')
        return
      }
      const row = rowRes.data
      setName(row.name || '')
      setTriggerType(row.trigger_type || 'always')
      const tc = row.trigger_conditions || {}
      if (row.trigger_type === 'order_value' && tc.min_value != null) {
        setMinOrderValue(String(tc.min_value))
      }
      if (row.trigger_type === 'product_purchased' && Array.isArray(tc.product_ids)) {
        setRequiredProductIds(tc.product_ids)
      }
      setUpsellProducts(Array.isArray(row.upsell_products) ? row.upsell_products : [])
      setDisplayDelay(String(row.display_delay ?? 0))
      setDisplayDuration(row.display_duration != null ? String(row.display_duration) : '')
      setHeadline(row.headline || '')
      setDescription(row.description || '')
      setCtaText(row.cta_text || 'Add to Order')
      setImageUrl(row.image_url || '')
      setDiscountType(row.discount_type || 'percentage')
      setDiscountValue(row.discount_value != null ? String(row.discount_value) : '')
      setUrgencyText(row.urgency_text || '')
      setStatus(row.status || 'active')
      setCampaignId(row.campaign_id || 'none')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, router])

  useEffect(() => {
    const ids = [
      ...requiredProductIds,
      ...upsellProducts.map((u) => u.product_id),
    ].filter(Boolean)
    const unique = [...new Set(ids)]
    if (unique.length === 0) {
      setStorefrontLinks([])
      return
    }
    getProductStorefrontLinks(unique).then((r) => {
      if (r.data) setStorefrontLinks(r.data)
    })
  }, [requiredProductIds, upsellProducts])

  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct)
    }
  }, [selectedProduct])

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

  const addUpsellProduct = () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }
    
    setUpsellProducts([...upsellProducts, {
      product_id: selectedProduct,
      variant_id: selectedProductVariants.length > 0 ? selectedProductVariants[0].id : undefined,
      discount: 0
    }])
    setSelectedProduct('')
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

    const triggerConditions: any = {}
    if (triggerType === 'order_value' && minOrderValue) {
      triggerConditions.min_value = parseFloat(minOrderValue)
    }
    if (triggerType === 'product_purchased' && requiredProductIds.length > 0) {
      triggerConditions.product_ids = requiredProductIds
    }

    setSaving(true)
    try {
      const result = await updatePostPurchaseUpsell(id, {
        campaign_id: campaignId && campaignId !== 'none' ? campaignId : null,
        name: name.trim(),
        trigger_type: triggerType,
        trigger_conditions: Object.keys(triggerConditions).length > 0 ? triggerConditions : null,
        upsell_products: upsellProducts,
        display_delay: parseInt(displayDelay, 10) || 0,
        display_duration: displayDuration ? parseInt(displayDuration, 10) : null,
        headline: headline.trim() || null,
        description: description.trim() || null,
        cta_text: ctaText.trim() || 'Add to Order',
        image_url: imageUrl || null,
        discount_type: discountType || null,
        discount_value: discountValue ? parseFloat(discountValue) : null,
        urgency_text: urgencyText.trim() || null,
        status: status as 'active' | 'inactive',
      })

      if (result.success) {
        toast.success('Updated successfully')
        router.push('/admin/promos-upsells/post-purchase')
      } else {
        toast.error(result.error || 'Failed to update')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Post-Purchase Upsell</h1>
          <p className="text-gray-600 mt-1">Upsell products after checkout completion</p>
        </div>
      </div>

      <StorefrontLinksCard links={storefrontLinks} />

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
                placeholder="e.g., Complete Your Look"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="triggerType">Trigger Type *</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger id="triggerType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always Show</SelectItem>
                    <SelectItem value="order_value">Order Value Threshold</SelectItem>
                    <SelectItem value="product_purchased">Specific Product Purchased</SelectItem>
                    <SelectItem value="category_purchased">Category Purchased</SelectItem>
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
            {triggerType === 'order_value' && (
              <div>
                <Label htmlFor="minOrderValue">Minimum Order Value ($)</Label>
                <Input
                  id="minOrderValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
            {triggerType === 'product_purchased' && (
              <div>
                <Label>Required Products</Label>
                <Select value={selectedProduct} onValueChange={(v) => {
                  if (v && !requiredProductIds.includes(v)) {
                    setRequiredProductIds([...requiredProductIds, v])
                  }
                  setSelectedProduct('')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => !requiredProductIds.includes(p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {requiredProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {requiredProductIds.map(id => {
                      const product = products.find(p => p.id === id)
                      return (
                        <span key={id} className="bg-gray-100 px-2 py-1 rounded text-sm flex items-center gap-2">
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
            )}
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
              <div className="space-y-2 border rounded-lg p-4">
                {upsellProducts.map((product, index) => {
                  const productData = products.find(p => p.id === product.product_id)
                  return (
                    <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{productData?.title || 'Unknown Product'}</p>
                        {selectedProductVariants.length > 0 && (
                          <Select
                            value={product.variant_id || ''}
                            onValueChange={(v) => updateUpsellProduct(index, { variant_id: v })}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUpsellProduct(index)}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayDelay">Display Delay (seconds)</Label>
                <Input
                  id="displayDelay"
                  type="number"
                  min="0"
                  value={displayDelay}
                  onChange={(e) => setDisplayDelay(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="displayDuration">Display Duration (seconds, optional)</Label>
                <Input
                  id="displayDuration"
                  type="number"
                  min="0"
                  value={displayDuration}
                  onChange={(e) => setDisplayDuration(e.target.value)}
                  placeholder="Leave empty for manual dismiss"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ctaText">Button Text</Label>
              <Input
                id="ctaText"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Add to Order"
              />
            </div>
            <div>
              <Label>Upsell Image</Label>
              <ImagePicker
                value={imageUrl}
                onChange={setImageUrl}
              />
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
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType !== 'free_shipping' && (
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
              )}
            </div>
            <div>
              <Label htmlFor="urgencyText">Urgency Text</Label>
              <Input
                id="urgencyText"
                value={urgencyText}
                onChange={(e) => setUrgencyText(e.target.value)}
                placeholder="e.g., Limited time offer!"
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
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}

