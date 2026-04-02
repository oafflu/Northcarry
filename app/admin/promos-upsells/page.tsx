'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Zap, 
  Layers,
  ShoppingBag,
  Tag,
  ArrowRight,
  Plus,
  Eye,
  Edit,
  BarChart3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getUpsellDashboardStats } from '@/app/actions/upsells'

export default function PromosUpsellsDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalConversions: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    activeCampaigns: 0,
    activeBundles: 0,
    activeQuantityBreaks: 0,
    activePostPurchase: 0,
    activeCartUpsells: 0,
    activePromotions: 0,
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const result = await getUpsellDashboardStats()
      if (result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'From all upsells & promos',
      link: '/admin/promos-upsells/analytics'
    },
    {
      title: 'Conversions',
      value: stats.totalConversions.toLocaleString(),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: `${stats.conversionRate.toFixed(1)}% conversion rate`,
      link: '/admin/promos-upsells/analytics'
    },
    {
      title: 'Average Order Value',
      value: `$${stats.averageOrderValue.toFixed(2)}`,
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'AOV increase from upsells',
      link: '/admin/promos-upsells/analytics'
    },
    {
      title: 'Active Campaigns',
      value: stats.activeCampaigns.toString(),
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Currently running',
      link: '/admin/promos-upsells/campaigns'
    },
  ]

  const quickActions = [
    {
      title: 'Product Bundles',
      description: 'Create buy X get Y bundles',
      icon: Package,
      href: '/admin/promos-upsells/bundles',
      count: stats.activeBundles,
      color: 'bg-blue-500'
    },
    {
      title: 'Quantity Breaks',
      description: 'Volume discounts & tier pricing',
      icon: Layers,
      href: '/admin/promos-upsells/quantity-breaks',
      count: stats.activeQuantityBreaks,
      color: 'bg-green-500'
    },
    {
      title: 'Post-Purchase Upsells',
      description: 'Upsells after checkout',
      icon: Zap,
      href: '/admin/promos-upsells/post-purchase',
      count: stats.activePostPurchase,
      color: 'bg-purple-500'
    },
    {
      title: 'Cart Upsells',
      description: 'Upsells on cart page',
      icon: ShoppingCart,
      href: '/admin/promos-upsells/cart-upsells',
      count: stats.activeCartUpsells,
      color: 'bg-orange-500'
    },
    {
      title: 'Frequently Bought Together',
      description: 'Product recommendations',
      icon: ShoppingBag,
      href: '/admin/promos-upsells/frequently-bought',
      count: 0,
      color: 'bg-pink-500'
    },
    {
      title: 'Promo Codes',
      description: 'Discount codes & coupons',
      icon: Tag,
      href: '/admin/promotions',
      count: stats.activePromotions,
      color: 'bg-teal-500'
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Promos & Upsells</h1>
          <p className="text-gray-600 mt-1">Manage promotions, bundles, and upsell campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/promos-upsells/analytics')}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </Button>
          <Button onClick={() => router.push('/admin/promos-upsells/campaigns/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Link
                key={index}
                href={action.href}
                className="group relative bg-white border border-gray-200 rounded-lg p-6 hover:border-teal-500 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`${action.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {action.count > 0 && (
                    <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-1 rounded-full">
                      {action.count} active
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{action.description}</p>
                <div className="flex items-center text-teal-600 text-sm font-medium group-hover:gap-2 transition-all">
                  <span>Manage</span>
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:ml-0" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest upsell and promotion activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>Activity feed coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

