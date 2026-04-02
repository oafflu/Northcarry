'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCart } from '@/lib/cart-context'
import { trackUpsellEvent } from '@/app/actions/upsells'

type FbtGroup = {
  id: string
  headline?: string
  campaign_id?: string
  max_products?: number
  related_products: Array<{ product_id: string; variant_id?: string; quantity?: number }>
}

type ProductRow = {
  id: string
  title: string
  slug: string
  base_price: number
  product_variants?: Array<{ id: string; color: string; price: number; image_url?: string }>
}

export function FrequentlyBoughtSection({ productId }: { productId: string }) {
  const { addItem } = useCart()
  const [groups, setGroups] = useState<FbtGroup[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/upsells/frequently-bought?product_id=${encodeURIComponent(productId)}`
        )
        const data = await res.json()
        if (cancelled) return
        setGroups(data.groups || [])
        setProducts(data.products || [])
      } catch {
        if (!cancelled) {
          setGroups([])
          setProducts([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!groups.length) return
    for (const g of groups) {
      trackUpsellEvent({
        campaign_id: g.campaign_id,
        upsell_type: 'frequently_bought',
        upsell_id: g.id,
        event_type: 'view',
        session_id: sessionId,
        product_ids: [productId],
      })
    }
  }, [groups, productId, sessionId])

  const addRelatedToCart = async (group: FbtGroup, productRow: ProductRow) => {
    const rel = group.related_products.find((r) => r.product_id === productRow.id)
    const variant =
      productRow.product_variants?.find((v) => v.id === rel?.variant_id) ||
      productRow.product_variants?.[0]
    if (!variant) return

    await trackUpsellEvent({
      campaign_id: group.campaign_id,
      upsell_type: 'frequently_bought',
      upsell_id: group.id,
      event_type: 'click',
      session_id: sessionId,
      product_ids: [productRow.id],
    })

    const qty = rel?.quantity && rel.quantity > 0 ? rel.quantity : 1
    await addItem({
      id: `${variant.id}-${Date.now()}`,
      name: productRow.title,
      color: variant.color || '',
      quantity: qty,
      price: parseFloat(String(variant.price)),
      originalPrice: parseFloat(String(variant.price)),
      image: variant.image_url || '/placeholder.jpg',
      variantId: variant.id,
    })

    await trackUpsellEvent({
      campaign_id: group.campaign_id,
      upsell_type: 'frequently_bought',
      upsell_id: group.id,
      event_type: 'add_to_cart',
      session_id: sessionId,
      product_ids: [productRow.id],
    })
  }

  if (loading || groups.length === 0) return null

  return (
    <section className="border-t py-12">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {groups.map((group) => {
          const max = group.max_products && group.max_products > 0 ? group.max_products : 6
          const relatedIds = group.related_products.map((r) => r.product_id).slice(0, max)
          const rows = relatedIds
            .map((rid) => products.find((p) => p.id === rid))
            .filter(Boolean) as ProductRow[]
          if (rows.length === 0) return null

          return (
            <div key={group.id} className="mb-10 last:mb-0">
              <div className="mb-6 flex items-center gap-3">
                <Users className="h-6 w-6 text-teal-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  {group.headline?.trim() || 'Frequently bought together'}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((p) => {
                  const variant =
                    p.product_variants?.find((v) =>
                      group.related_products.some(
                        (r) => r.product_id === p.id && r.variant_id === v.id
                      )
                    ) || p.product_variants?.[0]
                  const img = variant?.image_url || '/placeholder.jpg'
                  return (
                    <Card key={`${group.id}-${p.id}`} className="overflow-hidden">
                      <CardContent className="p-0">
                        <Link href={`/product/${p.slug}`} className="block">
                          <div className="relative aspect-square w-full bg-gray-100">
                            <Image
                              src={img}
                              alt={p.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          </div>
                          <div className="p-4">
                            <p className="font-medium text-gray-900">{p.title}</p>
                            {variant && (
                              <p className="mt-1 text-sm text-gray-600">
                                ${parseFloat(String(variant.price)).toFixed(2)}
                                {variant.color ? ` · ${variant.color}` : ''}
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="px-4 pb-4">
                          <Button
                            type="button"
                            className="w-full"
                            size="sm"
                            onClick={() => addRelatedToCart(group, p)}
                            disabled={!variant}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Add to cart
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
