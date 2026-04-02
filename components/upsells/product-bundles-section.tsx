'use client'

import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import { ProductBundle } from './product-bundle'

interface ProductBundlesSectionProps {
  productId: string
}

export function ProductBundlesSection({ productId }: ProductBundlesSectionProps) {
  const [bundles, setBundles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBundles()
  }, [productId])

  const loadBundles = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/upsells/bundles')
      const data = await response.json()
      
      // Filter bundles that include this product
      const relevantBundles = data.bundles?.filter((bundle: any) => {
        const mainProductIds = bundle.main_products?.map((mp: any) => mp.product_id) || []
        return mainProductIds.includes(productId)
      }) || []
      
      setBundles(relevantBundles)
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error loading bundles:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || bundles.length === 0) return null

  return (
    <section className="py-12 border-t">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6 text-teal-600" />
          <h2 className="text-2xl font-bold text-gray-900">Bundle Deals</h2>
        </div>
        <div className="space-y-4">
          {bundles.map((bundle) => (
            <ProductBundle key={bundle.id} bundle={bundle} products={products} />
          ))}
        </div>
      </div>
    </section>
  )
}

