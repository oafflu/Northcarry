"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Search, Eye, Loader2, DollarSign, FileText, CheckCircle, XCircle, Calendar, Building2, TrendingUp, TrendingDown, Download, Mail, CheckSquare, Square } from "lucide-react"
import { getSupplierInvoices, getPaymentStats, markInvoiceAsPaid, cancelInvoice, resendInvoicePaidEmail } from "@/app/actions/payments"
import { downloadSupplierInvoice } from "@/lib/invoice-utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalPending: 0,
    totalPaid: 0,
    thisMonthPaid: 0,
    lastMonthPaid: 0,
    changePercent: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
  })
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
    loadStats()
  }, [searchQuery, filterStatus])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const result = await getSupplierInvoices({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchQuery || undefined,
        limit: 100,
      })
      
      if (result.error) {
        toast.error("Failed to load invoices", {
          description: result.error,
        })
        setInvoices([])
      } else {
        setInvoices(result.data || [])
      }
    } catch (error: any) {
      console.error('Error loading invoices:', error)
      toast.error("Failed to load invoices", {
        description: error.message || "An unexpected error occurred",
      })
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getPaymentStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) return

    setPaying(true)
    try {
      const result = await markInvoiceAsPaid(selectedInvoice.id, {
        paidAmount: selectedInvoice.totalAmount,
      })

      if (result.success) {
        toast.success("Invoice marked as paid", {
          description: `Invoice ${selectedInvoice.invoiceNumber} has been marked as paid`,
        })
        setShowPayDialog(false)
        setSelectedInvoice(null)
        loadInvoices()
        loadStats()
      } else {
        toast.error("Failed to mark invoice as paid", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error)
      toast.error("Failed to mark invoice as paid", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setPaying(false)
    }
  }

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) return

    setCancelling(true)
    try {
      const result = await cancelInvoice(selectedInvoice.id, cancelReason)

      if (result.success) {
        toast.success("Invoice cancelled", {
          description: `Invoice ${selectedInvoice.invoiceNumber} has been cancelled`,
        })
        setShowCancelDialog(false)
        setCancelReason("")
        setSelectedInvoice(null)
        loadInvoices()
        loadStats()
      } else {
        toast.error("Failed to cancel invoice", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error cancelling invoice:', error)
      toast.error("Failed to cancel invoice", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setCancelling(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
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
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)))
    }
  }

  const handleBulkDownload = () => {
    if (selectedInvoices.size === 0) {
      toast.error("Please select at least one invoice to download")
      return
    }

    setDownloading(true)
    try {
      const selectedInvoiceData = invoices.filter(inv => selectedInvoices.has(inv.id))
      selectedInvoiceData.forEach((invoice, index) => {
        setTimeout(() => {
          try {
            downloadSupplierInvoice(invoice)
          } catch (error: any) {
            console.error(`Error downloading invoice ${invoice.invoiceNumber}:`, error)
            toast.error(`Failed to download ${invoice.invoiceNumber}`)
          }
        }, index * 500) // Stagger downloads to avoid popup blockers
      })
      toast.success(`Downloading ${selectedInvoices.size} invoice(s)`)
      setSelectedInvoices(new Set())
    } catch (error: any) {
      toast.error("Failed to download invoices", {
        description: error.message,
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadInvoice = (invoice: any) => {
    try {
      downloadSupplierInvoice(invoice)
      toast.success("Invoice downloaded")
    } catch (error: any) {
      toast.error("Failed to download invoice", {
        description: error.message,
      })
    }
  }

  const handleResendEmail = async (invoiceId: string, recipientType: 'supplier' | 'admin') => {
    setResendingEmail(invoiceId)
    try {
      const result = await resendInvoicePaidEmail(invoiceId, recipientType)
      if (result.success) {
        toast.success(`Email sent to ${recipientType === 'supplier' ? 'supplier' : 'admin(s)'}`)
      } else {
        toast.error("Failed to resend email", {
          description: result.error,
        })
      }
    } catch (error: any) {
      toast.error("Failed to resend email", {
        description: error.message,
      })
    } finally {
      setResendingEmail(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supplier Payments</h1>
          <p className="text-gray-600 mt-1">View and manage supplier invoices</p>
        </div>
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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-yellow-600" />
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
                {formatChange(stats.changePercent)}
              </div>
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.thisMonthPaid)}</p>
            <p className="text-sm text-gray-600 mt-1">Paid This Month</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPending)}</p>
            <p className="text-sm text-gray-600 mt-1">Pending Payment</p>
            <p className="text-xs text-gray-500 mt-1">{stats.pendingInvoices} invoice(s)</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPaid)}</p>
            <p className="text-sm text-gray-600 mt-1">Total Paid</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
            <p className="text-sm text-gray-600 mt-1">Total Invoices</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center"
                  >
                    {selectedInvoices.size === invoices.length && invoices.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-teal-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" />
                    <p className="mt-2 text-sm text-gray-500">Loading invoices...</p>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-sm text-gray-500">No invoices found</p>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
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
                      <Link
                        href={`/admin/payments/${invoice.id}`}
                        className="text-sm font-medium text-teal-600 hover:text-teal-700"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.supplierName}</div>
                      <div className="text-sm text-gray-500">{invoice.supplierEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{invoice.orderCount} order(s)</div>
                      <div className="text-xs text-gray-500">
                        {invoice.orderNumbers.slice(0, 3).join(', ')}
                        {invoice.orderNumbers.length > 3 && '...'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.status === "paid"
                            ? "bg-green-50 text-green-700"
                            : invoice.status === "pending" || invoice.status === "sent"
                              ? "bg-yellow-50 text-yellow-700"
                              : invoice.status === "cancelled"
                                ? "bg-red-50 text-red-700"
                                : "bg-gray-50 text-gray-700"
                        }`}
                      >
                        {invoice.status || "draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Link href={`/admin/payments/${invoice.id}`}>
                          <Button variant="ghost" size="sm" title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        {invoice.status === 'paid' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendEmail(invoice.id, 'supplier')}
                              disabled={resendingEmail === invoice.id}
                              title="Resend email to supplier"
                            >
                              {resendingEmail === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendEmail(invoice.id, 'admin')}
                              disabled={resendingEmail === invoice.id}
                              title="Resend email to admin"
                            >
                              {resendingEmail === invoice.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4 text-blue-600" />
                              )}
                            </Button>
                          </>
                        )}
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowPayDialog(true)
                              }}
                              className="text-green-600 border-green-300 hover:bg-green-50"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Pay
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowCancelDialog(true)
                              }}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Invoice Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Mark invoice {selectedInvoice?.invoiceNumber} as paid. This will update the invoice status and record the payment.
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Invoice Amount:</span>
                  <span className="text-sm font-semibold">{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Supplier:</span>
                  <span className="text-sm font-medium">{selectedInvoice.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Orders:</span>
                  <span className="text-sm">{selectedInvoice.orderCount} order(s)</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPayDialog(false)
                setSelectedInvoice(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700"
            >
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invoice Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invoice</DialogTitle>
            <DialogDescription>
              Cancel invoice {selectedInvoice?.invoiceNumber}. You can provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setCancelReason("")
                setSelectedInvoice(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancelInvoice}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

