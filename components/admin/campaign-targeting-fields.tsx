'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getActiveProductsForAdmin, getDistinctProductCategoriesForAdmin } from '@/app/actions/products'

export type CampaignTargetingPayload = {
  target_products: { product_ids: string[] } | undefined
  target_categories: { category_ids: string[] } | undefined
  target_conditions: Record<string, unknown> | undefined
  display_settings: Record<string, unknown> | undefined
}

export function normalizeCampaignProductIds(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { product_ids?: unknown }).product_ids)) {
    return ((raw as { product_ids: string[] }).product_ids || []).filter(Boolean)
  }
  return []
}

export function normalizeCampaignCategoryIds(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { category_ids?: unknown }).category_ids)) {
    return ((raw as { category_ids: string[] }).category_ids || []).filter(Boolean)
  }
  return []
}

export function buildCampaignTargetingPayload(args: {
  productIds: string[]
  categoryIds: string[]
  minCartValue: string
  maxCartValue: string
  customerSegment: string
  displayTheme: string
  displayPosition: string
}): CampaignTargetingPayload {
  const target_products =
    args.productIds.length > 0 ? { product_ids: args.productIds } : undefined
  const target_categories =
    args.categoryIds.length > 0 ? { category_ids: args.categoryIds } : undefined

  const target_conditions: Record<string, unknown> = {}
  if (args.minCartValue.trim() !== '') {
    const n = parseFloat(args.minCartValue)
    if (!Number.isNaN(n)) target_conditions.min_cart_value = n
  }
  if (args.maxCartValue.trim() !== '') {
    const n = parseFloat(args.maxCartValue)
    if (!Number.isNaN(n)) target_conditions.max_cart_value = n
  }
  if (args.customerSegment && args.customerSegment !== 'any') {
    target_conditions.customer_segment = args.customerSegment
  }

  const display_settings: Record<string, unknown> = {}
  if (args.displayTheme && args.displayTheme !== 'inherit') {
    display_settings.theme = args.displayTheme
  }
  if (args.displayPosition) {
    display_settings.position = args.displayPosition
  }

  return {
    target_products,
    target_categories,
    target_conditions: Object.keys(target_conditions).length ? target_conditions : undefined,
    display_settings: Object.keys(display_settings).length ? display_settings : undefined,
  }
}

export function parseCampaignTargetingFromRecord(record: {
  target_products?: unknown
  target_categories?: unknown
  target_conditions?: unknown
  display_settings?: unknown
}) {
  const cond =
    record.target_conditions && typeof record.target_conditions === 'object' && record.target_conditions !== null
      ? (record.target_conditions as Record<string, unknown>)
      : {}
  const disp =
    record.display_settings && typeof record.display_settings === 'object' && record.display_settings !== null
      ? (record.display_settings as Record<string, unknown>)
      : {}

  const theme = disp.theme
  const position = disp.position

  return {
    productIds: normalizeCampaignProductIds(record.target_products),
    categoryIds: normalizeCampaignCategoryIds(record.target_categories),
    minCartValue: cond.min_cart_value != null && cond.min_cart_value !== '' ? String(cond.min_cart_value) : '',
    maxCartValue: cond.max_cart_value != null && cond.max_cart_value !== '' ? String(cond.max_cart_value) : '',
    customerSegment:
      typeof cond.customer_segment === 'string' && cond.customer_segment
        ? cond.customer_segment
        : 'any',
    displayTheme: typeof theme === 'string' && theme ? theme : 'inherit',
    displayPosition: typeof position === 'string' && position ? position : 'bottom',
  }
}

type CampaignTargetingFieldsProps = {
  productIds: string[]
  onProductIdsChange: (ids: string[]) => void
  categoryIds: string[]
  onCategoryIdsChange: (ids: string[]) => void
  minCartValue: string
  onMinCartValueChange: (v: string) => void
  maxCartValue: string
  onMaxCartValueChange: (v: string) => void
  customerSegment: string
  onCustomerSegmentChange: (v: string) => void
  displayTheme: string
  onDisplayThemeChange: (v: string) => void
  displayPosition: string
  onDisplayPositionChange: (v: string) => void
}

