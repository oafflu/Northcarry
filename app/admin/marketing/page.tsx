"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Target,
  MousePointerClick,
  Users,
  BarChart3,
  Facebook,
  Search,
  Music,
  UserCheck,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { getMarketingMetrics } from "@/app/actions/marketing"

export default function MarketingDashboard() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<any>(null)
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y">("30d")

  useEffect(() => {
    loadMetrics()
  }, [dateRange])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const endDate = new Date().toISOString()
      const startDate = new Date()
      
      switch (dateRange) {
        case "7d":
          startDate.setDate(startDate.getDate() - 7)
          break
        case "30d":
          startDate.setDate(startDate.getDate() - 30)
          break
        case "90d":
          startDate.setDate(startDate.getDate() - 90)
          break
        case "1y":
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }
      
      const result = await getMarketingMetrics({
        startDate: startDate.toISOString(),
        endDate,
      })
      setMetrics(result)
    } catch (error) {
      console.error("Error loading marketing metrics:", error)
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num)
  }

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unable to load marketing metrics</p>
      </div>
    )
  }

  const mainMetrics = [
    {
      name: "Total Revenue",
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      name: "Total Ad Spend",
      value: formatCurrency(metrics.totalSpend),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      name: "ROAS",
      value: `${metrics.roas.toFixed(2)}x`,
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "Return on Ad Spend",
    },
    {
      name: "MER",
      value: `${metrics.mer.toFixed(2)}x`,
      icon: BarChart3,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "Marketing Efficiency Ratio",
    },
    {
      name: "CPA",
      value: formatCurrency(metrics.cpa),
      icon: Target,
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "Cost Per Acquisition",
    },
    {
      name: "Total Orders",
      value: formatNumber(metrics.totalOrders),
      icon: ShoppingCart,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      name: "CPC",
      value: formatCurrency(metrics.cpc),
      icon: MousePointerClick,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      description: "Cost Per Click",
    },
    {
      name: "CTR",
      value: formatPercentage(metrics.ctr),
      icon: MousePointerClick,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      description: "Click-Through Rate",
    },
  ]

  const platformCards = [
    {
      name: "Meta",
      icon: Facebook,
      href: "/admin/marketing/meta",
      revenue: metrics.platformMetrics.meta.revenue,
      spend: metrics.platformMetrics.meta.spend,
      roas: metrics.platformMetrics.meta.roas,
      orders: metrics.platformMetrics.meta.orders,
      color: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      name: "Google",
      icon: Search,
      href: "/admin/marketing/google",
      revenue: metrics.platformMetrics.google.revenue,
      spend: metrics.platformMetrics.google.spend,
      roas: metrics.platformMetrics.google.roas,
      orders: metrics.platformMetrics.google.orders,
      color: "bg-green-50 border-green-200",
      iconColor: "text-green-600",
    },
    {
      name: "TikTok",
      icon: Music,
      href: "/admin/marketing/tiktok",
      revenue: metrics.platformMetrics.tiktok.revenue,
      spend: metrics.platformMetrics.tiktok.spend,
      roas: metrics.platformMetrics.tiktok.roas,
      orders: metrics.platformMetrics.tiktok.orders,
      color: "bg-black border-gray-300",
      iconColor: "text-white",
    },
    {
      name: "Affiliate",
      icon: UserCheck,
      href: "/admin/marketing/affiliate",
      revenue: metrics.platformMetrics.affiliate.revenue,
      spend: metrics.platformMetrics.affiliate.commission,
      roas: metrics.platformMetrics.affiliate.revenue > 0 && metrics.platformMetrics.affiliate.commission > 0
        ? metrics.platformMetrics.affiliate.revenue / metrics.platformMetrics.affiliate.commission
        : 0,
      orders: metrics.platformMetrics.affiliate.orders,
      affiliates: metrics.platformMetrics.affiliate.affiliates,
      color: "bg-purple-50 border-purple-200",
      iconColor: "text-purple-600",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of all marketing channels and performance</p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg bg-white">
          {(["7d", "30d", "90d", "1y"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                dateRange === range
                  ? "bg-teal-600 text-white"
                  : "text-gray-700 hover:bg-gray-50"
              } ${range === "7d" ? "rounded-l-lg" : ""} ${
                range === "1y" ? "rounded-r-lg" : ""
              }`}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : range === "90d" ? "90 Days" : "1 Year"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainMetrics.map((metric) => (
          <div key={metric.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-lg ${metric.bgColor} flex items-center justify-center`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
              <p className="text-sm font-medium text-gray-600">{metric.name}</p>
              {metric.description && (
                <p className="text-xs text-gray-500 mt-1">{metric.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Platform Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Marketing Channels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformCards.map((platform) => (
            <Link
              key={platform.name}
              href={platform.href}
              className={`bg-white rounded-lg border-2 ${platform.color} p-6 hover:shadow-lg transition-all`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg ${platform.color} flex items-center justify-center`}>
                  <platform.icon className={`w-6 h-6 ${platform.iconColor}`} />
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{platform.name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Revenue:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(platform.revenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{platform.name === "Affiliate" ? "Commission:" : "Spend:"}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(platform.spend)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ROAS:</span>
                  <span className="font-medium text-gray-900">{platform.roas.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Orders:</span>
                  <span className="font-medium text-gray-900">{formatNumber(platform.orders)}</span>
                </div>
                {platform.affiliates !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Affiliates:</span>
                    <span className="font-medium text-gray-900">{formatNumber(platform.affiliates)}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Traffic Sources */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Traffic Sources</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Organic</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.organic)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Direct</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.direct)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Paid</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.paid)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Social</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.social)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Email</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.email)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Referral</p>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.trafficSources.referral)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

