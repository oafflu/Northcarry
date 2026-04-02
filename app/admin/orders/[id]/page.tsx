"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Mail, Printer, Loader2, Users, Plus, Edit, Trash2, X, Save, RefreshCw, FileText, Download, Settings, RotateCcw, XCircle, CheckCircle, ShoppingBag, CreditCard, Truck, Ban } from "lucide-react"
import { useParams } from "next/navigation"
import { getAdminOrderById, updateOrderFulfillment, sendOrderConfirmationEmail, sendInvoiceEmail, getOrderSupplierAssignments, assignOrdersToSupplier, addOrderItem, updateOrderItem, deleteOrderItem, convertOrderToSubscription, updateOrderAddress, getCustomerAddressesForAdmin, cancelOrder, markOrderAsPaid, createPaymentLinkForOrder, getOrderActivitiesForAdmin } from "@/app/actions/orders"
import { createAdminReturnRequest } from "@/app/actions/returns"
import { getTrackingUrl } from "@/lib/tracking-urls"
import { getSuppliers } from "@/app/actions/users"
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from "@/app/actions/products"
import { getSubscriptionProducts, getAllLinkedSubscriptions } from "@/app/actions/subscriptions"
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

// Helper function to handle server action errors gracefully
// Ignores non-critical Next.js forwarding timeout errors
function handleServerActionError(error: any, defaultMessage: string) {
  // Ignore connection timeout errors from Next.js server action forwarding
  // These are non-critical - the action still succeeds
  if (error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || 
      error?.message?.includes('Connect Timeout') ||
      error?.message?.includes('failed to forward action response')) {
    console.warn('Server action forwarding timeout (non-critical):', error.message)
    return { shouldShowError: false }
  }
  console.error(defaultMessage, error)
  return { shouldShowError: true, message: error.message || defaultMessage }
}

