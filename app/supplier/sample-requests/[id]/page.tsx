'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X, Truck, Package, FileText, DollarSign, Image as ImageIcon, ExternalLink, MapPin } from 'lucide-react'
import { getTrackingUrl, getCarrierDisplayName } from '@/lib/tracking-urls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { getSampleRequestById, updateSampleRequestPricing, updateSampleRequestStatus } from '@/app/actions/sample-requests'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/translations/supplier/context'
import Image from 'next/image'

export default function SupplierSampleRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const requestId = params.id as string

  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Pricing state
  const [samplePrice, setSamplePrice] = useState('0.00')
  const [shippingCost, setShippingCost] = useState('0.00')
  const [pricingModel, setPricingModel] = useState<'free' | 'free_sample_paid_shipping' | 'paid_sample_free_shipping' | 'paid_sample_paid_shipping'>('free')
  const [supplierNotes, setSupplierNotes] = useState('')
  
  // Status update state
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingCarrier, setShippingCarrier] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  
  const [updatingPricing, setUpdatingPricing] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showPricingDialog, setShowPricingDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [statusAction, setStatusAction] = useState<'approve' | 'reject' | 'ship' | 'deliver' | null>(null)

  useEffect(() => {
    if (requestId) {
      loadRequest()
    }
  }, [requestId])

  useEffect(() => {
    if (request) {
      setSamplePrice(parseFloat(request.sample_price || '0').toFixed(2))
      setShippingCost(parseFloat(request.shipping_cost || '0').toFixed(2))
      setPricingModel(request.pricing_model || 'free')
      setSupplierNotes(request.supplier_notes || '')
      setTrackingNumber(request.tracking_number || '')
      setShippingCarrier(request.shipping_carrier || '')
    }
  }, [request])

  const loadRequest = async () => {
    setLoading(true)
    try {
      const result = await getSampleRequestById(requestId)
      if (result.error) {
        toast.error(t('sampleRequests.details.failedToLoad'))
        router.push('/supplier/research-updates')
      } else {
        setRequest(result.data)
      }
    } catch (error) {
      console.error('Error loading sample request:', error)
      toast.error(t('sampleRequests.details.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePricing = async () => {
    setUpdatingPricing(true)
    try {
      const result = await updateSampleRequestPricing(requestId, {
        sample_price: parseFloat(samplePrice),
        shipping_cost: parseFloat(shippingCost),
        pricing_model: pricingModel,
        supplier_notes: supplierNotes || undefined,
      })

      if (result.success) {
        toast.success(t('sampleRequests.details.pricingUpdated'))
        setShowPricingDialog(false)
        loadRequest()
      } else {
        toast.error(result.error || t('sampleRequests.details.failedToUpdatePricing'))
      }
    } catch (error: any) {
      console.error('Error updating pricing:', error)
      toast.error(error.message || t('sampleRequests.details.failedToUpdatePricing'))
    } finally {
      setUpdatingPricing(false)
    }
  }

  const handleStatusUpdate = async (status: 'approved' | 'rejected' | 'shipped' | 'delivered') => {
    setUpdatingStatus(true)
    try {
      const result = await updateSampleRequestStatus(requestId, status, {
        tracking_number: status === 'shipped' ? trackingNumber : undefined,
        shipping_carrier: status === 'shipped' ? shippingCarrier : undefined,
        supplier_notes: statusNotes || undefined,
      })

      if (result.success) {
        const successMessage = 
          status === 'approved' ? t('sampleRequests.details.requestApproved') :
          status === 'rejected' ? t('sampleRequests.details.requestRejected') :
          status === 'shipped' ? t('sampleRequests.details.requestShipped') :
          t('sampleRequests.details.requestDelivered')
        toast.success(successMessage)
        setShowStatusDialog(false)
        setStatusAction(null)
        loadRequest()
      } else {
        toast.error(result.error || t('sampleRequests.details.failedToUpdateStatus'))
      }
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast.error(error.message || t('sampleRequests.details.failedToUpdateStatus'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const calculateTotal = () => {
    if (pricingModel === 'free') return 0.00
    if (pricingModel === 'free_sample_paid_shipping') return parseFloat(shippingCost) || 0
    if (pricingModel === 'paid_sample_free_shipping') return parseFloat(samplePrice) || 0
    if (pricingModel === 'paid_sample_paid_shipping') return (parseFloat(samplePrice) || 0) + (parseFloat(shippingCost) || 0)
    return 0.00
  }

  const getProductName = () => {
    if (!request) return ''
    if (request.request_type === 'custom_product') {
      return request.custom_product_name || t('sampleRequests.customProduct')
    }
    if (request.supplier_inventory) {
      return request.supplier_inventory.product_name
    }
    if (request.products) {
      return request.products.title
    }
    return t('sampleRequests.unknownProduct')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">{t('sampleRequests.details.notFound')}</p>
          <Link href="/supplier/research-updates">
            <Button className="mt-4">{t('sampleRequests.details.backToRequests')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/supplier/research-updates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{t('sampleRequests.details.title')}</h1>
          <p className="text-gray-600 mt-1">{t('sampleRequests.details.requestId')}: {request.id.substring(0, 8)}...</p>
        </div>
        <Badge className={getStatusColor(request.status)}>
          {request.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.productInformation')}</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.requestType')}</Label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {request.request_type === 'custom_product' ? t('sampleRequests.customProduct') : t('sampleRequests.existingProduct')}
                </p>
              </div>

              {request.request_type === 'existing_product' && (
                <>
                  {/* Display all products */}
                  {request.allProducts && request.allProducts.length > 0 ? (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">
                        {t('sampleRequests.details.productName')} ({request.allProducts.length})
                      </Label>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {request.allProducts.map((product: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                {product.sku && (
                                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                )}
                                {product.variant && (
                                  <p className="text-xs text-gray-500">
                                    {t('sampleRequests.color')}: {product.variant.color || 'N/A'}
                                    {product.variant.sku && ` | SKU: ${product.variant.sku}`}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {product.type === 'inventory' ? t('sampleRequests.details.fromSupplierInventory') : t('sampleRequests.details.fromProductsCatalog')}
                                </p>
                              </div>
                              <div className="ml-4 text-right">
                                <p className="text-sm font-semibold text-gray-900">{t('orders.quantity')}: {product.quantity}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Fallback for backward compatibility (single product)
                    <>
                      {(request.supplier_inventory_ids && request.supplier_inventory_ids.length > 0) ||
                       (request.product_ids && request.product_ids.length > 0) ? (
                        <div>
                          <Label className="text-sm font-medium text-gray-500 mb-2 block">
                            {t('sampleRequests.details.productName')} ({((request.supplier_inventory_ids?.length || 0) + (request.product_ids?.length || 0))})
                          </Label>
                          <div className="space-y-2">
                            {request.supplier_inventory && (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-gray-900">
                                  {request.supplier_inventory.product_name}
                                </p>
                                {request.supplier_inventory.sku && (
                                  <p className="text-xs text-gray-500">SKU: {request.supplier_inventory.sku}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{t('sampleRequests.details.fromSupplierInventory')}</p>
                              </div>
                            )}
                            {request.products && !request.supplier_inventory && (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-gray-900">
                                  {request.products.title}
                                </p>
                                {request.product_variants && (
                                  <p className="text-xs text-gray-500">
                                    {t('sampleRequests.color')}: {request.product_variants.color} | SKU: {request.product_variants.sku}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">{t('sampleRequests.details.fromProductsCatalog')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.productName')}</Label>
                          <p className="text-sm font-medium text-gray-900 mt-1">{getProductName()}</p>
                        </div>
                      )}
                      {request.request_type === 'existing_product' && request.product_variants && !request.supplier_inventory && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.variant')}</Label>
                          <p className="text-sm text-gray-700 mt-1">
                            {t('sampleRequests.color')}: {request.product_variants.color} | SKU: {request.product_variants.sku}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {request.request_type === 'custom_product' && (
                <>
                  {request.custom_product_description && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.description')}</Label>
                      <p className="text-sm text-gray-700 mt-1">{request.custom_product_description}</p>
                    </div>
                  )}

                  {request.custom_product_images && request.custom_product_images.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">{t('sampleRequests.details.productImages')}</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {request.custom_product_images.map((url: string, index: number) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                            <Image
                              src={url}
                              alt={`Custom product image ${index + 1}`}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {request.custom_product_links && request.custom_product_links.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">{t('sampleRequests.details.productLinks')}</Label>
                      <div className="space-y-2">
                        {request.custom_product_links.map((link: string, index: number) => (
                          <a
                            key={index}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {link}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {request.request_type === 'existing_product' && request.product_variants && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.variant')}</Label>
                  <p className="text-sm text-gray-700 mt-1">
                    {t('sampleRequests.color')}: {request.product_variants.color} | SKU: {request.product_variants.sku}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.shippingAddress')}</h2>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{request.shipping_address?.name}</p>
              <p className="text-sm text-gray-700">{request.shipping_address?.address_line1}</p>
              {request.shipping_address?.address_line2 && (
                <p className="text-sm text-gray-700">{request.shipping_address.address_line2}</p>
              )}
              <p className="text-sm text-gray-700">
                {request.shipping_address?.city}, {request.shipping_address?.state} {request.shipping_address?.postal_code}
              </p>
              <p className="text-sm text-gray-700">{request.shipping_address?.country}</p>
              {request.shipping_address?.phone && (
                <p className="text-sm text-gray-700">Phone: {request.shipping_address.phone}</p>
              )}
            </div>
            {request.shipping_notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.shippingNotes')}</Label>
                <p className="text-sm text-gray-700 mt-1">{request.shipping_notes}</p>
              </div>
            )}
          </div>

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.adminNotes')}</h2>
              <p className="text-sm text-gray-700">{request.admin_notes}</p>
            </div>
          )}

          {/* Fulfillment & Tracking Information */}
          {(request.status === 'shipped' || request.status === 'delivered') && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-teal-600" />
                <h2 className="text-xl font-bold">{t('orders.shipping')} & {t('orders.trackingNumber')}</h2>
              </div>
              {request.tracking_number ? (
                <div className="space-y-4">
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">{t('orders.carrier')}</Label>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {request.shipping_carrier ? getCarrierDisplayName(request.shipping_carrier) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">{t('orders.trackingNumber')}</Label>
                        <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">
                          {request.tracking_number}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const trackingUrl = request.shipping_carrier && request.tracking_number
                        ? getTrackingUrl(request.shipping_carrier, request.tracking_number)
                        : null
                      return trackingUrl ? (
                        <div className="mt-4">
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t('orders.trackPackage') || 'Track Package'}
                          </a>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    {request.shipped_at && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">{t('orders.shippedDate') || 'Shipped Date'}</Label>
                        <p className="text-sm text-gray-900 mt-1">
                          {new Date(request.shipped_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                    {request.delivered_at && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">{t('orders.deliveredDate') || 'Delivered Date'}</Label>
                        <p className="text-sm text-gray-900 mt-1">
                          {new Date(request.delivered_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    {t('sampleRequests.details.noTrackingInfo') || 'Tracking information has not been provided yet.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.pricing')}</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.samplePrice')}</Label>
                <p className="text-lg font-semibold text-gray-900">${parseFloat(request.sample_price || '0').toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.shippingCost')}</Label>
                <p className="text-lg font-semibold text-gray-900">${parseFloat(request.shipping_cost || '0').toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.pricingModel')}</Label>
                <p className="text-sm text-gray-700 mt-1 capitalize">
                  {request.pricing_model === 'free' ? t('sampleRequests.details.free') :
                   request.pricing_model === 'free_sample_paid_shipping' ? t('sampleRequests.details.freeSamplePaidShipping') :
                   request.pricing_model === 'paid_sample_free_shipping' ? t('sampleRequests.details.paidSampleFreeShipping') :
                   request.pricing_model === 'paid_sample_paid_shipping' ? t('sampleRequests.details.paidSamplePaidShipping') :
                   request.pricing_model?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.totalAmount')}</Label>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(request.total_amount || '0').toFixed(2)}</p>
              </div>
              {request.status === 'pending' && (
                <Button
                  onClick={() => setShowPricingDialog(true)}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  {t('sampleRequests.details.updatePricing')}
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.actions')}</h2>
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    setStatusAction('approve')
                    setShowStatusDialog(true)
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('sampleRequests.details.approveRequest')}
                </Button>
                <Button
                  onClick={() => {
                    setStatusAction('reject')
                    setShowStatusDialog(true)
                  }}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('sampleRequests.details.rejectRequest')}
                </Button>
              </div>
            </div>
          )}

          {request.status === 'approved' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('orders.shipping')}</h2>
              <Button
                onClick={() => {
                  setStatusAction('ship')
                  setShowStatusDialog(true)
                }}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Truck className="w-4 h-4 mr-2" />
                {t('sampleRequests.details.markAsShipped')}
              </Button>
            </div>
          )}

          {request.status === 'shipped' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.fulfillment') || 'Fulfillment'}</h2>
              {request.tracking_number && (
                <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{t('orders.carrier')}</Label>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {request.shipping_carrier ? getCarrierDisplayName(request.shipping_carrier) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{t('orders.trackingNumber')}</Label>
                    <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">
                      {request.tracking_number}
                    </p>
                  </div>
                  {(() => {
                    const trackingUrl = request.shipping_carrier && request.tracking_number
                      ? getTrackingUrl(request.shipping_carrier, request.tracking_number)
                      : null
                    return trackingUrl ? (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t('orders.trackPackage') || 'Track Package'}
                      </a>
                    ) : null
                  })()}
                </div>
              )}
              <Button
                onClick={() => {
                  setStatusAction('deliver')
                  setShowStatusDialog(true)
                }}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Package className="w-4 h-4 mr-2" />
                {t('sampleRequests.details.markAsDelivered')}
              </Button>
            </div>
          )}

          {/* Supplier Notes */}
          {request.supplier_notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">Your Notes</h2>
              <p className="text-sm text-gray-700">{request.supplier_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Dialog */}
      {showPricingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">{t('sampleRequests.details.updatePricing')}</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="samplePrice">{t('sampleRequests.details.samplePrice')} ($)</Label>
                <Input
                  id="samplePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={samplePrice}
                  onChange={(e) => setSamplePrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shippingCost">{t('sampleRequests.details.shippingCost')} ($)</Label>
                <Input
                  id="shippingCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pricingModel">{t('sampleRequests.details.pricingModel')}</Label>
                <Select value={pricingModel} onValueChange={(value: any) => setPricingModel(value)}>
                  <SelectTrigger id="pricingModel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">{t('sampleRequests.details.free')}</SelectItem>
                    <SelectItem value="free_sample_paid_shipping">{t('sampleRequests.details.freeSamplePaidShipping')}</SelectItem>
                    <SelectItem value="paid_sample_free_shipping">{t('sampleRequests.details.paidSampleFreeShipping')}</SelectItem>
                    <SelectItem value="paid_sample_paid_shipping">{t('sampleRequests.details.paidSamplePaidShipping')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <Label className="text-sm font-medium text-gray-500">{t('sampleRequests.details.totalAmount')}</Label>
                <p className="text-xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</p>
              </div>
              <div>
                <Label htmlFor="supplierNotes">{t('sampleRequests.details.supplierNotes')} ({t('common.all')})</Label>
                <Textarea
                  id="supplierNotes"
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowPricingDialog(false)}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleUpdatePricing}
                disabled={updatingPricing}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {updatingPricing ? t('sampleRequests.details.updating') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Dialog */}
      {showStatusDialog && statusAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {statusAction === 'approve' && t('sampleRequests.details.approveDialogTitle')}
              {statusAction === 'reject' && t('sampleRequests.details.rejectDialogTitle')}
              {statusAction === 'ship' && t('sampleRequests.details.shipDialogTitle')}
              {statusAction === 'deliver' && t('sampleRequests.details.deliverDialogTitle')}
            </h2>
            <div className="space-y-4">
              {statusAction === 'ship' && (
                <>
                  <div>
                    <Label htmlFor="shippingCarrier">{t('sampleRequests.details.shippingCarrier')} *</Label>
                    <Input
                      id="shippingCarrier"
                      value={shippingCarrier}
                      onChange={(e) => setShippingCarrier(e.target.value)}
                      placeholder={t('sampleRequests.details.enterCarrier')}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="trackingNumber">{t('sampleRequests.details.trackingNumber')} *</Label>
                    <Input
                      id="trackingNumber"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={t('sampleRequests.details.enterTrackingNumber')}
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="statusNotes">{t('sampleRequests.details.statusNotes')}</Label>
                <Textarea
                  id="statusNotes"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                  placeholder={t('sampleRequests.details.enterNotes')}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStatusDialog(false)
                  setStatusAction(null)
                }}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (statusAction === 'approve') handleStatusUpdate('approved')
                  else if (statusAction === 'reject') handleStatusUpdate('rejected')
                  else if (statusAction === 'ship') {
                    if (!trackingNumber || !shippingCarrier) {
                      toast.error(t('orders.missingRequiredInfo'))
                      return
                    }
                    handleStatusUpdate('shipped')
                  }
                  else if (statusAction === 'deliver') handleStatusUpdate('delivered')
                }}
                disabled={updatingStatus}
                className={`flex-1 ${
                  statusAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  statusAction === 'approve' || statusAction === 'deliver' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {updatingStatus ? t('sampleRequests.details.updating') : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

