"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Calendar, DollarSign, Package, User, MapPin, CreditCard, Pause, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { adminPauseSubscription, adminResumeSubscription, adminCancelSubscription } from "@/app/actions/customer-subscriptions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function SubscriptionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const subscriptionId = params.id as string

  const [subscription, setSubscription] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  useEffect(() => {
    if (subscriptionId) {
      loadSubscription()
    }
  }, [subscriptionId])

  const loadSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`)
      const data = await response.json()

      if (!response.ok || !data.subscription) {
        toast.error(data.error || "Subscription not found")
        router.push("/admin/subscriptions")
        return
      }

      setSubscription(data.subscription)
      setOrders(data.orders || [])
    } catch (error: any) {
      console.error("Error loading subscription:", error)
      toast.error("Failed to load subscription")
      router.push("/admin/subscriptions")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "paused":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "expired":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handlePause = async () => {
    if (!subscription) return
    
    setProcessing(true)
    try {
      const result = await adminPauseSubscription(subscription.id, 'Admin requested')
      if (result.success) {
        toast.success('Subscription paused successfully')
        loadSubscription()
      } else {
        toast.error(result.error || 'Failed to pause subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause subscription')
    } finally {
      setProcessing(false)
    }
  }

  const handleResume = async () => {
    if (!subscription) return
    
    setProcessing(true)
    try {
      const result = await adminResumeSubscription(subscription.id)
      if (result.success) {
        toast.success('Subscription resumed successfully')
        loadSubscription()
      } else {
        toast.error(result.error || 'Failed to resume subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume subscription')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (!subscription) return
    
    setProcessing(true)
    try {
      const result = await adminCancelSubscription(subscription.id, cancelReason || 'Admin requested')
      if (result.success) {
        toast.success('Subscription cancelled successfully')
        setShowCancelDialog(false)
        setCancelReason("")
        loadSubscription()
      } else {
        toast.error(result.error || 'Failed to cancel subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Subscription not found</p>
          <Link href="/admin/subscriptions">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Subscriptions
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const customer = subscription.profiles
  const product = subscription.subscription_products?.products
  const variant = subscription.subscription_products?.product_variants
  const address = subscription.addresses

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/subscriptions">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Subscriptions
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subscription Details</h1>
            <p className="text-gray-600 mt-1">View subscription information and order history</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(subscription.status)}>
              {subscription.status}
            </Badge>
            {/* Subscription Actions */}
            {subscription.status === 'active' && (
              <div className="flex gap-2">
                <Button
                  onClick={handlePause}
                  disabled={processing}
                  variant="outline"
                  size="sm"
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Pause className="w-4 h-4 mr-2" />
                  )}
                  Pause
                </Button>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={processing}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            {subscription.status === 'paused' && (
              <div className="flex gap-2">
                <Button
                  onClick={handleResume}
                  disabled={processing}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Resume
                </Button>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={processing}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
            {subscription.status === 'cancelled' && (
              <Badge variant="outline" className="text-gray-500">
                Cancelled
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Subscription Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Product</p>
                <p className="font-medium">{product?.title || "N/A"}</p>
                {variant && (
                  <p className="text-sm text-gray-500">{variant.color} {variant.size ? `- ${variant.size}` : ""}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Frequency</p>
                <p className="font-medium">
                  {subscription.frequency_months} {subscription.frequency_months === 1 ? "Month" : "Months"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Type</p>
                <Badge variant={subscription.purchase_type === "prepaid" ? "default" : "secondary"}>
                  {subscription.purchase_type === "prepaid" ? "Prepaid" : "Ongoing"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Quantity</p>
                <p className="font-medium">{subscription.quantity || 1}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Price per Cycle</p>
                <p className="font-medium">${parseFloat(subscription.price_per_cycle?.toString() || "0").toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Prepaid Amount</p>
                <p className="font-medium">
                  {subscription.total_prepaid_amount 
                    ? `$${parseFloat(subscription.total_prepaid_amount.toString()).toFixed(2)}`
                    : "N/A"}
                </p>
              </div>
              {subscription.stripe_subscription_id && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Stripe Subscription ID</p>
                  <p className="font-mono text-sm">{subscription.stripe_subscription_id}</p>
                </div>
              )}
              {subscription.stripe_customer_id && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Stripe Customer ID</p>
                  <p className="font-mono text-sm">{subscription.stripe_customer_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order History */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Order History</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders found for this subscription</p>
            ) : (
              <div className="space-y-4">
                {orders.map((subOrder: any) => {
                  const order = subOrder.orders
                  return (
                    <div key={subOrder.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">Cycle #{subOrder.cycle_number}</p>
                          {order && (
                            <p className="text-sm text-gray-500">
                              Order: {order.order_number || order.id}
                            </p>
                          )}
                        </div>
                        {order && (
                          <div className="flex gap-2">
                            <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>
                              {order.payment_status}
                            </Badge>
                            <Badge variant={order.fulfillment_status === "fulfilled" ? "default" : "secondary"}>
                              {order.fulfillment_status}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {order && (
                        <>
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <p className="text-sm text-gray-600">Amount</p>
                              <p className="font-medium">${parseFloat(order.total_amount?.toString() || "0").toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Date</p>
                              <p className="font-medium">
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {order.id && (
                            <Link href={`/admin/orders/${order.id}`}>
                              <Button variant="outline" size="sm" className="mt-2">
                                View Order
                              </Button>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">
                  {customer?.first_name} {customer?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{customer?.email}</p>
              </div>
              {customer?.phone && (
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
              )}
              {customer?.id && (
                <Link href={`/admin/customers/${customer.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Customer
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {address && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Shipping Address
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">
                  {address.address_line1}
                  {address.address_line2 ? `, ${address.address_line2}` : ""}
                </p>
                <p>
                  {address.city}, {address.state} {address.postal_code}
                </p>
                <p>{address.country}</p>
              </div>
            </div>
          )}

          {/* Billing Dates */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Important Dates
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Next Billing Date</p>
                <p className="font-medium">
                  {new Date(subscription.next_billing_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Next Shipment Date</p>
                <p className="font-medium">
                  {new Date(subscription.next_shipment_date).toLocaleDateString()}
                </p>
              </div>
              {subscription.prepaid_cycles_remaining !== null && (
                <div>
                  <p className="text-sm text-gray-600">Prepaid Cycles Remaining</p>
                  <p className="font-medium">{subscription.prepaid_cycles_remaining}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-medium">
                  {new Date(subscription.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this subscription? This action cannot be undone.
              {subscription?.stripe_subscription_id && ' The Stripe subscription will also be cancelled.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cancellation Reason (Optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setCancelReason("")
              }}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancel}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

