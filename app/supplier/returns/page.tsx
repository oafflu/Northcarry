'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { processReturn } from '@/app/actions/suppliers'
import Link from 'next/link'
import { Eye, CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from '@/lib/translations/supplier/context'
import { useSearchParams, useRouter } from 'next/navigation'

export default function SupplierReturnsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('requested')
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Check for tab parameter in URL
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['all', 'requested', 'approved', 'return_shipped', 'received', 'inspected', 'rejected', 'completed'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    loadReturns()
  }, [activeTab])

  const loadReturns = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        console.error('Error getting user: User not found')
        setReturns([])
        setLoading(false)
        return
      }

      // Add a small cache-busting delay to ensure we get fresh data
      await new Promise(resolve => setTimeout(resolve, 100))

      // First, get all order IDs assigned to this supplier
      const { data: assignments } = await supabase
        .from('supplier_order_assignments')
        .select('order_id')
        .eq('supplier_id', user.id)

      const assignedOrderIds = assignments?.map(a => a.order_id) || []

      // Also get all variant IDs linked to this supplier via product_supplier_links
      const { data: supplierLinks } = await supabase
        .from('product_supplier_links')
        .select('variant_id')
        .eq('supplier_id', user.id)
        .eq('is_primary_supplier', true)

      const supplierVariantIds = supplierLinks?.map(link => link.variant_id).filter(Boolean) || []

      // Query returns: either supplier_id matches OR order_id is in assigned orders
      // We'll fetch both sets and combine them
      let query1 = supabase
        .from('returns')
        .select(`
          *,
          orders (
            order_number,
            customer_email,
            customer_first_name,
            customer_last_name
          ),
          profiles!returns_customer_id_fkey (
            email,
            first_name,
            last_name
          )
        `)
        .eq('supplier_id', user.id)

      if (activeTab !== 'all') {
        query1 = query1.eq('status', activeTab)
      }

      const { data: returnsBySupplier, error: error1 } = await query1.order('created_at', { ascending: false })

      // Also get returns where order is assigned to this supplier (even if supplier_id is null)
      let returnsByOrder: any[] = []
      if (assignedOrderIds.length > 0) {
        let query2 = supabase
          .from('returns')
          .select(`
            *,
            orders (
              order_number,
              customer_email,
              customer_first_name,
              customer_last_name
            ),
            profiles!returns_customer_id_fkey (
              email,
              first_name,
              last_name
            )
          `)
          .in('order_id', assignedOrderIds)

        if (activeTab !== 'all') {
          query2 = query2.eq('status', activeTab)
        }

        const { data: returnsByOrderData, error: error2 } = await query2.order('created_at', { ascending: false })
        
        if (!error2 && returnsByOrderData) {
          returnsByOrder = returnsByOrderData
        }
      }

      // Also get returns where the order item's variant is linked to this supplier
      // This catches returns where supplier_id might be null but the variant belongs to this supplier
      let returnsByVariant: any[] = []
      if (supplierVariantIds.length > 0) {
        // First get all order items with these variant IDs
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id, order_id')
          .in('variant_id', supplierVariantIds)

        if (orderItems && orderItems.length > 0) {
          const orderItemIds = orderItems.map(item => item.id)
          
          // Get returns for these order items
          let query3 = supabase
            .from('returns')
            .select(`
              *,
              orders (
                order_number,
                customer_email,
                customer_first_name,
                customer_last_name
              ),
              profiles!returns_customer_id_fkey (
                email,
                first_name,
                last_name
              )
            `)
            .in('order_item_id', orderItemIds)

          if (activeTab !== 'all') {
            query3 = query3.eq('status', activeTab)
          }

          const { data: returnsByVariantData, error: error3 } = await query3.order('created_at', { ascending: false })
          
          if (!error3 && returnsByVariantData) {
            returnsByVariant = returnsByVariantData
          }
        }
      }

      // Combine and deduplicate by return ID
      let allReturns = [...(returnsBySupplier || []), ...returnsByOrder, ...returnsByVariant]
      const uniqueReturns = allReturns.filter((ret, index, self) => 
        index === self.findIndex(r => r.id === ret.id)
      )

      // For return_shipped tab, also include completed returns that have replacement_shipped_at
      if (activeTab === 'return_shipped') {
        // Fetch completed returns with replacement_shipped_at
        let completedQuery1 = supabase
          .from('returns')
          .select(`
            *,
            orders (
              order_number,
              customer_email,
              customer_first_name,
              customer_last_name
            ),
            profiles!returns_customer_id_fkey (
              email,
              first_name,
              last_name
            )
          `)
          .eq('supplier_id', user.id)
          .eq('status', 'completed')
          .not('replacement_shipped_at', 'is', null)

        const { data: completedBySupplier } = await completedQuery1.order('created_at', { ascending: false })

        let completedByOrder: any[] = []
        if (assignedOrderIds.length > 0) {
          let completedQuery2 = supabase
            .from('returns')
            .select(`
              *,
              orders (
                order_number,
                customer_email,
                customer_first_name,
                customer_last_name
              ),
              profiles!returns_customer_id_fkey (
                email,
                first_name,
                last_name
              )
            `)
            .in('order_id', assignedOrderIds)
            .eq('status', 'completed')
            .not('replacement_shipped_at', 'is', null)

          const { data: completedByOrderData } = await completedQuery2.order('created_at', { ascending: false })
          if (completedByOrderData) {
            completedByOrder = completedByOrderData
          }
        }

        let completedByVariant: any[] = []
        if (supplierVariantIds.length > 0) {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('id, order_id')
            .in('variant_id', supplierVariantIds)

          if (orderItems && orderItems.length > 0) {
            const orderItemIds = orderItems.map(item => item.id)
            
            let completedQuery3 = supabase
              .from('returns')
              .select(`
                *,
                orders (
                  order_number,
                  customer_email,
                  customer_first_name,
                  customer_last_name
                ),
                profiles!returns_customer_id_fkey (
                  email,
                  first_name,
                  last_name
                )
              `)
              .in('order_item_id', orderItemIds)
              .eq('status', 'completed')
              .not('replacement_shipped_at', 'is', null)

            const { data: completedByVariantData } = await completedQuery3.order('created_at', { ascending: false })
            if (completedByVariantData) {
              completedByVariant = completedByVariantData
            }
          }
        }

        // Combine completed returns with return_shipped returns
        const completedReturns = [...(completedBySupplier || []), ...completedByOrder, ...completedByVariant]
        allReturns = [...uniqueReturns, ...completedReturns]
        
        // Deduplicate again
        const finalReturns = allReturns.filter((ret, index, self) => 
          index === self.findIndex(r => r.id === ret.id)
        )
        
        const data = finalReturns
        const error = error1

        if (error) {
          console.error('Error loading returns:', error)
          setReturns([])
        } else {
          setReturns(data || [])
        }
        setLoading(false)
        return
      }

      const data = uniqueReturns
      const error = error1

      if (error) {
        console.error('Error loading returns:', error)
        setReturns([])
      } else {
        setReturns(data || [])
      }
    } catch (err) {
      console.error('Unexpected error loading returns:', err)
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (returnId: string) => {
    const result = await processReturn(returnId, 'approve')
    if (result.success) {
      // Switch to approved tab immediately
      setActiveTab('approved')
      // Wait longer for database update to commit and propagate
      // Then reload with cache busting
      setTimeout(async () => {
        // Force reload by adding a timestamp to bust cache
        await loadReturns()
        router.refresh()
        // Reload one more time after a short delay to ensure fresh data
        setTimeout(() => {
          loadReturns()
        }, 300)
      }, 1000)
    } else {
      alert(t('returns.failedToApprove'))
    }
  }

  const handleReject = async (returnId: string) => {
    const result = await processReturn(returnId, 'reject')
    if (result.success) {
      loadReturns()
    } else {
      alert(t('returns.failedToReject'))
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      requested: t('returns.requested'),
      approved: t('returns.approved'),
      return_shipped: t('returns.returnShipped'),
      received: t('returns.received'),
      inspected: t('returns.inspected'),
      completed: t('returns.completed') || 'Completed',
    }
    return statusMap[status] || status
  }

  const getTabLabel = (tab: string) => {
    if (tab === 'all') return t('returns.all')
    return getStatusLabel(tab)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('returns.title')}</h1>
        <p className="text-gray-600 mt-1">{t('returns.subtitle')}</p>
        <p className="mt-2 text-sm text-gray-500">{t('returns.policy')}</p>
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {['requested', 'approved', 'return_shipped', 'received', 'inspected', 'completed', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-teal-500 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">{t('returns.noReturns')}</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.returnNumber')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.orderNumber')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.customer')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.reason')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.status')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.date')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('returns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((returnItem) => (
                <tr key={returnItem.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{returnItem.return_number}</td>
                  <td className="py-3 px-4 font-mono text-sm">
                    {returnItem.orders?.order_number || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {(() => {
                      const email =
                        returnItem.profiles?.email ||
                        returnItem.orders?.customer_email ||
                        'N/A'
                      const first =
                        returnItem.profiles?.first_name ||
                        returnItem.orders?.customer_first_name ||
                        ''
                      const last =
                        returnItem.profiles?.last_name ||
                        returnItem.orders?.customer_last_name ||
                        ''
                      const name = `${first} ${last}`.trim()
                      return name ? `${name} (${email})` : email
                    })()}
                  </td>
                  <td className="py-3 px-4 text-sm">{returnItem.reason}</td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {getStatusLabel(returnItem.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(returnItem.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Link href={`/supplier/returns/${returnItem.id}`}>
                        <Button variant="ghost" size="sm" title={t('returns.viewDetails')}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {returnItem.status === 'requested' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(returnItem.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {t('returns.approve')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(returnItem.id)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            {t('returns.reject')}
                          </Button>
                        </>
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
  )
}

