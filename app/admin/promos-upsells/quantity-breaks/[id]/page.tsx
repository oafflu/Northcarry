'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  getQuantityBreak,
  getAllCampaigns,
  updateQuantityBreak,
  getProductStorefrontLinks,
} from '@/app/actions/upsells'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { StorefrontLinksCard } from '@/components/admin/storefront-links-card'

export default function EditQuantityBreakPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('all')
  const [breakType, setBreakType] = useState('quantity')
  const [campaignId, setCampaignId] = useState('none')
  const [tiers, setTiers] = useState<
    Array<{ quantity: number; discount_type: string; discount_value: number }>
  >([])
  const [badgeText, setBadgeText] = useState('')
  const [showOnProduct, setShowOnProduct] = useState(true)
  const [showInCart, setShowInCart] = useState(true)
  const [status, setStatus] = useState('active')

  const [campaigns, setCampaigns] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [storefrontLinks, setStorefrontLinks] = useState<
    Array<{ id: string; title: string; slug: string; url: string }>
  >([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [breakRes, campaignsRes, productsRes] = await Promise.all([
        getQuantityBreak(id),
        getAllCampaigns(),
        getActiveProductsForAdmin(),
      ])
      if (cancelled) return
      if (campaignsRes.data) setCampaigns(campaignsRes.data)
      if (productsRes.data) setProducts(productsRes.data)
      if (!breakRes.data) {
        toast.error(breakRes.error || 'Quantity break not found')
        router.replace('/admin/promos-upsells/quantity-breaks')
        return
      }
      const qb = breakRes.data
      setProductId(qb.product_id || '')
      setVariantId(qb.variant_id || 'all')
      setBreakType(qb.break_type || 'quantity')
      setCampaignId(qb.campaign_id || 'none')
      setTiers(Array.isArray(qb.tiers) ? qb.tiers : [])
      setBadgeText(qb.badge_text || '')
      setShowOnProduct(qb.show_on_product !== false)
      setShowInCart(qb.show_in_cart !== false)
      setStatus(qb.status || 'active')
      if (qb.product_id) {
        const linkRes = await getProductStorefrontLinks([qb.product_id])
        if (!cancelled && linkRes.data) setStorefrontLinks(linkRes.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, router])

  useEffect(() => {
    if (productId) {
      loadVariants(productId)
    }
  }, [productId])

  const loadVariants = async (prodId: string) => {
    const result = await getProductVariantsForAdmin(prodId)
    if (result.data) setVariants(result.data)
  }

  useEffect(() => {
    if (productId) {
      getProductStorefrontLinks([productId]).then((r) => {
        if (r.data) setStorefrontLinks(r.data)
      })
    } else {
      setStorefrontLinks([])
    }
  }, [productId])

  const addTier = () => {
    setTiers([...tiers, { quantity: 2, discount_type: 'percentage', discount_value: 10 }])
  }

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, updates: any) => {
    const updated = [...tiers]
    updated[index] = { ...updated[index], ...updates }
    setTiers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) {
      toast.error('Product is required')
      return
    }
    if (tiers.length === 0) {
      toast.error('At least one quantity tier is required')
      return
    }
    const sortedTiers = [...tiers].sort((a, b) => a.quantity - b.quantity)
    setSaving(true)
    try {
      const result = await updateQuantityBreak(id, {
        campaign_id: campaignId && campaignId !== 'none' ? campaignId : null,
        product_id: productId,
        variant_id: variantId && variantId !== 'all' ? variantId : null,
        break_type: breakType,
        tiers: sortedTiers,
        badge_text: badgeText.trim() || null,
        show_on_product: showOnProduct,
        show_in_cart: showInCart,
        status: status as 'active' | 'inactive',
      })
      if (result.success) {
        toast.success('Quantity break updated')
        router.push('/admin/promos-upsells/quantity-breaks')
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
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Quantity Break</h1>
          <p className="mt-1 text-gray-600">Volume discounts and tier pricing</p>
        </div>
      </div>

      <StorefrontLinksCard links={storefrontLinks} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Selection</CardTitle>
            <CardDescription>Product and variant for quantity breaks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="product">Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {variants.length > 0 && (
              <div>
                <Label htmlFor="variant">Variant (Optional)</Label>
                <Select value={variantId} onValueChange={setVariantId}>
                  <SelectTrigger id="variant">
                    <SelectValue placeholder="All variants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Variants</SelectItem>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.color || v.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="breakType">Break Type *</Label>
                <Select value={breakType} onValueChange={setBreakType}>
                  <SelectTrigger id="breakType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantity">Quantity</SelectItem>
                    <SelectItem value="tier">Tier</SelectItem>
                    <SelectItem value="bulk">Bulk</SelectItem>
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
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Quantity Tiers *</CardTitle>
                <CardDescription>Discount at each quantity level</CardDescription>
              </div>
              <Button type="button" onClick={addTier}>
                <Plus className="mr-2 h-4 w-4" />
                Add Tier
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tiers.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <p>No tiers yet. Click Add Tier.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 rounded-lg border bg-gray-50 p-4"
                  >
                    <div className="grid flex-1 grid-cols-3 gap-4">
                      <div>
                        <Label>Min Quantity *</Label>
                        <Input
                          type="number"
                          min={1}
                          value={tier.quantity}
                          onChange={(e) =>
                            updateTier(index, { quantity: parseInt(e.target.value, 10) || 1 })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Discount Type *</Label>
                        <Select
                          value={tier.discount_type}
                          onValueChange={(v) => updateTier(index, { discount_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Discount Value *</Label>
                        <Input
                          type="number"
                          min={0}
                          max={tier.discount_type === 'percentage' ? 100 : undefined}
                          step={tier.discount_type === 'percentage' ? '1' : '0.01'}
                          value={tier.discount_value}
                          onChange={(e) =>
                            updateTier(index, { discount_value: parseFloat(e.target.value) || 0 })
                          }
                          required
                        />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTier(index)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Tiers are sorted by quantity; customers get the best applicable discount.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>Where the quantity break appears</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="badgeText">Badge Text</Label>
              <Input
                id="badgeText"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g., Volume Discount"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnProduct}
                  onChange={(e) => setShowOnProduct(e.target.checked)}
                />
                <span>Show on product page</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInCart}
                  onChange={(e) => setShowInCart(e.target.checked)}
                />
                <span>Show in cart</span>
              </label>
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

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
