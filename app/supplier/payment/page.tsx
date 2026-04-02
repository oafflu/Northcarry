'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/translations/supplier/context'
import Link from 'next/link'
import { DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard, FileText, ArrowRight, Loader2, Eye } from 'lucide-react'
import { getSupplierOrdersCosts } from '@/app/actions/suppliers'
import { Button } from '@/components/ui/button'

export default function SupplierPaymentPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalEarnings: 0,
    pendingPayment: 0,
    paidAmount: 0,
    thisMonth: 0,
    lastMonth: 0,
    changePercent: 0,
  })
  const [recentInvoices, setRecentInvoices] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadPaymentData()
    }
  }, [user])

  const loadPaymentData = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) return

      // Get all fulfilled orders assigned to this supplier
      // Only include paid orders (suppliers should only fulfill paid orders)
      const { data: assignments } = await supabase
        .from('supplier_order_assignments')
        .select(`
          order_id,
          assignment_status,
          orders!inner (
            id,
            order_number,
            fulfillment_status,
            payment_status,
            created_at
          )
        `)
        .eq('supplier_id', user.id)
        .eq('orders.fulfillment_status', 'fulfilled')
        .eq('orders.payment_status', 'paid') // Only show paid orders

      if (!assignments || assignments.length === 0) {
        setLoading(false)
        return
      }

      const orderIds = assignments.map(a => a.order_id).filter(Boolean)
      const costsResult = await getSupplierOrdersCosts(orderIds, user.id)

      // Calculate stats
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      let thisMonthTotal = 0
      let lastMonthTotal = 0
      let totalEarnings = 0
      let pendingPayment = 0
      let paidAmount = 0

      // Get invoices to check payment status
      const { data: invoices } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setRecentInvoices(invoices || [])

      // Calculate based on invoices and orders
      if (costsResult.success) {
        totalEarnings = costsResult.totalCost

        // Check which orders are invoiced and paid
        assignments.forEach((assignment: any) => {
          const orderDate = new Date(assignment.orders.created_at)
          const cost = costsResult.orderCosts.find(c => c.orderId === assignment.order_id)?.cost || 0

          if (orderDate >= thisMonthStart) {
            thisMonthTotal += cost
          } else if (orderDate >= lastMonthStart && orderDate <= lastMonthEnd) {
            lastMonthTotal += cost
          }

          // Check if invoiced
          const invoice = invoices?.find(inv => 
            inv.order_numbers && inv.order_numbers.includes(assignment.orders.order_number)
          )

          if (invoice) {
            if (invoice.status === 'paid') {
              paidAmount += cost
            } else {
              pendingPayment += cost
            }
          } else {
            pendingPayment += cost
          }
        })
      }

      const changePercent = lastMonthTotal > 0 
        ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
        : 0

      setStats({
        totalEarnings,
        pendingPayment,
        paidAmount,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        changePercent,
      })
    } catch (error) {
      console.error('Error loading payment data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('payment.title') || 'Payment & Earnings'}</h1>
        <p className="text-gray-600 mt-1">{t('payment.subtitle') || 'Track your earnings and payment history'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-teal-600" />
            </div>
            {stats.changePercent !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-medium ${
                stats.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {stats.changePercent >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {Math.abs(stats.changePercent).toFixed(1)}%
              </div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.thisMonth)}</p>
            <p className="text-sm text-gray-600 mt-1">{t('payment.thisMonth') || 'This Month'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalEarnings)}</p>
            <p className="text-sm text-gray-600 mt-1">{t('payment.totalEarnings') || 'Total Earnings'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pendingPayment)}</p>
            <p className="text-sm text-gray-600 mt-1">{t('payment.pendingPayment') || 'Pending Payment'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.paidAmount)}</p>
            <p className="text-sm text-gray-600 mt-1">{t('payment.paidAmount') || 'Paid Amount'}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/supplier/payment/methods"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all"
        >
          <CreditCard className="w-8 h-8 text-teal-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('payment.paymentMethods') || 'Payment Methods'}</h3>
          <p className="text-sm text-gray-600 mb-4">{t('payment.managePaymentMethods') || 'Manage your bank details and payment methods'}</p>
          <div className="flex items-center text-teal-600 text-sm font-medium">
            {t('common.view') || 'View'} <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <Link
          href="/supplier/payment/invoice"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all"
        >
          <FileText className="w-8 h-8 text-teal-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('payment.sendInvoice') || 'Send Invoice'}</h3>
          <p className="text-sm text-gray-600 mb-4">{t('payment.generateInvoice') || 'Generate and send invoices for fulfilled orders'}</p>
          <div className="flex items-center text-teal-600 text-sm font-medium">
            {t('common.view') || 'View'} <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>

        <Link
          href="/supplier/payment/history"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all"
        >
          <DollarSign className="w-8 h-8 text-teal-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('payment.paymentHistory') || 'Payment History'}</h3>
          <p className="text-sm text-gray-600 mb-4">{t('payment.viewPaymentHistory') || 'View all your payment transactions'}</p>
          <div className="flex items-center text-teal-600 text-sm font-medium">
            {t('common.view') || 'View'} <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </Link>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('payment.recentInvoices') || 'Recent Invoices'}</h2>
          <Link href="/supplier/payment/invoice" className="text-sm font-medium text-teal-600 hover:text-teal-700">
            {t('payment.viewAll') || 'View All'}
          </Link>
        </div>
        <div className="p-6">
          {recentInvoices.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{t('payment.noInvoices') || 'No invoices yet'}</p>
          ) : (
            <div className="space-y-4">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Invoice #{invoice.invoice_number}</p>
                    <p className="text-sm text-gray-600">
                      {invoice.order_numbers?.length || 0} {t('payment.orders') || 'orders'} • {formatCurrency(parseFloat(invoice.amount || '0'))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status || 'pending'}
                      </span>
                    </div>
                    <Link href={`/supplier/payment/history/${invoice.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        {t('common.view') || 'View'}
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

