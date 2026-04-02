'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { processReturn } from '@/app/actions/suppliers'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, XCircle, Package, DollarSign, Edit2, Save, X } from 'lucide-react'
import { ReturnActions } from '@/components/supplier/return-actions'
import { useTranslation } from '@/lib/translations/supplier/context'
import { getTrackingUrl } from '@/lib/tracking-urls'
import { updateReplacementShipping } from '@/app/actions/returns'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function SupplierReturnDetailPage() {
  const params = useParams()
  const returnId = (params?.id || '') as string
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [returnItem, setReturnItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditingTracking, setIsEditingTracking] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [customCarrier, setCustomCarrier] = useState('')
  const [savingTracking, setSavingTracking] = useState(false)

  useEffect(() => {
    if (returnId && user) {
      loadReturn()
    }
  }, [returnId, user])

  const loadReturn = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // First check if this return's order is assigned to this supplier
      const { data: returnCheck } = await supabase
        .from('returns')
        .select('order_id, supplier_id, order_item_id')
        .eq('id', returnId)
        .single()

      if (!returnCheck) {
        setError('notFound')
        setLoading(false)
        return
      }

      // Check if supplier has access: either supplier_id matches OR order is assigned to supplier OR order item variant is linked to supplier
      let hasAccess = returnCheck.supplier_id === user.id

      if (!hasAccess && returnCheck.order_id) {
        // Check if order is assigned to this supplier
        const { data: assignment } = await supabase
          .from('supplier_order_assignments')
          .select('supplier_id')
          .eq('order_id', returnCheck.order_id)
          .eq('supplier_id', user.id)
          .single()
        
        hasAccess = !!assignment
      }

      // If still no access, check if the order item's variant is linked to this supplier
      if (!hasAccess && returnCheck.order_item_id) {
        // Get the order item's variant_id
        const { data: orderItem } = await supabase
          .from('order_items')
          .select('variant_id')
          .eq('id', returnCheck.order_item_id)
          .single()

        if (orderItem?.variant_id) {
          // Check if this variant is linked to this supplier
          const { data: supplierLink } = await supabase
            .from('product_supplier_links')
            .select('supplier_id')
            .eq('variant_id', orderItem.variant_id)
            .eq('supplier_id', user.id)
            .eq('is_primary_supplier', true)
            .single()
          
          hasAccess = !!supplierLink
        }
      }

      if (!hasAccess) {
        setError('noAccess')
        setLoading(false)
        return
      }

      // Fetch return details
      const { data: returnData, error: fetchError } = await supabase
        .from('returns')
        .select(`
          *,
          orders (
            order_number,
            total,
            customer_email,
            customer_first_name,
            customer_last_name
          ),
          profiles!returns_customer_id_fkey (
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
        .eq('id', returnId)
        .single()

      // Ensure replacement fields are included
      if (returnData) {
        returnData.replacement_tracking_number = returnData.replacement_tracking_number || null
        returnData.replacement_carrier = returnData.replacement_carrier || null
        returnData.replacement_shipped_at = returnData.replacement_shipped_at || null
      }

      if (fetchError || !returnData) {
        setError('notFound')
      } else {
        setReturnItem(returnData)
      }
    } catch (err) {
      console.error('Error loading return:', err)
      setError('notFound')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      rejected: 'bg-red-100 text-red-800',
      return_shipped: 'bg-purple-100 text-purple-800',
      received: 'bg-green-100 text-green-800',
      inspected: 'bg-teal-100 text-teal-800',
      refunded: 'bg-gray-100 text-gray-800',
      completed: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    return t(`returns.${status}`) || status
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">{t('common.loading')}</p>
      </div>
    )
  }

  if (error || !returnItem) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg border p-6 text-center">
          <p className="text-gray-500">
            {error === 'noAccess' ? t('returns.details.noAccess') : t('returns.details.notFound')}
          </p>
          <Link href="/supplier/returns" className="text-teal-600 hover:underline mt-4 inline-block">
            {t('returns.details.backToReturns')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/supplier/returns"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('returns.details.backToReturns')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {t('returns.details.title')} {returnItem.return_number}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('returns.details.requestedOn')} {new Date(returnItem.created_at).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">{t('returns.details.policy')}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(returnItem.status)}`}>
            {getStatusLabel(returnItem.status)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Return Details */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('returns.details.returnDetails')}</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('returns.details.orderInformation')}</h3>
                <p className="text-sm text-gray-600">
                  {t('returns.details.order')}: {returnItem.orders?.order_number || 'N/A'}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('returns.details.product')}</h3>
                <p className="text-sm">{returnItem.order_items?.product_title || 'N/A'}</p>
                <p className="text-sm text-gray-600">
                  {t('returns.details.color')}: {returnItem.order_items?.variant_color || 'N/A'} • {t('returns.details.quantity')}: {returnItem.quantity}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('returns.details.reason')}</h3>
                <p className="text-sm">{returnItem.reason}</p>
                {returnItem.detailed_reason && (
                  <p className="text-sm text-gray-600 mt-1">{returnItem.detailed_reason}</p>
                )}
              </div>

              {/* Customer Images */}
              {returnItem.customer_images && returnItem.customer_images.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t('returns.details.customerImages')}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(returnItem.customer_images as string[]).map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`${t('returns.details.customerImages')} ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Inspection Results */}
              {returnItem.status === 'inspected' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">{t('returns.details.inspectionResults')}</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{t('returns.details.condition')}:</span>{' '}
                      {returnItem.condition || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">{t('returns.details.restockable')}:</span>{' '}
                      {returnItem.restockable ? t('returns.details.yes') : t('returns.details.no')}
                    </p>
                    {returnItem.inspection_notes && (
                      <p>
                        <span className="font-medium">{t('returns.details.notes')}:</span>{' '}
                        {returnItem.inspection_notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Refund Information */}
              {returnItem.status === 'refunded' && returnItem.refund_amount && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">{t('returns.details.refundInformation')}</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">{t('returns.details.amount')}:</span> ${returnItem.refund_amount.toFixed(2)}
                    </p>
                    <p>
                      <span className="font-medium">{t('returns.details.method')}:</span> {returnItem.refund_method || 'N/A'}
                    </p>
                    {returnItem.refunded_at && (
                      <p>
                        <span className="font-medium">{t('returns.details.refunded')}:</span>{' '}
                        {new Date(returnItem.refunded_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('returns.details.returnTimeline')}</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
                <div>
                  <p className="font-medium">{t('returns.details.returnRequested')}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(returnItem.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {returnItem.approved_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('returns.details.approved')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(returnItem.approved_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.received_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('returns.details.received')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(returnItem.received_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.inspected_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('returns.details.inspected')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(returnItem.inspected_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.refunded_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500 mt-2"></div>
                  <div>
                    <p className="font-medium">{t('returns.details.refunded')}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(returnItem.refunded_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {returnItem.replacement_shipped_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-2"></div>
                  <div>
                    <p className="font-medium">Replacement Shipped</p>
                    <p className="text-sm text-gray-600">
                      {new Date(returnItem.replacement_shipped_at).toLocaleString()}
                    </p>
                    {returnItem.replacement_tracking_number && (
                      <p className="text-sm text-gray-600 mt-1">
                        Tracking: {returnItem.replacement_tracking_number}
                        {returnItem.replacement_carrier && ` (${returnItem.replacement_carrier})`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('returns.details.actions')}</h2>
            <ReturnActions returnItem={returnItem} />
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-bold mb-4">{t('returns.details.customerInformation')}</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">{t('returns.details.email')}:</span>
                <br />
                {returnItem.profiles?.email ||
                  returnItem.orders?.customer_email ||
                  'N/A'}
              </div>
              {(returnItem.profiles?.first_name && returnItem.profiles?.last_name) ||
              (returnItem.orders?.customer_first_name && returnItem.orders?.customer_last_name) ? (
                <div>
                  <span className="font-semibold">{t('returns.details.name')}:</span>
                  <br />
                  {(
                    returnItem.profiles?.first_name ||
                    returnItem.orders?.customer_first_name ||
                    ''
                  )}{' '}
                  {(
                    returnItem.profiles?.last_name ||
                    returnItem.orders?.customer_last_name ||
                    ''
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Replacement Shipping Information */}
          {returnItem.replacement_tracking_number && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Replacement Shipping</h2>
                {!isEditingTracking && (
                  <Button
                    onClick={() => {
                      setIsEditingTracking(true)
                      setTrackingNumber(returnItem.replacement_tracking_number || '')
                      setCarrier(returnItem.replacement_carrier || '')
                      setCustomCarrier('')
                    }}
                    variant="outline"
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Tracking
                  </Button>
                )}
              </div>
              
              {isEditingTracking ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tracking-number">Tracking Number *</Label>
                    <Input
                      id="tracking-number"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="carrier">Carrier *</Label>
                    <Select value={carrier} onValueChange={setCarrier}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USPS">USPS</SelectItem>
                        <SelectItem value="FedEx">FedEx</SelectItem>
                        <SelectItem value="UPS">UPS</SelectItem>
                        <SelectItem value="DHL">DHL</SelectItem>
                        <SelectItem value="4XP">4XP</SelectItem>
                        <SelectItem value="Canada Post">Canada Post</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {carrier === 'Other' && (
                    <div>
                      <Label htmlFor="custom-carrier">Custom Carrier Name *</Label>
                      <Input
                        id="custom-carrier"
                        value={customCarrier}
                        onChange={(e) => setCustomCarrier(e.target.value)}
                        placeholder="Enter carrier name"
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={async () => {
                        if (!trackingNumber.trim()) {
                          toast.error('Please enter a tracking number')
                          return
                        }
                        if (!carrier) {
                          toast.error('Please select a carrier')
                          return
                        }
                        if (carrier === 'Other' && !customCarrier.trim()) {
                          toast.error('Please enter a custom carrier name')
                          return
                        }
                        
                        setSavingTracking(true)
                        try {
                          const finalCarrier = carrier === 'Other' ? customCarrier : carrier
                          const result = await updateReplacementShipping(returnItem.id, {
                            tracking_number: trackingNumber.trim(),
                            carrier: finalCarrier
                          })
                          if (result.success) {
                            toast.success('Tracking information updated successfully')
                            setIsEditingTracking(false)
                            // Reload return data
                            loadReturn()
                          } else {
                            toast.error(result.error || 'Failed to update tracking information')
                          }
                        } catch (error: any) {
                          console.error('Error updating tracking:', error)
                          toast.error(error.message || 'Failed to update tracking information')
                        } finally {
                          setSavingTracking(false)
                        }
                      }}
                      disabled={savingTracking || !trackingNumber.trim() || !carrier || (carrier === 'Other' && !customCarrier.trim())}
                      className="flex-1"
                      variant="default"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingTracking ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditingTracking(false)
                        setTrackingNumber('')
                        setCarrier('')
                        setCustomCarrier('')
                      }}
                      variant="outline"
                      disabled={savingTracking}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Tracking Number:</span>
                    <br />
                    <a
                      href={getTrackingUrl(returnItem.replacement_carrier || '', returnItem.replacement_tracking_number) || `https://www.google.com/search?q=${encodeURIComponent(returnItem.replacement_carrier || '')}+tracking+${encodeURIComponent(returnItem.replacement_tracking_number)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 underline"
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
                      <span className="font-semibold">Shipped:</span>
                      <br />
                      {new Date(returnItem.replacement_shipped_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