export function CampaignTargetingFields({
  productIds,
  onProductIdsChange,
  categoryIds,
  onCategoryIdsChange,
  minCartValue,
  onMinCartValueChange,
  maxCartValue,
  onMaxCartValueChange,
  customerSegment,
  onCustomerSegmentChange,
  displayTheme,
  onDisplayThemeChange,
  displayPosition,
  onDisplayPositionChange,
}: CampaignTargetingFieldsProps) {
  const [products, setProducts] = useState<{ id: string; title: string }[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [pickProduct, setPickProduct] = useState('')
  const [pickCategory, setPickCategory] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [pRes, cRes] = await Promise.all([
        getActiveProductsForAdmin(),
        getDistinctProductCategoriesForAdmin(),
      ])
      if (cancelled) return
      if (pRes.data) setProducts(pRes.data.map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })))
      if (cRes.data) setCategories(cRes.data)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const addProduct = () => {
    if (!pickProduct || productIds.includes(pickProduct)) {
      setPickProduct('')
      return
    }
    onProductIdsChange([...productIds, pickProduct])
    setPickProduct('')
  }

  const addCategory = () => {
    if (!pickCategory || categoryIds.includes(pickCategory)) {
      setPickCategory('')
      return
    }
    onCategoryIdsChange([...categoryIds, pickCategory])
    setPickCategory('')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Target settings</CardTitle>
          <CardDescription>
            Limit this campaign to certain products, categories, or cart / customer rules. All fields are optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Target products</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={pickProduct} onValueChange={setPickProduct}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a product to add" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {products
                    .filter((p) => !productIds.includes(p.id))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" onClick={addProduct}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {productIds.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {productIds.map((id) => {
                  const title = products.find((p) => p.id === id)?.title || id.slice(0, 8) + '…'
                  return (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                      <span className="max-w-[200px] truncate">{title}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={() => onProductIdsChange(productIds.filter((x) => x !== id))}
                        aria-label={`Remove ${title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No products selected — campaign can apply broadly.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Target categories</Label>
            <p className="text-xs text-muted-foreground">
              Uses each product&apos;s category field in your catalog.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={pickCategory} onValueChange={setPickCategory}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={categories.length ? 'Choose a category' : 'No categories in catalog'} />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => !categoryIds.includes(c))
                    .map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" onClick={addCategory} disabled={!categories.length}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {categoryIds.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {categoryIds.map((c) => (
                  <Badge key={c} variant="outline" className="gap-1 pr-1 font-normal">
                    {c}
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => onCategoryIdsChange(categoryIds.filter((x) => x !== c))}
                      aria-label={`Remove ${c}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No categories selected.</p>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Target conditions</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minCart">Minimum cart value ($)</Label>
                <Input
                  id="minCart"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Any"
                  value={minCartValue}
                  onChange={(e) => onMinCartValueChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCart">Maximum cart value ($)</Label>
                <Input
                  id="maxCart"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Any"
                  value={maxCartValue}
                  onChange={(e) => onMaxCartValueChange(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Customer segment</Label>
              <Select value={customerSegment} onValueChange={onCustomerSegmentChange}>
                <SelectTrigger id="segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any customer</SelectItem>
                  <SelectItem value="new">New customers</SelectItem>
                  <SelectItem value="returning">Returning customers</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  {customerSegment !== 'any' &&
                    !['new', 'returning', 'vip', 'wholesale'].includes(customerSegment) && (
                      <SelectItem value={customerSegment}>Saved value: {customerSegment}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display settings</CardTitle>
          <CardDescription>How upsells tied to this campaign can present on the storefront.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select value={displayTheme} onValueChange={onDisplayThemeChange}>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Store default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                {displayTheme &&
                  !['inherit', 'light', 'dark'].includes(displayTheme) && (
                    <SelectItem value={displayTheme}>Saved: {displayTheme}</SelectItem>
                  )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select value={displayPosition} onValueChange={onDisplayPositionChange}>
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="sidebar">Sidebar</SelectItem>
                <SelectItem value="popup">Popup</SelectItem>
                <SelectItem value="inline">Inline</SelectItem>
                {displayPosition &&
                  !['top', 'bottom', 'sidebar', 'popup', 'inline'].includes(displayPosition) && (
                    <SelectItem value={displayPosition}>Saved: {displayPosition}</SelectItem>
                  )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
