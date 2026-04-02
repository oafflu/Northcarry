"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  BarChart3,
  Download,
  Sparkles,
  Loader2,
} from "lucide-react"
import { getAnalyticsData, generateAIAnalysis, type AnalyticsData } from "@/app/actions/analytics"
import { toast } from "sonner"

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "custom">("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [aiInsights, setAiInsights] = useState<string>("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [hoveredRevenueIdx, setHoveredRevenueIdx] = useState<number | null>(null)
  const [hoveredOrdersIdx, setHoveredOrdersIdx] = useState<number | null>(null)

  useEffect(() => {
    if (dateRange === "custom") return
    loadData()
  }, [dateRange])

  const loadData = async () => {
    if (dateRange === "custom" && (!customStart || !customEnd)) {
      toast.error("Choose start and end dates, then Apply.")
      return
    }
    setLoading(true)
    try {
      const start = dateRange === "custom" ? new Date(`${customStart}T00:00:00.000Z`).toISOString() : undefined
      const end = dateRange === "custom" ? new Date(`${customEnd}T23:59:59.999Z`).toISOString() : undefined
      const analyticsData = await getAnalyticsData(dateRange, start, end)
      setData(analyticsData)
    } catch (error: any) {
      console.error("Error loading analytics:", error)
      toast.error("Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAIInsights = async () => {
    if (!data) return
    
    setLoadingAI(true)
    try {
      const insights = await generateAIAnalysis(data, "insights")
      setAiInsights(insights)
    } catch (error: any) {
      console.error("Error generating AI insights:", error)
      toast.error("Failed to generate AI insights")
    } finally {
      setLoadingAI(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatCompactNumber = (n: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    )
  }

  const metrics = [
    {
      label: "Total Revenue",
      value: formatCurrency(data.revenue.total),
      current: formatCurrency(data.revenue.current),
      change: formatPercent(data.revenue.change),
      trend: data.revenue.change >= 0 ? "up" : "down",
      icon: DollarSign,
    },
    {
      label: "Orders",
      value: data.orders.total.toLocaleString(),
      current: data.orders.current.toLocaleString(),
      change: formatPercent(data.orders.change),
      trend: data.orders.change >= 0 ? "up" : "down",
      icon: ShoppingCart,
    },
    {
      label: "Customers",
      value: data.customers.total.toLocaleString(),
      current: `${data.customers.new.toLocaleString()} new`,
      change: `${data.customers.returning.toLocaleString()} returning`,
      trend: "up",
      icon: Users,
    },
    {
      label: "Avg. Order Value",
      value: formatCurrency(data.conversion.avgOrderValue),
      current: "",
      change: "",
      trend: "neutral",
      icon: BarChart3,
    },
    {
      label: "Top Products",
      value: data.products.topSelling.length.toString(),
      current: "",
      change: "",
      trend: "neutral",
      icon: Package,
    },
  ]

  // Get max revenue for chart scaling
  const maxRevenue = Math.max(...data.trends.revenueByDay.map((d) => d.revenue), 1)
  const maxOrders = Math.max(...data.trends.ordersByDay.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your store performance and insights</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="custom">Custom range</option>
          </select>
          {dateRange === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                onClick={loadData}
                className="rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Apply
              </button>
            </>
          )}
          <button
            onClick={handleGenerateAIInsights}
            disabled={loadingAI}
            className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {loadingAI ? "Generating..." : "AI Insights"}
          </button>
          <button className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* AI Insights Panel */}
      {aiInsights && (
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Insights</h3>
          </div>
          <p className="text-gray-700 whitespace-pre-line">{aiInsights}</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50">
                  <Icon className="h-6 w-6 text-teal-600" />
                </div>
                {metric.change && (
                  <span
                    className={`flex items-center gap-1 text-sm font-medium ${
                      metric.trend === "up" ? "text-green-600" : 
                      metric.trend === "down" ? "text-red-600" : 
                      "text-gray-600"
                    }`}
                  >
                    {metric.trend === "up" && <TrendingUp className="h-4 w-4" />}
                    {metric.trend === "down" && <TrendingDown className="h-4 w-4" />}
                    {metric.change}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{metric.value}</h3>
              <p className="text-sm text-gray-600">{metric.label}</p>
              {metric.current && (
                <p className="text-xs text-gray-500 mt-1">Current period: {metric.current}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Revenue Trend</h3>
            <p className="text-sm text-gray-600">
              {hoveredRevenueIdx !== null
                ? `${new Date(data.trends.revenueByDay[hoveredRevenueIdx].date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}: ${formatCurrency(data.trends.revenueByDay[hoveredRevenueIdx].revenue)}`
                : "Hover bars for values"}
            </p>
          </div>
          <div className="h-64 flex gap-3">
            <div className="w-12 h-full flex flex-col justify-between text-xs text-gray-500">
              <span>{formatCompactNumber(maxRevenue)}</span>
              <span>{formatCompactNumber(maxRevenue / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="h-full min-w-[720px] flex items-end gap-2 border-b border-gray-200 pb-6">
              {data.trends.revenueByDay.map((day, idx) => {
                const height = (day.revenue / maxRevenue) * 100
                return (
                  <div key={idx} className="w-6 shrink-0 flex flex-col items-center gap-2 min-w-0">
                    <div className="relative w-full h-[220px] flex items-end">
                      <div
                        className="w-full rounded-t-md bg-teal-600 transition-all hover:bg-teal-700 cursor-pointer"
                        style={{ height: `${Math.max(Math.min(height, 100), 3)}%` }}
                        title={formatCurrency(day.revenue)}
                        onMouseEnter={() => setHoveredRevenueIdx(idx)}
                        onMouseLeave={() => setHoveredRevenueIdx(null)}
                      />
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="mb-6 text-lg font-bold text-gray-900">Top Selling Products</h3>
          <div className="space-y-4">
            {data.products.topSelling.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No product sales data available</p>
            ) : (
              data.products.topSelling.slice(0, 5).map((product, idx) => (
                <div key={product.id || idx} className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gray-100">
                      <Package className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.sales} units sold</p>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Orders Trend */}
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Orders Trend</h3>
            <p className="text-sm text-gray-600">
              {hoveredOrdersIdx !== null
                ? `${new Date(data.trends.ordersByDay[hoveredOrdersIdx].date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}: ${data.trends.ordersByDay[hoveredOrdersIdx].count.toLocaleString()} orders`
                : "Hover bars for values"}
            </p>
          </div>
          <div className="h-64 flex gap-3">
            <div className="w-12 h-full flex flex-col justify-between text-xs text-gray-500">
              <span>{maxOrders.toLocaleString()}</span>
              <span>{Math.round(maxOrders / 2).toLocaleString()}</span>
              <span>0</span>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="h-full min-w-[720px] flex items-end gap-2 border-b border-gray-200 pb-6">
              {data.trends.ordersByDay.map((day, idx) => {
                const height = (day.count / maxOrders) * 100
                return (
                  <div key={idx} className="w-6 shrink-0 flex flex-col items-center gap-2 min-w-0">
                    <div className="relative w-full h-[220px] flex items-end">
                      <div
                        className="w-full rounded-t-md bg-blue-600 transition-all hover:bg-blue-700 cursor-pointer"
                        style={{ height: `${Math.max(Math.min(height, 100), 3)}%` }}
                        title={`${day.count} orders`}
                        onMouseEnter={() => setHoveredOrdersIdx(idx)}
                        onMouseLeave={() => setHoveredOrdersIdx(null)}
                      />
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                )
              })}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Insights */}
        <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
          <h3 className="mb-6 text-lg font-bold text-gray-900">Customer Insights</h3>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">New Customers</span>
                <span className="text-lg font-bold text-gray-900">{data.customers.new.toLocaleString()}</span>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">Returning Customers</span>
                <span className="text-lg font-bold text-gray-900">{data.customers.returning.toLocaleString()}</span>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-sm text-gray-600">Average Order Value</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.conversion.avgOrderValue)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{data.customers.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
