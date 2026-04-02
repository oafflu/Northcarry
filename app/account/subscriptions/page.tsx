'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getCustomerSubscriptions } from '@/app/actions/subscriptions'
import { getSubscriptionSettings } from '@/app/actions/subscription-settings'
import { pauseSubscription, resumeSubscription, cancelSubscription, chargeNow, skipNextOrder } from '@/app/actions/customer-subscriptions'
import { CreditCard, Calendar, CheckCircle, Package, Pause, Play, X, Zap, SkipForward, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'

interface Subscription {
  id: string
  user_id: string
  subscription_product_id: string
  frequency_months: number
  purchase_type: 'ongoing' | 'prepaid'
  quantity: number
  price_per_cycle: number
  total_prepaid_amount?: number
  next_billing_date: string
  next_shipment_date: string
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'completed'
  prepaid_cycles_remaining: number
  created_at: string
  subscription_products?: {
    products?: { id: string; title: string }
    product_variants?: { id: string; sku: string; color: string; price: number }
  }
}

export default function SubscriptionsPage() {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user?.id) return

    setLoading(true)
    const [subscriptionsResult, settingsResult] = await Promise.all([
      getCustomerSubscriptions(),
      getSubscriptionSettings(),
    ])
    
    if (subscriptionsResult.error) {
      toast.error('Failed to load subscriptions')
    } else {
      setSubscriptions(subscriptionsResult.data)
    }
    
    if (settingsResult.data) {
      setSettings(settingsResult.data)
    }
    
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handlePause = async (subscriptionId: string) => {
    setProcessing(subscriptionId)
    try {
      const result = await pauseSubscription(subscriptionId)
      if (result.success) {
        toast.success('Subscription paused successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to pause subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause subscription')
    } finally {
      setProcessing(null)
    }
  }

  const handleResume = async (subscriptionId: string) => {
    setProcessing(subscriptionId)
    try {
      const result = await resumeSubscription(subscriptionId)
      if (result.success) {
        toast.success('Subscription resumed successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to resume subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume subscription')
    } finally {
      setProcessing(null)
    }
  }

  const handleCancel = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription? This action cannot be undone.')) return
    
    setProcessing(subscriptionId)
    try {
      const result = await cancelSubscription(subscriptionId)
      if (result.success) {
        toast.success('Subscription cancelled successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to cancel subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription')
    } finally {
      setProcessing(null)
    }
  }

  const handleChargeNow = async (subscriptionId: string) => {
    if (!confirm('This will charge your payment method immediately. Continue?')) return
    
    setProcessing(subscriptionId)
    try {
      const result = await chargeNow(subscriptionId)
      if (result.success) {
        toast.success('Payment processed successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to process payment')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment')
    } finally {
      setProcessing(null)
    }
  }

  const handleSkip = async (subscriptionId: string) => {
    if (!confirm('This will skip the next scheduled order. Continue?')) return
    
    setProcessing(subscriptionId)
    try {
      const result = await skipNextOrder(subscriptionId)
      if (result.success) {
        toast.success('Next order skipped successfully')
        loadData()
      } else {
        toast.error(result.error || 'Failed to skip order')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to skip order')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="mt-4 text-gray-600">Loading subscriptions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="mt-1 text-gray-600">Manage your active subscriptions</p>
      </div>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <CreditCard className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-bold">No active subscriptions</h3>
          <p className="mb-6 text-gray-600">
            You don't have any active subscriptions yet. Subscribe to products to save on recurring deliveries.
          </p>
          <Button onClick={() => window.location.href = '/product'}>
            Browse Products
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((subscription) => {
            const product = subscription.subscription_products?.products
            const variant = subscription.subscription_products?.product_variants
            const isProcessing = processing === subscription.id
            
            return (
              <div key={subscription.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{product?.title || 'Product'}</h3>
                      <Badge className={getStatusColor(subscription.status)}>
                        {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                      </Badge>
                      {subscription.purchase_type === 'prepaid' && (
                        <Badge variant="secondary">
                          Prepaid
                        </Badge>
                      )}
                    </div>
                    {variant && (
                      <p className="text-sm text-gray-600 mb-3">
                        {variant.color} • SKU: {variant.sku} • Qty: {subscription.quantity}
                      </p>
                    )}
                    {(settings?.allowChangingQuantity !== 'none' || 
                      settings?.allowChangingSellingPlans || 
                      settings?.allowSwappingProducts !== 'none') && (
                      <Link href={`/account/subscriptions/${subscription.id}`}>
                        <Button variant="outline" size="sm" className="mt-2">
                          Manage Subscription
                        </Button>
                      </Link>
                    )}
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Delivery: Every {subscription.frequency_months} {subscription.frequency_months === 1 ? 'month' : 'months'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <span>
                          ${subscription.price_per_cycle.toFixed(2)} per {subscription.frequency_months === 1 ? 'month' : 'cycle'}
                          {subscription.purchase_type === 'prepaid' && subscription.total_prepaid_amount && (
                            <span className="text-gray-500"> (Total: ${subscription.total_prepaid_amount.toFixed(2)})</span>
                          )}
                        </span>
                      </div>
                      {subscription.status === 'active' && (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>
                              Next billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span>
                              Next shipment: {new Date(subscription.next_shipment_date).toLocaleDateString()}
                            </span>
                          </div>
                          {subscription.purchase_type === 'prepaid' && subscription.prepaid_cycles_remaining > 0 && (
                            <div className="text-xs text-gray-500">
                              {subscription.prepaid_cycles_remaining} {subscription.prepaid_cycles_remaining === 1 ? 'cycle' : 'cycles'} remaining
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {subscription.status === 'active' && (
                      <>
                        {settings?.showPauseResumeButtons && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handlePause(subscription.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4 mr-2" />
                            )}
                            Pause
                          </Button>
                        )}
                        {settings?.showChargeNowButton && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleChargeNow(subscription.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            Charge Now
                          </Button>
                        )}
                        {settings?.showSkipPaymentButton && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSkip(subscription.id)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <SkipForward className="h-4 w-4 mr-2" />
                            )}
                            Skip Payment
                          </Button>
                        )}
                        {settings?.showCancelButton && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCancel(subscription.id)} 
                            className="text-red-600 hover:text-red-700"
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <X className="h-4 w-4 mr-2" />
                            )}
                            Cancel
                          </Button>
                        )}
                      </>
                    )}
                    {subscription.status === 'paused' && settings?.showPauseResumeButtons && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleResume(subscription.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
