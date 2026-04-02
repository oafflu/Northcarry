'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Package, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getAllBundles, deleteBundle, updateBundle } from '@/app/actions/upsells'
import { PromoStorefrontActions } from '@/components/admin/promo-storefront-actions'

export default function ProductBundlesPage() {
  const router = useRouter()
  const [bundles, setBundles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBundles()
  }, [])

  const loadBundles = async () => {
    setLoading(true)
    try {
      const result = await getAllBundles()
      if (result.data) {
        setBundles(result.data)
      }
    } catch (error) {
      console.error('Error loading bundles:', error)
      toast.error('Failed to load bundles')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (bundleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateBundle(bundleId, { status: newStatus })
    if (result.success) {
      toast.success(`Bundle ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      loadBundles()
    } else {
      toast.error(result.error || 'Failed to update bundle')
    }
  }

  const handleDelete = async (bundleId: string) => {
    if (!confirm('Are you sure you want to delete this bundle?')) return
    
    const result = await deleteBundle(bundleId)
    if (result.success) {
      toast.success('Bundle deleted')
      loadBundles()
    } else {
      toast.error(result.error || 'Failed to delete bundle')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Bundles</h1>
          <p className="text-gray-600 mt-1">Create buy X get Y bundles and product combos</p>
        </div>
        <Button onClick={() => router.push('/admin/promos-upsells/bundles/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Bundle
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading bundles...</p>
        </div>
      ) : bundles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No bundles yet</h3>
            <p className="text-gray-600 mb-4">Create your first product bundle to increase average order value</p>
            <Button onClick={() => router.push('/admin/promos-upsells/bundles/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{bundle.name}</CardTitle>
                  {bundle.status === 'active' ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <CardDescription>{bundle.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <PromoStorefrontActions
                  className="mb-4"
                  productPreview={bundle.storefront_preview}
                  hint="bundle appears on this product page when active"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleStatus(bundle.id, bundle.status)}>
                    {bundle.status === 'active' ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/promos-upsells/bundles/${bundle.id}`)}>
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(bundle.id)}>
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

