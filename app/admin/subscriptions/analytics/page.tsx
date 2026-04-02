'use client'

import { useState, useEffect } from 'react'
import { getSubscriptionAnalytics } from '@/app/actions/subscriptions'
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from '@/app/actions/products'
import { getSubscriptionProducts } from '@/app/actions/subscriptions'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart,
  Calendar,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'

export default function SubscriptionAnalyticsPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{
    productId?: string
    variantId?: string
    subscriptionProductId?: string
    timeRange?: string
    startDate?: string
    endDate?: string
  }>({ timeRange: 'thisMonth' })
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  
  // Filter data
  const [products, setProducts] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const [loadingFilters, setLoadingFilters] = useState(false)
  const [customDateStart, setCustomDateStart] = useState<Date>()
  const [customDateEnd, setCustomDateEnd] = useState<Date>()

  useEffect(() => {
    loadFilterData()
  }, [])

  useEffect(() => {
    loadAnalytics()
  }, [filters])

  useEffect(() => {
    if (filters.productId) {
      loadVariants(filters.productId)
    } else {
      setVariants([])
      setFilters(prev => ({ ...prev, variantId: undefined }))
    }
  }, [filters.productId])

  const loadFilterData = async () => {
    setLoadingFilters(true)
    try {
      const [productsResult, subscriptionProductsResult] = await Promise.all([
        getActiveProductsForAdmin(),
        getSubscriptionProducts(true)
      ])
      
      if (productsResult.data) {
        setProducts(productsResult.data)
      }
      
      if (subscriptionProductsResult.data) {
        setSubscriptionProducts(subscriptionProductsResult.data)
      }
    } catch (error) {
      console.error('Error loading filter data:', error)
    } finally {
      setLoadingFilters(false)
    }
  }

  const loadVariants = async (productId: string) => {
    try {
      const result = await getProductVariantsForAdmin(productId)
      if (result.data) {
        setVariants(result.data)
      }
    } catch (error) {
      console.error('Error loading variants:', error)
      setVariants([])
    }
  }

  const calculateDateRange = (timeRange: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate: Date
    let endDate: Date = new Date(today)
    endDate.setHours(23, 59, 59, 999)

    switch (timeRange) {
      case 'today':
        startDate = new Date(today)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisWeek':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'lastWeek':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay() - 7) // Start of last week
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today)
        endDate.setDate(today.getDate() - today.getDay() - 1) // End of last week
        endDate.setHours(23, 59, 59, 999)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), now.getMonth(), 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'custom':
        if (customDateStart && customDateEnd) {
          startDate = new Date(customDateStart)
          startDate.setHours(0, 0, 0, 0)
          endDate = new Date(customDateEnd)
          endDate.setHours(23, 59, 59, 999)
        } else {
          // Default to this month if custom dates not set
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          startDate.setHours(0, 0, 0, 0)
        }
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const dateRange = calculateDateRange(filters.timeRange || 'thisMonth')
      
      const result = await getSubscriptionAnalytics({
        productId: filters.productId,
        variantId: filters.variantId,
        subscriptionProductId: filters.subscriptionProductId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })

      if (result.success && result.data) {
        setAnalytics(result.data)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const changeMonth = async (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth)
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1)
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1)
    }
    setSelectedMonth(newMonth)
    
    // Reload analytics
    loadAnalytics()
  }

  const handleTimeRangeChange = (value: string) => {
    if (value === 'custom') {
      setFilters({ ...filters, timeRange: 'custom' })
    } else {
      setFilters({ ...filters, timeRange: value })
    }
  }

  const applyCustomDate = () => {
    if (customDateStart && customDateEnd) {
      setFilters({
        ...filters,
        timeRange: 'custom',
        startDate: customDateStart.toISOString().split('T')[0],
        endDate: customDateEnd.toISOString().split('T')[0]
      })
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">No analytics data available</p>
        </div>
      </div>
    )
  }

  const { summary, averages, churn, newSubscriptions, retention, paymentSchedule, revenue } = analytics

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Powerful Analytics, Stats & Data Exports</h1>
        <p className="text-gray-600 mt-1">Comprehensive subscription metrics and insights</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        {/* Product Filter */}
        <Select
          value={filters.productId || 'all'}
          onValueChange={(value) => setFilters({ 
            ...filters, 
            productId: value === 'all' ? undefined : value,
            variantId: undefined // Reset variant when product changes
          })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Product Variant Filter */}
        <Select
          value={filters.variantId || 'all'}
          onValueChange={(value) => setFilters({ 
            ...filters, 
            variantId: value === 'all' ? undefined : value
          })}
          disabled={!filters.productId}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Variants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Variants</SelectItem>
            {variants.map((variant) => (
              <SelectItem key={variant.id} value={variant.id}>
                {variant.color || variant.sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Selling Plan Filter */}
        <Select
          value={filters.subscriptionProductId || 'all'}
          onValueChange={(value) => setFilters({ 
            ...filters, 
            subscriptionProductId: value === 'all' ? undefined : value
          })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Selling Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Selling Plans</SelectItem>
            {subscriptionProducts.map((sp) => (
              <SelectItem key={sp.id} value={sp.id}>
                {sp.products?.title || `Plan ${sp.id.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Filter */}
        <Select
          value={filters.timeRange || 'thisMonth'}
          onValueChange={handleTimeRangeChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="thisWeek">This Week</SelectItem>
            <SelectItem value="lastWeek">Last Week</SelectItem>
            <SelectItem value="thisMonth">This Month</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
          </SelectContent>
        </Select>

        {/* Custom Date Picker */}
        {filters.timeRange === 'custom' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {customDateStart && customDateEnd ? (
                  `${format(customDateStart, 'PPP')} - ${format(customDateEnd, 'PPP')}`
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <CalendarComponent
                    mode="single"
                    selected={customDateStart}
                    onSelect={setCustomDateStart}
                    initialFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <CalendarComponent
                    mode="single"
                    selected={customDateEnd}
                    onSelect={setCustomDateEnd}
                    initialFocus
                  />
                </div>
                <Button onClick={applyCustomDate} className="w-full">
                  Apply Date Range
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear Filters */}
        {(filters.productId || filters.variantId || filters.subscriptionProductId) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ timeRange: filters.timeRange })}
          >
            <X className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Revenue Section - Moved to Top */}
      {revenue && (
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Revenue Analytics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-green-700">
                ${revenue.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">From all subscription orders</div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="text-sm text-gray-600 mb-1">Monthly Recurring Revenue (MRR)</div>
              <div className="text-3xl font-bold text-blue-700">
                ${revenue.mrr?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">From active ongoing subscriptions</div>
            </div>

            <div className="bg-indigo-50 rounded-lg p-4 border-2 border-indigo-200">
              <div className="text-sm text-gray-600 mb-1">Annual Recurring Revenue (ARR)</div>
              <div className="text-3xl font-bold text-indigo-700">
                ${revenue.arr?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">MRR × 12</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Prepaid Revenue</div>
              <div className="text-2xl font-bold text-purple-700">
                ${revenue.prepaidCollectedRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Collected upfront</div>
            </div>

            <div className="bg-cyan-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Ongoing Revenue</div>
              <div className="text-2xl font-bold text-cyan-700">
                ${revenue.ongoingRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">From recurring payments</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Revenue Breakdown</div>
              <div className="text-sm font-semibold mt-2">
                <div className="flex justify-between mb-1">
                  <span>Prepaid:</span>
                  <span className="text-purple-600">
                    {revenue.totalRevenue > 0 
                      ? ((revenue.prepaidCollectedRevenue / revenue.totalRevenue) * 100).toFixed(1)
                      : '0'}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ongoing:</span>
                  <span className="text-cyan-600">
                    {revenue.totalRevenue > 0 
                      ? ((revenue.ongoingRevenue / revenue.totalRevenue) * 100).toFixed(1)
                      : '0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Section: Customer Retention, Recent Activity, Retention by Cohort */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Customer Retention and Value */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Customer Retention and Value</h2>
          
          <div className="space-y-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Average Subscription Length</div>
              <div className="text-2xl font-bold">{averages.avgSubscriptionLength} months</div>
              <div className="text-xs text-gray-500 mt-1">Based on {averages.totalSubscriptions} subscriptions</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Average Completed Subscription Length</div>
              <div className="text-2xl font-bold">{averages.avgCompletedLength} months</div>
              <div className="text-xs text-gray-500 mt-1">Based on {averages.completedSubscriptions} subscriptions</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">12-month Churn Rate</div>
              <div className="text-2xl font-bold">{churn.rate}%</div>
              <div className="text-xs text-gray-500 mt-1">Based on {churn.totalSubscriptions} subscriptions</div>
            </div>
          </div>

          {/* Churn Rate Chart */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">Churn Rate Over Time</h3>
            {churn.churnRateOverTime && churn.churnRateOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={churn.churnRateOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    domain={[0, 'dataMax + 5']}
                  />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Recent Activity</h2>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-600 mb-1">New Subscriptions</div>
            <div className="text-3xl font-bold text-blue-600">{newSubscriptions.count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {newSubscriptions.period?.start && newSubscriptions.period?.end && (
                `${new Date(newSubscriptions.period.start).toLocaleDateString()} - ${new Date(newSubscriptions.period.end).toLocaleDateString()}`
              )}
            </div>
          </div>

          {/* New Subscriptions Chart */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">New subscriptions</h3>
            {newSubscriptions.overTime && newSubscriptions.overTime.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={newSubscriptions.overTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    domain={[0, 'dataMax + 2']}
                  />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* 12-month Retention by Cohort */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">12-month Retention by Cohort</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Cohort</th>
                  <th className="text-center p-2 font-semibold">Total</th>
                  <th className="text-center p-2 font-semibold">Mo 1</th>
                  <th className="text-center p-2 font-semibold">Mo 2</th>
                  <th className="text-center p-2 font-semibold">Mo 3</th>
                  <th className="text-center p-2 font-semibold">Mo 4</th>
                  <th className="text-center p-2 font-semibold">Mo 5</th>
                  <th className="text-center p-2 font-semibold">Mo 6</th>
                  <th className="text-center p-2 font-semibold">Mo 7</th>
                </tr>
              </thead>
              <tbody>
                {retention.cohorts && retention.cohorts.length > 0 ? (
                  retention.cohorts.slice(-12).map((cohort: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{cohort.cohort}</td>
                      <td className="p-2 text-center">{cohort.total}</td>
                      <td className={`p-2 text-center ${cohort.retention.mo1 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo1}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo2 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo2}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo3 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo3}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo4 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo4}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo5 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo5}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo6 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo6}%
                      </td>
                      <td className={`p-2 text-center ${cohort.retention.mo7 >= 80 ? 'text-green-600 font-semibold' : ''}`}>
                        {cohort.retention.mo7}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-gray-500 text-sm">
                      No cohort data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Section: Payment Schedule and Summary Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Schedule */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Payment Schedule</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeMonth('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {paymentSchedule.month}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeMonth('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold p-2 text-gray-600">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {(() => {
                const firstDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
                const firstDayOfWeek = firstDay.getDay()
                const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()
                
                // Empty cells for days before the first day of the month
                const emptyCells = []
                for (let i = 0; i < firstDayOfWeek; i++) {
                  emptyCells.push(<div key={`empty-${i}`} className="border rounded p-2 min-h-[80px]"></div>)
                }
                
                // Days of the month
                const dayCells = []
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day)
                    .toISOString().split('T')[0]
                  const dayData = paymentSchedule.schedule?.find((d: any) => d.date === dateStr) || {
                    successful: { count: 0, amount: 0 },
                    failed: { count: 0 },
                    scheduled: { count: 0 }
                  }
                  
                  dayCells.push(
                    <div
                      key={day}
                      className={`border rounded p-2 min-h-[80px] ${
                        dayData.successful.count > 0 || dayData.failed.count > 0 || dayData.scheduled.count > 0
                          ? 'bg-gray-50'
                          : ''
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">{day}</div>
                      {dayData.successful.count > 0 && (
                        <div className="text-xs text-green-600 mb-1">
                          <div>Successful: {dayData.successful.count}</div>
                          <div className="font-semibold">${dayData.successful.amount.toFixed(2)}</div>
                        </div>
                      )}
                      {dayData.failed.count > 0 && (
                        <div className="text-xs text-red-600 mb-1">
                          Failed: {dayData.failed.count}
                        </div>
                      )}
                      {dayData.scheduled.count > 0 && (
                        <div className="text-xs text-gray-600">
                          Scheduled: {dayData.scheduled.count}
                        </div>
                      )}
                    </div>
                  )
                }
                
                return [...emptyCells, ...dayCells]
              })()}
            </div>
          </div>
        </div>

        {/* Subscription Summary Cards */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">Subscription Summary</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total subscriptions</div>
              <div className="text-2xl font-bold">{summary.totalSubscriptions}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Active subscriptions</div>
              <div className="text-2xl font-bold text-green-600">{summary.activeSubscriptions}</div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Paused subscriptions</div>
              <div className="text-2xl font-bold text-yellow-600">{summary.pausedSubscriptions}</div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Cancelled subscriptions</div>
              <div className="text-2xl font-bold text-red-600">{summary.cancelledSubscriptions}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Expired subscriptions</div>
              <div className="text-2xl font-bold">{summary.expiredSubscriptions}</div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Failed subscriptions</div>
              <div className="text-2xl font-bold text-red-600">{summary.failedSubscriptions}</div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total orders</div>
              <div className="text-2xl font-bold text-blue-600">{summary.totalOrders}</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total customers</div>
              <div className="text-2xl font-bold text-purple-600">{summary.totalCustomers}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Active customers</div>
              <div className="text-2xl font-bold text-green-600">{summary.activeCustomers}</div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Ongoing subscriptions</div>
              <div className="text-2xl font-bold text-blue-600">{summary.ongoingSubscriptions || 0}</div>
              <div className="text-xs text-gray-500 mt-1">{summary.activeOngoingSubscriptions || 0} active</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Prepaid subscriptions</div>
              <div className="text-2xl font-bold text-purple-600">{summary.prepaidSubscriptions || 0}</div>
              <div className="text-xs text-gray-500 mt-1">{summary.activePrepaidSubscriptions || 0} active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
