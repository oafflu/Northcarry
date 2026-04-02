"use client"

import { useState, useEffect } from "react"
import {
  FileText,
  Download,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Calendar,
  Loader2,
  Sparkles,
  BarChart3,
  PieChart,
} from "lucide-react"
import { getAnalyticsData, generateAIAnalysis, type AnalyticsData } from "@/app/actions/analytics"
import { toast } from "sonner"

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "custom">("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [reportType, setReportType] = useState<"customers" | "sales" | "revenue" | "trends" | "promotions">("customers")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
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
      console.error("Error loading report data:", error)
      toast.error("Failed to load report data")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!data) return
    
    setLoadingAI(true)
    try {
      const analysis = await generateAIAnalysis(data, reportType === "promotions" ? "recommendations" : "insights")
      setAiAnalysis(analysis)
    } catch (error: any) {
      console.error("Error generating report:", error)
      toast.error("Failed to generate report")
    } finally {
      setLoadingAI(false)
    }
  }

  const handleExport = () => {
    if (!data) return
    
    // Create CSV content based on report type
    let csvContent = ""
    
    switch (reportType) {
      case "customers":
        csvContent = `Customer Report - ${dateRange}\n\n`
        csvContent += `Total Customers,${data.customers.total}\n`
        csvContent += `New Customers,${data.customers.new}\n`
        csvContent += `Returning Customers,${data.customers.returning}\n`
        csvContent += `Retention Rate,${data.customers.retentionRate.toFixed(2)}%\n`
        break
      case "sales":
        csvContent = `Sales Report - ${dateRange}\n\n`
        csvContent += `Total Orders,${data.orders.total}\n`
        csvContent += `Current Period Orders,${data.orders.current}\n`
        csvContent += `Previous Period Orders,${data.orders.previous}\n`
        csvContent += `Change,${data.orders.change.toFixed(2)}%\n`
        csvContent += `Average Order Value,$${data.conversion.avgOrderValue.toFixed(2)}\n`
        break
      case "revenue":
        csvContent = `Revenue Report - ${dateRange}\n\n`
        csvContent += `Total Revenue,$${data.revenue.total.toFixed(2)}\n`
        csvContent += `Current Period Revenue,$${data.revenue.current.toFixed(2)}\n`
        csvContent += `Previous Period Revenue,$${data.revenue.previous.toFixed(2)}\n`
        csvContent += `Change,${data.revenue.change.toFixed(2)}%\n`
        break
      case "trends":
        csvContent = `Trends Report - ${dateRange}\n\n`
        csvContent += `Date,Revenue,Orders\n`
        data.trends.revenueByDay.forEach((day, idx) => {
          csvContent += `${day.date},$${day.revenue.toFixed(2)},${data.trends.ordersByDay[idx]?.count || 0}\n`
        })
        break
      case "promotions":
        csvContent = `Promotion Analysis - ${dateRange}\n\n`
        csvContent += `Top Products\n`
        csvContent += `Product Name,Sales,Revenue\n`
        data.products.topSelling.forEach(product => {
          csvContent += `${product.name},${product.sales},$${product.revenue.toFixed(2)}\n`
        })
        break
    }
    
    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportType}-report-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success("Report exported successfully")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatCompactNumber = (n: number) =>
    new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)

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
        <p className="text-gray-500">No report data available</p>
      </div>
    )
  }

  const maxRevenue = Math.max(...data.trends.revenueByDay.map((d) => d.revenue), 1)
  const maxOrders = Math.max(...data.trends.ordersByDay.map((d) => d.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate comprehensive reports and analyses</p>
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
            onClick={handleGenerateReport}
            disabled={loadingAI}
            className="flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {loadingAI ? "Generating..." : "AI Analysis"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReportType("customers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === "customers" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Customers
          </button>
          <button
            onClick={() => setReportType("sales")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === "sales" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Sales
          </button>
          <button
            onClick={() => setReportType("revenue")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === "revenue" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Revenue
          </button>
          <button
            onClick={() => setReportType("trends")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === "trends" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trends
          </button>
          <button
            onClick={() => setReportType("promotions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              reportType === "promotions" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Promotions
          </button>
        </div>
      </div>

      {/* AI Analysis Panel */}
      {aiAnalysis && (
        <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg border border-teal-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
          </div>
          <p className="text-gray-700 whitespace-pre-line">{aiAnalysis}</p>
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {reportType === "customers" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Customer Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{data.customers.total.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">New Customers</p>
                <p className="text-2xl font-bold text-green-600">{data.customers.new.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Returning Customers</p>
                <p className="text-2xl font-bold text-blue-600">{data.customers.returning.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Retention Rate</p>
                <p className="text-2xl font-bold text-teal-600">{data.customers.retentionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {reportType === "sales" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Sales Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{data.orders.total.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Current Period</p>
                <p className="text-2xl font-bold text-teal-600">{data.orders.current.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {data.orders.change >= 0 ? "+" : ""}{data.orders.change.toFixed(1)}% vs previous
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Average Order Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.conversion.avgOrderValue)}</p>
              </div>
            </div>
          </div>
        )}

        {reportType === "revenue" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Revenue Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.total)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Current Period</p>
                <p className="text-2xl font-bold text-teal-600">{formatCurrency(data.revenue.current)}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {data.revenue.change >= 0 ? "+" : ""}{data.revenue.change.toFixed(1)}% vs previous
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Previous Period</p>
                <p className="text-2xl font-bold text-gray-600">{formatCurrency(data.revenue.previous)}</p>
              </div>
            </div>
          </div>
        )}

        {reportType === "trends" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Purchase Trends</h2>
            <div className="space-y-4">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
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
                        <div className="w-full h-[220px] flex items-end">
                          <div
                            className="w-full bg-teal-600 rounded-t hover:bg-teal-700 cursor-pointer"
                            style={{ height: `${Math.max(Math.min(height, 100), 3)}%` }}
                            onMouseEnter={() => setHoveredRevenueIdx(idx)}
                            onMouseLeave={() => setHoveredRevenueIdx(null)}
                            title={formatCurrency(day.revenue)}
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
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Orders Trend</h3>
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
                        <div className="w-full h-[220px] flex items-end">
                          <div
                            className="w-full bg-blue-600 rounded-t hover:bg-blue-700 cursor-pointer"
                            style={{ height: `${Math.max(Math.min(height, 100), 3)}%` }}
                            onMouseEnter={() => setHoveredOrdersIdx(idx)}
                            onMouseLeave={() => setHoveredOrdersIdx(null)}
                            title={`${day.count} orders`}
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
            </div>
          </div>
        )}

        {reportType === "promotions" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Promotion Analysis</h2>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Performing Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Units Sold</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.products.topSelling.map((product, idx) => (
                      <tr key={product.id || idx}>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{product.sales}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

