'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Search, Edit, Copy, Check } from 'lucide-react'
import { getSubscriptionProducts } from '@/app/actions/subscriptions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SubscriptionProductsPage() {
  const router = useRouter()
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    const result = await getSubscriptionProducts()
    if (result.error) {
      toast.error('Failed to load subscription products')
    } else {
      setSubscriptionProducts(result.data || [])
    }
    setLoading(false)
  }

  // Group subscription products by product_id
  const groupedProducts = useMemo(() => {
    const grouped = new Map<string, {
      product: any
      variants: any[]
      totalVariants: number
      activeVariants: number
    }>()

    subscriptionProducts.forEach((sub) => {
      const productId = sub.product_id
      const product = sub.products

      if (!grouped.has(productId)) {
        grouped.set(productId, {
          product,
          variants: [],
          totalVariants: 0,
          activeVariants: 0,
        })
      }

      const group = grouped.get(productId)!
      group.variants.push(sub)
      group.totalVariants++
      if (sub.status === 'active') {
        group.activeVariants++
      }
    })

    return Array.from(grouped.values())
  }, [subscriptionProducts])

  const filteredProducts = groupedProducts.filter(group => {
    const productTitle = group.product?.title || ''
    const searchLower = searchTerm.toLowerCase()
    return productTitle.toLowerCase().includes(searchLower)
  })

  const copyProductUrl = async (productSlug: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const productUrl = `${baseUrl}/product/${productSlug}`
    
    try {
      await navigator.clipboard.writeText(productUrl)
      setCopiedUrl(productSlug)
      toast.success('Product URL copied to clipboard!')
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('Failed to copy URL')
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription Products</h1>
          <p className="text-gray-600 mt-1">View and manage subscription product configurations</p>
        </div>
        <Link href="/admin/subscriptions/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Subscription
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading subscription products...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Variants</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Active</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No products found matching your search' : 'No subscription products found'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((group) => {
                  const product = group.product
                  
                  return (
                    <tr key={product?.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium">{product?.title || 'N/A'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {group.variants.map((sub: any) => {
                            const variant = sub.product_variants
                            return (
                              <Badge key={sub.id} variant="secondary" className="text-xs">
                                {variant?.color || 'N/A'}
                              </Badge>
                            )
                          })}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {group.totalVariants} variant{group.totalVariants !== 1 ? 's' : ''} total
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={group.activeVariants > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {group.activeVariants} active
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {product?.slug && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyProductUrl(product.slug)}
                              title="Copy product URL"
                            >
                              {copiedUrl === product.slug ? (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy URL
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/subscriptions/products/${product?.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Products</div>
          <div className="text-2xl font-bold">{groupedProducts.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Variants</div>
          <div className="text-2xl font-bold text-blue-600">
            {subscriptionProducts.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Active Variants</div>
          <div className="text-2xl font-bold text-green-600">
            {subscriptionProducts.filter(p => p.status === 'active').length}
          </div>
        </div>
      </div>
    </div>
  )
}

