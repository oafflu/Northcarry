'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/translations/supplier/context'
// Using simple HTML/CSS charts instead of recharts to avoid dependency issues

export default function SupplierPerformancePage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month')

  useEffect(() => {
    loadPerformanceMetrics()
  }, [period])

  const loadPerformanceMetrics = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        console.error('Error getting user:', authError)
        setMetrics(null)
        setLoading(false)
        return
      }
      
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      if (period === 'week') {
        startDate.setDate(endDate.getDate() - 7)
      } else if (period === 'month') {
        startDate.setMonth(endDate.getMonth() - 1)
      } else {
        startDate.setMonth(endDate.getMonth() - 3)
      }

      // Get order assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('supplier_order_assignments')
        .select('*')
        .eq('supplier_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError)
      }

      // Get returns
      const { count: totalReturns, error: returnsError } = await supabase
        .from('returns')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (returnsError) {
        console.error('Error loading returns:', returnsError)
      }

    // Calculate metrics
    const totalOrders = assignments?.length || 0
    
    // Calculate on-time delivery (assuming 3 days lead time)
    const ordersOnTime = assignments?.filter(a => {
      if (!a.shipped_at || !a.created_at) return false
      const hoursDiff = (new Date(a.shipped_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
      return hoursDiff <= 72 // 3 days
    }).length || 0

    const onTimeDeliveryRate = totalOrders > 0 ? (ordersOnTime / totalOrders) * 100 : 0
    const returnRate = totalOrders > 0 ? ((totalReturns || 0) / totalOrders) * 100 : 0

    // Calculate overall score
    const overallScore = Math.round(
      (onTimeDeliveryRate * 0.7) + ((100 - returnRate) * 0.3)
    )

    // Get daily order counts for chart
    const dailyOrders: Record<string, number> = {}
    assignments?.forEach(a => {
      const date = new Date(a.created_at).toLocaleDateString()
      dailyOrders[date] = (dailyOrders[date] || 0) + 1
    })

    const chartData = Object.entries(dailyOrders)
      .map(([date, count]) => ({ date, orders: count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setMetrics({
        totalOrders,
        ordersOnTime,
        ordersLate: totalOrders - ordersOnTime,
        onTimeDeliveryRate,
        totalReturns: totalReturns || 0,
        returnRate,
        overallScore,
        chartData
      })
    } catch (err) {
      console.error('Unexpected error loading performance metrics:', err)
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">{t('performance.loadingMetrics')}</p>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">{t('performance.noData')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('performance.title')}</h1>
          <p className="text-gray-600 mt-1">{t('performance.subtitle')}</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'week' | 'month' | 'quarter')}
          className="px-4 py-2 border rounded-md"
        >
          <option value="week">{t('performance.week')}</option>
          <option value="month">{t('performance.month')}</option>
          <option value="quarter">{t('performance.quarter')}</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">{t('performance.overallScore')}</div>
          <div className="text-3xl font-bold text-teal-600">{metrics.overallScore}%</div>
          <div className="text-xs text-gray-500 mt-1">{t('performance.performanceRating')}</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">{t('performance.onTimeDelivery')}</div>
          <div className="text-3xl font-bold text-green-600">
            {metrics.onTimeDeliveryRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.ordersOnTime} / {metrics.totalOrders} {t('performance.totalOrders')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">{t('performance.returnRate')}</div>
          <div className="text-3xl font-bold text-orange-600">
            {metrics.returnRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.totalReturns} {t('performance.returns')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-sm font-medium text-gray-600 mb-1">{t('performance.totalOrders')}</div>
          <div className="text-3xl font-bold text-blue-600">{metrics.totalOrders}</div>
          <div className="text-xs text-gray-500 mt-1">{t('performance.ordersOverTime')}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Orders Over Time */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">{t('performance.ordersOverTime')}</h2>
          {metrics.chartData.length > 0 ? (
            <div className="space-y-2">
              {metrics.chartData.map((item: any, idx: number) => {
                const maxOrders = Math.max(...metrics.chartData.map((d: any) => d.orders))
                const barWidth = (item.orders / maxOrders) * 100
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-gray-600">{item.date}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-teal-600 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${barWidth}%` }}
                      >
                        {item.orders > 0 && (
                          <span className="text-xs text-white font-medium">{item.orders}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {t('performance.noData')}
            </div>
          )}
        </div>

        {/* Performance Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">{t('performance.orderTrends')}</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{t('performance.ordersOnTime')}</span>
                <span className="text-sm text-gray-600">
                  {metrics.ordersOnTime} / {metrics.totalOrders}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${metrics.onTimeDeliveryRate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{t('performance.ordersLate')}</span>
                <span className="text-sm text-gray-600">
                  {metrics.ordersLate} / {metrics.totalOrders}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${100 - metrics.onTimeDeliveryRate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{t('performance.returns')}</span>
                <span className="text-sm text-gray-600">
                  {metrics.totalReturns} / {metrics.totalOrders}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${metrics.returnRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">{t('performance.orderTrends')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-sm text-gray-600">{t('performance.ordersOnTime')}</div>
            <div className="text-2xl font-bold">{metrics.ordersOnTime}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('performance.ordersLate')}</div>
            <div className="text-2xl font-bold text-red-600">{metrics.ordersLate}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">{t('performance.totalReturns')}</div>
            <div className="text-2xl font-bold text-orange-600">{metrics.totalReturns}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

