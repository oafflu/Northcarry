'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Package, TruckIcon, AlertCircle, DollarSign } from 'lucide-react'
import { useTranslation } from '@/lib/translations/supplier/context'

export default function SupplierDashboard() {
  const supabase = createClient()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [profile, setProfile] = useState<any>(null)
  const [pendingOrders, setPendingOrders] = useState(0)
  const [processingOrders, setProcessingOrders] = useState(0)
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [recentAssignments, setRecentAssignments] = useState<any[]>([])
  const [totalInventoryValue, setTotalInventoryValue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    // User is already authenticated by layout - no need to check again
    if (!user) {
      setLoading(false)
      return
    }

    // Parallel queries for dashboard stats
    const [
      { data: profileData },
      { count: pendingCount },
      { count: processingCount },
      { data: lowStockItemsData },
      { data: recentAssignmentsData },
      { data: inventoryValueData }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('supplier_order_assignments')
        .select('id, orders!inner(id, payment_status)', { count: 'exact', head: true })
        .eq('supplier_id', user.id)
        .eq('assignment_status', 'pending')
        .eq('orders.payment_status', 'paid'), // Only count paid orders
      supabase.from('supplier_order_assignments')
        .select('id, orders!inner(id, payment_status)', { count: 'exact', head: true })
        .eq('supplier_id', user.id)
        .eq('assignment_status', 'processing')
        .eq('orders.payment_status', 'paid'), // Only count paid orders
      supabase.from('supplier_inventory')
        .select('*')
        .eq('supplier_id', user.id)
        .eq('status', 'active')
        .limit(10),
      supabase.from('supplier_order_assignments')
        .select(`
          *,
          orders!inner (
            order_number,
            total,
            created_at,
            customer_email,
            payment_status
          )
        `)
        .eq('supplier_id', user.id)
        .eq('orders.payment_status', 'paid') // Only show paid orders
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('supplier_inventory')
        .select('quantity_available, cost_price')
        .eq('supplier_id', user.id)
        .eq('status', 'active')
    ])

    setProfile(profileData)
    setPendingOrders(pendingCount || 0)
    setProcessingOrders(processingCount || 0)

    // Filter low stock items
    const lowStock = lowStockItemsData?.filter(item => 
      (item.quantity_available || 0) <= (item.reorder_point || 10)
    ) || []
    setLowStockItems(lowStock)

    setRecentAssignments(recentAssignmentsData || [])

    // Calculate inventory value
    const totalValue = inventoryValueData?.reduce((sum, item) => {
      return sum + ((item.quantity_available || 0) * parseFloat(item.cost_price?.toString() || '0'))
    }, 0) || 0
    setTotalInventoryValue(totalValue)

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-gray-600 mt-1">
          {t('dashboard.welcome')}, {profile?.company_name || profile?.first_name || t('layout.supplierUser')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('dashboard.pendingOrders')}</h3>
            <Package className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">{pendingOrders}</div>
          <p className="text-xs text-gray-500 mt-1">{t('dashboard.awaitingAcknowledgment')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('dashboard.processing')}</h3>
            <TruckIcon className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">{processingOrders}</div>
          <p className="text-xs text-gray-500 mt-1">{t('dashboard.currentlyProcessing')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('dashboard.lowStockItems')}</h3>
            <AlertCircle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {lowStockItems.length}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('dashboard.needReordering')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('dashboard.inventoryValue')}</h3>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold">
            ${totalInventoryValue.toFixed(2)}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('dashboard.totalCostValue')}</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">{t('dashboard.recentOrders')}</h2>
        {recentAssignments && recentAssignments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('dashboard.orderNumber')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('dashboard.customer')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('dashboard.total')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('common.status')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('common.date')}</th>
                </tr>
              </thead>
              <tbody>
                {recentAssignments.map((assignment: any) => {
                  const order = assignment.orders
                  if (!order) return null
                  
                  return (
                    <tr key={assignment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{order.order_number}</td>
                      <td className="py-3 px-4 text-sm">{order.customer_email}</td>
                      <td className="py-3 px-4 text-sm">-</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          assignment.assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          assignment.assignment_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          assignment.assignment_status === 'shipped' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.assignment_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">{t('dashboard.noRecentOrders')}</p>
        )}
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-bold text-orange-900 mb-3">{t('dashboard.lowStockAlert')}</h2>
          <div className="space-y-2">
            {lowStockItems.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.product_name} ({item.sku})</span>
                <span className="text-orange-700">
                  {item.quantity_available} {t('inventory.quantityAvailable')} ({t('inventory.reorderPoint')} {item.reorder_point})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
