"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Search, Package, Loader2 } from "lucide-react"
import { getAccountOrders } from "@/app/actions/account"
import {
  CUSTOMER_ORDER_STATUS_TABS,
  customerFulfillmentBadgeClass,
  customerOrderMatchesStatusTab,
  getCustomerFulfillmentLabel,
} from "@/lib/order-fulfillment-display"

export default function OrdersPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadOrders()
    }
  }, [user])

  const loadOrders = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const result = await getAccountOrders(user.id, 100, 0)
      if (result.error) {
        console.error('Error loading orders:', result.error)
      } else {
        setOrders(result.data || [])
      }
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.order_items?.some((item: any) => 
                           item.product_title?.toLowerCase().includes(searchQuery.toLowerCase())
                         )
    const matchesStatus = customerOrderMatchesStatusTab(order.fulfillment_status, statusFilter)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Order History</h1>
        <p className="mt-1 text-sm sm:text-base text-gray-600">View and track your orders</p>
      </div>

          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CUSTOMER_ORDER_STATUS_TABS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-colors ${
                    statusFilter === status ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
              Status follows supplier fulfillment: <strong>Pending</strong> (not shipped yet),{" "}
              <strong>Processing</strong> (supplier preparing),{" "}
              <strong>Fulfilled</strong> (shipped—tracking may be available; we don&apos;t show carrier &quot;delivered&quot; from tracking feeds).{" "}
              <strong>Cancelled</strong> if the order was cancelled.
            </p>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="rounded-lg bg-white p-4 sm:p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold truncate">{order.order_number || order.id}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Placed on{" "}
                          {new Date(order.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap ${customerFulfillmentBadgeClass(order.fulfillment_status)}`}
                        >
                          {getCustomerFulfillmentLabel(order.fulfillment_status)}
                        </span>
                        <p className="text-base sm:text-lg font-bold whitespace-nowrap">${parseFloat(order.total || '0').toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 space-y-3">
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((item: any, idx: number) => (
                        <div key={item.id || idx} className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
                          <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-md bg-gray-100 flex-shrink-0">
                              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base truncate">{item.product_title || 'Product'}</p>
                              {item.variant_color && (
                                <p className="text-xs sm:text-sm text-gray-600">Color: {item.variant_color}</p>
                              )}
                              <p className="text-xs sm:text-sm text-gray-600">Quantity: {item.quantity || 1}</p>
                            </div>
                          </div>
                          <p className="font-semibold text-sm sm:text-base whitespace-nowrap flex-shrink-0">${parseFloat(item.line_total || '0').toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No items found</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-3 border-t border-gray-100">
                    <div className="text-xs sm:text-sm text-gray-600">
                      Payment: <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-gray-800'}`}>
                        {order.payment_status === 'paid' ? 'Paid' : order.payment_status || 'Pending'}
                      </span>
                    </div>
                    <Link
                      href={`/account/orders/${order.id}`}
                      className="inline-block w-full sm:w-auto text-center rounded-md border border-gray-300 px-4 sm:px-6 py-2 text-sm sm:text-base font-medium transition-colors hover:bg-gray-50"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredOrders.length === 0 && (
            <div className="rounded-lg bg-white p-12 text-center shadow-sm">
              <Package className="mx-auto mb-4 h-16 w-16 text-gray-300" />
              <h3 className="mb-2 text-xl font-bold">No orders found</h3>
              <p className="mb-6 text-gray-600">Try adjusting your search or filters</p>
              <Link
                href="/product"
                className="inline-block rounded-md bg-black px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
              >
                Continue Shopping
              </Link>
            </div>
          )}
    </div>
  )
}
