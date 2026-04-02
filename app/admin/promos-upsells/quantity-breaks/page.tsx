'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Layers, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getAllQuantityBreaks, deleteQuantityBreak, updateQuantityBreak } from '@/app/actions/upsells'
import { PromoStorefrontActions } from '@/components/admin/promo-storefront-actions'

export default function QuantityBreaksPage() {
  const router = useRouter()
  const [breaks, setBreaks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBreaks()
  }, [])

  const loadBreaks = async () => {
    setLoading(true)
    try {
      const result = await getAllQuantityBreaks()
      if (result.data) {
        setBreaks(result.data)
      }
    } catch (error) {
      console.error('Error loading quantity breaks:', error)
      toast.error('Failed to load quantity breaks')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (breakId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateQuantityBreak(breakId, { status: newStatus })
    if (result.success) {
      toast.success(`Quantity break ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      loadBreaks()
    } else {
      toast.error(result.error || 'Failed to update quantity break')
    }
  }

  const handleDelete = async (breakId: string) => {
    if (!confirm('Are you sure you want to delete this quantity break?')) return
    
    const result = await deleteQuantityBreak(breakId)
    if (result.success) {
      toast.success('Quantity break deleted')
      loadBreaks()
    } else {
      toast.error(result.error || 'Failed to delete quantity break')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quantity Breaks</h1>
          <p className="text-gray-600 mt-1">Set volume discounts and tier pricing</p>
        </div>
        <Button onClick={() => router.push('/admin/promos-upsells/quantity-breaks/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quantity Break
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading quantity breaks...</p>
        </div>
      ) : breaks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No quantity breaks yet</h3>
            <p className="text-gray-600 mb-4">Create volume discounts and tier pricing for products</p>
            <Button onClick={() => router.push('/admin/promos-upsells/quantity-breaks/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Quantity Break
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {breaks.map((breakItem) => {
            const product = breakItem.products
            const variant = breakItem.product_variants
            return (
              <Card key={breakItem.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{product?.title || 'Unknown Product'}</CardTitle>
                      <CardDescription>
                        {variant ? `${variant.color} - ${variant.sku}` : 'All Variants'}
                      </CardDescription>
                    </div>
                    {breakItem.status === 'active' ? (
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
                      breakItem.storefront_preview
                        ? {
                            slug: breakItem.storefront_preview.slug,
                            title: breakItem.storefront_preview.title,
                          }
                        : product?.slug
                          ? { slug: product.slug, title: product.title }
                          : null
                    }
                    hint="tiers show on this product page when enabled"
                  />
                  <div className="space-y-2 mb-4">
                    {breakItem.tiers && Array.isArray(breakItem.tiers) && breakItem.tiers.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Tiers:</p>
                        <div className="flex flex-wrap gap-2">
                          {breakItem.tiers.map((tier: any, index: number) => (
                            <span key={index} className="bg-gray-100 px-3 py-1 rounded text-sm">
                              {tier.quantity}+ = {tier.discount_type === 'percentage' 
                                ? `${tier.discount_value}% OFF`
                                : `$${tier.discount_value} OFF`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(breakItem.id, breakItem.status)}>
                      {breakItem.status === 'active' ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/admin/promos-upsells/quantity-breaks/${breakItem.id}`)}>
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(breakItem.id)}>
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

