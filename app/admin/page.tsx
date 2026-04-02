"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Calendar,
  BarChart3,
  CreditCard,
  Globe,
  Repeat,
  TrendingDown,
  X,
} from "lucide-react"
import { getDashboardMetrics, type DateRange } from "@/app/actions/dashboard"
import { getRecentOrders } from "@/app/actions/orders"

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange>("thisMonth")
  const [compareEnabled, setCompareEnabled] = useState(true)
  const [customStart, setCustomStart] = useState<Date | undefined>()
  const [customEnd, setCustomEnd] = useState<Date | undefined>()
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])

  useEffect(() => {
    loadDashboardData()
  }, [dateRange, customStart, customEnd])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      const [metricsResult, ordersResult] = await Promise.all([
        getDashboardMetrics(dateRange, customStart, customEnd),
        getRecentOrders(5),
      ])

      setMetrics(metricsResult)
      if (ordersResult.data) {
        setRecentOrders(ordersResult.data)
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(1)}%`
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "thisWeek", label: "This Week" },
    { value: "lastWeek", label: "Last Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "custom", label: "Custom" },
  ]

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)
    if (range !== "custom") {
      setCustomStart(undefined)
      setCustomEnd(undefined)
      setShowCustomDatePicker(false)
    } else {
      setShowCustomDatePicker(true)
    }
  }

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      loadDashboardData()
      setShowCustomDatePicker(false)
    }
  }

  const MetricCard = ({
    title,
    value,
    change,
    previousValue,
    icon: Icon,
    formatValue = (v: number) => formatCurrency(v),
    showComparison = true,
  }: {
    title: string
    value: number
    change: number
    previousValue?: number
    icon: any
    formatValue?: (v: number) => string
    showComparison?: boolean
  }) => {
    const isPositive = change >= 0
    const hasComparison = compareEnabled && showComparison && previousValue !== undefined

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-teal-600" />
              </div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{formatValue(value)}</p>
            {hasComparison && (
              <div className="space-y-1">
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {formatChange(change)} vs previous period
                </div>
                <p className="text-xs text-gray-500">Previous: {formatValue(previousValue!)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Unable to load dashboard data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your store performance</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Compare Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700">Compare</span>
          </label>

          {/* Date Range Selector */}
          <div className="relative">
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg bg-white">
              {dateRangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDateRangeChange(option.value)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    dateRange === option.value
                      ? "bg-teal-600 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  } ${option.value === "today" ? "rounded-l-lg" : ""} ${
                    option.value === "custom" ? "rounded-r-lg" : ""
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker */}
            {showCustomDatePicker && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-[320px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Select Date Range</h3>
                  <button
                    onClick={() => {
                      setShowCustomDatePicker(false)
                      if (dateRange !== "custom") {
                        setDateRange("thisMonth")
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStart ? customStart.toISOString().split("T")[0] : ""}
                      onChange={(e) => setCustomStart(e.target.value ? new Date(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEnd ? customEnd.toISOString().split("T")[0] : ""}
                      onChange={(e) => setCustomEnd(e.target.value ? new Date(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <button
                    onClick={handleCustomDateApply}
                    disabled={!customStart || !customEnd}
                    className="w-full px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={metrics.revenue.current}
          change={metrics.revenue.change}
          previousValue={compareEnabled ? metrics.revenue.previous : undefined}
          icon={DollarSign}
        />
        <MetricCard
          title="Orders"
          value={metrics.orders.current}
          change={metrics.orders.change}
          previousValue={compareEnabled ? metrics.orders.previous : undefined}
          icon={ShoppingCart}
          formatValue={(v) => formatNumber(v)}
        />
        <MetricCard
          title="Average Order Value"
          value={metrics.aov.current}
          change={metrics.aov.change}
          previousValue={compareEnabled ? metrics.aov.previous : undefined}
          icon={CreditCard}
        />
        <MetricCard
          title="Cost of Goods Sold"
          value={metrics.cogs.current}
          change={metrics.cogs.change}
          previousValue={compareEnabled ? metrics.cogs.previous : undefined}
          icon={Package}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Profit"
          value={metrics.profit.current}
          change={metrics.profit.change}
          previousValue={compareEnabled ? metrics.profit.previous : undefined}
          icon={TrendingUp}
        />
        <MetricCard
          title="Website Sessions"
          value={metrics.sessions.current}
          change={metrics.sessions.change}
          previousValue={compareEnabled ? metrics.sessions.previous : undefined}
          icon={Globe}
          formatValue={(v) => formatNumber(v)}
        />
        <MetricCard
          title="Subscriptions"
          value={metrics.subscriptions.current}
          change={metrics.subscriptions.change}
          previousValue={compareEnabled ? metrics.subscriptions.previous : undefined}
          icon={Repeat}
          formatValue={(v) => formatNumber(v)}
          showComparison={true}
        />
        <MetricCard
          title="New Customers"
          value={metrics.customers.current}
          change={metrics.customers.change}
          previousValue={compareEnabled ? metrics.customers.previous : undefined}
          icon={Users}
          formatValue={(v) => formatNumber(v)}
        />
              </div>

      {/* Subscription Details Card */}
      {metrics.subscriptions && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.subscriptions.active)}</p>
              </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">New This Period</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.subscriptions.new)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total This Period</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.subscriptions.current)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Sources Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Organic</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.organic)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Direct</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.direct)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Referral</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.referral)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Social</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.social)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Email</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.email)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Paid</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.paid)}</p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm font-medium text-teal-600 hover:text-teal-700">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link href={`/admin/orders/${order.id}`} className="text-teal-600 hover:text-teal-700">
                        {order.orderNumber}
                      </Link>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.customer}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.product}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(parseFloat(order.amount))}
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === "fulfilled"
                          ? "bg-green-50 text-green-700"
                            : order.status === "in-transit"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                        {order.status === "fulfilled"
                          ? "Fulfilled"
                          : order.status === "in-transit"
                            ? "In Transit"
                            : "Unfulfilled"}
                    </span>
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
