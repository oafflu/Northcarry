"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { Search, Download, Eye, Loader2, Package, CheckSquare, Square, Users, Calendar, RefreshCw, Mail, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import {
  getAdminOrders,
  assignOrdersToSuppliers,
  assignOrdersToSupplier,
  backfillSupplierFulfilledOrders,
  sendPendingShippingNotificationEmails,
} from "@/app/actions/orders"
import { getSuppliers } from "@/app/actions/users"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom'

const PAGE_SIZE_OPTIONS = [50, 100, 500] as const
type OrdersPageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterFulfillmentStatus, setFilterFulfillmentStatus] = useState("all")
  const [filterPurchaseType, setFilterPurchaseType] = useState("all")
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [showBackfillDialog, setShowBackfillDialog] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [sendEmails, setSendEmails] = useState(false)
  const [showShippingEmailDialog, setShowShippingEmailDialog] = useState(false)
  const [shippingEmailBusy, setShippingEmailBusy] = useState(false)
  const [shippingEmailPreview, setShippingEmailPreview] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<OrdersPageSize>(50)
  const [totalCount, setTotalCount] = useState(0)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const filterKey = useMemo(
    () =>
      [
        searchQuery,
        filterStatus,
        filterFulfillmentStatus,
        filterPurchaseType,
        dateFilter,
        customStartDate,
        customEndDate,
      ].join("\u0000"),
    [searchQuery, filterStatus, filterFulfillmentStatus, filterPurchaseType, dateFilter, customStartDate, customEndDate]
  )

  const prevFilterKeyRef = useRef<string | null>(null)
  const prevPageSizeRef = useRef<number | null>(null)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const bumpOrdersRefresh = useCallback(() => setRefreshNonce((n) => n + 1), [])

  const loadSuppliers = async () => {
    try {
      const result = await getSuppliers()
      if (result.data) {
        setSuppliers(result.data)
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    }
  }

  const handleBulkAssign = async () => {
    if (!selectedSupplier || selectedSupplier.trim() === '') {
      toast.error("Please select a supplier")
      return
    }

    if (selectedOrders.size === 0) {
      toast.error("Please select at least one order")
      return
    }

    setBulkAssigning(true)
    try {
      const orderIds = Array.from(selectedOrders)
      console.log('Assigning orders:', { 
        orderIds, 
        orderIdsLength: orderIds.length,
        supplierId: selectedSupplier,
        supplierIdLength: selectedSupplier.length
      })
      
      if (!orderIds || orderIds.length === 0) {
        throw new Error('No orders selected')
      }

      if (!selectedSupplier || selectedSupplier.trim() === '') {
        throw new Error('No supplier selected')
      }

      const result = await assignOrdersToSupplier(orderIds, selectedSupplier)
      
      console.log('Assignment result:', result)
      
      if (!result) {
        throw new Error('No response from server')
      }

      if (result.success) {
        toast.success("Orders assigned successfully", {
          description: result.message || `Successfully assigned ${result.assigned || 0} order(s)`,
        })
        setSelectedOrders(new Set())
        setShowBulkAssignDialog(false)
        setSelectedSupplier("")
        bumpOrdersRefresh()
      } else {
        // Show detailed error message
        let errorMessage = "An unexpected error occurred"
        
        if (result.error) {
          errorMessage = result.error
        } else if (result.errorMessages && result.errorMessages.length > 0) {
          errorMessage = result.errorMessages.join(', ')
        } else if (result.message) {
          errorMessage = result.message
        }
        
        console.error('Assignment failed:', {
          error: result.error,
          errorMessages: result.errorMessages,
          message: result.message,
          assigned: result.assigned,
          errors: result.errors
        })
        
        toast.error("Failed to assign orders", {
          description: errorMessage,
          duration: 5000,
        })
      }
    } catch (error: any) {
      console.error('Error bulk assigning orders:', error)
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      
      const errorMessage = error?.message || error?.toString() || "An unexpected error occurred"
      
      toast.error("Failed to assign orders", {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setBulkAssigning(false)
    }
  }

  const getDateRange = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    switch (dateFilter) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        }
      case 'week':
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return {
          startDate: weekAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        }
      case 'month':
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return {
          startDate: monthAgo.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
        }
      case 'custom':
        return {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        }
      default:
        return {
          startDate: undefined,
          endDate: undefined,
        }
    }
  }

  const handleDateFilterChange = (value: DateFilter) => {
    setDateFilter(value)
    setShowCustomDateRange(value === 'custom')
    if (value !== 'custom') {
      setCustomStartDate('')
      setCustomEndDate('')
    }
  }

  const handleBackfillFulfilledOrders = async () => {
    setBackfilling(true)
    try {
      const result = await backfillSupplierFulfilledOrders({
        sendEmails: sendEmails,
        dryRun: false
      })

      if (result.success) {
        toast.success("Orders backfilled successfully", {
          description: result.message,
          duration: 5000,
        })
        bumpOrdersRefresh()
      } else {
        toast.error("Failed to backfill orders", {
          description: result.error || "An unexpected error occurred",
          duration: 5000,
        })
      }

      if (result.errors && result.errors.length > 0) {
        console.error('Backfill errors:', result.errors)
      }
    } catch (error: any) {
      console.error('Error backfilling orders:', error)
      toast.error("Failed to backfill orders", {
        description: error.message || "An unexpected error occurred",
        duration: 5000,
      })
    } finally {
      setBackfilling(false)
      setShowBackfillDialog(false)
    }
  }

  useEffect(() => {
    const prev = prevFilterKeyRef.current
    const filterJustChanged = prev !== null && prev !== filterKey
    prevFilterKeyRef.current = filterKey

    const prevPs = prevPageSizeRef.current
    const pageSizeJustChanged = prevPs !== null && prevPs !== pageSize
    prevPageSizeRef.current = pageSize

    if (filterJustChanged && page !== 1) {
      setPage(1)
      return
    }
    if (pageSizeJustChanged && page !== 1) {
      setPage(1)
      return
    }

    const pageToUse = filterJustChanged ? 1 : page
    const offset = (pageToUse - 1) * pageSize

    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const dateRange = getDateRange()
        const result = await getAdminOrders({
          search: searchQuery || undefined,
          paymentStatus: filterStatus !== "all" ? filterStatus : undefined,
          fulfillmentStatus: filterFulfillmentStatus !== "all" ? filterFulfillmentStatus : undefined,
          purchaseType: filterPurchaseType !== "all" ? filterPurchaseType : undefined,
          limit: pageSize,
          offset,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        })

        if (cancelled) return

        if (result.error) {
          toast.error("Failed to load orders", {
            description: result.error,
          })
          setOrders([])
          setTotalCount(0)
        } else {
          setOrders(result.data)
          setTotalCount(result.total ?? 0)
        }
      } catch (error: any) {
        if (cancelled) return
        console.error("Error loading orders:", error)
        toast.error("Failed to load orders", {
          description: error.message || "An unexpected error occurred",
        })
        setOrders([])
        setTotalCount(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filterKey, page, pageSize, refreshNonce])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalCount)

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(totalCount / pageSize))
    if (page > tp) setPage(tp)
  }, [totalCount, page, pageSize])

  const handleDryRunPendingShippingEmails = async () => {
    setShippingEmailBusy(true)
    setShippingEmailPreview(null)
    try {
      const orderIds =
        selectedOrders.size > 0 ? Array.from(selectedOrders) : undefined
      const result = await sendPendingShippingNotificationEmails({
        dryRun: true,
        orderIds,
      })
      if (!result.success) {
        toast.error("Dry run failed", { description: result.error })
        return
      }
      const n = result.pendingOrderNumbers?.length ?? 0
      const scope =
        selectedOrders.size > 0
          ? `Only the ${selectedOrders.size} order(s) you checked on the table are considered (still must be fulfilled, shipped+tracking, and no shipping email logged).`
          : "No rows were checked — this counted every qualifying order in your entire store."
      setShippingEmailPreview(
        n === 0
          ? `No orders qualify in this scope. ${scope}`
          : `${n} order(s) would receive the shipping notification email. ${scope}`
      )
      toast.success("Dry run complete", { description: result.message })
    } catch (e: any) {
      toast.error("Dry run failed", { description: e?.message })
    } finally {
      setShippingEmailBusy(false)
    }
  }

  const handleSendPendingShippingEmails = async () => {
    setShippingEmailBusy(true)
    try {
      const orderIds =
        selectedOrders.size > 0 ? Array.from(selectedOrders) : undefined
      const result = await sendPendingShippingNotificationEmails({
        dryRun: false,
        orderIds,
      })
      if (!result.success) {
        toast.error("Send failed", { description: result.error })
        return
      }
      toast.success(result.message || "Done", {
        description:
          result.errors?.length > 0
            ? `${result.errors.length} error(s) — see console or server logs`
            : undefined,
      })
      if (result.errors?.length) console.error("Shipping email errors:", result.errors)
      setShowShippingEmailDialog(false)
      setShippingEmailPreview(null)
      bumpOrdersRefresh()
    } catch (e: any) {
      toast.error("Send failed", { description: e?.message })
    } finally {
      setShippingEmailBusy(false)
    }
  }

  const handleAssignOrders = async () => {
    setAssigning(true)
    try {
      const result = await assignOrdersToSuppliers()
      if (result.success) {
        toast.success("Orders assigned to suppliers", {
          description: result.message,
        })
      } else {
        toast.error("Failed to assign orders", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      console.error('Error assigning orders:', error)
      toast.error("Failed to assign orders", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Manage and fulfill customer orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders/create">
            <Button
              variant="default"
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </Link>
          {selectedOrders.size > 0 && (
            <Button
              onClick={() => setShowBulkAssignDialog(true)}
              variant="default"
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Users className="w-4 h-4 mr-2" />
              Assign {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''} to Supplier
            </Button>
          )}
          <button
            onClick={handleAssignOrders}
            disabled={assigning}
            className="flex items-center gap-2 px-4 py-2.5 border border-teal-300 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assigning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Package className="w-5 h-5" />
            )}
            {assigning ? "Assigning..." : "Auto-Assign All"}
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            <Download className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowBackfillDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-blue-300 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
          >
            <RefreshCw className="w-5 h-5" />
            Backfill Fulfilled Orders
          </button>
          <button
            type="button"
            onClick={() => {
              setShowShippingEmailDialog(true)
              setShippingEmailPreview(null)
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-violet-300 bg-violet-50 text-violet-800 rounded-lg hover:bg-violet-100 font-medium"
          >
            <Mail className="w-5 h-5" />
            Send pending shipping emails
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Payment Status</option>
            <option value="pending">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={filterFulfillmentStatus}
            onChange={(e) => setFilterFulfillmentStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Fulfillment Status</option>
            <option value="unfulfilled">Unfulfilled</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterPurchaseType}
            onChange={(e) => setFilterPurchaseType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Purchase Types</option>
            <option value="one-time">One-Time</option>
            <option value="subscription">Ongoing Subscription</option>
            <option value="prepaid">Prepaid Subscription</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        
        {/* Date Filter */}
        <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by Date:</span>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value as DateFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="custom">Custom Date Range</option>
          </select>
          {showCustomDateRange && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm"
                placeholder="Start Date"
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm"
                placeholder="End Date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center"
                    title="Select all"
                  >
                    {selectedOrders.size === orders.length && orders.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-teal-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fulfillment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                    <p className="mt-2 text-sm text-gray-500">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <p className="text-sm text-gray-500">No orders found</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 ${selectedOrders.has(order.id) ? 'bg-teal-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleOrderSelection(order.id)}
                        className="flex items-center justify-center"
                        title="Select order"
                      >
                        {selectedOrders.has(order.id) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.customer}</div>
                      <div className="text-sm text-gray-500">{order.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${order.total}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const orderTotal = parseFloat(order.total || '0')
                        const isFreeOrder = orderTotal < 1.0
                        const displayStatus = isFreeOrder ? 'Free Order' : (order.paymentStatus || 'pending')
                        
                        return (
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              isFreeOrder
                                ? "bg-purple-50 text-purple-700"
                                : order.paymentStatus === "paid"
                                  ? "bg-green-50 text-green-700"
                                  : order.paymentStatus === "processing"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-yellow-50 text-yellow-700"
                            }`}
                          >
                            {displayStatus}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.fulfillmentStatus === "fulfilled" || order.fulfillmentStatus === "shipped"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        {order.fulfillmentStatus || "unfulfilled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.itemsCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.purchaseType === 'subscription' 
                          ? 'bg-blue-50 text-blue-700'
                          : order.purchaseType === 'prepaid'
                            ? 'bg-purple-50 text-purple-700'
                            : order.purchaseType === 'mixed'
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-gray-50 text-gray-700'
                      }`}>
                        {order.purchaseType === 'subscription' 
                          ? 'Ongoing Subscription'
                          : order.purchaseType === 'prepaid'
                            ? 'Prepaid Subscription'
                            : order.purchaseType === 'mixed'
                              ? 'Mixed'
                              : 'One-time'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80">
          <p className="text-sm text-gray-600">
            {totalCount === 0
              ? "No orders"
              : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="whitespace-nowrap">Per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as OrdersPageSize)}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="text-sm text-gray-600 tabular-nums px-2">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages || totalCount === 0}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Orders to Supplier</DialogTitle>
            <DialogDescription>
              Select a supplier to assign {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`.trim() || supplier.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkAssignDialog(false)
                setSelectedSupplier("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={!selectedSupplier || bulkAssigning}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {bulkAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Orders'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backfill Fulfilled Orders Dialog */}
      <Dialog open={showBackfillDialog} onOpenChange={setShowBackfillDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Backfill Supplier Fulfilled Orders</DialogTitle>
            <DialogDescription>
              This will update orders that were fulfilled by suppliers before the fix. It will sync tracking information from supplier assignments to the main orders and optionally send fulfillment emails to customers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>What this does:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Finds orders where suppliers have shipped but tracking info is missing on the main order</li>
                <li>Updates orders with tracking_number and shipping_carrier from supplier assignments</li>
                <li>Ensures fulfillment_status is set to 'fulfilled'</li>
                <li>Creates order_tracking records if missing</li>
                {sendEmails && (
                  <li className="font-semibold">Will send fulfillment emails to customers</li>
                )}
              </ul>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="sendEmails"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="sendEmails" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Send fulfillment emails to customers
              </label>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Only orders that need updating will be processed. Orders that already have tracking information will be skipped.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBackfillDialog(false)
                setSendEmails(false)
              }}
              disabled={backfilling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBackfillFulfilledOrders}
              disabled={backfilling}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {backfilling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Backfill Orders
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showShippingEmailDialog}
        onOpenChange={(open) => {
          setShowShippingEmailDialog(open)
          if (!open) setShippingEmailPreview(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send pending shipping emails</DialogTitle>
            <DialogDescription>
              Sends the same shipping notification email used when a supplier ships an order, but only for orders that are{" "}
              <strong>fulfilled</strong>, have a <strong>shipped</strong> supplier assignment with tracking, and have{" "}
              <strong>shipping_notification_sent_at</strong> empty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm text-gray-700">
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-violet-900">
              <p className="font-medium">Which orders are included?</p>
              <ul className="mt-2 list-disc list-inside text-xs leading-relaxed space-y-1">
                <li>
                  <strong>Checked rows in the table:</strong> Dry run / send only consider those order IDs (plus the rules
                  above). Uncheck everything to run against <strong>all</strong> pending orders in the database — that is why
                  you previously saw ~479.
                </li>
                <li>
                  <strong>Select all</strong> only selects orders on the <strong>current page</strong>. Raise &quot;Per
                  page&quot; (e.g. 500) or go page by page if your batch spans multiple pages.
                </li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
              <p className="font-medium">Before the fulfillment fix</p>
              <p className="mt-1 text-xs leading-relaxed">
                Bulk tracking upload may have <strong>already sent</strong> some shipping emails even when the admin order
                stayed &quot;unfulfilled.&quot; Check your email provider (e.g. Resend) logs. For any order that already got
                the email, run in Supabase:{" "}
                <code className="text-[11px] bg-amber-100 px-1 rounded">
                  UPDATE orders SET shipping_notification_sent_at = now() WHERE order_number IN (&apos;…&apos;);
                </code>{" "}
                so they are skipped here.
              </p>
            </div>
            <p className="text-xs text-gray-600">
              One-time setup: run <code className="bg-gray-100 px-1 rounded">scripts/add-shipping-notification-sent-at.sql</code>{" "}
              in the Supabase SQL editor if you have not already.
            </p>
            {shippingEmailPreview && (
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">{shippingEmailPreview}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowShippingEmailDialog(false)
                setShippingEmailPreview(null)
              }}
              disabled={shippingEmailBusy}
            >
              Close
            </Button>
            <Button variant="secondary" onClick={handleDryRunPendingShippingEmails} disabled={shippingEmailBusy}>
              {shippingEmailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Dry run
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleSendPendingShippingEmails}
              disabled={shippingEmailBusy}
            >
              {shippingEmailBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
