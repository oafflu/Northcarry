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
import { createFrequentlyBoughtTogether, getAllCampaigns } from '@/app/actions/upsells'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'

export default function NewFrequentlyBoughtTogetherPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [mainProductId, setMainProductId] = useState('')
  const [relatedProducts, setRelatedProducts] = useState<Array<{product_id: string, variant_id?: string, quantity?: number}>>([])
  const [algorithmType, setAlgorithmType] = useState('manual')
  const [maxProducts, setMaxProducts] = useState('4')
  const [headline, setHeadline] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [bundleDiscount, setBundleDiscount] = useState('')
  const [status, setStatus] = useState('active')
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

  const addRelatedProduct = () => {
    if (!selectedProduct) {
      toast.error('Please select a product')
      return
    }
    
    setRelatedProducts([...relatedProducts, {
      product_id: selectedProduct,
      variant_id: selectedProductVariants.length > 0 ? selectedProductVariants[0].id : undefined,
      quantity: 1
    }])
    setSelectedProduct('')
  }

  const removeRelatedProduct = (index: number) => {
    setRelatedProducts(relatedProducts.filter((_, i) => i !== index))
  }

  const updateRelatedProduct = (index: number, updates: any) => {
    const updated = [...relatedProducts]
    updated[index] = { ...updated[index], ...updates }
    setRelatedProducts(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!mainProductId) {
      toast.error('Main product is required')
      return
    }

    if (relatedProducts.length === 0) {
      toast.error('At least one related product is required')
      return
    }

    setSaving(true)
    try {
      const result = await createFrequentlyBoughtTogether({
        campaign_id: campaignId && campaignId !== 'none' ? campaignId : undefined,
        main_product_id: mainProductId,
        related_products: relatedProducts,
        algorithm_type: algorithmType,
        max_products: parseInt(maxProducts) || 4,
        headline: headline.trim() || undefined,
        show_discount: showDiscount,
        bundle_discount: bundleDiscount ? parseFloat(bundleDiscount) : undefined,
        status: status as 'active' | 'inactive',
      })

      if (result.success) {
        toast.success('Frequently Bought Together created successfully')
        router.push('/admin/promos-upsells/frequently-bought')
      } else {
        toast.error(result.error || 'Failed to create frequently bought together')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create frequently bought together')
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
          <h1 className="text-3xl font-bold text-gray-900">Create Frequently Bought Together</h1>
          <p className="text-gray-600 mt-1">Suggest complementary products to customers</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Main Product *</CardTitle>
            <CardDescription>Select the product that will show related product suggestions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mainProduct">Product *</Label>
              <Select value={mainProductId} onValueChange={setMainProductId}>
                <SelectTrigger id="mainProduct">
                  <SelectValue placeholder="Select main product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="algorithmType">Algorithm Type</Label>
                <Select value={algorithmType} onValueChange={setAlgorithmType}>
                  <SelectTrigger id="algorithmType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                    <SelectItem value="purchase_history">Purchase History</SelectItem>
                    <SelectItem value="category">Same Category</SelectItem>
                    <SelectItem value="tags">Similar Tags</SelectItem>
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
            {algorithmType === 'manual' && (
              <div>
                <Label htmlFor="maxProducts">Max Products to Show</Label>
                <Input
                  id="maxProducts"
                  type="number"
                  min="1"
                  max="10"
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Maximum number of related products to display</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related Products */}
        {algorithmType === 'manual' && (
          <Card>
            <CardHeader>
              <CardTitle>Related Products *</CardTitle>
              <CardDescription>Products to suggest when viewing the main product</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => p.id !== mainProductId).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addRelatedProduct}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>

              {relatedProducts.length > 0 && (
                <div className="space-y-2 border rounded-lg p-4">
                  {relatedProducts.map((product, index) => {
                    const productData = products.find(p => p.id === product.product_id)
                    return (
                      <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{productData?.title || 'Unknown Product'}</p>
                          {selectedProductVariants.length > 0 && (
                            <Select
                              value={product.variant_id || ''}
                              onValueChange={(v) => updateRelatedProduct(index, { variant_id: v })}
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
                            value={product.quantity || 1}
                            onChange={(e) => updateRelatedProduct(index, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-20"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRelatedProduct(index)}
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
        )}

        {/* Display Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>Customize how the suggestions appear</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g., Frequently Bought Together, Complete Your Look"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showDiscount"
                checked={showDiscount}
                onChange={(e) => setShowDiscount(e.target.checked)}
              />
              <Label htmlFor="showDiscount" className="cursor-pointer">
                Show bundle discount
              </Label>
            </div>
            {showDiscount && (
              <div>
                <Label htmlFor="bundleDiscount">Bundle Discount (%)</Label>
                <Input
                  id="bundleDiscount"
                  type="number"
                  min="0"
                  max="100"
                  value={bundleDiscount}
                  onChange={(e) => setBundleDiscount(e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">Discount percentage when buying all items together</p>
              </div>
            )}
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
            {saving ? 'Creating...' : 'Create Frequently Bought Together'}
          </Button>
        </div>
      </form>
    </div>
  )
}

