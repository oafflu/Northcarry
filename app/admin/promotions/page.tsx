"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Search, Filter, Edit, Trash2 } from "lucide-react"
import { getPromotions, deletePromotion, type Promotion } from "@/app/actions/promotions"
import { toast } from "sonner"

export default function PromotionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPromotions()
  }, [])

  const loadPromotions = async () => {
    setLoading(true)
    try {
      const result = await getPromotions()
      if (result.error) {
        toast.error(result.error)
        setPromotions([])
      } else {
        setPromotions(result.data)
      }
    } catch (error) {
      console.error('Error loading promotions:', error)
      toast.error('Failed to load promotions')
      setPromotions([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete promotion "${code}"?`)) {
      return
    }

    try {
      const result = await deletePromotion(id)
      if (result.success) {
        toast.success('Promotion deleted successfully')
        loadPromotions()
      } else {
        toast.error(result.error || 'Failed to delete promotion')
      }
    } catch (error) {
      console.error('Error deleting promotion:', error)
      toast.error('Failed to delete promotion')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700'
      case 'scheduled':
        return 'bg-blue-50 text-blue-700'
      case 'expired':
        return 'bg-gray-50 text-gray-700'
      case 'disabled':
        return 'bg-red-50 text-red-700'
      default:
        return 'bg-gray-50 text-gray-700'
    }
  }

  const formatDiscountValue = (promo: Promotion) => {
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}%`
    } else if (promo.discount_type === 'fixed') {
      return `$${promo.discount_value}`
    } else if (promo.discount_type === 'free_shipping') {
      return 'Free Shipping'
    }
    return promo.discount_value.toString()
  }

  const filteredPromotions = promotions.filter((promo) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      promo.code.toLowerCase().includes(query) ||
      promo.discount_type.toLowerCase().includes(query) ||
      promo.status.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-600 mt-1">Manage discount codes and special offers</p>
        </div>
        <Link
          href="/admin/promotions/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>
      </div>

      {/* Promotions table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading promotions...</div>
        ) : filteredPromotions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 font-medium mb-2">
              {searchQuery ? 'No promotions found' : 'No promotions yet'}
            </p>
            <p className="text-sm text-gray-400">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first promotion to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPromotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-medium text-gray-900">{promo.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                      {promo.discount_type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDiscountValue(promo)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {promo.usage_count} {promo.usage_limit ? `/ ${promo.usage_limit}` : ""}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(promo.status)}`}>
                        {promo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {promo.starts_at
                        ? new Date(promo.starts_at).toLocaleDateString()
                        : 'No start'}
                      {' - '}
                      {promo.ends_at
                        ? new Date(promo.ends_at).toLocaleDateString()
                        : 'No end'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/promotions/${promo.id}`}
                          className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(promo.id, promo.code)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
  )
}
