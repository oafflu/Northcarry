'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { acknowledgeOrder, updateOrderStatus, getSupplierOrderCost, bulkAcknowledgeOrders, bulkUpdateOrderStatus } from '@/app/actions/suppliers'
import Link from 'next/link'
import { Eye, Package, Truck, RefreshCw, Info, CheckSquare, Square, Download, Calendar, Upload, FileSpreadsheet } from 'lucide-react'
import { useTranslation } from '@/lib/translations/supplier/context'
import { toast } from 'sonner'
import { bulkUpdateShipping } from '@/app/actions/suppliers'
import * as XLSX from 'xlsx'

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom'

export default function SupplierOrdersPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('pending')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assignmentsExist, setAssignmentsExist] = useState(false)
  const [orderAccessError, setOrderAccessError] = useState<string | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDateRange, setShowCustomDateRange] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [orderCosts, setOrderCosts] = useState<Map<string, number>>(new Map())
  const [bulkAcknowledging, setBulkAcknowledging] = useState(false)
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<'processing' | 'ready' | 'shipped' | 'acknowledged'>('processing')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const [ordersPerPage] = useState(50) // Limit orders per page for performance

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
    loadOrders()
  }, [activeTab, dateFilter, customStartDate, customEndDate])

  useEffect(() => {
    loadOrders()
  }, [currentPage])
    
  const loadOrders = async () => {
    setLoading(true)
    try {
      // Use user from useAuth() - already authenticated by layout
      if (!user) {
        setOrders([])
        setLoading(false)
        return
      }
      
      // Use user.id directly - no need for intermediate variable

      // Calculate date range based on filter
      let startDate: Date | null = null
      let endDate: Date | null = null

      if (dateFilter === 'today') {
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
      } else if (dateFilter === 'week') {
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
        startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'month') {
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
        startDate = new Date(endDate)
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
      }

      // First, get total count for pagination
      // Only count orders that are paid (suppliers should only see paid orders)
      // We need to join with orders to filter by payment_status
      let countQuery = supabase
        .from('supplier_order_assignments')
        .select('id, orders!inner(id, payment_status)', { count: 'exact', head: true })
        .eq('supplier_id', user.id)
        .eq('orders.payment_status', 'paid')

      if (activeTab !== 'all') {
        countQuery = countQuery.eq('assignment_status', activeTab)
      }

      if (startDate && endDate) {
        countQuery = countQuery.gte('created_at', startDate.toISOString())
        countQuery = countQuery.lte('created_at', endDate.toISOString())
      }

      const { count, error: countError } = await countQuery
      setTotalOrders(count || 0)

      // Calculate pagination
      const offset = (currentPage - 1) * ordersPerPage

      // Now get assignments with order details (with pagination)
      // Optimized query - removed deeply nested product_variants to improve performance
      // Only show orders that are paid (suppliers should only fulfill paid orders)
    let query = supabase
      .from('supplier_order_assignments')
      .select(`
          id,
          order_id,
          supplier_id,
          assignment_status,
          acknowledged_at,
          processing_started_at,
          ready_at,
          shipped_at,
          carrier,
          tracking_number,
          created_at,
          orders!inner (
            id,
          order_number,
          total,
          created_at,
          customer_email,
          customer_first_name,
            customer_last_name,
            customer_phone,
            payment_status,
            fulfillment_status,
            shipping_address,
            order_items (
              id,
              product_title,
              variant_color,
              sku,
              quantity
            )
          )
        `)
        .eq('supplier_id', user.id)
        .eq('orders.payment_status', 'paid') // Only show paid orders
      .order('created_at', { ascending: false })
        .range(offset, offset + ordersPerPage - 1) // Add pagination

    if (activeTab !== 'all') {
      query = query.eq('assignment_status', activeTab)
    }

      // Apply date filter
      if (startDate && endDate) {
        query = query.gte('created_at', startDate.toISOString())
        query = query.lte('created_at', endDate.toISOString())
      }

    const { data, error } = await query

    if (error) {
      console.error('Error loading orders:', error)
      setOrders([])
      setOrderAccessError(error.message || 'Failed to load orders')
    } else {
      setOrders(data || [])
      setOrderAccessError(null)
      setAssignmentsExist((data?.length || 0) > 0)
        
        // Calculate supplier costs for orders on current page only (for performance)
        // Defer cost calculation to avoid blocking initial render - calculate in background
        if (data && data.length > 0 && user) {
          // Set empty map first for immediate render
          setOrderCosts(new Map())
          
          // Calculate costs in background without blocking
          Promise.allSettled(
            data.map(async (assignment: any) => {
              if (assignment.order_id) {
                try {
                  const costResult = await getSupplierOrderCost(assignment.order_id, user.id)
                  if (costResult.success) {
                    setOrderCosts(prev => {
                      const newMap = new Map(prev)
                      newMap.set(assignment.order_id, costResult.cost)
                      return newMap
                    })
                  }
                } catch (error) {
                  // Silently fail - cost calculation is optional
                }
              }
            })
          ).catch(() => {
            // Silently fail - cost calculation is optional
          })
        }
      }
    } catch (err) {
      console.error('Unexpected error loading orders:', err)
      setOrders([])
    } finally {
    setLoading(false)
    }
  }

  const handleAcknowledge = async (assignmentId: string) => {
    try {
    const result = await acknowledgeOrder(assignmentId)
    if (result.success) {
        toast.success("Order acknowledged successfully", {
          description: "The order has been acknowledged and moved to processing.",
        })
      loadOrders()
    } else {
        toast.error("Failed to acknowledge order", {
          description: result.error || t('orders.failedToAcknowledge'),
        })
      }
    } catch (error: any) {
      console.error('Error acknowledging order:', error)
      toast.error("Failed to acknowledge order", {
        description: error.message || "An unexpected error occurred",
      })
    }
  }

  const handleBulkAcknowledge = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Please select at least one order')
      return
    }

    // Get assignment IDs for selected orders that are pending
    const pendingAssignments = orders.filter(
      assignment => 
        selectedOrders.has(assignment.order_id) && 
        assignment.assignment_status === 'pending'
    )

    if (pendingAssignments.length === 0) {
      toast.error('No pending orders selected. Please select pending orders to acknowledge.')
      return
    }

    const assignmentIds = pendingAssignments.map(a => a.id)

    setBulkAcknowledging(true)
    try {
      const result = await bulkAcknowledgeOrders(assignmentIds)
      if (result.success) {
        toast.success(`Successfully acknowledged ${result.acknowledged} order(s)`, {
          description: result.acknowledged < assignmentIds.length 
            ? `${assignmentIds.length - result.acknowledged} order(s) were not pending and were skipped.`
            : 'All selected orders have been acknowledged.',
        })
        setSelectedOrders(new Set()) // Clear selection
        loadOrders()
      } else {
        toast.error("Failed to acknowledge orders", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      console.error('Error bulk acknowledging orders:', error)
      toast.error("Failed to acknowledge orders", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setBulkAcknowledging(false)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.size === 0) {
      toast.error('Please select at least one order')
      return
    }

    // Get assignment IDs for selected orders
    const selectedAssignments = orders.filter(
      assignment => selectedOrders.has(assignment.order_id)
    )

    if (selectedAssignments.length === 0) {
      toast.error('No valid orders selected')
      return
    }

    const assignmentIds = selectedAssignments.map(a => a.id)

    setBulkUpdating(true)
    try {
      const result = await bulkUpdateOrderStatus(assignmentIds, selectedStatus)
      if (result.success) {
        toast.success(`Successfully updated ${result.updated} order(s) to ${selectedStatus}`, {
          description: result.skipped > 0 
            ? `${result.skipped} order(s) were skipped (invalid status transition).`
            : 'All selected orders have been updated.',
        })
        setSelectedOrders(new Set()) // Clear selection
        setShowBulkStatusDialog(false)
        loadOrders()
      } else {
        toast.error("Failed to update orders", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      console.error('Error bulk updating orders:', error)
      toast.error("Failed to update orders", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setBulkUpdating(false)
    }
  }

  const [showShipDialog, setShowShipDialog] = useState(false)
  const [shipAssignmentId, setShipAssignmentId] = useState<string | null>(null)
  const [shipCarrier, setShipCarrier] = useState('')
  const [shipTrackingNumber, setShipTrackingNumber] = useState('')
  const [shipEstimatedDelivery, setShipEstimatedDelivery] = useState('')
  const [shipping, setShipping] = useState(false)

  const handleShip = async (assignmentId: string) => {
    setShipAssignmentId(assignmentId)
    setShowShipDialog(true)
  }

  const handleConfirmShip = async () => {
    if (!shipCarrier || !shipTrackingNumber) {
      toast.error("Carrier and tracking number are required")
      return
    }

    if (!shipAssignmentId) return

    setShipping(true)
    try {
      const result = await updateOrderStatus(shipAssignmentId, 'shipped', {
        carrier: shipCarrier,
        tracking_number: shipTrackingNumber,
        estimated_delivery_date: shipEstimatedDelivery || undefined
      })
      if (result.success) {
        toast.success("Order marked as shipped", {
          description: `Tracking: ${shipTrackingNumber} (${shipCarrier})`,
        })
        setShowShipDialog(false)
        setShipCarrier('')
        setShipTrackingNumber('')
        setShipEstimatedDelivery('')
        setShipAssignmentId(null)
        loadOrders()
      } else {
        toast.error("Failed to update order status", {
          description: result.error || t('orders.failedToUpdate'),
        })
      }
    } catch (error: any) {
      console.error('Error shipping order:', error)
      toast.error("Failed to update order status", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setShipping(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      shipped: 'bg-teal-100 text-teal-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t('orders.pending'),
      acknowledged: t('orders.acknowledged'),
      processing: t('orders.processing'),
      ready: t('orders.ready'),
      shipped: t('orders.shipped'),
      delivered: t('orders.delivered'),
      cancelled: t('orders.cancelled'),
    }
    return statusMap[status] || status
  }

  const getTabLabel = (tab: string) => {
    if (tab === 'all') return t('orders.allOrders')
    return getStatusLabel(tab)
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(orders.map(a => a.order_id).filter(Boolean)))
    }
  }

  const getFilteredOrders = () => {
    return orders.filter(assignment => {
      const order = assignment.orders
      if (!order) return false
      return true
    })
  }

  const exportToCSV = () => {
    const filteredOrders = getFilteredOrders()
    const selectedOrderIds = Array.from(selectedOrders)
    const ordersToExport = selectedOrderIds.length > 0
      ? filteredOrders.filter(a => selectedOrderIds.includes(a.order_id))
      : filteredOrders

    if (ordersToExport.length === 0) {
      toast.error('No orders to export')
      return
    }

    const headers = [
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Total',
      'Status',
      'Payment Status',
      'Fulfillment Status',
      'Date',
      'Carrier',
      'Tracking Number'
    ]

    const rows = ordersToExport.map(assignment => {
      const order = assignment.orders
      return [
        order?.order_number || '',
        order?.customer_first_name && order?.customer_last_name
          ? `${order.customer_first_name} ${order.customer_last_name}`
          : '',
        order?.customer_email || '',
        `$${parseFloat(order?.total?.toString() || '0').toFixed(2)}`,
        getStatusLabel(assignment.assignment_status),
        order?.payment_status || 'pending',
        order?.fulfillment_status || 'unfulfilled',
        order?.created_at ? new Date(order.created_at).toLocaleDateString() : '',
        assignment.carrier || '',
        assignment.tracking_number || ''
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const dateStr = new Date().toISOString().split('T')[0]
    const statusStr = activeTab !== 'all' ? `-${activeTab}` : ''
    a.download = `supplier-orders-${dateStr}${statusStr}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    
    toast.success(`Exported ${ordersToExport.length} order(s) to CSV`)
  }

  const exportToExcel = () => {
    const filteredOrders = getFilteredOrders()
    const selectedOrderIds = Array.from(selectedOrders)
    const ordersToExport = selectedOrderIds.length > 0
      ? filteredOrders.filter(a => selectedOrderIds.includes(a.order_id))
      : filteredOrders

    if (ordersToExport.length === 0) {
      toast.error('No orders to export')
      return
    }

    // Prepare data for Excel with all required fields
    const excelData = ordersToExport.map(assignment => {
      const order = assignment.orders
      const shippingAddress = order?.shipping_address || {}
      const recipientName = order?.customer_first_name && order?.customer_last_name
        ? `${order.customer_first_name} ${order.customer_last_name}`
        : order?.customer_first_name || order?.customer_last_name || ''
      
      // Get product variants/options as ordered by customer
      const orderItems = order?.order_items || []
      const productVariants = orderItems.map((item: any) => {
        const variantName = item.product_variants?.color || item.variant_color || item.sku || ''
        const quantity = item.quantity || 1
        return `${item.product_title || ''} - ${variantName} (Qty: ${quantity})`
      }).join('; ') || ''

      return {
        'Order ID': order?.id || '',
        'Order Number': order?.order_number || '',
        "Recipient's Name": recipientName,
        'Address': shippingAddress.address_line1 || '',
        'City': shippingAddress.city || '',
        'Postal Code': shippingAddress.postal_code || '',
        'Country': shippingAddress.country || '',
        'Phone Number': order?.customer_phone || '',
        'Product Option/Variant': productVariants,
        'Customer Email': order?.customer_email || '',
        'Total Cost': (orderCosts.get(assignment.order_id) || 0).toFixed(2),
        'Status': getStatusLabel(assignment.assignment_status),
        'Payment Status': order?.payment_status || 'pending',
        'Fulfillment Status': order?.fulfillment_status || 'unfulfilled',
        'Date': order?.created_at ? new Date(order.created_at).toLocaleDateString() : '',
        'Carrier': assignment.carrier || '',
        'Tracking Number': assignment.tracking_number || '',
        'Estimated Delivery': assignment.estimated_delivery_date || '',
      }
    })

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    const colWidths = [
      { wch: 36 }, // Order ID
      { wch: 15 }, // Order Number
      { wch: 25 }, // Recipient's Name
      { wch: 30 }, // Address
      { wch: 15 }, // City
      { wch: 12 }, // Postal Code
      { wch: 12 }, // Country
      { wch: 15 }, // Phone Number
      { wch: 40 }, // Product Option/Variant
      { wch: 25 }, // Customer Email
      { wch: 12 }, // Total Cost
      { wch: 15 }, // Status
      { wch: 15 }, // Payment Status
      { wch: 18 }, // Fulfillment Status
      { wch: 12 }, // Date
      { wch: 15 }, // Carrier
      { wch: 20 }, // Tracking Number
      { wch: 18 }, // Estimated Delivery
    ]
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, 'Orders')

    // Generate file name
    const dateStr = new Date().toISOString().split('T')[0]
    const statusStr = activeTab !== 'all' ? `-${activeTab}` : ''
    const fileName = `supplier-orders-${dateStr}${statusStr}.xlsx`

    // Write file
    XLSX.writeFile(wb, fileName)
    
    toast.success(`Exported ${ordersToExport.length} order(s) to Excel`)
  }

  const exportToPDF = () => {
    const filteredOrders = getFilteredOrders()
    const selectedOrderIds = Array.from(selectedOrders)
    const ordersToExport = selectedOrderIds.length > 0
      ? filteredOrders.filter(a => selectedOrderIds.includes(a.order_id))
      : filteredOrders

    if (ordersToExport.length === 0) {
      toast.error('No orders to export')
      return
    }

    // Create a printable HTML table
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to export PDF')
      return
    }

    const dateStr = new Date().toLocaleDateString()
    const statusStr = activeTab !== 'all' ? getStatusLabel(activeTab) : 'All Orders'
    const filterStr = dateFilter !== 'all' ? ` - ${dateFilter}` : ''

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Supplier Orders Export</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              color: #14b8a6;
              margin-bottom: 10px;
            }
            .meta {
              color: #666;
              margin-bottom: 20px;
              font-size: 14px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #f3f4f6;
              padding: 10px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: bold;
            }
            td {
              padding: 8px;
              border: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h1>Supplier Orders Report</h1>
          <div class="meta">
            <p><strong>Status:</strong> ${statusStr}${filterStr}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Total Orders:</strong> ${ordersToExport.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer Name</th>
                <th>Customer Email</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment Status</th>
                <th>Date</th>
                <th>Tracking</th>
              </tr>
            </thead>
            <tbody>
              ${ordersToExport.map(assignment => {
                const order = assignment.orders
                return `
                  <tr>
                    <td>${order?.order_number || ''}</td>
                    <td>${order?.customer_first_name && order?.customer_last_name
                      ? `${order.customer_first_name} ${order.customer_last_name}`
                      : ''}</td>
                    <td>${order?.customer_email || ''}</td>
                    <td>${(orderCosts.get(assignment.order_id) || 0).toFixed(2)}</td>
                    <td>${getStatusLabel(assignment.assignment_status)}</td>
                    <td>${order?.payment_status || 'pending'}</td>
                    <td>${order?.created_at ? new Date(order.created_at).toLocaleDateString() : ''}</td>
                    <td>${assignment.tracking_number || ''}</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print()
      toast.success(`Exported ${ordersToExport.length} order(s) to PDF`)
    }, 250)
  }

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter)
    if (filter === 'custom') {
      setShowCustomDateRange(true)
    } else {
      setShowCustomDateRange(false)
      setCustomStartDate('')
      setCustomEndDate('')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ]
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      toast.error('Please upload a valid Excel file (.xlsx, .xls) or CSV file')
      return
    }

    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (data.length === 0) {
        toast.error('Excel file is empty')
        setUploading(false)
        return
      }

      // Validate required columns - check for exact matches first, then case-insensitive partial matches
      const requiredColumns = ['Order Number', 'Carrier', 'Tracking Number']
      const firstRow = data[0]
      const rowKeys = Object.keys(firstRow)
      
      // Check for exact matches first
      const hasExactMatch = requiredColumns.every(col => 
        rowKeys.includes(col)
      )
      
      // If no exact match, check for case-insensitive partial matches
      const hasPartialMatch = !hasExactMatch && requiredColumns.every(col => {
        const normalizedCol = col.toLowerCase().replace(/\s+/g, '')
        return rowKeys.some(key => {
          const normalizedKey = key.toLowerCase().replace(/\s+/g, '')
          return normalizedKey.includes(normalizedCol) || normalizedCol.includes(normalizedKey)
        })
      })

      if (!hasExactMatch && !hasPartialMatch) {
        toast.error(`Excel file must contain columns: Order Number, Carrier, Tracking Number. Found columns: ${rowKeys.join(', ')}`)
        setUploading(false)
        return
      }

      // Parse data - prioritize exact matches, then case-insensitive partial matches
      const updates = data.map((row: any) => {
        // Try exact match first
        let orderNumberKey = rowKeys.find(k => k === 'Order Number')
        if (!orderNumberKey) {
          orderNumberKey = rowKeys.find(k => 
            k.toLowerCase().replace(/\s+/g, '').includes('ordernumber') ||
            (k.toLowerCase().includes('order') && k.toLowerCase().includes('number'))
          ) || 'Order Number'
        }
        
        let carrierKey = rowKeys.find(k => k === 'Carrier')
        if (!carrierKey) {
          carrierKey = rowKeys.find(k => 
            k.toLowerCase().includes('carrier')
          ) || 'Carrier'
        }
        
        let trackingKey = rowKeys.find(k => k === 'Tracking Number')
        if (!trackingKey) {
          trackingKey = rowKeys.find(k => 
            k.toLowerCase().replace(/\s+/g, '').includes('trackingnumber') ||
            (k.toLowerCase().includes('tracking') && k.toLowerCase().includes('number'))
          ) || 'Tracking Number'
        }
        
        const deliveryKey = rowKeys.find(k => 
          k === 'Estimated Delivery' ||
          k.toLowerCase().includes('delivery') || 
          k.toLowerCase().includes('estimated')
        )

        return {
          orderNumber: String(row[orderNumberKey] || '').trim(),
          carrier: String(row[carrierKey] || '').trim(),
          trackingNumber: String(row[trackingKey] || '').trim(),
          estimatedDeliveryDate: deliveryKey ? String(row[deliveryKey] || '').trim() : undefined,
        }
      }).filter(update => 
        update.orderNumber && update.carrier && update.trackingNumber
      )

      if (updates.length === 0) {
        toast.error('No valid shipping data found in Excel file')
        setUploading(false)
        return
      }

      // Call bulk update
      const result = await bulkUpdateShipping(updates)

      if (result.success) {
        toast.success(result.message || `Successfully updated ${result.successCount} order(s)`, {
          description: result.failedCount > 0 
            ? `${result.failedCount} order(s) failed. Check console for details.`
            : undefined,
          duration: 5000,
        })
        
        if (result.errors.length > 0) {
          console.error('Bulk update errors:', result.errors)
        }
        
        // Reload orders
        loadOrders()
        setShowUploadDialog(false)
      } else {
        toast.error(result.error || 'Failed to update orders')
      }
    } catch (error: any) {
      console.error('Error processing Excel file:', error)
      toast.error(`Error processing file: ${error.message || 'Invalid file format'}`)
    } finally {
      setUploading(false)
      // Reset file input
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const downloadTemplate = () => {
    // Create template Excel file matching the download format
    // Note: Valid carrier values are: UPS, FedEx, USPS, DHL, 4PX
    const templateData = [
      {
        'Order ID': '00000000-0000-0000-0000-000000000001',
        'Order Number': 'ORD-001',
        "Recipient's Name": 'John Doe',
        'Address': '123 Main St',
        'City': 'New York',
        'Postal Code': '10001',
        'Country': 'US',
        'Phone Number': '+1234567890',
        'Product Option/Variant': 'Product Name - Color (Qty: 1)',
        'Carrier': 'UPS',
        'Tracking Number': '1Z999AA10123456784',
        'Estimated Delivery Date': '2024-12-20',
      },
      {
        'Order ID': '00000000-0000-0000-0000-000000000002',
        'Order Number': 'ORD-002',
        "Recipient's Name": 'Jane Smith',
        'Address': '456 Oak Ave',
        'City': 'Los Angeles',
        'Postal Code': '90001',
        'Country': 'US',
        'Phone Number': '+1987654321',
        'Product Option/Variant': 'Product Name - Color (Qty: 2)',
        'Carrier': 'FedEx',
        'Tracking Number': '1234567890',
        'Estimated Delivery Date': '2024-12-21',
      },
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(templateData)
    
    // Add a note about valid carriers (as a comment in the first data row)
    // Note: XLSX doesn't support comments directly, but the examples show valid values
    
    // Set column widths
    ws['!cols'] = [
      { wch: 36 }, // Order ID
      { wch: 15 }, // Order Number
      { wch: 25 }, // Recipient's Name
      { wch: 30 }, // Address
      { wch: 15 }, // City
      { wch: 12 }, // Postal Code
      { wch: 12 }, // Country
      { wch: 15 }, // Phone Number
      { wch: 40 }, // Product Option/Variant
      { wch: 15 }, // Carrier
      { wch: 25 }, // Tracking Number
      { wch: 20 }, // Estimated Delivery Date
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Shipping Updates')
    XLSX.writeFile(wb, 'shipping-upload-template.xlsx')
    
    toast.success('Template downloaded')
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold">{t('orders.title')}</h1>
        <p className="text-gray-600 mt-1">{t('orders.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedOrders.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedOrders.size} selected
            </span>
          )}
          {activeTab === 'pending' && selectedOrders.size > 0 && (
            <Button
              onClick={handleBulkAcknowledge}
              disabled={bulkAcknowledging}
              variant="default"
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
            >
              {bulkAcknowledging ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Acknowledging...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Acknowledge {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
          {(activeTab === 'acknowledged' || activeTab === 'processing' || activeTab === 'ready') && selectedOrders.size > 0 && (
            <Button
              onClick={() => setShowBulkStatusDialog(true)}
              disabled={bulkUpdating}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Truck className="h-4 w-4 mr-2" />
              Update Status ({selectedOrders.size})
            </Button>
          )}
          <Button
            onClick={loadOrders}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t('common.loading') : t('orders.refresh')}
          </Button>
          {orders.length > 0 && (
            <>
              <Button
                onClick={() => {
                  const menu = document.getElementById('export-menu')
                  if (menu) {
                    const isHidden = menu.classList.contains('hidden')
                    menu.classList.toggle('hidden')
                    if (isHidden) {
                      // Scroll to menu if it was hidden
                      setTimeout(() => {
                        menu.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                      }, 100)
                    }
                  }
                }}
                variant="default"
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('orders.downloadOrders') || 'Download Orders'}
              </Button>
              <Button
                onClick={() => setShowUploadDialog(true)}
                variant="outline"
                size="sm"
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('orders.uploadShipping') || 'Upload Shipping'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Export Menu */}
      {orders.length > 0 && (
        <div id="export-menu" className="hidden mb-4 bg-white border rounded-lg p-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('orders.exportToCSV')}
            </Button>
            <Button
              onClick={exportToExcel}
              variant="outline"
              size="sm"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {t('orders.exportToExcel') || 'Export to Excel'}
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('orders.exportToPDF')}
            </Button>
            {selectedOrders.size > 0 && (
              <span className="text-sm text-gray-600">
                ({selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected)
              </span>
            )}
            {selectedOrders.size === 0 && (
              <span className="text-sm text-gray-600">
                (All {orders.length} order{orders.length > 1 ? 's' : ''} will be exported)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Ship Order Dialog */}
      {showShipDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Ship Order</h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter shipping information to mark this order as shipped. The customer will receive an email notification.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Carrier *</label>
                <select
                  value={shipCarrier}
                  onChange={(e) => setShipCarrier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  required
                >
                  <option value="">Select a carrier...</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="USPS">USPS</option>
                  <option value="DHL">DHL</option>
                  <option value="4PX">4PX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tracking Number *</label>
                <Input
                  value={shipTrackingNumber}
                  onChange={(e) => setShipTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Estimated Delivery Date (Optional)</label>
                <Input
                  type="date"
                  value={shipEstimatedDelivery}
                  onChange={(e) => setShipEstimatedDelivery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <Button
                onClick={() => {
                  setShowShipDialog(false)
                  setShipCarrier('')
                  setShipTrackingNumber('')
                  setShipEstimatedDelivery('')
                  setShipAssignmentId(null)
                }}
                variant="outline"
                disabled={shipping}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmShip}
                disabled={shipping || !shipCarrier || !shipTrackingNumber}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {shipping ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Shipping...
                  </>
                ) : (
                  <>
                    <Truck className="h-4 w-4 mr-2" />
                    Mark as Shipped
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Status Update Dialog */}
      {showBulkStatusDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Update Order Status</h2>
            <p className="text-sm text-gray-600 mb-4">
              Update {selectedOrders.size} selected order{selectedOrders.size > 1 ? 's' : ''} to a new status.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select New Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as 'processing' | 'ready' | 'shipped' | 'acknowledged')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="processing">Processing</option>
                  <option value="ready">Ready to Ship</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="shipped">Shipped</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedStatus === 'processing' && 'Orders will be marked as processing'}
                  {selectedStatus === 'ready' && 'Orders will be marked as ready to ship'}
                  {selectedStatus === 'acknowledged' && 'Orders will be marked as acknowledged'}
                  {selectedStatus === 'shipped' && 'Orders will be marked as shipped (main order will be updated to fulfilled)'}
                </p>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    setShowBulkStatusDialog(false)
                    setSelectedStatus('processing')
                  }}
                  variant="outline"
                  disabled={bulkUpdating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkStatusUpdate}
                  disabled={bulkUpdating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {bulkUpdating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4 mr-2" />
                      Update {selectedOrders.size} Order{selectedOrders.size > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">{t('orders.uploadShippingInfo') || 'Upload Shipping Information'}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('orders.excelFileRequired') || 'Upload an Excel file (.xlsx) with columns: Order Number, Carrier, Tracking Number, Estimated Delivery Date (optional)'}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('orders.selectExcelFile') || 'Select Excel File'}
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>{t('orders.needTemplate') || 'Need a template?'} </span>
                <button
                  onClick={downloadTemplate}
                  className="text-teal-600 hover:text-teal-700 underline"
                >
                  {t('orders.downloadTemplate') || 'Download template'}
                </button>
              </div>
              
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    setShowUploadDialog(false)
                    setUploading(false)
                  }}
                  variant="outline"
                  disabled={uploading}
                >
                  {t('common.cancel') || 'Cancel'}
                </Button>
              </div>
              
              {uploading && (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-600">{t('orders.processingFile') || 'Processing file...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date Filter */}
      <div className="mb-6 bg-white rounded-lg border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{t('orders.filterByDate')}:</span>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value as DateFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
          >
            <option value="all">{t('orders.allTime')}</option>
            <option value="today">{t('orders.today')}</option>
            <option value="week">{t('orders.last7Days')}</option>
            <option value="month">{t('orders.last30Days')}</option>
            <option value="custom">{t('orders.customRange')}</option>
          </select>
          {showCustomDateRange && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm"
                placeholder={t('orders.startDate')}
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm"
                placeholder={t('orders.endDate')}
              />
            </div>
          )}
        </div>
      </div>

      {/* RLS Error Message */}
      {assignmentsExist && orderAccessError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Access Issue Detected</h3>
            <p className="text-sm text-red-800 mb-2">
              {orderAccessError}
            </p>
            <p className="text-sm text-red-700">
              <strong>Solution:</strong> The database administrator needs to run the SQL script: 
              <code className="bg-red-100 px-2 py-1 rounded text-xs ml-1">scripts/fix-orders-rls-for-suppliers.sql</code>
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      {orders.length > 0 && activeTab === 'pending' && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">How to Process Orders</h3>
            <p className="text-sm text-blue-800">
              Orders with status <strong>"Pending"</strong> need to be acknowledged. Click the <strong>"Acknowledge"</strong> button 
              next to each order to confirm you've received it. After acknowledging, you can update the order status 
              through the order detail page (click the eye icon to view details).
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 border-b">
        {['pending', 'acknowledged', 'processing', 'ready', 'shipped', 'all'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-teal-500 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-12"></th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.orderNumber')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.customer')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.total')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.status')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.date')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="bg-white border rounded-lg p-8">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg mb-2">{t('orders.noOrders')}</p>
                    <p className="text-gray-400 text-sm mb-4">
                      {activeTab === 'pending' 
                        ? "No pending orders assigned to you. Orders assigned by the admin will appear here."
                        : activeTab === 'all'
                        ? "No orders have been assigned to you yet. Contact the admin to have orders assigned."
                        : `No orders with status "${activeTab}" found.`
                      }
                    </p>
                    {activeTab !== 'all' && (
                      <button
                        onClick={() => setActiveTab('all')}
                        className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                      >
                        View all orders
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center"
                    title="Select all"
                  >
                    {selectedOrders.size === orders.length && orders.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-teal-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.orderNumber')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.customer')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.total')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.status')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.date')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('orders.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((assignment) => {
                const order = assignment.orders
                if (!order) return null
                
                return (
                  <tr 
                    key={assignment.id} 
                    className={`border-b hover:bg-gray-50 ${selectedOrders.has(assignment.order_id) ? 'bg-teal-50' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleOrderSelection(assignment.order_id)}
                        className="flex items-center justify-center"
                        title="Select order"
                      >
                        {selectedOrders.has(assignment.order_id) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">{order.order_number}</td>
                    <td className="py-3 px-4 text-sm">
                      {order.customer_first_name && order.customer_last_name
                        ? `${order.customer_first_name} ${order.customer_last_name}`
                        : order.customer_email}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      ${(orderCosts.get(assignment.order_id) || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(assignment.assignment_status)}`}>
                        {getStatusLabel(assignment.assignment_status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Link href={`/supplier/orders/${assignment.order_id}`}>
                          <Button variant="ghost" size="sm" title={t('orders.viewDetails')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {assignment.assignment_status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcknowledge(assignment.id)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            {t('orders.acknowledge')}
                          </Button>
                        )}
                        {assignment.assignment_status === 'ready' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleShip(assignment.id)}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            {t('orders.shipOrder')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalOrders > ordersPerPage && (
            <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * ordersPerPage) + 1} to {Math.min(currentPage * ordersPerPage, totalOrders)} of {totalOrders} orders
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm text-gray-700">
                  Page {currentPage} of {Math.ceil(totalOrders / ordersPerPage)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalOrders / ordersPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalOrders / ordersPerPage) || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

