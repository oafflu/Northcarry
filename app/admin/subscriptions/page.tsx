'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Search, Edit, Trash2, Eye, RefreshCw } from 'lucide-react'
import { getAllSubscriptions, deleteSubscriptionProduct, createSubscriptionsFromPrepaidOrders, findDuplicateSubscriptions, cancelDuplicateSubscriptions, syncSubscriptionStatusesFromStripe } from '@/app/actions/subscriptions'
import { retryFailedSubscriptionOrders } from '@/app/actions/cron'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SubscriptionsPage() {
  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPurchaseType, setFilterPurchaseType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [cancellingDuplicates, setCancellingDuplicates] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null)
  const [syncingStatuses, setSyncingStatuses] = useState(false)

  useEffect(() => {
    loadSubscriptions()
    
    // Check for customer filter in URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const customerId = urlParams.get('customer')
      if (customerId) {
        // Filter subscriptions by customer
        setSearchTerm(customerId)
      }
    }
  }, [])

  const loadSubscriptions = async () => {
    setLoading(true)
    try {
      const result = await getAllSubscriptions()
      if (result.error) {
        console.error('Error loading subscriptions:', result.error)
        toast.error(result.error || 'Failed to load subscriptions')
        setSubscriptions([])
      } else {
        setSubscriptions(result.data || [])
      }
    } catch (error: any) {
      console.error('Unexpected error loading subscriptions:', error)
      toast.error(error?.message || 'Failed to load subscriptions')
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSubscriptions = (subscriptions || []).filter(sub => {
    if (!sub) return false
    
    // Filter by purchase type
    if (filterPurchaseType !== 'all' && sub.purchase_type !== filterPurchaseType) {
      return false
    }
    
    // Filter by status
    if (filterStatus !== 'all' && sub.status !== filterStatus) {
      return false
    }
    
    // Filter by customer ID if search term looks like a UUID
    if (searchTerm && searchTerm.length === 36 && searchTerm.includes('-')) {
      // Likely a customer ID
      return sub.user_id === searchTerm
    }
    
    // Filter by search term
    if (!searchTerm) return true
    
    const productTitle = sub.subscription_products?.products?.title || ''
    const variantColor = sub.subscription_products?.product_variants?.color || ''
    const customerName = `${sub.profiles?.first_name || ''} ${sub.profiles?.last_name || ''}`.trim()
    const customerEmail = sub.profiles?.email || ''
    
    const searchLower = searchTerm.toLowerCase()
    return (
      productTitle.toLowerCase().includes(searchLower) ||
      variantColor.toLowerCase().includes(searchLower) ||
      customerName.toLowerCase().includes(searchLower) ||
      customerEmail.toLowerCase().includes(searchLower)
    )
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">All Subscriptions</h1>
          <p className="text-gray-600 mt-1">View and manage all customer subscriptions</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={async () => {
              if (!confirm("This will sync active subscriptions from Stripe. This may take a few minutes. Continue?")) {
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
                  const response = await fetch("/api/admin/subscriptions/sync-stripe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      limit: 100,
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
                      toast.success(`Sync complete! Imported ${totalImported} subscription(s), skipped ${totalSkipped} existing/duplicate(s)${result.errorCount > 0 ? `. ${result.errorCount} error(s) occurred.` : ''}`)
                      loadSubscriptions()
                    }
                  } else {
                    toast.error(result.error || "Failed to sync subscriptions")
                    break
                  }
                }

                if (hasMore && batch > 10) {
                  toast.warning(`Sync paused after ${batch - 1} batches. Click "Sync from Stripe" again to continue.`)
                }
              } catch (error: any) {
                console.error("Error syncing subscriptions:", error)
                toast.error(error.message || "Failed to sync subscriptions")
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Stripe"}
          </Button>
          <Button
            onClick={async () => {
              if (!confirm("This will create missing subscriptions from existing prepaid orders. Continue?")) {
                return
              }
              setBackfilling(true)
              try {
                const result = await createSubscriptionsFromPrepaidOrders()
                if (result.success) {
                  toast.success(result.message || `Created ${result.created} subscription(s)`)
                  if (result.errors && result.errors.length > 0) {
                    console.error('Backfill errors:', result.errors)
                    toast.warning(`${result.errors.length} error(s) occurred. Check console for details.`)
                  }
                  loadSubscriptions()
                } else {
                  toast.error(result.error || "Failed to backfill subscriptions")
                }
              } catch (error: any) {
                console.error("Error backfilling subscriptions:", error)
                toast.error(error.message || "Failed to backfill subscriptions")
              } finally {
                setBackfilling(false)
              }
            }}
            disabled={backfilling}
            variant="outline"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${backfilling ? "animate-spin" : ""}`} />
            {backfilling ? "Backfilling..." : "Create Missing Prepaid Subscriptions"}
          </Button>
          <Button
            onClick={async () => {
              if (!confirm("This will create missing subscription orders for active subscriptions that should have orders. Continue?")) {
                return
              }
              setRetrying(true)
              try {
                const result = await retryFailedSubscriptionOrders()
                if (result.success) {
                  toast.success(result.message || `Created ${result.created} order(s)`)
                  if (result.errors && result.errors.length > 0) {
                    console.error('Retry errors:', result.errors)
                    toast.warning(`${result.errors.length} error(s) occurred. Check console for details.`)
                  }
                  loadSubscriptions()
                } else {
                  toast.error(result.error || "Failed to retry subscription orders")
                }
              } catch (error: any) {
                console.error("Error retrying subscription orders:", error)
                toast.error(error.message || "Failed to retry subscription orders")
              } finally {
                setRetrying(false)
              }
            }}
            disabled={retrying}
            variant="outline"
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Creating Orders..." : "Create Missing Subscription Orders"}
          </Button>
          <Button
            onClick={async () => {
              if (!confirm("This will sync subscription statuses from Stripe for all subscriptions with Stripe IDs. This ensures local statuses match Stripe. Continue?")) {
                return
              }
              setSyncingStatuses(true)
              try {
                const result = await syncSubscriptionStatusesFromStripe()
                if (result.success) {
                  toast.success(result.message || `Updated ${result.updated} subscription status(es)`)
                  if (result.errors && result.errors.length > 0) {
                    console.error('Status sync errors:', result.errors)
                    toast.warning(`${result.errors.length} error(s) occurred. Check console for details.`)
                  }
                  loadSubscriptions()
                } else {
                  toast.error(result.error || "Failed to sync subscription statuses")
                }
              } catch (error: any) {
                console.error("Error syncing statuses:", error)
                toast.error(error.message || "Failed to sync subscription statuses")
              } finally {
                setSyncingStatuses(false)
              }
            }}
            disabled={syncingStatuses}
            variant="outline"
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncingStatuses ? "animate-spin" : ""}`} />
            {syncingStatuses ? "Syncing Statuses..." : "Sync Statuses from Stripe"}
          </Button>
          <Button
            onClick={async () => {
              setCheckingDuplicates(true)
              try {
                const result = await findDuplicateSubscriptions()
                if (result.success) {
                  setDuplicateInfo(result)
                  if (result.duplicates && result.duplicates.length > 0) {
                    toast.warning(`Found ${result.totalDuplicates} duplicate subscription(s) in ${result.duplicates.length} group(s)`)
                  } else {
                    toast.success("No duplicate subscriptions found")
                    setDuplicateInfo(null)
                  }
                } else {
                  toast.error(result.error || "Failed to check for duplicates")
                }
              } catch (error: any) {
                console.error("Error checking duplicates:", error)
                toast.error(error.message || "Failed to check for duplicates")
              } finally {
                setCheckingDuplicates(false)
              }
            }}
            disabled={checkingDuplicates}
            variant="outline"
            className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checkingDuplicates ? "animate-spin" : ""}`} />
            {checkingDuplicates ? "Checking..." : "Find Duplicate Subscriptions"}
          </Button>
          {duplicateInfo && duplicateInfo.duplicates && duplicateInfo.duplicates.length > 0 && (
            <Button
              onClick={async () => {
                if (!confirm(`This will cancel ${duplicateInfo.totalDuplicates} duplicate subscription(s). The recommended subscription will be kept for each group. This action cannot be undone. Continue?`)) {
                  return
                }
                setCancellingDuplicates(true)
                try {
                  const result = await cancelDuplicateSubscriptions(false) // false = actually cancel, not dry run
                  if (result.success) {
                    toast.success(result.message || `Cancelled ${result.cancelled} duplicate subscription(s)`)
                    if (result.details && result.details.length > 0) {
                      console.log('Cancellation details:', result.details)
                    }
                    setDuplicateInfo(null)
                    loadSubscriptions()
                  } else {
                    toast.error(result.error || "Failed to cancel duplicates")
                  }
                } catch (error: any) {
                  console.error("Error cancelling duplicates:", error)
                  toast.error(error.message || "Failed to cancel duplicates")
                } finally {
                  setCancellingDuplicates(false)
                }
              }}
              disabled={cancellingDuplicates}
              variant="outline"
              className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${cancellingDuplicates ? "animate-spin" : ""}`} />
              {cancellingDuplicates ? "Cancelling..." : `Cancel ${duplicateInfo.totalDuplicates} Duplicate(s)`}
            </Button>
          )}
          <Link href="/admin/subscriptions/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Subscription
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Subscriptions</div>
          <div className="text-2xl font-bold">{subscriptions.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Ongoing</div>
          <div className="text-2xl font-bold text-blue-600">
            {subscriptions.filter(s => s.purchase_type === 'ongoing').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Prepaid</div>
          <div className="text-2xl font-bold text-purple-600">
            {subscriptions.filter(s => s.purchase_type === 'prepaid').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">
            {subscriptions.filter(s => s.status === 'active').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Paused</div>
          <div className="text-2xl font-bold text-yellow-600">
            {subscriptions.filter(s => s.status === 'paused').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Cancelled</div>
          <div className="text-2xl font-bold text-red-600">
            {subscriptions.filter(s => s.status === 'cancelled').length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by product, variant, customer name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-4">
          <select
            value={filterPurchaseType}
            onChange={(e) => setFilterPurchaseType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Purchase Types</option>
            <option value="ongoing">Ongoing</option>
            <option value="prepaid">Prepaid</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Status help note */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
        <span className="font-medium">Status meanings:</span>{' '}
        <strong>Expired</strong> = payment failed (e.g. card declined or past due).{' '}
        Prepaid subscriptions that finish all cycles show as <strong>Completed</strong>.
      </div>

      {/* Duplicate Subscriptions Info */}
      {duplicateInfo && duplicateInfo.duplicates && duplicateInfo.duplicates.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Duplicate Subscriptions Found</h3>
          <p className="text-sm text-yellow-700 mb-3">
            Found {duplicateInfo.totalDuplicates} duplicate subscription(s) in {duplicateInfo.duplicates.length} group(s).
            Review the details below and click "Cancel Duplicates" to remove them.
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {duplicateInfo.duplicates.map((dup: any, idx: number) => (
              <div key={idx} className="bg-white rounded p-3 text-sm">
                <p className="font-medium mb-1">
                  Group {idx + 1}: {dup.subscriptions.length} subscription(s) for user {(dup.subscriptions[0].profiles as any)?.email || 'Unknown'} - Product {(dup.subscriptions[0].subscription_products as any)?.products?.title || 'Unknown'}
                </p>
                <div className="ml-4 space-y-1">
                  {dup.subscriptions.map((sub: any, subIdx: number) => (
                    <div key={sub.id} className={sub.id === dup.recommendedKeep ? "text-green-700 font-medium" : "text-gray-600"}>
                      {sub.id === dup.recommendedKeep ? "✓ KEEP: " : "✗ CANCEL: "}
                      Subscription {sub.id.substring(0, 8)}... 
                      (Status: {sub.status}, Created: {new Date(sub.created_at).toLocaleDateString()}
                      {sub.stripe_subscription_id ? `, Stripe: ${sub.stripe_subscription_id.substring(0, 12)}...` : ''})
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading subscriptions...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Frequency</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Price</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Next Billing</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No subscriptions found matching your search' : 'No subscriptions found'}
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((subscription) => {
                  const product = subscription.subscription_products?.products
                  const variant = subscription.subscription_products?.product_variants
                  const customer = subscription.profiles
                  
                  return (
                    <tr key={subscription.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">
                            {customer?.first_name} {customer?.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{customer?.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{product?.title}</p>
                          <p className="text-sm text-gray-500">{variant?.color}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {subscription.frequency_months} {subscription.frequency_months === 1 ? 'Month' : 'Months'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={subscription.purchase_type === 'prepaid' ? 'default' : 'secondary'}>
                          {subscription.purchase_type === 'prepaid' ? 'Prepaid' : 'Ongoing'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        ${parseFloat(subscription.price_per_cycle?.toString() || '0').toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        {new Date(subscription.next_billing_date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(subscription.status)}>
                          {subscription.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/admin/subscriptions/${subscription.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

