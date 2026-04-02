'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Copy, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { getLinkedSubscription, updateLinkedSubscription, deleteLinkedSubscription, createLinkedSubscription } from '@/app/actions/subscriptions'
import { toast } from 'sonner'

export default function LinkedSubscriptionDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [linkedSubscription, setLinkedSubscription] = useState<any>(null)

  useEffect(() => {
    loadLinkedSubscription()
  }, [id])

  const loadLinkedSubscription = async () => {
    setLoading(true)
    const result = await getLinkedSubscription(id)
    if (result.error || !result.data) {
      toast.error('Failed to load linked subscription')
      router.push('/admin/subscriptions/linked')
    } else {
      setLinkedSubscription(result.data)
    }
    setLoading(false)
  }

  const handleToggleStatus = async () => {
    if (!linkedSubscription) return
    
    const newStatus = linkedSubscription.status === 'active' ? 'inactive' : 'active'
    const result = await updateLinkedSubscription(id, { status: newStatus })
    
    if (result.success) {
      toast.success(`Linked subscription ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`)
      loadLinkedSubscription()
    } else {
      toast.error(result.error || 'Failed to update status')
    }
  }

  const handleDuplicate = async () => {
    if (!linkedSubscription) return
    
    if (!confirm(`Create a copy of "${linkedSubscription.name || 'Untitled'}"?`)) {
      return
    }

    try {
      const result = await createLinkedSubscription({
        trigger_product_id: linkedSubscription.trigger_product_id,
        trigger_variant_id: linkedSubscription.trigger_variant_id || undefined,
        subscription_product_id: linkedSubscription.subscription_product_id,
        frequency_months: linkedSubscription.frequency_months || 2,
        purchase_type: linkedSubscription.purchase_type || 'ongoing',
        quantity: linkedSubscription.quantity || 1,
        start_after_months: linkedSubscription.start_after_months || 2,
        billing_days_before_delivery: linkedSubscription.billing_days_before_delivery || 15,
        min_quantity: linkedSubscription.min_quantity || 1,
        auto_activate: linkedSubscription.auto_activate !== false,
        name: linkedSubscription.name ? `${linkedSubscription.name} (Copy)` : undefined,
        description: linkedSubscription.description || undefined,
        status: 'inactive',
      })

      if (result.success) {
        toast.success('Linked subscription duplicated successfully')
        router.push('/admin/subscriptions/linked')
      } else {
        toast.error(result.error || 'Failed to duplicate linked subscription')
      }
    } catch (error: any) {
      console.error('Error duplicating linked subscription:', error)
      toast.error(error.message || 'Failed to duplicate linked subscription')
    }
  }

  const handleDelete = async () => {
    if (!linkedSubscription) return
    
    if (!confirm(`Are you sure you want to delete the linked subscription "${linkedSubscription.name || 'Untitled'}"?`)) {
      return
    }

    const result = await deleteLinkedSubscription(id)
    if (result.success) {
      toast.success('Linked subscription deleted successfully')
      router.push('/admin/subscriptions/linked')
    } else {
      toast.error(result.error || 'Failed to delete linked subscription')
    }
  }

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Loading linked subscription...</p>
        </div>
      </div>
    )
  }

  if (!linkedSubscription) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Linked subscription not found</p>
          <Button onClick={() => router.push('/admin/subscriptions/linked')} className="mt-4">
            Back to List
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/subscriptions/linked">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {linkedSubscription.name || 'Untitled Linked Subscription'}
            </h1>
            <p className="text-gray-600 mt-1">Linked Subscription Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(linkedSubscription.status)}>
            {linkedSubscription.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
          >
            {linkedSubscription.status === 'active' ? (
              <>
                <ToggleRight className="h-4 w-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <ToggleLeft className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
          <Link href={`/admin/subscriptions/linked/${id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.name || 'Untitled'}
              </p>
            </div>
            {linkedSubscription.description && (
              <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p className="text-sm text-gray-900 mt-1">
                  {linkedSubscription.description}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="mt-1">
                <Badge className={getStatusColor(linkedSubscription.status)}>
                  {linkedSubscription.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Auto-Activate</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.auto_activate ? 'Yes' : 'No'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Product — charged immediately */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Product charged immediately
              <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded">Bundle: pay now</span>
            </CardTitle>
            <CardDescription>Charged in the initial order (e.g. brush).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Product</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.trigger_product?.title || 'N/A'}
              </p>
            </div>
            {linkedSubscription.trigger_variant && (
              <div>
                <label className="text-sm font-medium text-gray-500">Variant</label>
                <p className="text-sm text-gray-900 mt-1">
                  {linkedSubscription.trigger_variant?.color || 'N/A'}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Minimum Quantity</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.min_quantity || 1}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Product — charged in future */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Product charged in future (subscription)
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Bundle: pay later</span>
            </CardTitle>
            <CardDescription>Not charged at checkout; billed each cycle (e.g. replacement heads).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Product</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.subscription_product?.products?.title || 'N/A'}
              </p>
            </div>
            {linkedSubscription.subscription_product?.product_variants && (
              <div>
                <label className="text-sm font-medium text-gray-500">Variant</label>
                <p className="text-sm text-gray-900 mt-1">
                  {linkedSubscription.subscription_product.product_variants.color || 'N/A'}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Quantity per Cycle</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.quantity || 1}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Configuration</CardTitle>
            <CardDescription>How the subscription will be created</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Frequency</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.frequency_months || 2} {linkedSubscription.frequency_months === 1 ? 'month' : 'months'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Purchase Type</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.purchase_type === 'prepaid' ? 'Prepaid' : 'Ongoing'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Starts After</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.start_after_months || 2} {linkedSubscription.start_after_months === 1 ? 'month' : 'months'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Billing Days Before Delivery</label>
              <p className="text-sm text-gray-900 mt-1">
                {linkedSubscription.billing_days_before_delivery || 15} days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

