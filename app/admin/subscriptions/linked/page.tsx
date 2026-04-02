'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Search, Edit, Trash2, Package, Eye, Copy, ToggleLeft, ToggleRight } from 'lucide-react'
import { getAllLinkedSubscriptions, deleteLinkedSubscription, updateLinkedSubscription, createLinkedSubscription } from '@/app/actions/subscriptions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function LinkedSubscriptionsPage() {
  const router = useRouter()
  const [linkedSubs, setLinkedSubs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadLinkedSubscriptions()
  }, [])

  const loadLinkedSubscriptions = async () => {
    setLoading(true)
    const result = await getAllLinkedSubscriptions()
    if (result.error) {
      toast.error('Failed to load linked subscriptions')
    } else {
      setLinkedSubs(result.data || [])
    }
    setLoading(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the linked subscription "${name || 'Untitled'}"?`)) {
      return
    }

    const result = await deleteLinkedSubscription(id)
    if (result.success) {
      toast.success('Linked subscription deleted successfully')
      loadLinkedSubscriptions()
    } else {
      toast.error(result.error || 'Failed to delete linked subscription')
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string, name: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const result = await updateLinkedSubscription(id, { status: newStatus })
    
    if (result.success) {
      toast.success(`Linked subscription "${name || 'Untitled'}" ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`)
      loadLinkedSubscriptions()
    } else {
      toast.error(result.error || 'Failed to update status')
    }
  }

  const handleDuplicate = async (linkedSub: any) => {
    if (!confirm(`Create a copy of "${linkedSub.name || 'Untitled'}"?`)) {
      return
    }

    try {
      const result = await createLinkedSubscription({
        trigger_product_id: linkedSub.trigger_product_id,
        trigger_variant_id: linkedSub.trigger_variant_id || undefined,
        subscription_product_id: linkedSub.subscription_product_id,
        frequency_months: linkedSub.frequency_months || 2,
        purchase_type: linkedSub.purchase_type || 'ongoing',
        quantity: linkedSub.quantity || 1,
        start_after_months: linkedSub.start_after_months || 2,
        billing_days_before_delivery: linkedSub.billing_days_before_delivery || 15,
        min_quantity: linkedSub.min_quantity || 1,
        auto_activate: linkedSub.auto_activate !== false,
        name: linkedSub.name ? `${linkedSub.name} (Copy)` : undefined,
        description: linkedSub.description || undefined,
        status: 'inactive', // Set to inactive by default for safety
      })

      if (result.success) {
        toast.success('Linked subscription duplicated successfully')
        loadLinkedSubscriptions()
      } else {
        toast.error(result.error || 'Failed to duplicate linked subscription')
      }
    } catch (error: any) {
      console.error('Error duplicating linked subscription:', error)
      toast.error(error.message || 'Failed to duplicate linked subscription')
    }
  }

  const filteredLinkedSubs = linkedSubs.filter(linkedSub => {
    const triggerProduct = linkedSub.trigger_product?.title || ''
    const subscriptionProduct = linkedSub.subscription_product?.products?.title || ''
    const name = linkedSub.name || ''
    
    const searchLower = searchTerm.toLowerCase()
    return (
      triggerProduct.toLowerCase().includes(searchLower) ||
      subscriptionProduct.toLowerCase().includes(searchLower) ||
      name.toLowerCase().includes(searchLower)
    )
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Linked Subscriptions</h1>
          <p className="text-gray-600 mt-1">
            Automatically create subscriptions when trigger products are purchased
          </p>
        </div>
        <Link href="/admin/subscriptions/linked/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Linked Subscription
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by trigger product, subscription product, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filteredLinkedSubs.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">No linked subscriptions found</p>
          <Link href="/admin/subscriptions/linked/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Linked Subscription
            </Button>
          </Link>
        </div>
      ) : (
        // Table container with both horizontal and vertical scroll
        <div className="bg-white rounded-lg shadow-sm max-h-[600px] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="block">Trigger Product</span>
                  <span className="font-normal normal-case text-green-600">Charged immediately</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="block">Subscription Product</span>
                  <span className="font-normal normal-case text-blue-600">Charged in future</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Starts After
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLinkedSubs.map((linkedSub) => (
                <tr key={linkedSub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {linkedSub.name || 'Untitled'}
                    </div>
                    {linkedSub.description && (
                      <div className="text-sm text-gray-500">{linkedSub.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {linkedSub.trigger_product?.title || 'N/A'}
                    </div>
                    {linkedSub.trigger_variant && (
                      <div className="text-sm text-gray-500">
                        Variant: {linkedSub.trigger_variant?.color || 'N/A'}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Min Qty: {linkedSub.min_quantity || 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {linkedSub.subscription_product?.products?.title || 'N/A'}
                    </div>
                    {linkedSub.subscription_product?.product_variants && (
                      <div className="text-sm text-gray-500">
                        Variant: {linkedSub.subscription_product.product_variants.color || 'N/A'}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Qty: {linkedSub.quantity || 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {linkedSub.frequency_months || 2} month{linkedSub.frequency_months !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {linkedSub.start_after_months || 2} month{linkedSub.start_after_months !== 1 ? 's' : ''}
                    <div className="text-xs text-gray-500">
                      (Bill {linkedSub.billing_days_before_delivery || 15} days before)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {linkedSub.purchase_type === 'prepaid' ? 'Prepaid' : 'Ongoing'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(linkedSub.status)}>
                      {linkedSub.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/subscriptions/linked/${linkedSub.id}`}>
                        <Button variant="ghost" size="sm" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/subscriptions/linked/${linkedSub.id}/edit`}>
                        <Button variant="ghost" size="sm" title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(linkedSub)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(linkedSub.id, linkedSub.status, linkedSub.name)}
                        title={linkedSub.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {linkedSub.status === 'active' ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(linkedSub.id, linkedSub.name)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