export default function OrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  
  const [order, setOrder] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fulfillmentStatus, setFulfillmentStatus] = useState("unfulfilled")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [shippingCarrier, setShippingCarrier] = useState("")
  const [notes, setNotes] = useState("")
  const [updating, setUpdating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [supplierAssignments, setSupplierAssignments] = useState<any[]>([])
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [assigning, setAssigning] = useState(false)
  
  // Order item editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState(1)
  const [editPrice, setEditPrice] = useState("0.00")
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showConvertToSubscriptionDialog, setShowConvertToSubscriptionDialog] = useState(false)
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [variants, setVariants] = useState<any[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [addItemQuantity, setAddItemQuantity] = useState(1)
  const [addItemPrice, setAddItemPrice] = useState("")
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const [linkedSubscriptions, setLinkedSubscriptions] = useState<any[]>([])
  const [selectedSubscriptionProductId, setSelectedSubscriptionProductId] = useState("")
  const [subscriptionFrequency, setSubscriptionFrequency] = useState(1)
  const [subscriptionPurchaseType, setSubscriptionPurchaseType] = useState<'ongoing' | 'prepaid'>('ongoing')
  const [subscriptionQuantity, setSubscriptionQuantity] = useState(1)
  const [converting, setConverting] = useState(false)
  const [subscriptionsByItem, setSubscriptionsByItem] = useState<Record<string, any>>({})
  
  // Address editing state
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false)
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")
  const [newAddress, setNewAddress] = useState({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  })
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [newPhone, setNewPhone] = useState("")
  const [updatingAddress, setUpdatingAddress] = useState(false)
  
  // Return request state
  const [showReturnRequestDialog, setShowReturnRequestDialog] = useState(false)
  const [selectedItemForReturn, setSelectedItemForReturn] = useState<any>(null)
  const [returnReason, setReturnReason] = useState("")
  const [returnDetailedReason, setReturnDetailedReason] = useState("")
  const [returnQuantity, setReturnQuantity] = useState(1)
  const [requestingReturn, setRequestingReturn] = useState(false)
  
  // Cancel order state
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  
  // Mark as paid state
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [transactionId, setTransactionId] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentComments, setPaymentComments] = useState("")
  const [markingPaid, setMarkingPaid] = useState(false)
  
  // Payment link state
  const [generatingPaymentLink, setGeneratingPaymentLink] = useState(false)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      loadOrder()
      loadSupplierAssignments()
      loadSuppliers()
      loadProducts()
      loadSubscriptionProducts()
    }
  }, [orderId])

  useEffect(() => {
    if (order?.order_items && order.user_id) {
      loadSubscriptionsForOrder()
    }
  }, [order])

  const loadSubscriptionsForOrder = async () => {
    if (!order?.user_id || !order.order_items) return
    
    try {
      // Get all subscriptions for this user
      const response = await fetch(`/api/admin/subscriptions?userId=${order.user_id}`)
      if (response.ok) {
        const data = await response.json()
        const subscriptions = data.subscriptions || []
        
        // Map subscriptions by subscription_product_id and purchase_type
        const subscriptionsMap: Record<string, any> = {}
        
        order.order_items.forEach((item: any) => {
          if (item.subscription_product_id && (item.purchase_type === 'prepaid' || item.purchase_type === 'subscription')) {
            // Find matching subscription - prefer exact match by subscription_product_id and purchase_type
            const matchingSub = subscriptions.find((sub: any) => 
              sub.subscription_product_id === item.subscription_product_id &&
              sub.purchase_type === item.purchase_type
            )
            
            if (matchingSub) {
              subscriptionsMap[item.id] = matchingSub
            }
          }
        })
        
        setSubscriptionsByItem(subscriptionsMap)
      }
    } catch (error) {
      console.error('Error loading subscriptions for order:', error)
    }
  }

  const loadCustomerAddresses = async () => {
    if (!order?.user_id) return
    
    try {
      const result = await getCustomerAddressesForAdmin(order.user_id)
      if (result.data) {
        setCustomerAddresses(result.data)
      }
    } catch (error) {
      console.error('Error loading customer addresses:', error)
    }
  }

  const handleEditAddress = () => {
    if (order?.user_id) {
      loadCustomerAddresses()
    }
    setNewPhone(order?.customer_phone || "")
    setEditingPhone(false)
    setShowEditAddressDialog(true)
  }

  const handleSaveAddress = async () => {
    if (!order) return

    setUpdatingAddress(true)
    try {
      let addressToUse = null

      if (useNewAddress) {
        // Validate new address
        if (!newAddress.address_line1 || !newAddress.city || !newAddress.state || !newAddress.postal_code || !newAddress.country) {
          toast.error("Please fill in all required address fields")
          setUpdatingAddress(false)
          return
        }
        addressToUse = newAddress
      } else if (selectedAddressId) {
        // Use selected existing address
        const selectedAddress = customerAddresses.find(addr => addr.id === selectedAddressId)
        if (!selectedAddress) {
          toast.error("Selected address not found")
          setUpdatingAddress(false)
          return
        }
        addressToUse = {
          address_line1: selectedAddress.address_line1,
          address_line2: selectedAddress.address_line2 || "",
          city: selectedAddress.city,
          state: selectedAddress.state,
          postal_code: selectedAddress.postal_code,
          country: selectedAddress.country,
        }
      } else {
        toast.error("Please select an address or create a new one")
        setUpdatingAddress(false)
        return
      }

      const updates: any = {}
      if (addressToUse) {
        updates.shippingAddress = addressToUse
      }
      if (editingPhone && newPhone !== order.customer_phone) {
        updates.customerPhone = newPhone || null
      }

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save")
        setUpdatingAddress(false)
        return
      }

      const result = await updateOrderAddress(order.id, updates)

      if (result.success) {
        toast.success(result.message || "Address updated successfully")
        setShowEditAddressDialog(false)
        setSelectedAddressId("")
        setNewAddress({
          address_line1: "",
          address_line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "",
        })
        setUseNewAddress(false)
        setEditingPhone(false)
        loadOrder() // Reload to show updated address
      } else {
        toast.error("Failed to update address", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error updating address')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to update address", {
          description: errorHandling.message,
        })
      }
    } finally {
      setUpdatingAddress(false)
    }
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const result = await getActiveProductsForAdmin()
      if (result.data) {
        setProducts(result.data)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const loadSubscriptionProducts = async () => {
    try {
      const [subResult, linkedResult] = await Promise.all([
        getSubscriptionProducts(true),
        getAllLinkedSubscriptions(),
      ])
      if (subResult.data) {
        setSubscriptionProducts(subResult.data)
      }
      if (linkedResult.data) {
        setLinkedSubscriptions(linkedResult.data)
      }
    } catch (error) {
      console.error('Error loading subscription products:', error)
    }
  }

  const handleProductChange = async (productId: string) => {
    setSelectedProductId(productId)
    setSelectedVariantId("")
    if (productId) {
      try {
        const result = await getProductVariantsForAdmin(productId)
        if (result.data) {
          setVariants(result.data)
          // Auto-select first variant and set price
          if (result.data.length > 0) {
            setSelectedVariantId(result.data[0].id)
            setAddItemPrice(parseFloat(result.data[0].price?.toString() || '0').toFixed(2))
          }
        }
      } catch (error) {
        console.error('Error loading variants:', error)
      }
    } else {
      setVariants([])
    }
  }

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId)
    const variant = variants.find(v => v.id === variantId)
    if (variant) {
      setAddItemPrice(parseFloat(variant.price?.toString() || '0').toFixed(2))
    }
  }

  const handleAddItem = async () => {
    if (!selectedProductId || !selectedVariantId) {
      toast.error("Please select a product and variant")
      return
    }

    try {
      const result = await addOrderItem(orderId, {
        productId: selectedProductId,
        variantId: selectedVariantId,
        quantity: addItemQuantity,
        unitPrice: addItemPrice ? parseFloat(addItemPrice) : undefined,
      })

      if (result.success) {
        toast.success("Item added to order")
        setShowAddItemDialog(false)
        setSelectedProductId("")
        setSelectedVariantId("")
        setAddItemQuantity(1)
        setAddItemPrice("")
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to add item", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error adding item')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to add item", {
          description: errorHandling.message,
        })
      }
    }
  }

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id)
    setEditQuantity(item.quantity)
    setEditPrice(parseFloat(item.unit_price || '0').toFixed(2))
  }

  const handleSaveEdit = async (itemId: string) => {
    try {
      const result = await updateOrderItem(itemId, {
        quantity: editQuantity,
        unitPrice: parseFloat(editPrice),
      })

      if (result.success) {
        toast.success("Item updated")
        setEditingItemId(null)
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to update item", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error updating item')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to update item", {
          description: errorHandling.message,
        })
      }
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item from the order?')) {
      return
    }

    try {
      const result = await deleteOrderItem(itemId)

      if (result.success) {
        toast.success("Item removed from order")
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to remove item", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error deleting item')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to remove item", {
          description: errorHandling.message,
        })
      }
    }
  }

  const handleConvertToSubscription = async () => {
    if (!selectedSubscriptionProductId) {
      toast.error("Please select a subscription product")
      return
    }

    setConverting(true)
    try {
      const result = await convertOrderToSubscription(orderId, {
        subscriptionProductId: selectedSubscriptionProductId,
        frequencyMonths: subscriptionFrequency,
        purchaseType: subscriptionPurchaseType,
        quantity: subscriptionQuantity,
      })

      if (result.success) {
        toast.success("Order converted to subscription", {
          description: `Subscription will start billing from ${result.data?.nextBillingDate}`,
        })
        setShowConvertToSubscriptionDialog(false)
        setSelectedSubscriptionProductId("")
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to convert order", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error converting order')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to convert order", {
          description: errorHandling.message,
        })
      }
    } finally {
      setConverting(false)
    }
  }

  const handleRequestReturn = async () => {
    if (!selectedItemForReturn) {
      toast.error("Please select an item")
      return
    }

    if (!returnReason.trim()) {
      toast.error("Please provide a reason for the return")
      return
    }

    if (returnQuantity < 1 || returnQuantity > selectedItemForReturn.quantity) {
      toast.error(`Quantity must be between 1 and ${selectedItemForReturn.quantity}`)
      return
    }

    setRequestingReturn(true)
    try {
      const result = await createAdminReturnRequest({
        order_id: orderId,
        order_item_id: selectedItemForReturn.id,
        reason: returnReason,
        detailed_reason: returnDetailedReason || undefined,
        quantity: returnQuantity,
      })

      if (result.success) {
        toast.success("Replacement request created", {
          description: `Return number: ${result.returnNumber}. The supplier has been notified.`,
        })
        setShowReturnRequestDialog(false)
        setSelectedItemForReturn(null)
        setReturnReason("")
        setReturnDetailedReason("")
        setReturnQuantity(1)
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to create replacement request", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error creating return request')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to create replacement request", {
          description: errorHandling.message,
        })
      }
    } finally {
      setRequestingReturn(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancellationReason.trim()) {
      toast.error("Please provide a reason for cancellation")
      return
    }

    if (!confirm(`Are you sure you want to cancel order ${order?.order_number}? This action cannot be undone.${order?.payment_status === 'paid' ? ' A refund will be processed.' : ''}`)) {
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
        loadSupplierAssignments() // Reload assignments
      } else {
        toast.error("Failed to cancel order", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error cancelling order')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to cancel order", {
          description: errorHandling.message,
        })
      }
    } finally {
      setCancelling(false)
    }
  }

  const handleMarkAsPaid = async () => {
    setMarkingPaid(true)
    try {
      const result = await markOrderAsPaid(orderId, {
        paymentMethod: paymentMethod || undefined,
        transactionId: transactionId || undefined,
        paymentDate: paymentDate || undefined,
        comments: paymentComments || undefined,
      })

      if (result.success) {
        toast.success("Order marked as paid successfully", {
          description: result.message,
        })
        setShowMarkPaidDialog(false)
        setPaymentMethod("")
        setTransactionId("")
        setPaymentDate(new Date().toISOString().split('T')[0])
        setPaymentComments("")
        loadOrder() // Reload to show updated order
      } else {
        toast.error("Failed to mark order as paid", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error marking order as paid:', error)
      toast.error("Failed to mark order as paid", {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setMarkingPaid(false)
    }
  }

  const handleGeneratePaymentLink = async () => {
    setGeneratingPaymentLink(true)
    try {
      const result = await createPaymentLinkForOrder(orderId)

      if (result.success && result.paymentLink) {
        setPaymentLink(result.paymentLink)
        const emailDescription = result.paymentLinkEmailSent
          ? "Payment link was emailed to the customer automatically."
          : result.paymentLinkEmailSkipped
            ? "Link generated. Email was skipped (already sent previously)."
            : result.paymentLinkEmailError
              ? `Link generated, but email failed: ${result.paymentLinkEmailError}`
              : "Payment link generated."

        toast.success("Payment link generated successfully", {
          description: emailDescription,
        })
      } else {
        toast.error("Failed to generate payment link", {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error: any) {
      console.error('Error generating payment link:', error)
      toast.error("Failed to generate payment link", {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setGeneratingPaymentLink(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const result = await getSuppliers()
      if (result.data) {
        setSuppliers(result.data)
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const loadSupplierAssignments = async () => {
    try {
      const result = await getOrderSupplierAssignments(orderId)
      if (result.data) {
        setSupplierAssignments(result.data)
      }
    } catch (error) {
      console.error('Error loading supplier assignments:', error)
    }
  }

  const handleAssignToSupplier = async () => {
    if (!selectedSupplier) {
      toast.error("Please select a supplier")
      return
    }

    setAssigning(true)
    try {
      const result = await assignOrdersToSupplier([orderId], selectedSupplier)
      
      if (result.success) {
        toast.success("Order assigned to supplier", {
          description: result.message,
        })
        setShowAssignDialog(false)
        setSelectedSupplier("")
        loadSupplierAssignments()
      } else {
        toast.error("Failed to assign order", {
          description: result.error || "An unexpected error occurred",
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error assigning order')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to assign order", {
          description: errorHandling.message,
        })
      }
    } finally {
      setAssigning(false)
    }
  }

  const loadOrder = async () => {
    setLoading(true)
    try {
      const [orderResult, activitiesResult] = await Promise.all([
        getAdminOrderById(orderId),
        getOrderActivitiesForAdmin(orderId),
      ])
      if (orderResult.error) {
        toast.error("Failed to load order", {
          description: orderResult.error,
        })
      } else if (orderResult.data) {
        setOrder(orderResult.data)
        setFulfillmentStatus(orderResult.data.fulfillment_status || "unfulfilled")
        
        // Get tracking info from order_tracking table (most recent)
        const trackingInfo = orderResult.data.order_tracking && orderResult.data.order_tracking.length > 0
          ? orderResult.data.order_tracking[orderResult.data.order_tracking.length - 1]
          : null
        
        setTrackingNumber(trackingInfo?.tracking_number || "")
        setShippingCarrier(trackingInfo?.carrier || "")
      }
      if (!activitiesResult.error && activitiesResult.data?.length) {
        setActivities(activitiesResult.data)
      } else {
        setActivities([])
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error loading order')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to load order", {
          description: errorHandling.message,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFulfillment = async () => {
    setUpdating(true)
    try {
      const result = await updateOrderFulfillment(
        orderId,
        fulfillmentStatus,
        trackingNumber || undefined,
        shippingCarrier || undefined
      )
      
      if (result.success) {
        toast.success("Order updated successfully")
        loadOrder() // Reload to get updated data
        loadSupplierAssignments() // Reload assignments in case they changed
      } else {
        toast.error("Failed to update order", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error updating order')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to update order", {
          description: errorHandling.message,
        })
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleSendEmail = async () => {
    setSendingEmail(true)
    try {
      const result = await sendOrderConfirmationEmail(orderId)
      
      if (result.success) {
        toast.success("Order confirmation email sent successfully", {
          description: `Email sent to ${order?.customer_email}`,
        })
      } else {
        toast.error("Failed to send email", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error sending email')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to send email", {
          description: errorHandling.message,
        })
      }
    } finally {
      setSendingEmail(false)
    }
  }

  const handleSendInvoice = async () => {
    setSendingInvoice(true)
    try {
      const result = await sendInvoiceEmail(orderId)
      
      if (result.success) {
        toast.success("Invoice sent successfully", {
          description: `Invoice sent to ${order?.customer_email}`,
        })
      } else {
        toast.error("Failed to send invoice", {
          description: result.error,
        })
      }
    } catch (error: any) {
      const errorHandling = handleServerActionError(error, 'Error sending invoice')
      if (errorHandling.shouldShowError) {
        toast.error("Failed to send invoice", {
          description: errorHandling.message,
        })
      }
    } finally {
      setSendingInvoice(false)
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
    const discount = parseFloat(order.discount || '0')
    const shipping = parseFloat(order.shipping_cost || '0')
    const tax = parseFloat(order.tax || '0')
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
            .status-free {
              background: #e9d5ff;
              color: #6b21a8;
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
                <span class="status-badge ${(() => {
                  const orderTotal = parseFloat(order.total || '0')
                  const isFreeOrder = orderTotal < 1.0
                  if (isFreeOrder) return 'status-free'
                  return order.payment_status === 'paid' ? 'status-paid' : 'status-pending'
                })()}">
                  ${(() => {
                    const orderTotal = parseFloat(order.total || '0')
                    const isFreeOrder = orderTotal < 1.0
                    if (isFreeOrder) return 'Free Order'
                    return order.payment_status === 'paid' ? 'Paid' : order.payment_status || 'Pending'
                  })()}
                </span>
              </p>
              <p><strong>Fulfillment Status:</strong> 
                <span class="status-badge ${order.fulfillment_status === 'fulfilled' ? 'status-fulfilled' : 'status-pending'}">
                  ${order.fulfillment_status === 'fulfilled' ? 'Fulfilled' : order.fulfillment_status || 'Pending'}
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
                    ${item.purchase_type && item.purchase_type !== 'one-time' 
                      ? `<br><span style="color: #14b8a6; font-size: 12px;">${item.purchase_type === 'ongoing' ? 'Ongoing Subscription' : 'Prepaid Subscription'}</span>` 
                      : ''}
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
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-500">Order not found</p>
          <Link href="/admin/orders" className="text-teal-600 hover:underline mt-4 inline-block">
            Back to Orders
          </Link>
        </div>
      </div>
    )
  }

  const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Guest'
  const shippingAddress = order.shipping_address || {}

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order {order.order_number}</h1>
            <p className="text-gray-600 mt-1">
              {new Date(order.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            {sendingEmail ? "Sending..." : "Email Customer"}
          </button>
          <button 
            onClick={handleSendInvoice}
            disabled={sendingInvoice}
            className="flex items-center gap-2 px-4 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            {sendingInvoice ? "Sending..." : "Send Invoice"}
          </button>
          <button 
            onClick={handleDownloadInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <FileText className="w-4 h-4" />
            Download Invoice
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fulfillment */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Fulfillment</h2>
              <span
                className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  fulfillmentStatus === "fulfilled"
                    ? "bg-green-50 text-green-700"
                    : fulfillmentStatus === "in-transit"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-50 text-gray-700"
                }`}
              >
                {fulfillmentStatus === "fulfilled"
                  ? "Fulfilled"
                  : fulfillmentStatus === "in-transit"
                    ? "In Transit"
                    : "Unfulfilled"}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fulfillment Status</label>
                <select
                  value={fulfillmentStatus}
                  onChange={(e) => setFulfillmentStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="in-transit">In Transit</option>
                  <option value="fulfilled">Fulfilled</option>
                </select>
              </div>

              {fulfillmentStatus !== "unfulfilled" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Carrier</label>
                    <select
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select carrier...</option>
                      <option value="USPS">USPS</option>
                      <option value="UPS">UPS</option>
                      <option value="FedEx">FedEx</option>
                      <option value="DHL">DHL</option>
                      <option value="4PX">4PX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add notes about this order..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleUpdateFulfillment}
                  disabled={updating || order?.fulfillment_status === 'cancelled'}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updating ? "Updating..." : "Update Fulfillment"}
                </button>
                {order?.fulfillment_status !== 'cancelled' && (
                  <button 
                    onClick={() => setShowCancelDialog(true)}
                    disabled={updating}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Order items */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowAddItemDialog(true)}
                  size="sm"
                  variant="outline"
                  className="text-teal-600 border-teal-300 hover:bg-teal-50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
                {order.user_id && (
                  <Button
                    onClick={() => setShowConvertToSubscriptionDialog(true)}
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Convert to Subscription
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {order.order_items && order.order_items.length > 0 ? (
                order.order_items.map((item: any) => {
                  // Get product image - priority: variant image > primary product image
                  const variant = item.product_variants
                  const product = item.products
                  const productImages = product?.product_images || []
                  
                  // Get primary image from product_images
                  const primaryImage = productImages
                    .filter((img: any) => img.is_primary && !img.variant_id)
                    .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0]
                  
                  const imageUrl = variant?.image_url || 
                    variant?.color_image_url ||
                    primaryImage?.image_url ||
                    "/placeholder.svg"
                  
                  return (
                  <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      <Image
                        src={imageUrl}
                        alt={item.product_title || "Product"}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900">{item.product_title}</p>
                        {item.purchase_type && item.purchase_type !== 'one-time' && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            item.purchase_type === 'subscription' 
                              ? 'bg-blue-50 text-blue-700'
                              : item.purchase_type === 'prepaid'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-gray-50 text-gray-700'
                          }`}>
                            {item.purchase_type === 'subscription' 
                              ? 'Ongoing Subscription'
                              : item.purchase_type === 'prepaid'
                                ? 'Prepaid Subscription'
                                : 'One-time'}
                          </span>
                        )}
                      </div>
                      {item.variant_color && (
                        <p className="text-sm text-gray-500">Color: {item.variant_color}</p>
                      )}
                      {item.sku && (
                        <p className="text-sm text-gray-500">SKU: {item.sku}</p>
                      )}
                      {(item.frequency_months != null || item.prepaid_cycles_remaining != null) && (
                        <div className="text-sm text-gray-500 space-y-0.5">
                          {item.frequency_months != null && (
                            <p>Delivery interval: Every {item.frequency_months} {item.frequency_months === 1 ? 'month' : 'months'}</p>
                          )}
                          {item.prepaid_cycles_remaining != null && (
                            <p>Prepaid cycles: {item.prepaid_cycles_remaining} (before expiry)</p>
                          )}
                        </div>
                      )}
                      {item.purchase_type && (item.purchase_type === 'prepaid' || item.purchase_type === 'subscription') && subscriptionsByItem[item.id] && !item.frequency_months && (
                        <p className="text-sm text-gray-500">
                          Frequency: Every {subscriptionsByItem[item.id].frequency_months} {subscriptionsByItem[item.id].frequency_months === 1 ? 'month' : 'months'}
                        </p>
                      )}
                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs text-gray-600">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <label className="text-xs text-gray-600 ml-2">Price:</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <Button
                            onClick={() => handleSaveEdit(item.id)}
                            size="sm"
                            className="ml-2 h-7 px-2"
                          >
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => setEditingItemId(null)}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          {item.purchase_type && (item.purchase_type === 'prepaid' || item.purchase_type === 'subscription') && subscriptionsByItem[item.id] && (
                            <Link href={`/admin/subscriptions/${subscriptionsByItem[item.id].id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                Manage Subscription
                              </Button>
                            </Link>
                          )}
                          <Button
                            onClick={() => {
                              setSelectedItemForReturn(item)
                              setReturnQuantity(1)
                              setReturnReason("")
                              setReturnDetailedReason("")
                              setShowReturnRequestDialog(true)
                            }}
                            size="sm"
                            variant="default"
                            className="h-7 px-3 text-xs font-semibold bg-teal-600 text-white border-teal-600 hover:bg-teal-700 hover:border-teal-700"
                            title="Request Replacement"
                          >
                            <RotateCcw className="w-3 h-3 mr-1.5" />
                            Request Return
                          </Button>
                          <Button
                            onClick={() => handleEditItem(item)}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteItem(item.id)}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">${parseFloat(item.unit_price || '0').toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Total: ${parseFloat(item.line_total || '0').toFixed(2)}</p>
                    </div>
                  </div>
                  )
                })
              ) : (
                <p className="text-sm text-gray-500">No items found</p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">${parseFloat(order.subtotal || '0').toFixed(2)}</span>
              </div>
              {parseFloat(order.discount_amount || '0') > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium text-green-600">-${parseFloat(order.discount_amount || '0').toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium text-gray-900">${parseFloat(order.shipping_cost || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span className="font-medium text-gray-900">${parseFloat(order.tax_amount || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total</span>
                <span>${parseFloat(order.total || '0').toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Order activity timeline */}
          {activities.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order activity</h2>
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
                        {activity.user_name && (
                          <p className="mt-0.5 text-xs text-gray-500">By {activity.user_name || activity.user_email}</p>
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h2>
            <div className="space-y-4">
              {(() => {
                const orderTotal = parseFloat(order.total || '0')
                const isFreeOrder = orderTotal < 1.0
                const displayStatus = isFreeOrder ? 'Free Order' : (order.payment_status || 'pending')
                
                return (
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                      isFreeOrder
                        ? "bg-purple-50 text-purple-700"
                        : order.payment_status === "paid"
                          ? "bg-green-50 text-green-700"
                          : order.payment_status === "processing"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {displayStatus}
                  </span>
                )
              })()}
              
              {order.payment_status !== 'paid' && (
                <div className="space-y-2 pt-2 border-t">
                  <Button
                    onClick={() => setShowMarkPaidDialog(true)}
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Mark as Paid
                  </Button>
                  {parseFloat(order.total || '0') >= 1.0 && (
                    <>
                      <Button
                        onClick={handleGeneratePaymentLink}
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={generatingPaymentLink}
                      >
                        {generatingPaymentLink ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" />
                            Generate Payment Link
                          </>
                        )}
                      </Button>
                      {paymentLink && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-gray-600 mb-2">Payment Link:</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={paymentLink}
                              readOnly
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(paymentLink)
                                toast.success('Payment link copied to clipboard')
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{customerName}</p>
              <p className="text-sm text-gray-600">{order.customer_email}</p>
              {order.customer_phone && (
                <p className="text-sm text-gray-600">{order.customer_phone}</p>
              )}
            </div>
          </div>

          {/* Shipping address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
              {order.user_id && (
                <Button
                  onClick={handleEditAddress}
                  size="sm"
                  variant="outline"
                  className="text-teal-600 border-teal-300 hover:bg-teal-50"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p>{customerName}</p>
              <p>{shippingAddress.address_line1}</p>
              {shippingAddress.address_line2 && <p>{shippingAddress.address_line2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
              </p>
              <p>{shippingAddress.country}</p>
            </div>
            {order.customer_phone && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Phone Number</p>
                    <p className="text-sm text-gray-900">{order.customer_phone}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Supplier Assignments */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Supplier Assignments</h2>
              <Button
                onClick={() => setShowAssignDialog(true)}
                size="sm"
                variant="outline"
                className="text-teal-600 border-teal-300 hover:bg-teal-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Assign
              </Button>
            </div>
            {supplierAssignments.length === 0 ? (
              <p className="text-sm text-gray-500">No suppliers assigned to this order</p>
            ) : (
              <div className="space-y-3">
                {supplierAssignments.map((assignment) => {
                  const supplier = assignment.profiles
                  const supplierName = supplier?.company_name || 
                    `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
                    supplier?.email || 'Unknown Supplier'
                  
                  return (
                    <div key={assignment.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900">{supplierName}</p>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          assignment.assignment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          assignment.assignment_status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          assignment.assignment_status === 'shipped' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {assignment.assignment_status}
                        </span>
                      </div>
                      {assignment.tracking_number && (
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>
                            Tracking: {assignment.tracking_number} ({assignment.carrier})
                          </p>
                          {(() => {
                            const trackingUrl = getTrackingUrl(assignment.carrier, assignment.tracking_number)
                            return trackingUrl ? (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 hover:text-teal-700 underline"
                              >
                                Track Package →
                              </a>
                            ) : null
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Supplier Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Order to Supplier</DialogTitle>
            <DialogDescription>
              Select a supplier to assign this order to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`.trim() || supplier.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignDialog(false)
                setSelectedSupplier("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignToSupplier}
              disabled={!selectedSupplier || assigning}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {assigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Product to Order</DialogTitle>
            <DialogDescription>
              Select a product and variant to add to this order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Product</label>
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading products...
                </div>
              ) : (
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Choose a product...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {selectedProductId && (
              <div>
                <label className="block text-sm font-medium mb-2">Variant</label>
                {variants.length > 0 ? (
                  <select
                    value={selectedVariantId}
                    onChange={(e) => handleVariantChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Choose a variant...</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.color || 'Default'} - ${parseFloat(variant.price?.toString() || '0').toFixed(2)} {variant.sku ? `(${variant.sku})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">No variants available for this product</p>
                )}
              </div>
            )}
            {selectedVariantId && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Unit Price (optional - defaults to variant price)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addItemPrice}
                    onChange={(e) => setAddItemPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddItemDialog(false)
                setSelectedProductId("")
                setSelectedVariantId("")
                setAddItemQuantity(1)
                setAddItemPrice("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={!selectedProductId || !selectedVariantId}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Add to Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Subscription Dialog */}
      <Dialog open={showConvertToSubscriptionDialog} onOpenChange={setShowConvertToSubscriptionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert Order to Subscription</DialogTitle>
            <DialogDescription>
              Convert this order to a subscription. The customer will not be charged again - billing will start from the next cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!order.user_id && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  This order does not have a customer account. The order must be linked to a customer (user_id) to convert to a subscription.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Subscription Product</label>
              <select
                value={selectedSubscriptionProductId}
                onChange={(e) => setSelectedSubscriptionProductId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                disabled={!order.user_id}
              >
                <option value="">Choose a subscription product...</option>
                {subscriptionProducts.map((subProduct: any) => {
                  const linkedSub = linkedSubscriptions.find((ls: any) => ls.subscription_product_id === subProduct.id)
                  const linkedLabel = linkedSub?.trigger_product?.title ? ` — Linked: ${linkedSub.trigger_product.title}` : ''
                  return (
                    <option key={subProduct.id} value={subProduct.id}>
                      {subProduct.products?.title || 'Product'} - {subProduct.product_variants?.color || 'Variant'}
                      {subProduct.subscription_price ? ` ($${parseFloat(subProduct.subscription_price.toString()).toFixed(2)}/cycle)` : ''}
                      {linkedLabel}
                    </option>
                  )
                })}
              </select>
            </div>
            {selectedSubscriptionProductId && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Purchase Type</label>
                  <select
                    value={subscriptionPurchaseType}
                    onChange={(e) => setSubscriptionPurchaseType(e.target.value as 'ongoing' | 'prepaid')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="ongoing">Ongoing Subscription</option>
                    <option value="prepaid">Prepaid Subscription</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Frequency (months)</label>
                  <input
                    type="number"
                    min="1"
                    value={subscriptionFrequency}
                    onChange={(e) => setSubscriptionFrequency(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={subscriptionQuantity}
                    onChange={(e) => setSubscriptionQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> The customer will not be charged again. The subscription will start billing from the next cycle based on the selected frequency.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConvertToSubscriptionDialog(false)
                setSelectedSubscriptionProductId("")
                setSubscriptionFrequency(1)
                setSubscriptionPurchaseType('ongoing')
                setSubscriptionQuantity(1)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConvertToSubscription}
              disabled={!selectedSubscriptionProductId || !order.user_id || converting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {converting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to Subscription'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog open={showEditAddressDialog} onOpenChange={setShowEditAddressDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shipping Address</DialogTitle>
            <DialogDescription>
              Select an existing address or create a new one. The customer will be notified via email of any changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Phone Number Edit */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Phone Number</label>
                <Button
                  onClick={() => setEditingPhone(!editingPhone)}
                  size="sm"
                  variant="ghost"
                  className="h-7"
                >
                  {editingPhone ? "Cancel" : "Edit"}
                </Button>
              </div>
              {editingPhone ? (
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              ) : (
                <p className="text-sm text-gray-600">{order?.customer_phone || "No phone number"}</p>
              )}
            </div>

            {/* Address Selection */}
            {order?.user_id && customerAddresses.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Existing Address</label>
                <select
                  value={useNewAddress ? "" : selectedAddressId}
                  onChange={(e) => {
                    setSelectedAddressId(e.target.value)
                    setUseNewAddress(false)
                  }}
                  disabled={useNewAddress}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
                >
                  <option value="">Choose an address...</option>
                  {customerAddresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.address_line1}, {addr.city}, {addr.state} {addr.is_default ? "(Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useNewAddress"
                checked={useNewAddress}
                onChange={(e) => {
                  setUseNewAddress(e.target.checked)
                  if (e.target.checked) {
                    setSelectedAddressId("")
                  }
                }}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="useNewAddress" className="text-sm font-medium">
                Create New Address
              </label>
            </div>

            {/* New Address Form */}
            {useNewAddress && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Address Line 1 *</label>
                  <input
                    type="text"
                    value={newAddress.address_line1}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Address Line 2</label>
                  <input
                    type="text"
                    value={newAddress.address_line2}
                    onChange={(e) => setNewAddress({ ...newAddress, address_line2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">City *</label>
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">State *</label>
                    <input
                      type="text"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Postal Code *</label>
                    <input
                      type="text"
                      value={newAddress.postal_code}
                      onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Country *</label>
                    <input
                      type="text"
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditAddressDialog(false)
                setSelectedAddressId("")
                setNewAddress({
                  address_line1: "",
                  address_line2: "",
                  city: "",
                  state: "",
                  postal_code: "",
                  country: "",
                })
                setUseNewAddress(false)
                setEditingPhone(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAddress}
              disabled={updatingAddress || (!useNewAddress && !selectedAddressId)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {updatingAddress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              This will cancel the order and {order?.payment_status === 'paid' ? 'process a refund through Stripe. ' : ''}Supplier assignments will be cancelled immediately.
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
            {order?.payment_status === 'paid' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> A full refund of ${parseFloat(order?.total || '0').toFixed(2)} will be processed through Stripe.
                </p>
              </div>
            )}
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

      {/* Mark as Paid Dialog */}
      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Order as Paid</DialogTitle>
            <DialogDescription>
              Mark order {order?.order_number} as paid. This will update the payment status and record payment details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Method</label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g., Cash, Check, Bank Transfer, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Transaction ID / Reference</label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Transaction ID or reference number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Comments / Notes</label>
              <textarea
                value={paymentComments}
                onChange={(e) => setPaymentComments(e.target.value)}
                placeholder="Additional payment details or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            {order && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600 mb-1">Order Total:</p>
                <p className="text-lg font-semibold text-gray-900">${parseFloat(order.total || '0').toFixed(2)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMarkPaidDialog(false)
                setPaymentMethod("")
                setTransactionId("")
                setPaymentDate(new Date().toISOString().split('T')[0])
                setPaymentComments("")
              }}
              disabled={markingPaid}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={markingPaid}
              className="bg-green-600 hover:bg-green-700"
            >
              {markingPaid ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Marking...
                </>
              ) : (
                'Mark as Paid'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Return/Replacement Dialog */}
      <Dialog open={showReturnRequestDialog} onOpenChange={setShowReturnRequestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Replacement</DialogTitle>
            <DialogDescription>
              Request a replacement for this order item. The supplier will be notified and can ship the replacement.
            </DialogDescription>
          </DialogHeader>
          {selectedItemForReturn && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold text-sm">{selectedItemForReturn.product_title}</p>
                {selectedItemForReturn.variant_color && (
                  <p className="text-sm text-gray-600">Color: {selectedItemForReturn.variant_color}</p>
                )}
                <p className="text-sm text-gray-600">Available Quantity: {selectedItemForReturn.quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Quantity to Replace *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemForReturn.quantity}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason *</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a reason...</option>
                  <option value="Defective">Defective</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Wrong Item">Wrong Item</option>
                  <option value="Quality Issue">Quality Issue</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Detailed Reason (Optional)</label>
                <textarea
                  value={returnDetailedReason}
                  onChange={(e) => setReturnDetailedReason(e.target.value)}
                  placeholder="Provide additional details about the replacement request..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReturnRequestDialog(false)
                setSelectedItemForReturn(null)
                setReturnReason("")
                setReturnDetailedReason("")
                setReturnQuantity(1)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestReturn}
              disabled={!returnReason || !selectedItemForReturn || requestingReturn}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {requestingReturn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Request...
                </>
              ) : (
                'Request Replacement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
