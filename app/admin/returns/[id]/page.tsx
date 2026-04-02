import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Package, Truck } from 'lucide-react'
import { getTrackingUrl } from '@/lib/tracking-urls'

export default async function AdminReturnDetailPage({
  params
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  // Handle both Next.js 14 and 15 params format
  const resolvedParams = 'then' in params ? await params : params
  
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Not authenticated</div>
  }

  // Check if user is admin or partner
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'partner')) {
    return <div>Unauthorized</div>
  }

  const adminSupabase = await createAdminSupabaseClient()

  // Fetch return details
  const { data: returnItem, error } = await adminSupabase
    .from('returns')
    .select(`
      *,
      orders:order_id (
        order_number,
        total
      ),
      profiles:customer_id (
        email,
        first_name,
        last_name
      ),
      order_items:order_item_id (
        product_title,
        variant_color,
        quantity,
        unit_price
      )
    `)
    .eq('id', resolvedParams.id)
    .single()
  
  // Log error for debugging
  if (error) {
    console.error('Error fetching return:', error)
    console.error('Return ID:', resolvedParams.id)
  }

  if (error || !returnItem) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg border p-6 text-center">
          <p className="text-gray-500">Return not found or you don't have access to this return</p>
          {error && (
            <p className="text-xs text-red-500 mt-2">Error: {error.message}</p>
          )}
          <Link href="/admin/returns" className="text-teal-600 hover:underline mt-4 inline-block">
            Back to Returns
          </Link>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'return_shipped':
        return 'bg-purple-100 text-purple-800'
      case 'received':
        return 'bg-indigo-100 text-indigo-800'
      case 'inspected':
        return 'bg-teal-100 text-teal-800'
      case 'refunded':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const order = returnItem.orders as any
  const customer = returnItem.profiles as any
  const orderItem = returnItem.order_items as any

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/admin/returns" className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Returns
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Replacement Request {returnItem.return_number}</h1>
              <p className="text-sm text-gray-500 mt-1">All returns are treated as replacements according to our policy</p>
            </div>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(returnItem.status)}`}>
              {getStatusLabel(returnItem.status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Information */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-bold mb-4">Order Information</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Order Number:</span>
                  <br />
                  <Link href={`/admin/orders/${returnItem.order_id}`} className="text-teal-600 hover:underline">
                    {order?.order_number || 'N/A'}
                  </Link>
                </div>
                <div>
                  <span className="font-semibold">Product:</span>
                  <br />
                  {orderItem?.product_title || 'N/A'}
                  {orderItem?.variant_color && (
                    <span className="text-gray-500"> - {orderItem.variant_color}</span>
                  )}
                </div>
                <div>
                  <span className="font-semibold">Quantity:</span>
                  <br />
                  {returnItem.quantity}
                </div>
                <div>
                  <span className="font-semibold">Unit Price:</span>
                  <br />
                  ${parseFloat(orderItem?.unit_price || '0').toFixed(2)}
                </div>
              </div>
            </div>

            {/* Return Details */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-bold mb-4">Return Details</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Reason:</span>
                  <br />
                  {returnItem.reason}
                </div>
                {returnItem.detailed_reason && (
                  <div>
                    <span className="font-semibold">Detailed Reason:</span>
                    <br />
                    <p className="text-gray-700">{returnItem.detailed_reason}</p>
                  </div>
                )}
                <div>
                  <span className="font-semibold">Requested By:</span>
                  <br />
                  {returnItem.requested_by_admin ? 'Admin' : returnItem.requested_by_partner ? 'Partner' : 'Customer'}
                </div>
                <div>
                  <span className="font-semibold">Created:</span>
                  <br />
                  {new Date(returnItem.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Replacement Shipping */}
            {returnItem.replacement_tracking_number && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Replacement Shipping
                </h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Tracking Number:</span>
                    <br />
                    <a
                      href={getTrackingUrl(returnItem.replacement_carrier || '', returnItem.replacement_tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:underline"
                    >
                      {returnItem.replacement_tracking_number}
                    </a>
                  </div>
                  {returnItem.replacement_carrier && (
                    <div>
                      <span className="font-semibold">Carrier:</span>
                      <br />
                      {returnItem.replacement_carrier}
                    </div>
                  )}
                  {returnItem.replacement_shipped_at && (
                    <div>
                      <span className="font-semibold">Shipped At:</span>
                      <br />
                      {new Date(returnItem.replacement_shipped_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inspection Details */}
            {returnItem.status === 'inspected' && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-xl font-bold mb-4">Inspection Details</h2>
                <div className="space-y-2 text-sm">
                  {returnItem.condition && (
                    <div>
                      <span className="font-semibold">Condition:</span>
                      <br />
                      {returnItem.condition}
                    </div>
                  )}
                  {returnItem.restockable !== null && (
                    <div>
                      <span className="font-semibold">Restockable:</span>
                      <br />
                      {returnItem.restockable ? 'Yes' : 'No'}
                    </div>
                  )}
                  {returnItem.inspection_notes && (
                    <div>
                      <span className="font-semibold">Inspection Notes:</span>
                      <br />
                      <p className="text-gray-700">{returnItem.inspection_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Refund Information */}
            {returnItem.status === 'refunded' && returnItem.refund_amount && (
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-xl font-bold mb-4">Refund Information</h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Refund Amount:</span>
                    <br />
                    ${parseFloat(returnItem.refund_amount.toString()).toFixed(2)}
                  </div>
                  {returnItem.refund_method && (
                    <div>
                      <span className="font-semibold">Refund Method:</span>
                      <br />
                      {returnItem.refund_method}
                    </div>
                  )}
                  {returnItem.refunded_at && (
                    <div>
                      <span className="font-semibold">Refunded At:</span>
                      <br />
                      {new Date(returnItem.refunded_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-bold mb-4">Customer Information</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Email:</span>
                  <br />
                  {customer?.email || 'N/A'}
                </div>
                {customer?.first_name && customer?.last_name && (
                  <div>
                    <span className="font-semibold">Name:</span>
                    <br />
                    {customer.first_name} {customer.last_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

