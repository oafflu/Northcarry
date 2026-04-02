"use client"

import { useState, useEffect } from "react"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Loader2,
  Sparkles,
  PieChart,
  BarChart3,
} from "lucide-react"
import { getAnalyticsData, generateAIAnalysis, type AnalyticsData } from "@/app/actions/analytics"
import { toast } from "sonner"

export default function FinancialsPage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "custom">("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [aiInsights, setAiInsights] = useState<string>("")
  const [loadingAI, setLoadingAI] = useState(false)
  const [hoveredProfitIdx, setHoveredProfitIdx] = useState<number | null>(null)

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
      console.error("Error loading financial data:", error)
      toast.error("Failed to load financial data")
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInsights = async () => {
    if (!data) return
    
    setLoadingAI(true)
    try {
      const insights = await generateAIAnalysis(data, "recommendations")
      setAiInsights(insights)
    } catch (error: any) {
      console.error("Error generating insights:", error)
      toast.error("Failed to generate insights")
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

  // Calculate estimated costs (placeholder - you'll need to add actual cost tracking)
  const estimatedCosts = {
    cogs: data ? data.revenue.current * 0.4 : 0, // 40% COGS estimate
    marketing: data ? data.revenue.current * 0.15 : 0, // 15% marketing estimate
    operations: data ? data.revenue.current * 0.1 : 0, // 10% operations estimate
    other: data ? data.revenue.current * 0.05 : 0, // 5% other costs
  }
  
  const totalCosts = Object.values(estimatedCosts).reduce((sum, cost) => sum + cost, 0)
  const grossProfit = data ? data.revenue.current - estimatedCosts.cogs : 0
  const netProfit = data ? data.revenue.current - totalCosts : 0
  const profitMargin = data && data.revenue.current > 0 ? (netProfit / data.revenue.current) * 100 : 0
  const maxProfit = data ? Math.max(...data.trends.revenueByDay.map((d) => d.revenue * 0.6), 1) : 1

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
        <p className="text-gray-500">No financial data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financials</h1>
          <p className="text-gray-600 mt-1">Revenue, costs, expenses, and profit analysis</p>
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
            onClick={handleGenerateInsights}
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
            <h3 className="text-lg font-semibold text-gray-900">AI Financial Insights</h3>
          </div>
          <p className="text-gray-700 whitespace-pre-line">{aiInsights}</p>
        </div>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.revenue.current)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {data.revenue.change >= 0 ? "+" : ""}{data.revenue.change.toFixed(1)}% vs previous
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Costs</p>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCosts)}</p>
          <p className="text-sm text-gray-500 mt-1">Estimated</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Gross Profit</p>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(grossProfit)}</p>
          <p className="text-sm text-gray-500 mt-1">
            {data.revenue.current > 0 ? ((grossProfit / data.revenue.current) * 100).toFixed(1) : 0}% margin
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Net Profit</p>
            <DollarSign className="w-5 h-5 text-teal-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(netProfit)}</p>
          <p className="text-sm text-gray-500 mt-1">{profitMargin.toFixed(1)}% margin</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Cost Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Cost of Goods Sold (COGS)</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(estimatedCosts.cogs)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${(estimatedCosts.cogs / totalCosts) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Marketing & Advertising</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(estimatedCosts.marketing)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${(estimatedCosts.marketing / totalCosts) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Operations</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(estimatedCosts.operations)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500" style={{ width: `${(estimatedCosts.operations / totalCosts) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Other Expenses</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(estimatedCosts.other)}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-gray-500" style={{ width: `${(estimatedCosts.other / totalCosts) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Profitability Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Profitability Trend</h3>
            <p className="text-sm text-gray-600">
              {hoveredProfitIdx !== null
                ? `${new Date(data.trends.revenueByDay[hoveredProfitIdx].date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}: ${formatCurrency(data.trends.revenueByDay[hoveredProfitIdx].revenue * 0.6)} est. profit`
                : "Hover bars for values"}
            </p>
          </div>
          <div className="h-64 flex gap-3">
            <div className="w-12 h-full flex flex-col justify-between text-xs text-gray-500">
              <span>{formatCompactNumber(maxProfit)}</span>
              <span>{formatCompactNumber(maxProfit / 2)}</span>
              <span>0</span>
            </div>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="h-full min-w-[720px] flex items-end gap-2 border-b border-gray-200 pb-6">
                {data.trends.revenueByDay.map((day, idx) => {
                  const dayProfit = day.revenue * 0.6 // estimated after costs
                  const height = (dayProfit / maxProfit) * 100
                  return (
                    <div key={idx} className="w-6 shrink-0 flex flex-col items-center gap-2 min-w-0">
                      <div className="w-full h-[220px] flex items-end">
                        <div
                          className="w-full bg-teal-600 rounded-t hover:bg-teal-700 cursor-pointer"
                          style={{ height: `${Math.max(Math.min(height, 100), 3)}%` }}
                          onMouseEnter={() => setHoveredProfitIdx(idx)}
                          onMouseLeave={() => setHoveredProfitIdx(null)}
                          title={formatCurrency(dayProfit)}
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

        {/* Revenue vs Costs Comparison */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue vs Costs</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Revenue</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(data.revenue.current)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Total Costs</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(totalCosts)}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
              <span className="text-sm font-medium text-gray-700">Net Profit</span>
              <span className="text-lg font-bold text-teal-600">{formatCurrency(netProfit)}</span>
            </div>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Key Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Profit Margin</span>
              <span className="text-sm font-bold text-gray-900">{profitMargin.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Gross Margin</span>
              <span className="text-sm font-bold text-gray-900">
                {data.revenue.current > 0 ? ((grossProfit / data.revenue.current) * 100).toFixed(2) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Cost Ratio</span>
              <span className="text-sm font-bold text-gray-900">
                {data.revenue.current > 0 ? ((totalCosts / data.revenue.current) * 100).toFixed(2) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Order Value</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(data.conversion.avgOrderValue)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

