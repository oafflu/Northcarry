'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Eye, Package, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAdminSampleRequests } from '@/app/actions/sample-requests'
import { toast } from 'sonner'

export default function SampleRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const result = await getAdminSampleRequests()
      if (result.error) {
        toast.error('Failed to load sample requests')
      } else {
        setRequests(result.data || [])
      }
    } catch (error) {
      console.error('Error loading sample requests:', error)
      toast.error('Failed to load sample requests')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProductName = (request: any) => {
    if (request.request_type === 'custom_product') {
      return request.custom_product_name || 'Custom Product'
    }
    
    // Check for multiple products
    const inventoryCount = request.supplier_inventory_ids?.length || 0
    const productCount = request.product_ids?.length || 0
    const totalCount = inventoryCount + productCount
    
    if (totalCount > 1) {
      return `${totalCount} Products`
    }
    
    // Single product display
    if (request.supplier_inventory) {
      return request.supplier_inventory.product_name
    }
    if (request.products) {
      return request.products.title
    }
    return 'Unknown Product'
  }

  const getSupplierName = (request: any) => {
    const supplier = request.supplier
    if (supplier?.company_name) return supplier.company_name
    if (supplier?.first_name || supplier?.last_name) {
      return `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim()
    }
    return supplier?.email || 'Unknown Supplier'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sample Requests</h1>
          <p className="text-gray-600 mt-1">Request product samples from suppliers</p>
        </div>
        <Link
          href="/admin/sample-requests/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Request Sample
        </Link>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading sample requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No sample requests found
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          {request.request_type === 'custom_product' ? (
                            <FileText className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getProductName(request)}
                          </p>
                          {request.request_type === 'existing_product' && 
                           !request.supplier_inventory_ids?.length && 
                           !request.product_ids?.length &&
                           request.product_variants && (
                            <p className="text-xs text-gray-500">Color: {request.product_variants.color}</p>
                          )}
                          {((request.supplier_inventory_ids?.length || 0) + (request.product_ids?.length || 0)) > 1 && (
                            <p className="text-xs text-gray-500">
                              {((request.supplier_inventory_ids?.length || 0) + (request.product_ids?.length || 0))} products
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {getSupplierName(request)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline">
                        {request.request_type === 'custom_product' ? 'Custom' : 'Existing'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={getPaymentStatusColor(request.payment_status)}>
                        {request.payment_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${parseFloat(request.total_amount || '0').toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/sample-requests/${request.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

