'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAdminReturns, resendReplacementShippedEmails } from '@/app/actions/returns'
import Link from 'next/link'
import { RotateCcw, Eye, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getTrackingUrl } from '@/lib/tracking-urls'

interface Return {
  id: string
  return_number: string
  order_id: string
  order_number?: string
  customer_email?: string
  customer_name?: string
  reason: string
  quantity: number
  status: string
  replacement_tracking_number?: string
  replacement_carrier?: string
  replacement_shipped_at?: string
  created_at: string
  updated_at: string
}

export default function AdminReturnsPage() {
  const { user } = useAuth()
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadReturns()
    }
  }, [user, activeTab])

  const loadReturns = async () => {
    if (!user?.id) return

    setLoading(true)
    const result = await getAdminReturns()
    if (result.error) {
      toast.error('Failed to load returns')
    } else {
      setReturns(result.data)
    }
    setLoading(false)
  }

  const handleResendEmail = async (returnId: string) => {
    setSendingEmailId(returnId)
    try {
      const result = await resendReplacementShippedEmails(returnId)
      if (result.success) {
        toast.success(result.message || 'Email sent to customer and admins')
      } else {
        toast.error(result.error || 'Failed to send email')
      }
    } catch (error: any) {
      console.error('Error resending replacement email:', error)
      toast.error(error?.message || 'Failed to send email')
    } finally {
      setSendingEmailId(null)
    }
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

  const filteredReturns = returns.filter((ret) => {
    const matchesSearch = 
      ret.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesTab = activeTab === 'all' || ret.status === activeTab
    
    return matchesSearch && matchesTab
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">Loading returns...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Returns & Replacements</h1>
            <p className="text-gray-600 mt-1">Manage all return and replacement requests</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by return number, order number, or customer email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {['all', 'requested', 'approved', 'received', 'inspected', 'completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Returns List */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No returns found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Replacement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{ret.return_number}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(ret.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${ret.order_id}`}
                          className="text-sm text-teal-600 hover:text-teal-800"
                        >
                          {ret.order_number || 'N/A'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{ret.customer_name || 'N/A'}</div>
                        <div className="text-xs text-gray-500">{ret.customer_email || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{ret.reason}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{ret.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ret.status)}`}>
                          {getStatusLabel(ret.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {ret.replacement_tracking_number ? (
                          <div className="text-sm">
                            <div className="text-gray-900">
                              <a
                                href={getTrackingUrl(ret.replacement_carrier || '', ret.replacement_tracking_number) || `https://www.google.com/search?q=${encodeURIComponent(ret.replacement_carrier || '')}+tracking+${encodeURIComponent(ret.replacement_tracking_number)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:text-teal-800 underline"
                              >
                                {ret.replacement_tracking_number}
                              </a>
                            </div>
                            {ret.replacement_carrier && (
                              <div className="text-xs text-gray-500">{ret.replacement_carrier}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not shipped</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/returns/${ret.id}`}
                            className="text-teal-600 hover:text-teal-800"
                          >
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                          {ret.replacement_tracking_number && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={sendingEmailId === ret.id}
                              onClick={() => handleResendEmail(ret.id)}
                              title="Send tracking email to customer and admins"
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              {sendingEmailId === ret.id ? 'Sending…' : 'Send Email'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

