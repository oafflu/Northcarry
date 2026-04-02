"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Package, MapPin, CreditCard, Truck, FileText, Loader2, XCircle, Mail, CheckCircle, ShoppingBag, Ban } from "lucide-react"
import { getOrderById, getOrderActivities } from "@/app/actions/account"
import { cancelOrder } from "@/app/actions/orders"
import { toast } from "sonner"
import { getTrackingUrl } from "@/lib/tracking-urls"
import {
  customerFulfillmentBadgeClass,
  getCustomerFulfillmentLabel,
  isCustomerFulfilledBucket,
} from "@/lib/order-fulfillment-display"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function OrderDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const orderId = params.id as string
  
  const [order, setOrder] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (orderId && user?.id) {
      loadOrder()
    }
  }, [orderId, user?.id])

  const loadOrder = async () => {
    if (!orderId || !user?.id) return
    
    setLoading(true)
    try {
      const [orderResult, activitiesResult] = await Promise.all([
        getOrderById(orderId, user.id),
        getOrderActivities(orderId, user.id),
      ])
      
      if (orderResult.error) {
        toast.error("Failed to load order", {
          description: orderResult.error,
        })
      } else if (orderResult.data) {
        setOrder(orderResult.data)
      }
      if (!activitiesResult.error && activitiesResult.data?.length) {
        setActivities(activitiesResult.data)
      } else {
        setActivities([])
      }
    } catch (error: any) {
      console.error('Error loading order:', error)
      toast.error("Failed to load order", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation")
      return
    }

    const orderTotal = parseFloat(order?.total || '0')
    const isFreeOrder = orderTotal < 1.0
    const confirmMessage = `Are you sure you want to cancel order ${order?.order_number}? This action cannot be undone.${!isFreeOrder && order?.payment_status === 'paid' ? ' A refund will be processed.' : isFreeOrder ? ' This is a free order, so no refund is needed.' : ''}`

    if (!confirm(confirmMessage)) {
      return
    }

    setCancelling(true)
    try {
      const result = await cancelOrder(orderId, cancellationReason)

      if (result.success) {
        toast.success("Order cancelled successfully", {
          description: result.message,
        })
        setShowCancelDialog(false)
        setCancellationReason("")
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to cancel order", {
          description: result.error,
        })
      }
    } catch (error: any) {
      toast.error("Failed to cancel order", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setCancelling(false)
    }
  }

  const handleDownloadInvoice = () => {
    if (!order) return

    // Create a new window for the invoice
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to download invoice')
      return
    }

    // Get the origin for logo URLs
    const origin = window.location.origin

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Guest'
    const shippingAddress = order.shipping_address || {}
    const billingAddress = order.billing_address || {}

    // Calculate totals
    const subtotal = parseFloat(order.subtotal || '0')
    const discount = parseFloat(order.discount_amount || '0')
    const shipping = parseFloat(order.shipping_cost || '0')
    const tax = parseFloat(order.tax_amount || '0')
    const total = parseFloat(order.total || '0')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order.order_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
              background: white;
            }
            .invoice-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #14b8a6;
            }
            .invoice-header h1 {
              color: #14b8a6;
              font-size: 32px;
              font-weight: bold;
            }
            .invoice-info {
              text-align: right;
            }
            .invoice-info p {
              margin: 4px 0;
              font-size: 14px;
            }
            .company-info {
              margin-bottom: 30px;
            }
            .company-info h2 {
              color: #14b8a6;
              font-size: 24px;
              margin-bottom: 10px;
            }
            .billing-shipping {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .address-box {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
            }
            .address-box h3 {
              color: #14b8a6;
              font-size: 16px;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .address-box p {
              margin: 4px 0;
              font-size: 14px;
              line-height: 1.6;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table thead {
              background: #14b8a6;
              color: white;
            }
            .items-table th {
              padding: 12px;
              text-align: left;
              font-weight: bold;
              font-size: 14px;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }
            .items-table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .items-table .text-right {
              text-align: right;
            }
            .items-table .text-center {
              text-align: center;
            }
            .totals {
              margin-left: auto;
              width: 300px;
              margin-top: 20px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .totals-row.total {
              font-size: 18px;
              font-weight: bold;
              padding-top: 12px;
              border-top: 2px solid #14b8a6;
              margin-top: 8px;
            }
            .totals-row.label {
              color: #666;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              margin-top: 10px;
            }
            .status-paid {
              background: #d1fae5;
              color: #065f46;
            }
            .status-pending {
              background: #fef3c7;
              color: #92400e;
            }
            .status-fulfilled {
              background: #dbeafe;
              color: #1e40af;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div>
              <h1>INVOICE</h1>
              <p style="margin-top: 8px; color: #666;">Order #${order.order_number}</p>
            </div>
            <div class="invoice-info">
              <p><strong>Invoice Date:</strong> ${orderDate}</p>
              <p><strong>Order Date:</strong> ${orderDate}</p>
              <p><strong>Payment Status:</strong> 
                <span class="status-badge ${order.payment_status === 'paid' ? 'status-paid' : 'status-pending'}">
                  ${order.payment_status === 'paid' ? 'Paid' : order.payment_status || 'Pending'}
                </span>
              </p>
              <p><strong>Fulfillment Status:</strong> 
                <span class="status-badge ${isCustomerFulfilledBucket(order.fulfillment_status) ? 'status-fulfilled' : 'status-pending'}">
                  ${getCustomerFulfillmentLabel(order.fulfillment_status)}
                </span>
              </p>
            </div>
          </div>

          <div class="company-info">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
              <img src="${origin}/brevi-logo.png" alt="BREVI Logo" style="height: 50px; width: auto;" />
            </div>
            <p style="color: #666; font-size: 14px;">Premium Oral Care Products</p>
          </div>

          <div class="billing-shipping">
            <div class="address-box">
              <h3>Bill To</h3>
              <p><strong>${customerName}</strong></p>
              ${order.customer_email ? `<p>${order.customer_email}</p>` : ''}
              ${billingAddress.address_line1 ? `<p>${billingAddress.address_line1}</p>` : ''}
              ${billingAddress.address_line2 ? `<p>${billingAddress.address_line2}</p>` : ''}
              ${billingAddress.city || billingAddress.state || billingAddress.postal_code
                ? `<p>${[billingAddress.city, billingAddress.state, billingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                : ''}
              ${billingAddress.country ? `<p>${billingAddress.country}</p>` : ''}
            </div>
            <div class="address-box">
              <h3>Ship To</h3>
              <p><strong>${customerName}</strong></p>
              ${shippingAddress.address_line1 ? `<p>${shippingAddress.address_line1}</p>` : ''}
              ${shippingAddress.address_line2 ? `<p>${shippingAddress.address_line2}</p>` : ''}
              ${shippingAddress.city || shippingAddress.state || shippingAddress.postal_code
                ? `<p>${[shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                : ''}
              ${shippingAddress.country ? `<p>${shippingAddress.country}</p>` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.order_items || []).map((item: any) => `
                <tr>
                  <td>
                    <strong>${item.product_title || 'Product'}</strong>
                    ${item.variant_color ? `<br><span style="color: #666; font-size: 12px;">Color: ${item.variant_color}</span>` : ''}
                    ${item.sku ? `<br><span style="color: #666; font-size: 12px;">SKU: ${item.sku}</span>` : ''}
                  </td>
                  <td class="text-center">${item.quantity || 1}</td>
                  <td class="text-right">$${parseFloat(item.unit_price || '0').toFixed(2)}</td>
                  <td class="text-right">$${parseFloat(item.line_total || '0').toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span class="label">Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
              <div class="totals-row">
                <span class="label">Discount:</span>
                <span>-$${discount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${shipping > 0 ? `
              <div class="totals-row">
                <span class="label">Shipping:</span>
                <span>$${shipping.toFixed(2)}</span>
              </div>
            ` : ''}
            ${tax > 0 ? `
              <div class="totals-row">
                <span class="label">Tax:</span>
                <span>$${tax.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>

          ${order.order_tracking && order.order_tracking.length > 0 ? `
            <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3 style="color: #14b8a6; font-size: 16px; margin-bottom: 8px;">Tracking Information</h3>
              ${order.order_tracking.map((tracking: any) => `
                <p><strong>Carrier:</strong> ${tracking.carrier || 'N/A'}</p>
                <p><strong>Tracking Number:</strong> ${tracking.tracking_number}</p>
              `).join('')}
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business!</p>
            <p style="margin-top: 8px;">This is an official invoice for order ${order.order_number}</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <p style="color: #666; font-size: 12px; margin: 0;">BREVI™ is a product of</p>
              <img src="${origin}/oafflu-icon.svg" alt="OAFFLU LLC" style="height: 24px; width: auto;" />
              <p style="color: #666; font-size: 12px; margin: 0;">OAFFLU LLC</p>
            </div>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()

    // Wait for content to load, then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }

    toast.success('Invoice opened in new window')
  }

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">Order not found</p>
          <Link href="/account/orders" className="text-teal-600 hover:underline mt-4 inline-block">
            Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Guest'
  const shippingAddress = order.shipping_address || {}
  const billingAddress = order.billing_address || {}

  return (
    <div className="lg:col-span-2">
      <div className="mb-8">
        <Link
          href="/account/orders"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black"
        >
          ← Back to Orders
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
            <p className="mt-1 text-gray-600">
              Placed on{" "}
              {new Date(order.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button 
            onClick={handleDownloadInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <FileText className="w-4 h-4" />
            Download Invoice
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Details */}
        <div className="lg:col-span-2">
              <div className="space-y-6">
                {/* Order Status */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Order Status</h2>
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-medium ${customerFulfillmentBadgeClass(order.fulfillment_status)}`}
                    >
                      {getCustomerFulfillmentLabel(order.fulfillment_status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Payment Status: <span className="font-medium">{order.payment_status || 'pending'}</span>
                  </p>
                  <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                    Fulfillment status reflects your supplier: <strong>Pending</strong> until shipped,{" "}
                    <strong>Processing</strong> while the supplier prepares the order, and{" "}
                    <strong>Fulfilled</strong> once it has shipped (use tracking below when available). Final carrier delivery is not shown separately.
                  </p>
                </div>

                {/* Tracking Information */}
                {order.order_tracking && order.order_tracking.length > 0 && (
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-bold">Tracking Information</h2>
                    {order.order_tracking.map((tracking: any, idx: number) => {
                      const trackingUrl = getTrackingUrl(tracking.carrier, tracking.tracking_number)
                      
                      return (
                        <div key={tracking.id || idx} className="mb-4 flex items-center gap-4 rounded-lg bg-gray-50 p-4">
                          <Truck className="h-6 w-6 text-gray-600" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">Tracking Number</p>
                            <p className="font-semibold">{tracking.tracking_number}</p>
                            {tracking.carrier && (
                              <p className="text-sm text-gray-600">Carrier: {tracking.carrier}</p>
                            )}
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-sm text-teal-600 hover:text-teal-700 underline"
                              >
                                Track Package →
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Order Items */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold">Order Items</h2>
                  <div className="space-y-4">
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gray-100">
                            <Package className="h-10 w-10 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{item.product_title || 'Product'}</p>
                            {item.variant_color && (
                              <p className="text-sm text-gray-600">Color: {item.variant_color}</p>
                            )}
                            {item.sku && (
                              <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                            )}
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                          </div>
                          <p className="font-semibold">${parseFloat(item.line_total || '0').toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No items found</p>
                    )}
                  </div>
                </div>

                {/* Order activity timeline */}
                {activities.length > 0 && (
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="mb-4 text-xl font-bold">Order activity</h2>
                    <div className="relative space-y-0">
                      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" aria-hidden />
                      {activities.map((activity: any, idx: number) => {
                        const at = activity.action_type || ''
                        const isCreated = at === 'order_created'
                        const isEmail = at === 'order_confirmation_email_sent'
                        const isFulfillment = at.includes('fulfillment')
                        const isPaid = at === 'order_marked_as_paid'
                        const isCancelled = at === 'order_cancelled'
                        const Icon = isCreated ? ShoppingBag : isEmail ? Mail : isFulfillment ? Truck : isPaid ? CreditCard : isCancelled ? Ban : CheckCircle
                        const label = isCreated ? 'Order placed' : isEmail ? 'Order confirmation email sent' : isFulfillment ? 'Fulfillment updated' : isPaid ? 'Order marked as paid' : isCancelled ? 'Order cancelled' : activity.action_description?.split(/[.:]/)[0] || activity.action_type?.replace(/^order_/, '').replace(/_/g, ' ') || 'Activity'
                        const time = new Date(activity.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                        return (
                          <div key={activity.id || idx} className="relative flex gap-4 pb-6 last:pb-0">
                            <div className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className="font-medium text-gray-900">{label}</p>
                              {activity.action_description && activity.action_description !== label && (
                                <p className="mt-0.5 text-sm text-gray-600">{activity.action_description}</p>
                              )}
                              <p className="mt-1 text-xs text-gray-500">{time}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="space-y-6">
                {/* Price Summary */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-xl font-bold">Order Summary</h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">${parseFloat(order.subtotal || '0').toFixed(2)}</span>
                    </div>
                    {parseFloat(order.discount_amount || '0') > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount</span>
                        <span className="font-medium text-green-600">-${parseFloat(order.discount_amount || '0').toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">
                        {parseFloat(order.shipping_cost || '0') === 0 ? "FREE" : `$${parseFloat(order.shipping_cost || '0').toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">${parseFloat(order.tax_amount || '0').toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-3 text-base">
                      <span className="font-bold">Total</span>
                      <span className="font-bold">${parseFloat(order.total || '0').toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-gray-600" />
                    <h3 className="font-bold">Shipping Address</h3>
                  </div>
                  <div className="text-sm text-gray-700">
                    <p className="font-medium">{customerName}</p>
                    {shippingAddress.address_line1 && <p>{shippingAddress.address_line1}</p>}
                    {shippingAddress.address_line2 && <p>{shippingAddress.address_line2}</p>}
                    {(shippingAddress.city || shippingAddress.state || shippingAddress.postal_code) && (
                      <p>
                        {[shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {shippingAddress.country && <p>{shippingAddress.country}</p>}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-gray-600" />
                    <h3 className="font-bold">Payment Status</h3>
                  </div>
                  <p className="text-sm text-gray-700">
                    {(() => {
                      const orderTotal = parseFloat(order.total || '0')
                      const isFreeOrder = orderTotal < 1.0
                      const displayStatus = isFreeOrder ? 'Free Order' : (order.payment_status || 'pending')
                      
                      return (
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                          isFreeOrder
                            ? 'bg-purple-50 text-purple-700'
                            : order.payment_status === 'paid'
                              ? 'bg-green-50 text-green-700'
                              : order.payment_status === 'processing'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {displayStatus}
                        </span>
                      )
                    })()}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  {order.fulfillment_status !== 'cancelled' && (
                    <Button
                      onClick={() => setShowCancelDialog(true)}
                      variant="destructive"
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Order
                    </Button>
                  )}
                  <Link
                    href="/product"
                    className="block rounded-md bg-black py-3 text-center font-semibold text-white transition-colors hover:bg-gray-800"
                  >
                    Buy Again
                  </Link>
                  <Link
                    href={`/account/support?order=${encodeURIComponent(order.order_number || '')}&orderId=${encodeURIComponent(order.id)}`}
                    className="block w-full rounded-md border border-gray-300 py-3 text-center font-semibold transition-colors hover:bg-gray-50"
                  >
                    Get Help
                  </Link>
                </div>
              </div>
            </div>
          </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              {(() => {
                const orderTotal = parseFloat(order?.total || '0')
                const isFreeOrder = orderTotal < 1.0
                return isFreeOrder
                  ? 'This is a free order. Cancellation will not process a refund.'
                  : order?.payment_status === 'paid'
                    ? 'A refund will be processed through Stripe if payment was made.'
                    : 'This will cancel your order.'
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cancellation Reason *</label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            {(() => {
              const orderTotal = parseFloat(order?.total || '0')
              const isFreeOrder = orderTotal < 1.0
              if (!isFreeOrder && order?.payment_status === 'paid') {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> A full refund of ${parseFloat(order?.total || '0').toFixed(2)} will be processed through Stripe.
                    </p>
                  </div>
                )
              }
              return null
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setCancellationReason("")
              }}
              disabled={cancelling}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancelOrder}
              disabled={!cancellationReason.trim() || cancelling}
              variant="destructive"
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
                  Cancel Order
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
