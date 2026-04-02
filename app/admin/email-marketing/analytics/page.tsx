"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, Mail, Send, MousePointerClick, Users, DollarSign, Calendar, Package, X, Trash2, BarChart3 } from "lucide-react"
import { getEmailAnalytics, getTopPerformingCampaigns, getEmailPerformanceTimeSeries } from "@/app/actions/email-analytics"
import { createBouncedFailedSegment } from "@/app/actions/email-segments"
import { toast } from "sonner"

interface Metric {
  name: string
  value: string
  change: number
  trend: "up" | "down"
  icon: typeof Mail
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "custom">("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [topCampaigns, setTopCampaigns] = useState<any[]>([])
  const [timeSeries, setTimeSeries] = useState<any[]>([])
  const [chartType, setChartType] = useState<"line" | "bar">("line")
  const [creatingSegment, setCreatingSegment] = useState(false)

  useEffect(() => {
    if (dateRange === "custom") return
    loadAnalytics()
  }, [dateRange])

  const rangeToIso = () => {
    if (dateRange !== "custom" || !customStart || !customEnd) return { start: undefined as string | undefined, end: undefined as string | undefined }
    const startIso = new Date(`${customStart}T00:00:00.000Z`).toISOString()
    const endIso = new Date(`${customEnd}T23:59:59.999Z`).toISOString()
    return { start: startIso, end: endIso }
  }

  const loadAnalytics = async () => {
    if (dateRange === "custom" && (!customStart || !customEnd)) {
      toast.error("Choose start and end dates, then Apply.")
      return
    }
    setLoading(true)
    try {
      const { start, end } = rangeToIso()
      const [analyticsResult, campaignsResult, timeSeriesResult] = await Promise.all([
        getEmailAnalytics(dateRange, start || customStart || undefined, end || customEnd || undefined),
        getTopPerformingCampaigns(10),
        getEmailPerformanceTimeSeries(dateRange, start || customStart || undefined, end || customEnd || undefined),
      ])

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data)
      }

      if (campaignsResult.success) {
        setTopCampaigns(campaignsResult.data || [])
      }

      if (timeSeriesResult.success) {
        setTimeSeries(timeSeriesResult.data || [])
      }
    } catch (error) {
      toast.error("Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  // Main Mailgun metrics cards (matching the image)
  const mailgunMetrics: Metric[] = analytics
    ? [
        {
          name: "Total Emails Sent",
          value: `${analytics.totalEmailsSent.toLocaleString()} / ${analytics.totalEmailsSent.toLocaleString()}`,
          change: analytics.previousTotalEmailsSent && analytics.previousTotalEmailsSent > 0
            ? ((analytics.totalEmailsSent - analytics.previousTotalEmailsSent) / analytics.previousTotalEmailsSent) * 100
            : analytics.totalEmailsSent > 0 ? 100 : 0,
          trend: analytics.totalEmailsSent >= (analytics.previousTotalEmailsSent || 0) ? "up" : "down",
          icon: Send,
        },
        {
          name: "Delivered",
          value: `${analytics.totalDelivered?.toLocaleString() || "0"} / ${analytics.totalEmailsSent.toLocaleString()}`,
          change: analytics.previousTotalDelivered !== undefined && analytics.previousTotalDelivered > 0
            ? ((analytics.totalDelivered - analytics.previousTotalDelivered) / analytics.previousTotalDelivered) * 100
            : analytics.totalDelivered > 0 ? 100 : 0,
          trend: analytics.totalDelivered >= (analytics.previousTotalDelivered || 0) ? "up" : "down",
          icon: Package,
        },
        {
          name: "Failed",
          value: `${analytics.totalFailed?.toLocaleString() || "0"} / ${analytics.totalEmailsSent.toLocaleString()}`,
          change: analytics.previousTotalFailed !== undefined && analytics.previousTotalFailed > 0
            ? ((analytics.totalFailed - analytics.previousTotalFailed) / analytics.previousTotalFailed) * 100
            : analytics.totalFailed > 0 ? 100 : 0,
          trend: analytics.totalFailed <= (analytics.previousTotalFailed || 0) ? "up" : "down", // Lower is better for failures
          icon: X,
        },
        {
          name: "Suppressed",
          value: `${analytics.totalSuppressed?.toLocaleString() || "0"} / ${analytics.totalEmailsSent.toLocaleString()}`,
          change: analytics.previousTotalSuppressed !== undefined && analytics.previousTotalSuppressed > 0
            ? ((analytics.totalSuppressed - analytics.previousTotalSuppressed) / analytics.previousTotalSuppressed) * 100
            : analytics.totalSuppressed > 0 ? 100 : 0,
          trend: analytics.totalSuppressed <= (analytics.previousTotalSuppressed || 0) ? "up" : "down", // Lower is better for suppressed
          icon: Trash2,
        },
      ]
    : []

  // Additional performance metrics
  const performanceMetrics: Metric[] = analytics
    ? [
        {
          name: "Open Rate",
          value: `${analytics.averageOpenRate.toFixed(1)}%`,
          change: analytics.previousAverageOpenRate !== undefined && analytics.previousAverageOpenRate > 0
            ? ((analytics.averageOpenRate - analytics.previousAverageOpenRate) / analytics.previousAverageOpenRate) * 100
            : analytics.averageOpenRate > 0 ? 100 : 0,
          trend: analytics.averageOpenRate >= (analytics.previousAverageOpenRate || 0) ? "up" : "down",
          icon: Mail,
        },
        {
          name: "Click Rate",
          value: `${analytics.averageClickRate.toFixed(1)}%`,
          change: analytics.previousAverageClickRate !== undefined && analytics.previousAverageClickRate > 0
            ? ((analytics.averageClickRate - analytics.previousAverageClickRate) / analytics.previousAverageClickRate) * 100
            : analytics.averageClickRate > 0 ? 100 : 0,
          trend: analytics.averageClickRate >= (analytics.previousAverageClickRate || 0) ? "up" : "down",
          icon: MousePointerClick,
        },
        {
          name: "Revenue",
          value: `$${analytics.totalRevenue.toLocaleString()}`,
          change: analytics.previousTotalRevenue && analytics.previousTotalRevenue > 0
            ? ((analytics.totalRevenue - analytics.previousTotalRevenue) / analytics.previousTotalRevenue) * 100
            : analytics.totalRevenue > 0 ? 100 : 0,
          trend: analytics.totalRevenue >= (analytics.previousTotalRevenue || 0) ? "up" : "down",
          icon: DollarSign,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Analytics</h1>
          <p className="text-gray-600 mt-1">Track performance and engagement metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => loadAnalytics()}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                >
                  Apply
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={creatingSegment}
            onClick={async () => {
              setCreatingSegment(true)
              try {
                const now = new Date()
                let startIso: string | undefined
                let endIso: string | undefined
                if (dateRange === "custom" && customStart && customEnd) {
                  startIso = new Date(`${customStart}T00:00:00.000Z`).toISOString()
                  endIso = new Date(`${customEnd}T23:59:59.999Z`).toISOString()
                } else {
                  let start: Date
                  switch (dateRange) {
                    case "7d":
                      start = new Date(now.getTime() - 7 * 86400000)
                      break
                    case "90d":
                      start = new Date(now.getTime() - 90 * 86400000)
                      break
                    case "1y":
                      start = new Date(now.getTime() - 365 * 86400000)
                      break
                    default:
                      start = new Date(now.getTime() - 30 * 86400000)
                  }
                  startIso = start.toISOString()
                  endIso = now.toISOString()
                }
                const r = await createBouncedFailedSegment({ startIso, endIso })
                if (r.success && r.data) {
                  toast.success(`Segment created: ${r.data.name}`)
                  router.push(`/admin/email-marketing/segments/${r.data.id}`)
                } else toast.error(r.error || "Could not create segment")
              } finally {
                setCreatingSegment(false)
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {creatingSegment ? "Creating…" : "Create bounced segment"}
          </button>
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setChartType("line")}
              className={`px-4 py-2 ${chartType === "line" ? "bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Line Chart
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-4 py-2 ${chartType === "bar" ? "bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Bar Chart
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      )}

      {/* Mailgun Metrics Grid (Main Cards) */}
      {!loading && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mailgunMetrics.map((metric) => {
            // Calculate percentage for delivered/failed/suppressed
            const totalSent = analytics?.totalEmailsSent || 0
            let percentage = 0
            let displayValue = metric.value
            
            if (metric.name === "Delivered" && totalSent > 0) {
              percentage = (analytics.totalDelivered / totalSent) * 100
              displayValue = `${analytics.totalDelivered.toLocaleString()} / ${totalSent.toLocaleString()}`
            } else if (metric.name === "Failed" && totalSent > 0) {
              percentage = (analytics.totalFailed / totalSent) * 100
              displayValue = `${analytics.totalFailed.toLocaleString()} / ${totalSent.toLocaleString()}`
            } else if (metric.name === "Suppressed" && totalSent > 0) {
              percentage = (analytics.totalSuppressed / totalSent) * 100
              displayValue = `${analytics.totalSuppressed.toLocaleString()} / ${totalSent.toLocaleString()}`
            } else if (metric.name === "Total Emails Sent") {
              displayValue = totalSent.toLocaleString()
            }
            
            return (
              <div key={metric.name} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    metric.name === "Delivered" ? "bg-green-50" :
                    metric.name === "Failed" ? "bg-red-50" :
                    metric.name === "Suppressed" ? "bg-yellow-50" :
                    "bg-teal-50"
                  }`}>
                    <metric.icon className={`w-6 h-6 ${
                      metric.name === "Delivered" ? "text-green-600" :
                      metric.name === "Failed" ? "text-red-600" :
                      metric.name === "Suppressed" ? "text-yellow-600" :
                      "text-teal-600"
                    }`} />
                  </div>
                  {metric.name !== "Total Emails Sent" && (
                    <div className={`text-2xl font-bold ${
                      metric.name === "Delivered" ? "text-green-600" :
                      metric.name === "Failed" ? "text-red-600" :
                      metric.name === "Suppressed" ? "text-yellow-600" :
                      "text-gray-900"
                    }`}>
                      {percentage.toFixed(2)}%
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-1">{displayValue}</p>
                <p className={`text-lg font-semibold ${
                  metric.name === "Delivered" ? "text-green-700" :
                  metric.name === "Failed" ? "text-red-700" :
                  metric.name === "Suppressed" ? "text-yellow-700" :
                  "text-gray-900"
                }`}>{metric.name}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Performance Metrics Grid */}
      {!loading && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {performanceMetrics.map((metric) => (
            <div key={metric.name} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
                  <metric.icon className="w-6 h-6 text-teal-600" />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  metric.trend === "up" ? "text-green-600" : "text-red-600"
                }`}>
                  {metric.trend === "up" ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {Math.abs(metric.change).toFixed(1)}%
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.name}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Performance Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Performance Over Time</h2>
          <div className="space-y-4">
            {timeSeries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No data available for this period</div>
            ) : chartType === "bar" ? (
              // Bar Chart View
              <div className="space-y-4">
                {timeSeries.map((data, idx) => {
                  const maxValue = Math.max(
                    data.sent || 0, 
                    data.delivered || 0, 
                    data.failed || 0, 
                    data.suppressed || 0,
                    data.opened || 0, 
                    data.clicked || 0, 
                    1
                  )
                  return (
                    <div key={idx} className="space-y-2 border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">{new Date(data.date).toLocaleDateString()}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500">Sent: {(data.sent || 0).toLocaleString()}</span>
                          <span className="text-green-600">Delivered: {(data.delivered || 0).toLocaleString()}</span>
                          <span className="text-blue-600">Opened: {(data.opened || 0).toLocaleString()}</span>
                          <span className="text-purple-600">Clicked: {(data.clicked || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20">Sent</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-gray-400"
                              style={{ width: `${((data.sent || 0) / maxValue) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-700 w-12 text-right">{(data.sent || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20">Delivered</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${((data.delivered || 0) / maxValue) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-green-600 w-12 text-right">{(data.delivered || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20">Opened</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${((data.opened || 0) / maxValue) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-blue-600 w-12 text-right">{(data.opened || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-20">Clicked</span>
                          <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${((data.clicked || 0) / maxValue) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-purple-600 w-12 text-right">{(data.clicked || 0).toLocaleString()}</span>
                        </div>
                        {(data.failed || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">Failed</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${((data.failed || 0) / maxValue) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-red-600 w-12 text-right">{(data.failed || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {(data.suppressed || 0) > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">Suppressed</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-yellow-500"
                                style={{ width: `${((data.suppressed || 0) / maxValue) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-yellow-600 w-12 text-right">{(data.suppressed || 0).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Line Chart View (original)
              timeSeries.map((data, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{new Date(data.date).toLocaleDateString()}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">Sent: {data.sent.toLocaleString()}</span>
                      <span className="text-blue-600">Opened: {data.opened.toLocaleString()}</span>
                      <span className="text-green-600">Clicked: {data.clicked.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="bg-blue-500"
                        style={{ width: `${data.sent > 0 ? (data.opened / data.sent) * 100 : 0}%` }}
                      ></div>
                      <div
                        className="bg-green-500"
                        style={{ width: `${data.sent > 0 ? (data.clicked / data.sent) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Campaign Performance */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Campaigns</h2>
          <div className="space-y-4">
            {topCampaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No campaign data available</div>
            ) : (
              topCampaigns.map((campaign) => (
                <div key={campaign.id} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                    <span className="text-sm font-semibold text-gray-900">${(campaign.revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Open Rate</span>
                      <p className="font-medium text-gray-900">{campaign.openRate}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Click Rate</span>
                      <p className="font-medium text-gray-900">{campaign.clickRate}%</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Sent</span>
                      <p className="font-medium text-gray-900">{campaign.sent.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detailed Campaign Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Campaign Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opened</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicked</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Click Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No campaign data available
                  </td>
                </tr>
              ) : (
                topCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{campaign.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.sent.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.opened.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.clicked.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.openRate}%</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{campaign.clickRate}%</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ${(campaign.revenue || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analytics?.totalSubscribers.toLocaleString() || "0"}</p>
              <p className="text-sm text-gray-600">Active Subscribers</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Growth</span>
              <span className={`font-medium ${
                analytics?.totalSubscribers >= (analytics?.previousTotalSubscribers || 0) ? "text-green-600" : "text-red-600"
              }`}>
                {analytics?.previousTotalSubscribers && analytics.previousTotalSubscribers > 0
                  ? `${analytics.totalSubscribers >= analytics.previousTotalSubscribers ? "+" : ""}${(((analytics.totalSubscribers - analytics.previousTotalSubscribers) / analytics.previousTotalSubscribers) * 100).toFixed(1)}%`
                  : analytics?.totalSubscribers > 0 ? "+100%" : "0%"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analytics?.averageOpenRate.toFixed(1) || "0"}%</p>
              <p className="text-sm text-gray-600">Average Open Rate</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Change</span>
              <span className={`font-medium ${
                analytics?.averageOpenRate >= (analytics?.previousAverageOpenRate || 0) ? "text-green-600" : "text-red-600"
              }`}>
                {analytics?.previousAverageOpenRate !== undefined && analytics.previousAverageOpenRate > 0
                  ? `${analytics.averageOpenRate >= analytics.previousAverageOpenRate ? "+" : ""}${(((analytics.averageOpenRate - analytics.previousAverageOpenRate) / analytics.previousAverageOpenRate) * 100).toFixed(1)}%`
                  : analytics?.averageOpenRate > 0 ? "+100%" : "0%"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <MousePointerClick className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{analytics?.averageClickRate.toFixed(1) || "0"}%</p>
              <p className="text-sm text-gray-600">Average Click Rate</p>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Change</span>
              <span className={`font-medium ${
                analytics?.averageClickRate >= (analytics?.previousAverageClickRate || 0) ? "text-green-600" : "text-red-600"
              }`}>
                {analytics?.previousAverageClickRate !== undefined && analytics.previousAverageClickRate > 0
                  ? `${analytics.averageClickRate >= analytics.previousAverageClickRate ? "+" : ""}${(((analytics.averageClickRate - analytics.previousAverageClickRate) / analytics.previousAverageClickRate) * 100).toFixed(1)}%`
                  : analytics?.averageClickRate > 0 ? "+100%" : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

