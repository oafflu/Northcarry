"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Mail, Phone, Calendar, ShoppingBag, Package, Edit, MapPin, UserCog, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function CustomerDetailPage() {
  const params = useParams()
  const customerId = params.id as string
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [addresses, setAddresses] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [marketingStatus, setMarketingStatus] = useState<"unknown" | "active" | "unsubscribed">("unknown")
  const [updatingOpt, setUpdatingOpt] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadCustomerData = async () => {
      if (!customerId) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/admin/customers/${customerId}`)
        const data = await response.json()
        
        if (response.ok && data.customer) {
          setCustomer(data.customer)
          setOrders(data.orders || [])
          setAddresses(data.addresses || [])
          
          // Load subscriptions for this customer
          if (data.customer.id) {
            try {
              const subsResponse = await fetch(`/api/admin/subscriptions?userId=${data.customer.id}`)
              if (subsResponse.ok) {
                const subsData = await subsResponse.json()
                setSubscriptions(subsData.subscriptions || [])
              }
            } catch (error) {
              console.error('Error loading subscriptions:', error)
            }
          }
        } else {
          console.error('Failed to load customer:', data.error || 'Unknown error')
          // Customer will remain null, showing "Customer not found" message
        }

        // Load marketing opt-in status
        try {
          const statusRes = await fetch(`/api/admin/customers/email-opt?userId=${customerId}`)
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            if (statusData.success && statusData.status) {
              setMarketingStatus(statusData.status)
            }
          }
        } catch (err) {
          console.error('Error loading marketing status:', err)
        }
      } catch (error) {
        console.error('Error loading customer:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCustomerData()
  }, [customerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading customer details...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Customer not found</p>
        </div>
      </div>
    )
  }

  const customerName = customer.first_name && customer.last_name
    ? `${customer.first_name} ${customer.last_name}`
    : customer.email?.split('@')[0] || 'Customer'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/customers" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Customers
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Customer Details</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch('/api/admin/impersonate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ targetUserId: customerId }),
                })
                const data = await response.json()
                
                if (data.success && data.redirectUrl) {
                  toast.success('Switching to customer account...')
                  window.location.href = data.redirectUrl
                } else {
                  toast.error(data.error || 'Failed to impersonate user')
                }
              } catch (error) {
                console.error('Error impersonating user:', error)
                toast.error('Failed to impersonate user')
              }
            }}
          >
            <UserCog className="w-4 h-4 mr-2" />
            View as Customer
          </Button>
          <Link href={`/admin/customers/${customerId}/edit`}>
            <Button>
              <Edit className="w-4 h-4 mr-2" />
              Edit Customer
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Name</p>
                <p className="text-base font-medium text-gray-900">{customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${customer.email}`} className="text-base text-teal-600 hover:text-teal-700">
                    {customer.email}
                  </a>
                </div>
              </div>
              {customer.phone && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${customer.phone}`} className="text-base text-teal-600 hover:text-teal-700">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-1">Member Since</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-base text-gray-900">
                    {new Date(customer.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Marketing Emails</p>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="marketing-opt"
                      checked={marketingStatus !== "unsubscribed"}
                      disabled={updatingOpt}
                      onCheckedChange={async (checked) => {
                        setUpdatingOpt(true)
                        try {
                          const res = await fetch('/api/admin/customers/email-opt', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: customerId, optIn: checked }),
                          })
                          const data = await res.json()
                          if (res.ok && data.success) {
                            setMarketingStatus(data.status)
                            toast.success(`Marketing emails ${checked ? 'enabled' : 'disabled'} for this customer`)
                          } else {
                            toast.error(data.error || 'Failed to update marketing preference')
                          }
                        } catch (err) {
                          toast.error('Failed to update marketing preference')
                        } finally {
                          setUpdatingOpt(false)
                        }
                      }}
                    />
                    <Label htmlFor="marketing-opt" className="text-sm text-gray-700">
                      {marketingStatus === "unsubscribed" ? "Opted out" : "Opted in"}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Addresses</h2>
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</span>
              </div>
            </div>
            {addresses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No addresses on file</p>
            ) : (
              <div className="space-y-4">
                {addresses.map((address: any) => (
                  <div
                    key={address.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {address.type} Address
                        </span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{address.address_line1}</p>
                      {address.address_line2 && <p>{address.address_line2}</p>}
                      <p>
                        {address.city}, {address.state} {address.postal_code}
                      </p>
                      <p>{address.country}</p>
                      {address.phone && (
                        <p className="flex items-center gap-1 mt-2">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <a href={`tel:${address.phone}`} className="text-teal-600 hover:text-teal-700">
                            {address.phone}
                          </a>
                        </p>
                      )}
                      {address.from_order && (
                        <p className="text-xs text-gray-400 mt-1 italic">From order</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Orders */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Orders</h2>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">{orders.length} orders</span>
              </div>
            </div>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-teal-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{order.order_number}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">${parseFloat(order.total).toFixed(2)}</p>
                        <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${
                          order.fulfillment_status === 'fulfilled'
                            ? 'bg-green-50 text-green-700'
                            : order.fulfillment_status === 'in_transit'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {order.fulfillment_status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {subscriptions.length > 0 && (
                <Link
                  href={`/admin/subscriptions?customer=${customerId}`}
                  className="block w-full px-4 py-2 text-sm font-medium text-center text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <Settings className="w-4 h-4 inline mr-2" />
                  Manage Subscriptions ({subscriptions.length})
                </Link>
              )}
              <Link
                href={`/admin/support?customer=${customerId}`}
                className="block w-full px-4 py-2 text-sm font-medium text-center text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
              >
                View Support Tickets
              </Link>
              <a
                href={`mailto:${customer.email}`}
                className="block w-full px-4 py-2 text-sm font-medium text-center text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Send Email
              </a>
            </div>
          </div>

          {/* Account Stats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Orders</span>
                <span className="text-sm font-medium text-gray-900">{orders.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Spent</span>
                <span className="text-sm font-medium text-gray-900">
                  ${orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

