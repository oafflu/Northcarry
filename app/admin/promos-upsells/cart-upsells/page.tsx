'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ShoppingCart, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getAllCartUpsells, deleteCartUpsell, updateCartUpsell } from '@/app/actions/upsells'
import { PromoStorefrontActions } from '@/components/admin/promo-storefront-actions'

export default function CartUpsellsPage() {
  const router = useRouter()
  const [upsells, setUpsells] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUpsells()
  }, [])

  const loadUpsells = async () => {
    setLoading(true)
    try {
      const result = await getAllCartUpsells()
      if (result.data) {
        setUpsells(result.data)
      }
    } catch (error) {
      console.error('Error loading cart upsells:', error)
      toast.error('Failed to load cart upsells')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (upsellId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateCartUpsell(upsellId, { status: newStatus })
    if (result.success) {
      toast.success(`Cart upsell ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      loadUpsells()
    } else {
      toast.error(result.error || 'Failed to update cart upsell')
    }
  }

  const handleDelete = async (upsellId: string) => {
    if (!confirm('Are you sure you want to delete this cart upsell?')) return
    
    const result = await deleteCartUpsell(upsellId)
    if (result.success) {
      toast.success('Cart upsell deleted')
      loadUpsells()
    } else {
      toast.error(result.error || 'Failed to delete cart upsell')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cart Upsells</h1>
          <p className="text-gray-600 mt-1">Show upsell offers on the cart page</p>
        </div>
        <Button onClick={() => router.push('/admin/promos-upsells/cart-upsells/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Create Cart Upsell
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading cart upsells...</p>
        </div>
      ) : upsells.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No cart upsells yet</h3>
            <p className="text-gray-600 mb-4">Create upsell offers that appear on the shopping cart page</p>
            <Button onClick={() => router.push('/admin/promos-upsells/cart-upsells/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Cart Upsell
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upsells.map((upsell) => (
            <Card key={upsell.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{upsell.name}</CardTitle>
                  {upsell.status === 'active' ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <CardDescription>
                  Position: {upsell.position || 'default'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PromoStorefrontActions
                  className="mb-4"
                  productPreview={upsell.storefront_preview}
                  contextualPreviews={[{ label: 'cart page', path: '/cart' }]}
                  hint="first upsell product; widget shows on cart"
                />
                <div className="space-y-2 mb-4">
                  {upsell.headline && (
                    <p className="text-sm font-medium">{upsell.headline}</p>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Products:</span>
                    <span className="font-medium">{upsell.upsell_products?.length || 0}</span>
                  </div>
                  {upsell.min_cart_value && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Min Cart:</span>
                      <span className="font-medium">${upsell.min_cart_value}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleStatus(upsell.id, upsell.status)}>
                    {upsell.status === 'active' ? (
                      <EyeOff className="w-3 h-3" />
                    ) : (
                      <Eye className="w-3 h-3" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/promos-upsells/cart-upsells/${upsell.id}`)}>
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(upsell.id)}>
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

