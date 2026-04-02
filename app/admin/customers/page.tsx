'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Mail, Phone, Calendar, ShoppingBag, DollarSign, Eye, Edit, Plus, Loader2, ChevronRight, ChevronLeft, Upload, Send, CheckSquare, Square, Users, Filter, Lock, ChevronDown, ChevronUp, Package } from 'lucide-react'
import Link from 'next/link'
import { getCustomersWithStats, getCustomerAggregateStats } from '@/app/actions/users'
import { backfillCustomersFromOrders, getOrdersWithoutCustomer } from '@/app/actions/orders'
import { createSegmentForZeroCustomers, sendTemporaryPasswordToCustomer, sendBulkTemporaryPasswords } from '@/app/actions/customers'
import { migrateAddressesFromOrders, migratePaymentMethodsFromOrders } from '@/app/actions/migrations'
import { toast } from 'sonner'

export default function CustomersPage() {
  const supabase = createClient()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [backfilling, setBackfilling] = useState(false)
  const [migratingAddresses, setMigratingAddresses] = useState(false)
  const [migratingPaymentMethods, setMigratingPaymentMethods] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [segmentName, setSegmentName] = useState('')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [sendingTemporaryPasswords, setSendingTemporaryPasswords] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showSegmentModal, setShowSegmentModal] = useState(false)
  const [segmentType, setSegmentType] = useState<'orders' | 'spent'>('orders')
  const [newSegmentName, setNewSegmentName] = useState('')
  const [creatingSegment, setCreatingSegment] = useState(false)
  const [guestOrders, setGuestOrders] = useState<Array<{ id: string; orderNumber: string; customerEmail: string; customerName: string; total: number; createdAt: string }>>([])
  const [guestOrdersLoading, setGuestOrdersLoading] = useState(false)
  const [showGuestOrders, setShowGuestOrders] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [aggregateStats, setAggregateStats] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  })

  // Load customers with debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers()
    }, searchTerm ? 300 : 0) // 300ms debounce only if there's a search term

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, currentPage, pageSize, filterStatus])

  // Load aggregate stats (only when filter changes, not on search/pagination)
  useEffect(() => {
    loadAggregateStats()
  }, [filterStatus])

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (searchTerm) {
      setCurrentPage(1)
    }
  }, [searchTerm])

  // Check if table is scrollable and show scroll button
  useEffect(() => {
    const checkScrollable = () => {
      if (tableRef.current) {
        const { scrollWidth, clientWidth } = tableRef.current
        setShowScrollButton(scrollWidth > clientWidth)
      }
    }

    checkScrollable()
    window.addEventListener('resize', checkScrollable)
    return () => window.removeEventListener('resize', checkScrollable)
  }, [customers])

  const handleCsvImport = async (file: File) => {
    if (!file) return

    setImporting(true)
    let totalImported = 0
    let totalUpdated = 0
    let totalErrors = 0
    let chunkIndex = 0
    let csvData: string | undefined = undefined
    let importStartTime: string | undefined = undefined
    let createdSegmentId: string | undefined = undefined

    try {
      // Process in chunks to avoid Vercel's 60-second timeout
      while (true) {
        const formData = new FormData()
        if (chunkIndex === 0) {
          formData.append('file', file)
        } else if (csvData) {
          formData.append('csvData', csvData)
        } else {
          throw new Error('Missing CSV data for chunk processing')
        }
        formData.append('chunkIndex', chunkIndex.toString())
        if (segmentName.trim()) {
          formData.append('segmentName', segmentName.trim())
        }
        if (importStartTime) {
          formData.append('importStartTime', importStartTime)
        }

        // Set timeout for each chunk (55 seconds to be safe - Vercel Pro has 60s limit)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 55000)

        const response = await fetch('/api/admin/customers/import', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `Server error: ${response.status}`
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error || errorMessage
          } catch {
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Import failed')
        }

        // Accumulate results
        totalImported += result.imported || 0
        totalUpdated += result.updated || 0
        totalErrors += result.errors || 0

        // Store CSV data for next chunk if available
        if (result.csvData) {
          csvData = result.csvData
        }
        
        // Store import start time for next chunk if available
        if (result.importStartTime) {
          importStartTime = result.importStartTime
        }
        
        // Store segment ID if created
        if (result.segmentId) {
          createdSegmentId = result.segmentId
        }

        // Show progress
        if (result.hasMore) {
          const progress = Math.round((result.processed / result.total) * 100)
          toast.loading(`Importing customers... ${result.processed} of ${result.total} (${progress}%)`, {
            id: 'import-progress',
            duration: Infinity,
          })
        }

        // If there are more chunks, continue processing
        if (result.hasMore && result.remaining > 0) {
          chunkIndex++
          // Small delay before next chunk to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        } else {
          // Import completed
          toast.dismiss('import-progress')
          let message = result.message || 
            `${totalImported} new customers imported, ${totalUpdated} existing customers updated, ${totalErrors} errors`
          
          // Add segment info if segment was created
          if (createdSegmentId && segmentName.trim()) {
            const segmentLink = `/admin/email-marketing/segments`
            message += ` Segment "${segmentName}" has been created with customers who have valid email addresses.`
          }
          
          toast.success('Customers imported successfully', {
            description: message,
            duration: 10000,
          })
          setShowImportModal(false)
          setSelectedFile(null)
          setSegmentName('')
          if (fileInputRef.current) fileInputRef.current.value = ''
          loadCustomers() // Reload to show new customers
          break
        }
      }
    } catch (error: any) {
      console.error('Error importing customers:', error)
      toast.dismiss('import-progress')
      if (error.name === 'AbortError') {
        toast.error('Import timeout', {
          description: `Partially imported: ${totalImported} imported, ${totalUpdated} updated, ${totalErrors} errors. The import timed out. You can try importing again - existing customers will be updated, not duplicated.`,
          duration: 15000,
        })
      } else {
        toast.error('Import failed', {
          description: error.message || 'An unexpected error occurred',
        })
      }
    } finally {
      setImporting(false)
    }
  }

  const handleBackfill = async () => {
    if (!confirm('This will create customer accounts for all orders that don\'t have a linked customer. Continue?')) {
      return
    }

    setBackfilling(true)
    try {
      const result = await backfillCustomersFromOrders()
      if (result.success) {
        toast.success("Customers backfilled successfully", {
          description: result.message,
        })
        await Promise.all([
          loadCustomers(),
          loadAggregateStats(),
          loadGuestOrders(),
        ])
      } else {
        toast.error("Backfill completed with issues", {
          description: result.error || result.message || "No customers could be created or linked. See Orders without customer account below.",
        })
      }
    } catch (error: any) {
      console.error('Error backfilling customers:', error)
      toast.error("Failed to backfill customers", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setBackfilling(false)
    }
  }

  const handleMigrateAddresses = async () => {
    if (!confirm('This will migrate addresses from orders to customer accounts. Continue?')) {
      return
    }

    setMigratingAddresses(true)
    try {
      const result = await migrateAddressesFromOrders()
      if (result.success) {
        toast.success("Addresses migrated successfully", {
          description: result.message,
        })
      } else {
        toast.error("Failed to migrate addresses", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      console.error('Error migrating addresses:', error)
      toast.error("Failed to migrate addresses", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setMigratingAddresses(false)
    }
  }

  const handleMigratePaymentMethods = async () => {
    if (!confirm('This will migrate payment methods from orders to customer accounts. Continue?')) {
      return
    }

    setMigratingPaymentMethods(true)
    try {
      const result = await migratePaymentMethodsFromOrders()
      if (result.success) {
        toast.success("Payment methods migrated successfully", {
          description: result.message,
        })
      } else {
        toast.error("Failed to migrate payment methods", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      console.error('Error migrating payment methods:', error)
      toast.error("Failed to migrate payment methods", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setMigratingPaymentMethods(false)
    }
  }

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const result = await getCustomersWithStats('customer', {
        page: currentPage,
        pageSize: pageSize,
        search: searchTerm,
      })
      if (result.data) {
        setCustomers(result.data)
        setTotalCustomers(result.total || 0)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAggregateStats = async () => {
    try {
      const stats = await getCustomerAggregateStats('customer')
      setAggregateStats(stats)
    } catch (error) {
      console.error('Error loading aggregate stats:', error)
    }
  }

  const loadGuestOrders = async () => {
    setGuestOrdersLoading(true)
    try {
      const result = await getOrdersWithoutCustomer(200)
      if (result.data) setGuestOrders(result.data)
    } catch (error) {
      console.error('Error loading guest orders:', error)
    } finally {
      setGuestOrdersLoading(false)
    }
  }

  // Customers are already filtered server-side, but we can still filter by status client-side
  const filteredCustomers = customers.filter(customer => {
    if (filterStatus === 'active') {
      return (customer.orderCount || 0) > 0
    }
    if (filterStatus === 'inactive') {
      return (customer.orderCount || 0) === 0
    }
    return true
  })

  const getCustomerName = (customer: any) => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name} ${customer.last_name}`
    }
    return customer.email?.split('@')[0] || 'Customer'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerId)) {
        newSet.delete(customerId)
      } else {
        newSet.add(customerId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)))
    }
  }


  const handleSendTemporaryPasswordToSingle = async (customerId: string) => {
    setSendingTemporaryPasswords(true)
    try {
      const result = await sendTemporaryPasswordToCustomer(customerId)
      if (result.success) {
        toast.success('Temporary password sent successfully')
      } else {
        toast.error(result.error || 'Failed to send temporary password')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send temporary password')
    } finally {
      setSendingTemporaryPasswords(false)
    }
  }

  const handleSendTemporaryPasswords = async (customerIds?: string[]) => {
    const idsToSend = customerIds || Array.from(selectedCustomers)
    if (idsToSend.length === 0) {
      toast.error('Please select at least one customer')
      return
    }

    setSendingTemporaryPasswords(true)
    try {
      const result = await sendBulkTemporaryPasswords(idsToSend)
      if (result.success) {
        toast.success(result.message || 'Temporary passwords sent successfully')
      } else {
        toast.error(result.error || 'Failed to send temporary passwords')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send temporary passwords')
    } finally {
      setSendingTemporaryPasswords(false)
    }
  }

  const handleCreateSegment = async () => {
    if (!newSegmentName.trim()) {
      toast.error('Please enter a segment name')
      return
    }

    setCreatingSegment(true)
    try {
      const result = await createSegmentForZeroCustomers(newSegmentName.trim(), segmentType)
      if (result.success) {
        toast.success(result.message || 'Segment created successfully')
        setShowSegmentModal(false)
        setNewSegmentName('')
      } else {
        toast.error(result.error || 'Failed to create segment')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create segment')
    } finally {
      setCreatingSegment(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-gray-600 mt-1">Manage your customer base</p>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-2 max-w-2xl">
            Customers below have an account. Guest checkouts that could not be linked (e.g. due to auth errors) appear under <strong>Orders without customer account</strong> — you can open the order from there.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowImportModal(true)}
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import from CSV
          </Button>
          <Button
            onClick={handleBackfill}
            disabled={backfilling || migratingAddresses || migratingPaymentMethods}
            variant="outline"
            className="bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100"
          >
            {backfilling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Backfilling...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Backfill Customers from Orders
              </>
            )}
          </Button>
          <Button
            onClick={handleMigrateAddresses}
            disabled={backfilling || migratingAddresses || migratingPaymentMethods}
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
          >
            {migratingAddresses ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Migrate Addresses
              </>
            )}
          </Button>
          <Button
            onClick={handleMigratePaymentMethods}
            disabled={backfilling || migratingAddresses || migratingPaymentMethods}
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            {migratingPaymentMethods ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Migrate Payment Methods
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowSegmentModal(true)}
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
          >
            <Filter className="mr-2 h-4 w-4" />
            Create Segment
          </Button>
          <Link href="/admin/customers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Customer
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Customers</div>
          <div className="text-2xl font-bold">{aggregateStats.totalCustomers.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Orders</div>
          <div className="text-2xl font-bold">{aggregateStats.totalOrders.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Revenue</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(aggregateStats.totalRevenue)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Avg Order Value</div>
          <div className="text-2xl font-bold">
            {formatCurrency(aggregateStats.avgOrderValue)}
          </div>
        </div>
      </div>

      {/* Orders without customer account (guest orders that couldn't be linked) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setShowGuestOrders(!showGuestOrders)
            if (!showGuestOrders && guestOrders.length === 0 && !guestOrdersLoading) loadGuestOrders()
          }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <Package className="h-5 w-5 text-amber-500" />
            Orders without customer account
            {guestOrders.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({guestOrders.length} order{guestOrders.length !== 1 ? 's' : ''})</span>
            )}
          </span>
          {showGuestOrders ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
        </button>
        {showGuestOrders && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/50">
            {guestOrdersLoading ? (
              <div className="flex items-center gap-2 py-4 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading...
              </div>
            ) : guestOrders.length === 0 ? (
              <p className="text-gray-600 py-4">No orders without a linked customer account.</p>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200">
                      <th className="pb-2 pr-4">Order</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Customer</th>
                      <th className="pb-2 pr-4">Email</th>
                      <th className="pb-2 pr-4">Total</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestOrders.map((o) => (
                      <tr key={o.id} className="border-b border-gray-100 hover:bg-white">
                        <td className="py-2 pr-4 font-mono text-gray-800">{o.orderNumber}</td>
                        <td className="py-2 pr-4 text-gray-600">
                          {new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="py-2 pr-4">{o.customerName}</td>
                        <td className="py-2 pr-4">{o.customerEmail}</td>
                        <td className="py-2 pr-4">{formatCurrency(Number(o.total))}</td>
                        <td className="py-2">
                          <Link href={`/admin/orders/${o.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                            <Eye className="h-4 w-4" /> View order
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters and Pagination Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value as any)
            setCurrentPage(1)
          }}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Customers</option>
          <option value="active">Active (with orders)</option>
          <option value="inactive">Inactive (no orders)</option>
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value))
            setCurrentPage(1)
          }}
          className="px-4 py-2 border rounded-md"
        >
          <option value="10">10 per page</option>
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCustomers.size > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-medium text-teal-900">
              {selectedCustomers.size} customer{selectedCustomers.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSendTemporaryPasswords()}
              disabled={sendingTemporaryPasswords}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendingTemporaryPasswords ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Send Temporary Passwords ({selectedCustomers.size})
                </>
              )}
            </Button>
            <Button
              onClick={() => setSelectedCustomers(new Set())}
              variant="outline"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Menu */}
      <div className="mb-4 flex gap-2">
        {/* Magic links removed - using temporary passwords instead */}
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading customers...</p>
        </div>
      ) : (
        <div className="relative">
          <div 
            ref={tableRef}
            className="bg-white border rounded-lg overflow-x-auto"
            style={{ scrollBehavior: 'smooth' }}
          >
            <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center"
                    title={selectedCustomers.size === filteredCustomers.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-teal-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Orders</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Total Spent</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Last Order</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Member Since</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleSelectCustomer(customer.id)}
                        className="flex items-center justify-center"
                      >
                        {selectedCustomers.has(customer.id) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                          {customer.first_name?.[0]?.toUpperCase() || customer.email?.[0]?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <p className="font-medium">{getCustomerName(customer)}</p>
                          {customer.first_name && customer.last_name && (
                            <p className="text-xs text-gray-500">{customer.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <ShoppingBag className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{customer.orderCount || 0}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-medium">{formatCurrency(customer.totalSpent || 0)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {customer.lastOrderDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(customer.lastOrderDate).toLocaleDateString()}
                        </div>
                      ) : (
                        'No orders'
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Link href={`/admin/customers/${customer.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/customers/${customer.id}/edit`}>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendTemporaryPasswordToSingle(customer.id)}
                          disabled={sendingTemporaryPasswords}
                          title="Send temporary password"
                        >
                          {sendingTemporaryPasswords ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          
          {/* Scroll to Right Button */}
          {showScrollButton && (
            <button
              onClick={() => {
                if (tableRef.current) {
                  tableRef.current.scrollBy({ left: 300, behavior: 'smooth' })
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-l-lg shadow-lg transition-colors z-10"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalCustomers > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCustomers)} of {totalCustomers.toLocaleString()} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {(() => {
                const totalPages = Math.ceil(totalCustomers / pageSize)
                const pagesToShow = Math.min(5, totalPages)
                const pages: number[] = []
                
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else if (currentPage <= 3) {
                  for (let i = 1; i <= 5; i++) {
                    pages.push(i)
                  }
                } else if (currentPage >= totalPages - 2) {
                  for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  for (let i = currentPage - 2; i <= currentPage + 2; i++) {
                    pages.push(i)
                  }
                }
                
                return pages.map(pageNum => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                ))
              })()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCustomers / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCustomers / pageSize)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Import Customers from CSV</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload a Shopify customer export CSV file. The import will create customer profiles and addresses.
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0])
                    } else {
                      setSelectedFile(null)
                    }
                  }}
                />
                {selectedFile && (
                  <div className="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                    <p className="text-sm text-teal-800">
                      <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </p>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment Name (Optional)
                </label>
                <input
                  type="text"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g., Black Friday 2024 Import"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  If provided, a segment will be automatically created for these imported customers, allowing you to send targeted emails.
                </p>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Supported fields:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>Customer ID, First Name, Last Name, Email</li>
                  <li>Phone, Default Address fields</li>
                  <li>Accepts Email Marketing (for email subscribers)</li>
                  <li>Total Spent, Total Orders</li>
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              {importing ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing customers... This may take a few minutes.</span>
                </div>
              ) : (
                <div></div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowImportModal(false)
                    setSelectedFile(null)
                    setSegmentName('')
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  variant="outline"
                  disabled={importing}
                >
                  Cancel
                </Button>
                {selectedFile && (
                  <Button
                    onClick={() => handleCsvImport(selectedFile)}
                    disabled={importing}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Import Customers
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Segment Modal */}
      {showSegmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Create Customer Segment</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create a segment for customers with 0 orders or $0 spent
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment Name
                </label>
                <input
                  type="text"
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  placeholder="e.g., Inactive Customers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment Type
                </label>
                <select
                  value={segmentType}
                  onChange={(e) => setSegmentType(e.target.value as 'orders' | 'spent')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="orders">Customers with 0 orders</option>
                  <option value="spent">Customers with $0 spent</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <Button
                onClick={() => {
                  setShowSegmentModal(false)
                  setNewSegmentName('')
                }}
                variant="outline"
                disabled={creatingSegment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSegment}
                disabled={creatingSegment || !newSegmentName.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {creatingSegment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Filter className="mr-2 h-4 w-4" />
                    Create Segment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


