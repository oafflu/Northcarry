'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Eye, MousePointerClick, ShoppingCart, DollarSign, Calendar, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { getUpsellAnalytics, getUpsellDashboardStats } from '@/app/actions/upsells'
import { getAllCampaigns } from '@/app/actions/upsells'
import { toast } from 'sonner'

interface AnalyticsData {
  views: number
  clicks: number
  addToCart: number
  purchases: number
  dismissals: number
  revenue: number
  conversionRate: number
  clickThroughRate: number
  addToCartRate: number
}

export default function UpsellAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    views: 0,
    clicks: 0,
    addToCart: 0,
    purchases: 0,
    dismissals: 0,
    revenue: 0,
    conversionRate: 0,
    clickThroughRate: 0,
    addToCartRate: 0,
  })
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [selectedUpsellType, setSelectedUpsellType] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('30')
  const [eventBreakdown, setEventBreakdown] = useState<any[]>([])
  const [topPerformers, setTopPerformers] = useState<any[]>([])

  useEffect(() => {
    loadData()
  }, [selectedCampaign, selectedUpsellType, dateRange])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load campaigns
      const campaignsResult = await getAllCampaigns()
      if (campaignsResult.data) {
        setCampaigns(campaignsResult.data)
      }

      // Load dashboard stats
      const statsResult = await getUpsellDashboardStats()
      if (statsResult.data) {
        setDashboardStats(statsResult.data)
      }

      // Calculate date range
      const endDate = new Date().toISOString()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(dateRange))
      const startDateStr = startDate.toISOString()

      // Load analytics
      const filters: any = {}
      if (selectedCampaign !== 'all') {
        filters.campaign_id = selectedCampaign
      }
      if (selectedUpsellType !== 'all') {
        filters.upsell_type = selectedUpsellType
      }
      filters.start_date = startDateStr
      filters.end_date = endDate

      const analyticsResult = await getUpsellAnalytics(filters)
      
      if (analyticsResult.data) {
        const data = analyticsResult.data
        
        // Calculate metrics
        const views = data.filter((e: any) => e.event_type === 'view').length
        const clicks = data.filter((e: any) => e.event_type === 'click').length
        const addToCart = data.filter((e: any) => e.event_type === 'add_to_cart').length
        const purchases = data.filter((e: any) => e.event_type === 'purchase').length
        const dismissals = data.filter((e: any) => e.event_type === 'dismiss').length
        
        const revenue = data
          .filter((e: any) => e.event_type === 'purchase')
          .reduce((sum: number, e: any) => sum + (parseFloat(e.revenue?.toString() || '0') || 0), 0)
        
        const conversionRate = views > 0 ? (purchases / views) * 100 : 0
        const clickThroughRate = views > 0 ? (clicks / views) * 100 : 0
        const addToCartRate = clicks > 0 ? (addToCart / clicks) * 100 : 0

        setAnalytics({
          views,
          clicks,
          addToCart,
          purchases,
          dismissals,
          revenue,
          conversionRate,
          clickThroughRate,
          addToCartRate,
        })

        // Event breakdown by type
        const breakdown = ['bundle', 'quantity_break', 'post_purchase', 'cart_upsell', 'frequently_bought'].map(type => {
          const typeData = data.filter((e: any) => e.upsell_type === type)
          return {
            type,
            views: typeData.filter((e: any) => e.event_type === 'view').length,
            clicks: typeData.filter((e: any) => e.event_type === 'click').length,
            purchases: typeData.filter((e: any) => e.event_type === 'purchase').length,
            revenue: typeData
              .filter((e: any) => e.event_type === 'purchase')
              .reduce((sum: number, e: any) => sum + (parseFloat(e.revenue?.toString() || '0') || 0), 0),
          }
        })
        setEventBreakdown(breakdown)

        // Top performers (by revenue)
        const performerMap = new Map<string, { id: string, type: string, views: number, clicks: number, purchases: number, revenue: number }>()
        
        data.forEach((e: any) => {
          const key = `${e.upsell_type}_${e.upsell_id}`
          if (!performerMap.has(key)) {
            performerMap.set(key, {
              id: e.upsell_id,
              type: e.upsell_type,
              views: 0,
              clicks: 0,
              purchases: 0,
              revenue: 0,
            })
          }
          const performer = performerMap.get(key)!
          if (e.event_type === 'view') performer.views++
          if (e.event_type === 'click') performer.clicks++
          if (e.event_type === 'purchase') {
            performer.purchases++
            performer.revenue += parseFloat(e.revenue?.toString() || '0') || 0
          }
        })

        const topPerformersList = Array.from(performerMap.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10)
        
        setTopPerformers(topPerformersList)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatUpsellType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upsell Analytics</h1>
          <p className="text-gray-600 mt-1">Track performance of your upsell campaigns</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Campaign</label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Upsell Type</label>
              <Select value={selectedUpsellType} onValueChange={setSelectedUpsellType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bundle">Product Bundles</SelectItem>
                  <SelectItem value="quantity_break">Quantity Breaks</SelectItem>
                  <SelectItem value="post_purchase">Post-Purchase</SelectItem>
                  <SelectItem value="cart_upsell">Cart Upsells</SelectItem>
                  <SelectItem value="frequently_bought">Frequently Bought</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${dashboardStats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From all upsells</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.totalConversions}</div>
              <p className="text-xs text-muted-foreground">Completed purchases</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardStats.conversionRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">Views to purchases</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${dashboardStats.averageOrderValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Per conversion</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.views.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total impressions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.clicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {analytics.clickThroughRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Add to Cart</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.addToCart.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Rate: {analytics.addToCartRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Purchases</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.purchases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Conversion: {analytics.conversionRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue and Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>Total revenue from upsells</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-teal-600">${analytics.revenue.toFixed(2)}</div>
            <p className="text-sm text-gray-600 mt-2">
              From {analytics.purchases} purchase{analytics.purchases !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dismissals</CardTitle>
            <CardDescription>Users who dismissed upsells</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-600">{analytics.dismissals.toLocaleString()}</div>
            <p className="text-sm text-gray-600 mt-2">
              {analytics.views > 0 
                ? `${((analytics.dismissals / analytics.views) * 100).toFixed(2)}% dismissal rate`
                : 'No data'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Event Breakdown by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Upsell Type</CardTitle>
          <CardDescription>Breakdown of metrics by upsell category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Views</th>
                  <th className="text-right p-2 font-medium">Clicks</th>
                  <th className="text-right p-2 font-medium">Purchases</th>
                  <th className="text-right p-2 font-medium">Revenue</th>
                  <th className="text-right p-2 font-medium">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {eventBreakdown.map((item) => (
                  <tr key={item.type} className="border-b">
                    <td className="p-2">{formatUpsellType(item.type)}</td>
                    <td className="p-2 text-right">{item.views.toLocaleString()}</td>
                    <td className="p-2 text-right">{item.clicks.toLocaleString()}</td>
                    <td className="p-2 text-right">{item.purchases.toLocaleString()}</td>
                    <td className="p-2 text-right font-medium">${item.revenue.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      {item.views > 0 
                        ? `${((item.purchases / item.views) * 100).toFixed(2)}%`
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Upsells</CardTitle>
          <CardDescription>Highest revenue generating upsells</CardDescription>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No performance data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Rank</th>
                    <th className="text-left p-2 font-medium">Type</th>
                    <th className="text-right p-2 font-medium">Views</th>
                    <th className="text-right p-2 font-medium">Clicks</th>
                    <th className="text-right p-2 font-medium">Purchases</th>
                    <th className="text-right p-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.map((performer, index) => (
                    <tr key={`${performer.type}_${performer.id}`} className="border-b">
                      <td className="p-2">#{index + 1}</td>
                      <td className="p-2">{formatUpsellType(performer.type)}</td>
                      <td className="p-2 text-right">{performer.views.toLocaleString()}</td>
                      <td className="p-2 text-right">{performer.clicks.toLocaleString()}</td>
                      <td className="p-2 text-right">{performer.purchases.toLocaleString()}</td>
                      <td className="p-2 text-right font-medium text-teal-600">
                        ${performer.revenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

