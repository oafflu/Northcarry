'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/translations/supplier/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, ArrowLeft, Calendar, Download, Eye, Loader2, Search, Filter, CheckSquare, Square } from 'lucide-react'
import { downloadSupplierInvoice } from '@/lib/invoice-utils'
import Link from 'next/link'
import { toast } from 'sonner'

export default function PaymentHistoryPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'pending' | 'paid' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (user) {
      loadInvoices()
    }
  }, [user])

  useEffect(() => {
    filterInvoices()
  }, [invoices, searchTerm, statusFilter, dateFilter, customStartDate, customEndDate])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) return

      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading invoices:', error)
        toast.error(t('payment.failedToLoadInvoices') || 'Failed to load invoices')
      } else {
        setInvoices(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('payment.unexpectedError') || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const filterInvoices = () => {
    let filtered = [...invoices]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.order_numbers?.some((on: string) => on.toLowerCase().includes(term))
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date | null = null
      let endDate: Date | null = null

      if (dateFilter === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      } else if (dateFilter === 'week') {
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 7)
      } else if (dateFilter === 'month') {
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
      }

      if (startDate && endDate) {
        filtered = filtered.filter(inv => {
          const invDate = new Date(inv.created_at)
          return invDate >= startDate! && invDate <= endDate!
        })
      }
    }

    setFilteredInvoices(filtered)
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      sent: { bg: 'bg-blue-100', text: 'text-blue-800', label: t('payment.sent') || 'Sent' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t('payment.pending') || 'Pending' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: t('payment.paid') || 'Paid' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: t('payment.cancelled') || 'Cancelled' },
    }
    const statusInfo = statusMap[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
        {statusInfo.label}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const toggleSelectInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices)
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId)
    } else {
      newSelected.add(invoiceId)
    }
    setSelectedInvoices(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)))
    }
  }

  const handleBulkDownload = () => {
    if (selectedInvoices.size === 0) {
      toast.error(t('payment.pleaseSelectOrders') || 'Please select at least one invoice to download')
      return
    }

    setDownloading(true)
    try {
      const selectedInvoiceData = filteredInvoices.filter(inv => selectedInvoices.has(inv.id))
      selectedInvoiceData.forEach((invoice, index) => {
        setTimeout(() => {
          try {
            downloadSupplierInvoice({
              id: invoice.id,
              invoiceNumber: invoice.invoice_number,
              invoiceDate: invoice.created_at,
              dueDate: invoice.due_date,
              orderNumbers: invoice.order_numbers || [],
              orderCount: (invoice.order_numbers || []).length,
              subtotal: parseFloat(invoice.subtotal || '0'),
              taxAmount: parseFloat(invoice.tax_amount || '0'),
              totalAmount: parseFloat(invoice.amount || invoice.total_amount || '0'),
              status: invoice.status,
              companyName: invoice.company_name,
              companyAddress: invoice.address_line1 
                ? `${invoice.address_line1}${invoice.address_line2 ? ', ' + invoice.address_line2 : ''}, ${invoice.city}, ${invoice.state} ${invoice.postal_code}`
                : '',
              country: invoice.country,
              email: invoice.email,
              contactNumber: invoice.contact_number,
              taxId: invoice.tax_id,
              paidAt: invoice.paid_at,
              paidAmount: invoice.paid_amount ? parseFloat(invoice.paid_amount.toString()) : null,
              notes: invoice.notes,
              createdAt: invoice.created_at,
            })
          } catch (error: any) {
            console.error(`Error downloading invoice ${invoice.invoice_number}:`, error)
            toast.error(t('payment.failedToDownloadInvoice') || `Failed to download ${invoice.invoice_number}`)
          }
        }, index * 500)
      })
      toast.success(t('payment.downloadingInvoices') || `Downloading ${selectedInvoices.size} invoice(s)`)
      setSelectedInvoices(new Set())
    } catch (error: any) {
      toast.error(t('payment.failedToDownloadInvoice') || 'Failed to download invoices', {
        description: error.message,
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadInvoice = (invoice: any) => {
    try {
      downloadSupplierInvoice({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.created_at,
        dueDate: invoice.due_date,
        orderNumbers: invoice.order_numbers || [],
        orderCount: (invoice.order_numbers || []).length,
        subtotal: parseFloat(invoice.subtotal || '0'),
        taxAmount: parseFloat(invoice.tax_amount || '0'),
        totalAmount: parseFloat(invoice.amount || invoice.total_amount || '0'),
        status: invoice.status,
        companyName: invoice.company_name,
        companyAddress: invoice.address_line1 
          ? `${invoice.address_line1}${invoice.address_line2 ? ', ' + invoice.address_line2 : ''}, ${invoice.city}, ${invoice.state} ${invoice.postal_code}`
          : '',
        country: invoice.country,
        email: invoice.email,
        contactNumber: invoice.contact_number,
        taxId: invoice.tax_id,
        paidAt: invoice.paid_at,
        paidAmount: invoice.paid_amount ? parseFloat(invoice.paid_amount.toString()) : null,
        notes: invoice.notes,
        createdAt: invoice.created_at,
      })
      toast.success(t('payment.invoiceDownloaded') || 'Invoice downloaded')
    } catch (error: any) {
      toast.error(t('payment.failedToDownloadInvoice') || 'Failed to download invoice', {
        description: error.message,
      })
    }
  }

  const exportToCSV = () => {
    if (filteredInvoices.length === 0) {
      toast.error(t('payment.noInvoicesFound') || 'No invoices to export')
      return
    }

    const headers = ['Invoice Number', 'Date', 'Order Numbers', 'Amount', 'Status', 'Paid Date']
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number || '',
      new Date(inv.created_at).toLocaleDateString(),
      (inv.order_numbers || []).join(', '),
      parseFloat(inv.amount || '0').toFixed(2),
      inv.status || 'pending',
      inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `payment-history-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Exported to CSV')
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
        <Link href="/supplier/payment" className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back') || 'Back'}
        </Link>
        <h1 className="text-3xl font-bold">{t('payment.paymentHistory') || 'Payment History'}</h1>
        <p className="text-gray-600 mt-1">{t('payment.viewAllInvoices') || 'View all your invoices and payment transactions'}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder={t('payment.searchInvoices') || 'Search invoices...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('payment.allStatuses') || 'All Statuses'}</option>
            <option value="sent">{t('payment.sent') || 'Sent'}</option>
            <option value="pending">{t('payment.pending') || 'Pending'}</option>
            <option value="paid">{t('payment.paid') || 'Paid'}</option>
            <option value="cancelled">{t('payment.cancelled') || 'Cancelled'}</option>
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">{t('payment.allTime') || 'All Time'}</option>
              <option value="today">{t('payment.today') || 'Today'}</option>
              <option value="week">{t('payment.last7Days') || 'Last 7 Days'}</option>
              <option value="month">{t('payment.last30Days') || 'Last 30 Days'}</option>
              <option value="custom">{t('payment.customRange') || 'Custom Range'}</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm"
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {/* Bulk Download Button */}
          {selectedInvoices.size > 0 && (
            <Button
              onClick={handleBulkDownload}
              disabled={downloading}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download ({selectedInvoices.size})
                </>
              )}
            </Button>
          )}
          {/* Export Button */}
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filteredInvoices.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            {t('payment.exportCSV') || 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('payment.invoices') || 'Invoices'} ({filteredInvoices.length})
          </h2>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('payment.noInvoicesFound') || 'No invoices found'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0 ? (
                        <CheckSquare className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.invoiceNumber') || 'Invoice Number'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.date') || 'Date'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.orders') || 'Orders'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.amount') || 'Amount'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.status') || 'Status'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('payment.paidDate') || 'Paid Date'}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions') || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleSelectInvoice(invoice.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedInvoices.has(invoice.id) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium text-gray-900">{invoice.invoice_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        {(invoice.order_numbers || []).slice(0, 2).map((on: string, idx: number) => (
                          <span key={idx} className="font-mono text-xs">{on}</span>
                        ))}
                        {(invoice.order_numbers || []).length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{(invoice.order_numbers || []).length - 2} {t('payment.more') || 'more'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(parseFloat(invoice.amount || '0'))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.status || 'pending')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Link
                          href={`/supplier/payment/history/${invoice.id}`}
                          className="text-teal-600 hover:text-teal-900"
                        >
                          <Eye className="w-4 h-4 inline mr-1" />
                          {t('common.view') || 'View'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

