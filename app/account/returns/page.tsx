'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getCustomerReturns } from '@/app/actions/returns'
import Link from 'next/link'
import { RotateCcw, Package, Search, Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getTrackingUrl } from '@/lib/tracking-urls'

interface Return {
  id: string
  return_number: string
  order_id: string
  order_number?: string
  reason: string
  quantity: number
  status: string
  replacement_tracking_number?: string
  replacement_carrier?: string
  replacement_shipped_at?: string
  refund_amount?: number
  created_at: string
  updated_at: string
}

export default function ReturnsPage() {
  const { user } = useAuth()
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (user?.id) {
      loadReturns()
    }
  }, [user])

  const loadReturns = async () => {
    if (!user?.id) return

    setLoading(true)
    const result = await getCustomerReturns()
    if (result.error) {
      toast.error('Failed to load returns')
    } else {
      setReturns(result.data)
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'return_shipped':
        return 'bg-purple-100 text-purple-800'
      case 'received':
        return 'bg-indigo-100 text-indigo-800'
      case 'inspected':
        return 'bg-teal-100 text-teal-800'
      case 'refunded':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const filteredReturns = returns.filter((ret) =>
    ret.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ret.order_number?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">Loading returns...</div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Returns</h1>
          <p className="mt-1 text-gray-600">View and manage your replacement requests</p>
          <p className="mt-2 text-sm text-gray-500">We offer a 5-day replacement policy for defective or damaged Brevi brushes. Contact us within 5 days of delivery for a replacement.</p>
        </div>
          <Button onClick={() => window.location.href = '/account/orders'}>
          <Plus className="mr-2 h-4 w-4" />
          Request Replacement
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by return number or order number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredReturns.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <RotateCcw className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-bold">
            {searchQuery ? 'No returns found' : 'No returns yet'}
          </h3>
          <p className="mb-6 text-gray-600">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'You haven\'t requested any replacements yet. Request a replacement from your order history if you received a defective or damaged item within 5 days of delivery.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => window.location.href = '/account/orders'}>
              View Orders
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((ret) => (
            <div key={ret.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{ret.return_number}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(ret.status)}`}>
                      {getStatusLabel(ret.status)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Order:</span> {ret.order_number}
                    </p>
                    <p>
                      <span className="font-medium">Reason:</span> {ret.reason}
                    </p>
                    <p>
                      <span className="font-medium">Quantity:</span> {ret.quantity}
                    </p>
                    {ret.refund_amount && (
                      <p>
                        <span className="font-medium">Refund Amount:</span> ${ret.refund_amount.toFixed(2)}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Requested:</span>{' '}
                      {new Date(ret.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Replacement Shipping Info */}
              {ret.replacement_tracking_number && (
                <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Replacement Shipped</h4>
                  </div>
                  <div className="space-y-1 text-sm text-green-800">
                    <p>
                      <span className="font-medium">Tracking Number:</span>{' '}
                      <a
                        href={getTrackingUrl(ret.replacement_carrier || '', ret.replacement_tracking_number) || `https://www.google.com/search?q=${encodeURIComponent(ret.replacement_carrier || '')}+tracking+${encodeURIComponent(ret.replacement_tracking_number)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-green-900"
                      >
                        {ret.replacement_tracking_number}
                      </a>
                    </p>
                    {ret.replacement_carrier && (
                      <p>
                        <span className="font-medium">Carrier:</span> {ret.replacement_carrier}
                      </p>
                    )}
                    {ret.replacement_shipped_at && (
                      <p>
                        <span className="font-medium">Shipped:</span>{' '}
                        {new Date(ret.replacement_shipped_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3 mt-4">
                <Link
                  href={`/account/orders/${ret.order_id}`}
                  className="text-sm font-medium text-teal-600 hover:text-teal-700"
                >
                  View Order →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

