'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ShoppingBag, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getAllFrequentlyBoughtTogether, deleteFrequentlyBoughtTogether, updateFrequentlyBoughtTogether } from '@/app/actions/upsells'
import { PromoStorefrontActions } from '@/components/admin/promo-storefront-actions'

export default function FrequentlyBoughtTogetherPage() {
  const router = useRouter()
  const [fbtItems, setFbtItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFBTItems()
  }, [])

  const loadFBTItems = async () => {
    setLoading(true)
    try {
      const result = await getAllFrequentlyBoughtTogether()
      if (result.data) {
        setFbtItems(result.data)
      }
    } catch (error) {
      console.error('Error loading frequently bought together:', error)
      toast.error('Failed to load FBT items')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (fbtId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateFrequentlyBoughtTogether(fbtId, { status: newStatus })
    if (result.success) {
      toast.success(`FBT ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      loadFBTItems()
    } else {
      toast.error(result.error || 'Failed to update FBT')
    }
  }

  const handleDelete = async (fbtId: string) => {
    if (!confirm('Are you sure you want to delete this frequently bought together item?')) return
    
    const result = await deleteFrequentlyBoughtTogether(fbtId)
    if (result.success) {
      toast.success('FBT deleted')
      loadFBTItems()
    } else {
      toast.error(result.error || 'Failed to delete FBT')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Frequently Bought Together</h1>
          <p className="text-gray-600 mt-1">Suggest complementary products to customers</p>
        </div>
        <Button onClick={() => router.push('/admin/promos-upsells/frequently-bought/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create FBT
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading frequently bought together items...</p>
        </div>
      ) : fbtItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingBag className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No frequently bought together items yet</h3>
            <p className="text-gray-600 mb-4">Create product recommendations based on purchase history or manual selection</p>
            <Button onClick={() => router.push('/admin/promos-upsells/frequently-bought/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create FBT
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {fbtItems.map((fbt) => {
            const mainProduct = fbt.products
            return (
              <Card key={fbt.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{mainProduct?.title || 'Unknown Product'}</CardTitle>
                      <CardDescription>
                        Algorithm: {fbt.algorithm_type || 'manual'} • 
                        Related Products: {fbt.related_products?.length || 0}
                      </CardDescription>
                    </div>
                    {fbt.status === 'active' ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <PromoStorefrontActions
                    className="mb-4"
                    productPreview={
                      fbt.storefront_preview
                        ? {
                            slug: fbt.storefront_preview.slug,
                            title: fbt.storefront_preview.title,
                          }
                        : mainProduct?.slug
                          ? { slug: mainProduct.slug, title: mainProduct.title }
                          : null
                    }
                    hint="recommendations show on this product page when active"
                  />
                  {fbt.headline && (
                    <p className="text-sm text-gray-600 mb-4">{fbt.headline}</p>
                  )}
                  {fbt.show_discount && fbt.bundle_discount && (
                    <p className="text-sm font-medium text-teal-600 mb-4">
                      Bundle Discount: {fbt.bundle_discount}%
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(fbt.id, fbt.status)}>
                      {fbt.status === 'active' ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/admin/promos-upsells/frequently-bought/${fbt.id}`)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(fbt.id)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
