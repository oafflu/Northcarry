"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Package, ShoppingBag } from "lucide-react"
import { getAccountStats, getAccountOrders } from "@/app/actions/account"
import {
  customerFulfillmentBadgeClass,
  getCustomerFulfillmentLabel,
} from "@/lib/order-fulfillment-display"

interface AccountStats {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  totalSpent: number
}

export default function AccountPage() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<AccountStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalSpent: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return

      try {
        const [statsData, ordersData] = await Promise.all([
          getAccountStats(user.id),
          getAccountOrders(user.id, 5, 0),
        ])

        setStats(statsData)
        setRecentOrders(ordersData.data || [])
      } catch (error) {
        console.error("Error fetching account data:", error)
      } finally {
        setStatsLoading(false)
      }
    }

    if (user?.id) {
      fetchData()
    }
  }, [user?.id])

  // Prevent hydration mismatch - don't render user-dependent content until mounted
  if (!mounted || !user) {
    return (
      <div className="lg:col-span-2">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {statsLoading ? "..." : stats.totalOrders}
                        </p>
                        <p className="text-sm text-gray-600">Total Orders</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <Package className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {statsLoading ? "..." : stats.pendingOrders}
                        </p>
                        <p className="text-sm text-gray-600">Active Orders</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Orders */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Recent Orders</h2>
                    <Link href="/account/orders" className="text-sm font-medium text-primary hover:underline">
                      View All
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {statsLoading ? (
                      <p className="text-center text-gray-600 py-4">Loading orders...</p>
                    ) : recentOrders.length === 0 ? (
                      <p className="text-center text-gray-600 py-4">No orders yet</p>
                    ) : (
                      recentOrders.map((order) => {
                        // Format date safely to prevent hydration mismatch
                        const orderDate = mounted && order.created_at
                          ? new Date(order.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""
                        const itemsCount = order.order_items?.length || 0
                        const status = getCustomerFulfillmentLabel(order.fulfillment_status)

                        return (
                          <Link
                            key={order.id}
                            href={`/account/orders/${order.id}`}
                            className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{order.order_number}</p>
                                <p className="text-sm text-gray-600">
                                  {orderDate} • {itemsCount} items
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">${parseFloat(order.total).toFixed(2)}</p>
                                <span
                                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${customerFulfillmentBadgeClass(
                                    order.fulfillment_status
                                  )}`}
                                >
                                  {status}
                                </span>
                              </div>
                            </div>
                          </Link>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Account Details */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold">Account Details</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-3">
                      <span className="text-gray-600">Name</span>
                      <span className="font-medium">
                        {user?.firstName || ""} {user?.lastName || ""}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-3">
                      <span className="text-gray-600">Email</span>
                      <span className="font-medium">{user?.email || ""}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-3">
                      <span className="text-gray-600">Phone</span>
                      <span className="font-medium">{user?.phone || "Not set"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Member Since</span>
                      <span className="font-medium">
                        {mounted && user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/account/profile"
                    className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Edit Profile
                  </Link>
                </div>
              </div>
            </div>
  )
}
