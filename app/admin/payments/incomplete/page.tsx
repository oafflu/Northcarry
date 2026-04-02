"use client"

import { useState, useEffect } from "react"
import { Search, Eye, Loader2, DollarSign, XCircle, CheckCircle, Mail, ShoppingCart, AlertCircle, Calendar, Filter, Download, RefreshCw, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface IncompletePayment {
  id: string
  user_id?: string
  customer_email: string
  customer_name?: string
  stripe_payment_intent_id: string
  paypal_order_id?: string
  payment_method?: string
  payment_amount: number
  currency: string
  failure_reason?: string
  failure_code?: string
  failure_message?: string
  order_id?: string
  order_number?: string
  cart_items?: any[]
  retry_count: number
  recovered: boolean
  email_sent: boolean
  automation_triggered: boolean
  created_at: string
  updated_at: string
}

interface AbandonedCart {
  user_id?: string
  session_id?: string
  customer_email?: string
  customer_name?: string
  cart_items: any[]
  total_value: number
  last_updated: string
  days_abandoned: number
}

export default function IncompletePaymentsPage() {
  const [activeTab, setActiveTab] = useState<"payments" | "carts" | "paypal">("payments")
  const [paypalPayments, setPaypalPayments] = useState<IncompletePayment[]>([])
  const [payments, setPayments] = useState<IncompletePayment[]>([])
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "unrecovered" | "recovered">("all")
  const [filterEmailSent, setFilterEmailSent] = useState<"all" | "sent" | "unsent">("all")
  const [filterFailureReason, setFilterFailureReason] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [selectedPayment, setSelectedPayment] = useState<IncompletePayment | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [triggeringEmails, setTriggeringEmails] = useState(false)
  const [selectedStripePaymentIds, setSelectedStripePaymentIds] = useState<Set<string>>(new Set())
  const [selectedPaypalPaymentIds, setSelectedPaypalPaymentIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [recovering, setRecovering] = useState(false)
  const [recoveringPaymentId, setRecoveringPaymentId] = useState<string | null>(null)
  const [showRecoverByOrderNumber, setShowRecoverByOrderNumber] = useState(false)
  const [orderNumberToRecover, setOrderNumberToRecover] = useState("")
  const [paymentIntentIdToRecover, setPaymentIntentIdToRecover] = useState("")

  useEffect(() => {
    if (activeTab === "payments") {
      setCurrentPage(1) // Reset to first page when filters change
      setSelectedStripePaymentIds(new Set())
      loadPayments()
    } else if (activeTab === "paypal") {
      setCurrentPage(1)
      setSelectedPaypalPaymentIds(new Set())
      loadPaypalPayments()
    } else {
      setCurrentPage(1)
      loadAbandonedCarts()
    }
  }, [activeTab, filterStatus, filterEmailSent, filterFailureReason, itemsPerPage, startDate, endDate])

  useEffect(() => {
    if (activeTab === "payments") {
      loadPayments()
    } else if (activeTab === "paypal") {
      loadPaypalPayments()
    } else {
      loadAbandonedCarts()
    }
  }, [currentPage])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus === "unrecovered") params.append("recovered", "false")
      if (filterStatus === "recovered") params.append("recovered", "true")
      if (filterEmailSent === "sent") params.append("email_sent", "true")
      if (filterEmailSent === "unsent") params.append("email_sent", "false")
      if (filterFailureReason !== "all") params.append("failure_reason", filterFailureReason)
      if (startDate) params.append("start_date", new Date(startDate).toISOString())
      if (endDate) {
        // Include the full day by setting end-of-day if user picked a date
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        params.append("end_date", end.toISOString())
      }
      params.append("limit", itemsPerPage.toString())
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString())

      const response = await fetch(`/api/admin/incomplete-payments?${params}`)
      const data = await response.json()

      if (response.ok) {
        let filtered = data.payments || []
        if (searchQuery) {
          filtered = filtered.filter((p: IncompletePayment) =>
            p.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.stripe_payment_intent_id.toLowerCase().includes(searchQuery.toLowerCase())
          )
        }
        setPayments(filtered)
        setTotalCount(data.total || filtered.length)
        setTotalPages(Math.ceil((data.total || filtered.length) / itemsPerPage))
      } else {
        toast.error("Failed to load incomplete payments")
        setPayments([])
        setTotalCount(0)
        setTotalPages(1)
      }
    } catch (error: any) {
      console.error("Error loading payments:", error)
      toast.error("Failed to load incomplete payments")
      setPayments([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const loadPaypalPayments = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('payment_method', 'paypal')
      if (filterStatus === "unrecovered") params.append("recovered", "false")
      if (filterStatus === "recovered") params.append("recovered", "true")
      if (filterEmailSent === "sent") params.append("email_sent", "true")
      if (filterEmailSent === "unsent") params.append("email_sent", "false")
      if (filterFailureReason !== "all") params.append("failure_reason", filterFailureReason)
      if (startDate) params.append("start_date", new Date(startDate).toISOString())
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        params.append("end_date", end.toISOString())
      }
      params.append("limit", itemsPerPage.toString())
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString())

      const response = await fetch(`/api/admin/incomplete-payments?${params}`)
      const data = await response.json()

      if (response.ok) {
        let filtered = data.payments || []
        if (searchQuery) {
          filtered = filtered.filter((p: IncompletePayment) =>
            p.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.paypal_order_id?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        }
        setPaypalPayments(filtered)
        setTotalCount(data.total || filtered.length)
        setTotalPages(Math.ceil((data.total || filtered.length) / itemsPerPage))
      } else {
        toast.error("Failed to load PayPal incomplete payments")
        setPaypalPayments([])
        setTotalCount(0)
        setTotalPages(1)
      }
    } catch (error: any) {
      console.error("Error loading PayPal payments:", error)
      toast.error("Failed to load PayPal incomplete payments")
      setPaypalPayments([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const loadAbandonedCarts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("limit", itemsPerPage.toString())
      params.append("offset", ((currentPage - 1) * itemsPerPage).toString())

      const response = await fetch(`/api/admin/abandoned-carts?${params}`)
      const data = await response.json()

      if (response.ok) {
        let filtered = data.carts || []
        if (searchQuery) {
          filtered = filtered.filter((c: AbandonedCart) =>
            c.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        }
        setAbandonedCarts(filtered)
        setTotalCount(data.total || filtered.length)
        setTotalPages(Math.ceil((data.total || filtered.length) / itemsPerPage))
      } else {
        toast.error("Failed to load abandoned carts")
        setAbandonedCarts([])
        setTotalCount(0)
        setTotalPages(1)
      }
    } catch (error: any) {
      console.error("Error loading abandoned carts:", error)
      toast.error("Failed to load abandoned carts")
      setAbandonedCarts([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getFailureReasonColor = (reason?: string) => {
    switch (reason) {
      case "card_declined":
        return "text-red-600 bg-red-50"
      case "insufficient_funds":
        return "text-orange-600 bg-orange-50"
      case "expired_card":
        return "text-yellow-600 bg-yellow-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const triggerEmailsForUnsent = async () => {
    const unsentPayments = payments.filter(p => !p.email_sent && !p.recovered)
    if (unsentPayments.length === 0) {
      toast.info('No unsent incomplete payments found')
      return
    }
    
    setTriggeringEmails(true)
    try {
      const response = await fetch('/api/admin/incomplete-payments/trigger-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: unsentPayments.map(p => p.id),
        }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`Successfully triggered ${data.triggered} email(s)`)
        // Reload payments to update status
        await loadPayments()
      } else {
        toast.error(data.error || 'Failed to trigger emails')
      }
    } catch (error: any) {
      console.error('Error triggering emails:', error)
      toast.error('Failed to trigger emails')
    } finally {
      setTriggeringEmails(false)
    }
  }

  const triggerEmailsForSelected = async () => {
    const selectedIds =
      activeTab === "payments"
        ? Array.from(selectedStripePaymentIds)
        : activeTab === "paypal"
          ? Array.from(selectedPaypalPaymentIds)
          : []

    if (selectedIds.length === 0) {
      toast.info("No payments selected")
      return
    }

    setTriggeringEmails(true)
    try {
      const response = await fetch('/api/admin/incomplete-payments/trigger-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIds: selectedIds,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Successfully triggered ${data.triggered} email(s)`)
        if (activeTab === "payments") {
          setSelectedStripePaymentIds(new Set())
          await loadPayments()
        } else if (activeTab === "paypal") {
          setSelectedPaypalPaymentIds(new Set())
          await loadPaypalPayments()
        }
      } else {
        toast.error(data.error || 'Failed to trigger emails')
      }
    } catch (error: any) {
      console.error('Error triggering selected emails:', error)
      toast.error('Failed to trigger emails')
    } finally {
      setTriggeringEmails(false)
    }
  }

  const getSelectedSet = () => (activeTab === "paypal" ? selectedPaypalPaymentIds : selectedStripePaymentIds)
  const setSelectedSet = (next: Set<string>) => {
    if (activeTab === "paypal") setSelectedPaypalPaymentIds(next)
    else setSelectedStripePaymentIds(next)
  }

  const togglePaymentSelected = (id: string) => {
    const current = getSelectedSet()
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedSet(next)
  }

  const selectAllOnPage = (rows: IncompletePayment[]) => {
    const current = getSelectedSet()
    const next = new Set(current)
    rows.forEach((p) => next.add(p.id))
    setSelectedSet(next)
  }

  const clearAllOnPage = (rows: IncompletePayment[]) => {
    const current = getSelectedSet()
    const next = new Set(current)
    rows.forEach((p) => next.delete(p.id))
    setSelectedSet(next)
  }

  const recoverOrder = async (payment: IncompletePayment) => {
    if (!confirm(`Recover order for payment ${payment.stripe_payment_intent_id || payment.paypal_order_id}? This will create an order record from the payment.`)) {
      return
    }

    setRecoveringPaymentId(payment.id)
    setRecovering(true)
    try {
      const response = await fetch('/api/admin/incomplete-payments/recover-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: payment.stripe_payment_intent_id,
          orderNumber: payment.order_number,
          incompletePaymentId: payment.id,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success(`Order recovered successfully! Order #${data.order.order_number}`, {
          description: data.order.note || '',
        })
        // Reload payments to update status
        if (activeTab === "payments") {
          await loadPayments()
        } else if (activeTab === "paypal") {
          await loadPaypalPayments()
        }
      } else {
        toast.error(data.error || 'Failed to recover order')
      }
    } catch (error: any) {
      console.error('Error recovering order:', error)
      toast.error('Failed to recover order: ' + (error.message || 'Unknown error'))
    } finally {
      setRecovering(false)
      setRecoveringPaymentId(null)
    }
  }

  const recoverSelectedOrders = async () => {
    const selectedIds = activeTab === "payments"
      ? Array.from(selectedStripePaymentIds)
      : activeTab === "paypal"
        ? Array.from(selectedPaypalPaymentIds)
        : []

    if (selectedIds.length === 0) {
      toast.info("No payments selected")
      return
    }

    if (!confirm(`Recover orders for ${selectedIds.length} selected payment(s)? This will create order records from the payments.`)) {
      return
    }

    setRecovering(true)
    try {
      const paymentsToRecover = activeTab === "payments" 
        ? payments.filter(p => selectedIds.includes(p.id))
        : paypalPayments.filter(p => selectedIds.includes(p.id))

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      for (const payment of paymentsToRecover) {
        try {
          const response = await fetch('/api/admin/incomplete-payments/recover-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: payment.stripe_payment_intent_id,
              orderNumber: payment.order_number,
              incompletePaymentId: payment.id,
            }),
          })

          const data = await response.json()

          if (response.ok && data.success) {
            successCount++
          } else {
            failCount++
            errors.push(`${payment.customer_email}: ${data.error || 'Unknown error'}`)
          }
        } catch (error: any) {
          failCount++
          errors.push(`${payment.customer_email}: ${error.message || 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully recovered ${successCount} order(s)`)
      }
      if (failCount > 0) {
        toast.error(`Failed to recover ${failCount} order(s)`, {
          description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''),
        })
      }

      // Reload payments to update status
      if (activeTab === "payments") {
        setSelectedStripePaymentIds(new Set())
        await loadPayments()
      } else if (activeTab === "paypal") {
        setSelectedPaypalPaymentIds(new Set())
        await loadPaypalPayments()
      }
    } catch (error: any) {
      console.error('Error recovering selected orders:', error)
      toast.error('Failed to recover orders: ' + (error.message || 'Unknown error'))
    } finally {
      setRecovering(false)
    }
  }

  const autoRecoverAllUnrecovered = async () => {
    const unrecoveredPayments = activeTab === "payments"
      ? payments.filter(p => !p.recovered && p.failure_reason === 'order_not_created')
      : paypalPayments.filter(p => !p.recovered)

    if (unrecoveredPayments.length === 0) {
      toast.info('No unrecovered payments found that can be auto-recovered')
      return
    }

    if (!confirm(`Auto-recover ${unrecoveredPayments.length} unrecovered payment(s)? This will attempt to create order records for all successful payments without orders.`)) {
      return
    }

    setRecovering(true)
    try {
      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      for (const payment of unrecoveredPayments) {
        try {
          const response = await fetch('/api/admin/incomplete-payments/recover-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: payment.stripe_payment_intent_id,
              orderNumber: payment.order_number,
              incompletePaymentId: payment.id,
            }),
          })

          const data = await response.json()

          if (response.ok && data.success) {
            successCount++
          } else {
            failCount++
            errors.push(`${payment.customer_email}: ${data.error || 'Unknown error'}`)
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
        } catch (error: any) {
          failCount++
          errors.push(`${payment.customer_email}: ${error.message || 'Unknown error'}`)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully auto-recovered ${successCount} order(s)`)
      }
      if (failCount > 0) {
        toast.warning(`Failed to recover ${failCount} order(s)`, {
          description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''),
        })
      }

      // Reload payments to update status
      if (activeTab === "payments") {
        await loadPayments()
      } else if (activeTab === "paypal") {
        await loadPaypalPayments()
      }
    } catch (error: any) {
      console.error('Error auto-recovering orders:', error)
      toast.error('Failed to auto-recover orders: ' + (error.message || 'Unknown error'))
    } finally {
      setRecovering(false)
    }
  }

  const stats = {
    totalPayments: payments.length,
    unrecoveredPayments: payments.filter(p => !p.recovered).length,
    totalValue: payments.reduce((sum, p) => sum + parseFloat(p.payment_amount.toString()), 0),
    unrecoveredValue: payments.filter(p => !p.recovered).reduce((sum, p) => sum + parseFloat(p.payment_amount.toString()), 0),
    totalCarts: abandonedCarts.length,
    totalCartValue: abandonedCarts.reduce((sum, c) => sum + c.total_value, 0),
    unsentPayments: payments.filter(p => !p.email_sent && !p.recovered).length,
    totalPaypalPayments: paypalPayments.length,
    unrecoveredPaypalPayments: paypalPayments.filter(p => !p.recovered).length,
    totalPaypalValue: paypalPayments.reduce((sum, p) => sum + parseFloat(p.payment_amount.toString()), 0),
    unrecoveredPaypalValue: paypalPayments.filter(p => !p.recovered).reduce((sum, p) => sum + parseFloat(p.payment_amount.toString()), 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incomplete Payments & Abandoned Carts</h1>
          <p className="text-gray-600 mt-1">Track failed payments and abandoned shopping carts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("payments")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "payments"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Stripe Payments ({stats.totalPayments})
          </button>
          <button
            onClick={() => setActiveTab("paypal")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "paypal"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            PayPal Payments ({paypalPayments.length})
          </button>
          <button
            onClick={() => setActiveTab("carts")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "carts"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Abandoned Carts ({stats.totalCarts})
          </button>
        </nav>
      </div>

      {/* Stats Cards */}
      {activeTab === "payments" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Failed Payments</p>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Unrecovered</p>
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.unrecoveredPayments}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Value</p>
              <DollarSign className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Unrecovered Value</p>
              <DollarSign className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.unrecoveredValue)}</p>
          </div>
        </div>
      )}
      {activeTab === "paypal" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Failed Payments</p>
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPaypalPayments}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Unrecovered</p>
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.unrecoveredPaypalPayments}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Value</p>
              <DollarSign className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPaypalValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Unrecovered Value</p>
              <DollarSign className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.unrecoveredPaypalValue)}</p>
          </div>
        </div>
      )}

      {activeTab === "carts" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Abandoned Carts</p>
              <ShoppingCart className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalCarts}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Cart Value</p>
              <DollarSign className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCartValue)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Average Cart Value</p>
              <DollarSign className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalCarts > 0 ? formatCurrency(stats.totalCartValue / stats.totalCarts) : "$0.00"}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {(activeTab === "payments" || activeTab === "paypal") && (
        <div className="space-y-3">
          {/* Recover by Order Number */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Recover Order by Order Number</h3>
                <p className="text-xs text-gray-500 mt-1">Search Stripe for a payment by order number and create the missing order</p>
              </div>
              <button
                onClick={() => setShowRecoverByOrderNumber(!showRecoverByOrderNumber)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
              >
                {showRecoverByOrderNumber ? "Hide" : "Show"}
              </button>
            </div>
            {showRecoverByOrderNumber && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter order number (e.g., BREVI-20260120-G0CD)"
                    value={orderNumberToRecover}
                    onChange={(e) => setOrderNumberToRecover(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    onClick={async () => {
                      if (!orderNumberToRecover.trim()) {
                        toast.error("Please enter an order number")
                        return
                      }
                      setRecovering(true)
                      try {
                        const response = await fetch('/api/admin/incomplete-payments/recover-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            orderNumber: orderNumberToRecover.trim(),
                          }),
                        })

                        const data = await response.json()

                        if (response.ok && data.success) {
                          toast.success(`Order recovered successfully! Order #${data.order.order_number}`, {
                            description: data.order.note || '',
                          })
                          setOrderNumberToRecover("")
                          setShowRecoverByOrderNumber(false)
                          // Reload payments to update status
                          if (activeTab === "payments") {
                            await loadPayments()
                          } else if (activeTab === "paypal") {
                            await loadPaypalPayments()
                          }
                        } else {
                          toast.error(data.error || 'Failed to recover order', {
                            description: 'If order number search fails, try using the Payment Intent ID below.',
                            duration: 8000,
                          })
                        }
                      } catch (error: any) {
                        console.error('Error recovering order:', error)
                        toast.error('Failed to recover order: ' + (error.message || 'Unknown error'))
                      } finally {
                        setRecovering(false)
                      }
                    }}
                    disabled={recovering || !orderNumberToRecover.trim()}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                  >
                    {recovering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Recover by Order Number
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex-1 border-t border-gray-200"></div>
                  <span>OR</span>
                  <div className="flex-1 border-t border-gray-200"></div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Payment Intent ID (e.g., pi_3SrgQqGcTncGVTkL1A9a5UAq)"
                    value={paymentIntentIdToRecover}
                    onChange={(e) => setPaymentIntentIdToRecover(e.target.value.trim())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  />
                  <button
                    onClick={async () => {
                      if (!paymentIntentIdToRecover.trim()) {
                        toast.error("Please enter a Payment Intent ID")
                        return
                      }
                      if (!paymentIntentIdToRecover.trim().startsWith('pi_')) {
                        toast.error("Payment Intent ID must start with 'pi_'")
                        return
                      }
                      setRecovering(true)
                      try {
                        const response = await fetch('/api/admin/incomplete-payments/recover-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            paymentIntentId: paymentIntentIdToRecover.trim(),
                          }),
                        })

                        const data = await response.json()

                        if (response.ok && data.success) {
                          toast.success(`Order recovered successfully! Order #${data.order.order_number}`, {
                            description: data.order.note || '',
                          })
                          setPaymentIntentIdToRecover("")
                          setOrderNumberToRecover("")
                          setShowRecoverByOrderNumber(false)
                          // Reload payments to update status
                          if (activeTab === "payments") {
                            await loadPayments()
                          } else if (activeTab === "paypal") {
                            await loadPaypalPayments()
                          }
                        } else {
                          toast.error(data.error || 'Failed to recover order')
                        }
                      } catch (error: any) {
                        console.error('Error recovering order:', error)
                        toast.error('Failed to recover order: ' + (error.message || 'Unknown error'))
                      } finally {
                        setRecovering(false)
                      }
                    }}
                    disabled={recovering || !paymentIntentIdToRecover.trim()}
                    className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2"
                  >
                    {recovering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recovering...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Recover by Payment Intent ID
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  💡 Tip: If order number search fails, use the Payment Intent ID from Stripe Dashboard. Find it in the payment details (starts with "pi_").
                </p>
              </div>
            )}
          </div>

          {/* Other Action Buttons */}
          <div className="flex justify-end gap-2 flex-wrap">
          {activeTab === "payments" && (
            <button
              onClick={async () => {
                if (!confirm("This will sync incomplete payments and subscription invoices from Stripe. This may take a few minutes. Continue?")) {
                  return
                }
                setSyncing(true)
                try {
                  let totalImported = 0
                  let totalSkipped = 0
                  let startAfter: string | null = null
                  let hasMore = true
                  let batch = 1

                  while (hasMore && batch <= 10) { // Limit to 10 batches (1000 records max)
                    const response = await fetch("/api/admin/incomplete-payments/sync-stripe", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        limit: 100,
                        startAfter,
                        syncSubscriptions: true,
                      }),
                    })

                    const result = await response.json()

                    if (result.success) {
                      totalImported += result.imported || 0
                      totalSkipped += result.skipped || 0
                      hasMore = result.hasMore || false
                      startAfter = result.nextStartAfter

                      if (hasMore) {
                        toast.success(`Batch ${batch}: Imported ${result.imported}, skipped ${result.skipped}. Continuing...`)
                        batch++
                        // Small delay between batches
                        await new Promise(resolve => setTimeout(resolve, 500))
                      } else {
                        toast.success(`Sync complete! Imported ${totalImported} payment(s), skipped ${totalSkipped} existing/duplicate(s)`)
                        loadPayments()
                      }
                    } else {
                      toast.error(result.error || "Failed to sync payments")
                      break
                    }
                  }

                  if (hasMore && batch > 10) {
                    toast.warning(`Sync paused after ${batch - 1} batches. Click "Sync from Stripe" again to continue.`)
                  }
                } catch (error: any) {
                  console.error("Error syncing payments:", error)
                  toast.error(error.message || "Failed to sync payments")
                } finally {
                  setSyncing(false)
                }
              }}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Stripe"}
            </button>
          )}
          {activeTab === "paypal" && (
            <button
              onClick={async () => {
                if (!confirm("This will sync incomplete PayPal orders. This may take a few minutes. Continue?")) {
                  return
                }
                setSyncing(true)
                try {
                  let totalImported = 0
                  let totalSkipped = 0
                  let startAfter: string | null = null
                  let hasMore = true
                  let batch = 1

                  while (hasMore && batch <= 10) { // Limit to 10 batches
                    const response = await fetch("/api/admin/incomplete-payments/sync-paypal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        limit: 20, // PayPal max is 20 per page
                        startAfter,
                      }),
                    })

                    const result = await response.json()

                    if (result.success) {
                      totalImported += result.imported || 0
                      totalSkipped += result.skipped || 0
                      hasMore = result.hasMore || false
                      startAfter = result.nextStartAfter

                      if (hasMore) {
                        toast.success(`Batch ${batch}: Imported ${result.imported}, skipped ${result.skipped}. Continuing...`)
                        batch++
                        // Small delay between batches
                        await new Promise(resolve => setTimeout(resolve, 500))
                      } else {
                        toast.success(`Sync complete! Imported ${totalImported} payment(s), skipped ${totalSkipped} existing/duplicate(s)`)
                        loadPaypalPayments()
                      }
                    } else {
                      toast.error(result.error || "Failed to sync PayPal payments")
                      break
                    }
                  }

                  if (hasMore && batch > 10) {
                    toast.warning(`Sync paused after ${batch - 1} batches. Click "Sync from PayPal" again to continue.`)
                  }
                } catch (error: any) {
                  console.error("Error syncing PayPal payments:", error)
                  toast.error(error.message || "Failed to sync PayPal payments")
                } finally {
                  setSyncing(false)
                }
              }}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from PayPal"}
            </button>
          )}
          {activeTab === "payments" && stats.unsentPayments > 0 && (
            <button
              onClick={triggerEmailsForUnsent}
              disabled={triggeringEmails}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Mail className={`w-4 h-4 ${triggeringEmails ? "animate-pulse" : ""}`} />
              {triggeringEmails ? "Sending..." : `Send Emails (${stats.unsentPayments})`}
            </button>
          )}
          {(activeTab === "payments" || activeTab === "paypal") && (
            <button
              onClick={triggerEmailsForSelected}
              disabled={triggeringEmails || (activeTab === "payments" ? selectedStripePaymentIds.size === 0 : selectedPaypalPaymentIds.size === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Send recovery emails only for selected rows"
            >
              <Mail className={`w-4 h-4 ${triggeringEmails ? "animate-pulse" : ""}`} />
              {triggeringEmails
                ? "Sending..."
                : `Send Selected (${activeTab === "payments" ? selectedStripePaymentIds.size : selectedPaypalPaymentIds.size})`}
            </button>
          )}
          {(activeTab === "payments" || activeTab === "paypal") && (
            <button
              onClick={recoverSelectedOrders}
              disabled={recovering || (activeTab === "payments" ? selectedStripePaymentIds.size === 0 : selectedPaypalPaymentIds.size === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Recover orders for selected payments"
            >
              <RotateCcw className={`w-4 h-4 ${recovering ? "animate-spin" : ""}`} />
              {recovering
                ? "Recovering..."
                : `Recover Selected (${activeTab === "payments" ? selectedStripePaymentIds.size : selectedPaypalPaymentIds.size})`}
            </button>
          )}
          {activeTab === "payments" && (
            <button
              onClick={autoRecoverAllUnrecovered}
              disabled={recovering}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Auto-recover all successful payments without orders"
            >
              <RotateCcw className={`w-4 h-4 ${recovering ? "animate-spin" : ""}`} />
              {recovering ? "Recovering..." : "Auto-Recover All"}
            </button>
          )}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "payments" ? "Stripe payments" : activeTab === "paypal" ? "PayPal payments" : "carts"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="itemsPerPage" className="text-sm text-gray-600 whitespace-nowrap">
              Per page:
            </label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1) // Reset to first page when changing items per page
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={400}>400</option>
              <option value={1000}>1000</option>
            </select>
          </div>
          {(activeTab === "payments" || activeTab === "paypal") && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="text-sm outline-none"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="text-sm outline-none"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("")
                    setEndDate("")
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm whitespace-nowrap"
                >
                  Clear dates
                </button>
              )}
            </div>
          )}
          {(activeTab === "payments" || activeTab === "paypal") && (
            <>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Status</option>
                <option value="unrecovered">Unrecovered</option>
                <option value="recovered">Recovered</option>
              </select>
              <select
                value={filterEmailSent}
                onChange={(e) => setFilterEmailSent(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Emails</option>
                <option value="sent">Email Sent</option>
                <option value="unsent">Email Not Sent</option>
              </select>
              <select
                value={filterFailureReason}
                onChange={(e) => setFilterFailureReason(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Failure Reasons</option>
                <option value="card_declined">Card Declined</option>
                <option value="insufficient_funds">Insufficient Funds</option>
                <option value="expired_card">Expired Card</option>
                <option value="authentication_required">Authentication Required</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="order_not_created">Order Not Created</option>
                <option value="other">Other</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : activeTab === "payments" || activeTab === "paypal" ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {(() => {
                      const rows = activeTab === "payments" ? payments : paypalPayments
                      const selected = activeTab === "payments" ? selectedStripePaymentIds : selectedPaypalPaymentIds
                      const selectableRows = rows
                      const allSelected = selectableRows.length > 0 && selectableRows.every((p) => selected.has(p.id))
                      const someSelected = selectableRows.some((p) => selected.has(p.id))
                      return (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !allSelected && someSelected
                          }}
                          onChange={(e) => {
                            if (e.target.checked) selectAllOnPage(selectableRows)
                            else clearAllOnPage(selectableRows)
                          }}
                          aria-label="Select all on this page"
                          className="h-4 w-4"
                        />
                      )
                    })()}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failure Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(activeTab === "payments" ? payments : paypalPayments).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No incomplete {activeTab === "paypal" ? "PayPal" : "Stripe"} payments found
                    </td>
                  </tr>
                ) : (
                  (activeTab === "payments" ? payments : paypalPayments).map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={(activeTab === "payments" ? selectedStripePaymentIds : selectedPaypalPaymentIds).has(payment.id)}
                          onChange={() => togglePaymentSelected(payment.id)}
                          aria-label={`Select payment ${payment.id}`}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.customer_name || "Unknown"}</p>
                          <p className="text-sm text-gray-500">{payment.customer_email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(payment.payment_amount, payment.currency)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.failure_reason && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFailureReasonColor(payment.failure_reason)}`}>
                            {payment.failure_reason.replace("_", " ")}
                          </span>
                        )}
                        {payment.failure_message && (
                          <p className="text-xs text-gray-500 mt-1">{payment.failure_message}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.recovered ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-green-600 bg-green-50 flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" />
                            Recovered
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-red-600 bg-red-50 flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" />
                            Unrecovered
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.email_sent ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-green-600 bg-green-50 flex items-center gap-1 w-fit">
                            <Mail className="w-3 h-3" />
                            Sent
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full text-gray-600 bg-gray-50 flex items-center gap-1 w-fit">
                            <Mail className="w-3 h-3" />
                            Not Sent
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payment.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="text-teal-600 hover:text-teal-900 flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          {!payment.recovered && (payment.failure_reason === 'order_not_created' || payment.payment_method === 'stripe') && (
                            <button
                              onClick={() => recoverOrder(payment)}
                              disabled={recovering && recoveringPaymentId === payment.id}
                              className="text-green-600 hover:text-green-900 flex items-center gap-1 disabled:opacity-50"
                              title="Recover order from this payment"
                            >
                              {recovering && recoveringPaymentId === payment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              Recover
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Abandoned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {abandonedCarts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No abandoned carts found
                    </td>
                  </tr>
                ) : (
                  abandonedCarts.map((cart, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cart.customer_name || "Guest"}</p>
                          {cart.customer_email && (
                            <p className="text-sm text-gray-500">{cart.customer_email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{cart.cart_items?.length || 0} items</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(cart.total_value)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          cart.days_abandoned > 7 ? "text-red-600 bg-red-50" :
                          cart.days_abandoned > 3 ? "text-orange-600 bg-orange-50" :
                          "text-yellow-600 bg-yellow-50"
                        }`}>
                          {cart.days_abandoned} days
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(cart.last_updated)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-teal-600 hover:text-teal-900 flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 border rounded-lg ${
                        currentPage === pageNum
                          ? "bg-teal-600 text-white border-teal-600"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
              <button
                onClick={() => setSelectedPayment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="text-sm font-medium text-gray-900">{selectedPayment.customer_name || "Unknown"}</p>
                <p className="text-sm text-gray-600">{selectedPayment.customer_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Amount</p>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(selectedPayment.payment_amount, selectedPayment.currency)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{selectedPayment.payment_method === 'paypal' ? 'PayPal Order ID' : 'Stripe Payment Intent'}</p>
                <p className="text-sm font-mono text-gray-900">
                  {selectedPayment.payment_method === 'paypal' 
                    ? (selectedPayment.paypal_order_id || 'N/A')
                    : selectedPayment.stripe_payment_intent_id}
                </p>
              </div>
              {selectedPayment.failure_reason && (
                <div>
                  <p className="text-sm text-gray-500">Failure Reason</p>
                  <p className="text-sm font-medium text-gray-900">{selectedPayment.failure_reason}</p>
                  {selectedPayment.failure_message && (
                    <p className="text-sm text-gray-600 mt-1">{selectedPayment.failure_message}</p>
                  )}
                  {selectedPayment.failure_code && (
                    <p className="text-sm text-gray-500 mt-1">Code: {selectedPayment.failure_code}</p>
                  )}
                </div>
              )}
              {selectedPayment.cart_items && selectedPayment.cart_items.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Cart Items</p>
                  <div className="space-y-2">
                    {selectedPayment.cart_items.map((item: any, index: number) => (
                      <div key={index} className="border border-gray-200 rounded p-2">
                        <p className="text-sm font-medium">{item.name || item.title}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {formatCurrency(item.price || 0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedPayment.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedPayment.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

