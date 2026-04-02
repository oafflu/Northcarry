'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'
import { FulfillmentActions } from '@/components/supplier/fulfillment-actions'
import { useTranslation } from '@/lib/translations/supplier/context'
import { getSupplierOrderCost } from '@/app/actions/suppliers'
import { useAuth } from '@/lib/auth-context'
import { getTrackingUrl } from '@/lib/tracking-urls'

export default function SupplierOrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orderCost, setOrderCost] = useState<number>(0)
  const [itemCosts, setItemCosts] = useState<Map<string, { unitCost: number, lineCost: number }>>(new Map())

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    if (!orderId) {
      setError('Order ID is required')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      // First, get the assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('supplier_order_assignments')
        .select('*')
        .eq('order_id', orderId)
        .eq('supplier_id', user.id)
        .single()

      console.log('Assignment query result:', {
        hasData: !!assignmentData,
        error: assignmentError,
        errorCode: assignmentError?.code,
        errorMessage: assignmentError?.message,
        orderId,
        supplierId: user.id
      })

      if (assignmentError || !assignmentData) {
        console.error('Assignment not found:', assignmentError)
        setError(t('orders.noOrders') || 'Order not found or you don\'t have access to this order')
        setLoading(false)
        return
      }

      // Now fetch the order separately (this should work with RLS if the supplier has access)
      // Only allow access to paid orders (suppliers should only fulfill paid orders)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_variants (
              *,
              products (
                id,
                title
              )
            )
          )
        `)
        .eq('id', orderId)
        .eq('payment_status', 'paid') // Only show paid orders
        .single()

      console.log('Order query result:', {
        hasData: !!orderData,
        error: orderError,
        errorCode: orderError?.code,
        errorMessage: orderError?.message
      })

      if (orderError || !orderData) {
        console.error('Order not accessible:', orderError)
        // Assignment exists but can't access order - RLS issue
        // This might be an RLS policy issue - the supplier has an assignment but can't query the order
        // Try refreshing or contact admin
        setError('Cannot access order details. Please try refreshing the page. If the issue persists, contact admin.')
        setLoading(false)
        return
      }

      console.log('Order loaded successfully:', {
        assignmentId: assignmentData.id,
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        itemsCount: orderData.order_items?.length || 0
      })

      setAssignment(assignmentData)
      setOrder(orderData)
      
      // Calculate supplier cost
      if (orderData && user) {
        try {
          const costResult = await getSupplierOrderCost(orderId, user.id)
          if (costResult.success) {
            setOrderCost(costResult.cost)
            const costsMap = new Map<string, { unitCost: number, lineCost: number }>()
            costResult.itemCosts.forEach(item => {
              costsMap.set(item.itemId, {
                unitCost: item.unitCost,
                lineCost: item.lineCost,
              })
            })
            setItemCosts(costsMap)
          }
        } catch (costError) {
          console.error('Error calculating order cost:', costError)
        }
      }
    } catch (err: any) {
      console.error('Error loading order:', err)
      setError(err.message || 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      shipped: 'bg-teal-100 text-teal-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t('orders.pending'),
      acknowledged: t('orders.acknowledged'),
      processing: t('orders.processing'),
      ready: t('orders.ready'),
      shipped: t('orders.shipped'),
      delivered: t('orders.delivered'),
      cancelled: t('orders.cancelled'),
    }
    return statusMap[status] || status
  }

  const getPurchaseTypeLabel = (type: string) => {
    if (type === 'subscription') return t('orders.ongoingSubscription')
    if (type === 'prepaid') return t('orders.prepaidSubscription')
    return t('orders.oneTime')
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

  if (error || !assignment || !order) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg border p-6 text-center">
          <p className="text-gray-500">{error || 'Order not found'}</p>
          <Link href="/supplier/orders" className="text-teal-600 hover:underline mt-4 inline-block">
            {t('orders.backToOrders')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/supplier/orders"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('orders.backToOrders')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('orders.orderNumber')} {order.order_number}</h1>
            <p className="text-gray-600 mt-1">
              {t('orders.placedOn')} {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(assignment.assignment_status)}`}>
            {getStatusLabel(assignment.assignment_status)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.orderItems')}</h2>
            {!order.order_items || order.order_items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>{t('orders.noItemsFound')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {order.order_items.map((item: any) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <div className="w-20 h-20 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                      {item.product_variants?.image_url ? (
                        <img
                          src={item.product_variants.image_url}
                          alt={item.product_title}
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{item.product_title}</h3>
                        {item.purchase_type && item.purchase_type !== 'one-time' && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            item.purchase_type === 'subscription' 
                              ? 'bg-blue-50 text-blue-700'
                              : item.purchase_type === 'prepaid'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-gray-50 text-gray-700'
                          }`}>
                            {getPurchaseTypeLabel(item.purchase_type)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {t('orders.sku')}: {item.sku} • {t('orders.color')}: {item.variant_color}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm font-medium">{t('orders.quantity')}: {item.quantity}</p>
                        <p className="text-sm font-semibold">
                          ${(itemCosts.get(item.id)?.unitCost || 0).toFixed(2)} × {item.quantity} = ${(itemCosts.get(item.id)?.lineCost || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fulfillment Timeline */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.fulfillmentTimeline')}</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                <div>
                  <p className="font-medium">{t('orders.orderCreated')}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {assignment.acknowledged_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('orders.acknowledged')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(assignment.acknowledged_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {assignment.processing_started_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('orders.processingStarted')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(assignment.processing_started_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {assignment.ready_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('orders.readyToShip')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(assignment.ready_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {assignment.shipped_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('orders.shipped')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(assignment.shipped_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Information */}
          {assignment.tracking_number && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-bold mb-4">{t('orders.shippingInformation')}</h2>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">{t('orders.carrier')}:</span>{' '}
                  {assignment.carrier}
                </div>
                <div>
                  <span className="font-semibold">{t('orders.trackingNumber')}:</span>{' '}
                  {assignment.tracking_number}
                </div>
                {(() => {
                  const trackingUrl = getTrackingUrl(assignment.carrier, assignment.tracking_number)
                  return trackingUrl ? (
                    <div>
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-600 hover:text-teal-700 underline"
                      >
                        Track Package →
                      </a>
                    </div>
                  ) : null
                })()}
                {assignment.estimated_delivery_date && (
                  <div>
                    <span className="font-semibold">{t('orders.estimatedDelivery')}:</span>{' '}
                    {new Date(assignment.estimated_delivery_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fulfillment Actions */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.actions')}</h2>
            <FulfillmentActions assignment={assignment} />
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.orderSummary')}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('orders.totalCost') || 'Total Cost'}:</span>
                <span className="font-bold text-lg">${orderCost.toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('orders.costBasedOnInventory') || 'Cost calculated based on your inventory prices'}
              </p>
              <div className="pt-2 border-t mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600">{t('orders.paymentStatus')}:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.payment_status === 'paid'
                      ? 'bg-green-50 text-green-700'
                      : order.payment_status === 'processing'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {order.payment_status || t('orders.pending')}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600">{t('orders.fulfillmentStatus')}:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'shipped'
                      ? 'bg-green-50 text-green-700'
                      : order.fulfillment_status === 'in_transit'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-50 text-gray-700'
                  }`}>
                    {order.fulfillment_status || t('orders.pending')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.customerInformation')}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">{t('orders.name')}:</span>
                <br />
                {order.customer_first_name && order.customer_last_name
                  ? `${order.customer_first_name} ${order.customer_last_name}`
                  : t('orders.guestCustomer')}
              </div>
              <div>
                <span className="font-semibold">{t('orders.email')}:</span>
                <br />
                <a href={`mailto:${order.customer_email}`} className="text-teal-600 hover:underline">
                  {order.customer_email}
                </a>
              </div>
              {order.customer_phone && (
                <div>
                  <span className="font-semibold">{t('orders.phone')}:</span>
                  <br />
                  <a href={`tel:${order.customer_phone}`} className="text-teal-600 hover:underline">
                    {order.customer_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.shippingAddress')}</h2>
            <address className="not-italic text-sm">
              {order.shipping_address?.address_line1}
              <br />
              {order.shipping_address?.address_line2 && (
                <>
                  {order.shipping_address.address_line2}
                  <br />
                </>
              )}
              {order.shipping_address?.city}, {order.shipping_address?.state}{' '}
              {order.shipping_address?.postal_code}
              <br />
              {order.shipping_address?.country}
            </address>
          </div>
        </div>
      </div>
    </div>
  )
}
