'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, FileText, ExternalLink, DollarSign, Truck, MapPin } from 'lucide-react'
import { getTrackingUrl, getCarrierDisplayName } from '@/lib/tracking-urls'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { getSampleRequestById } from '@/app/actions/sample-requests'
import { toast } from 'sonner'
import Image from 'next/image'

export default function AdminSampleRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string

  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (requestId) {
      loadRequest()
    }
  }, [requestId])

  const loadRequest = async () => {
    setLoading(true)
    try {
      const result = await getSampleRequestById(requestId)
      if (result.error) {
        toast.error('Failed to load sample request')
        router.push('/admin/sample-requests')
      } else {
        setRequest(result.data)
      }
    } catch (error) {
      console.error('Error loading sample request:', error)
      toast.error('Failed to load sample request')
    } finally {
      setLoading(false)
    }
  }

  const getProductName = () => {
    if (!request) return ''
    if (request.request_type === 'custom_product') {
      return request.custom_product_name || 'Custom Product'
    }
    if (request.supplier_inventory) {
      return request.supplier_inventory.product_name
    }
    if (request.products) {
      return request.products.title
    }
    return 'Unknown Product'
  }

  const getSupplierName = () => {
    if (!request) return ''
    const supplier = request.supplier
    if (supplier?.company_name) return supplier.company_name
    if (supplier?.first_name || supplier?.last_name) {
      return `${supplier.first_name || ''} ${supplier.last_name || ''}`.trim()
    }
    return supplier?.email || 'Unknown Supplier'
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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Sample request not found</p>
          <Link href="/admin/sample-requests">
            <Button className="mt-4">Back to Sample Requests</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/sample-requests">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Sample Request Details</h1>
          <p className="text-gray-600 mt-1">Request ID: {request.id.substring(0, 8)}...</p>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(request.status)}>
            {request.status}
          </Badge>
          <Badge className={getPaymentStatusColor(request.payment_status)}>
            {request.payment_status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Product Information</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Request Type</Label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {request.request_type === 'custom_product' ? 'Custom Product' : 'Existing Product'}
                </p>
              </div>

              {request.request_type === 'existing_product' && (
                <>
                  {/* Display all products */}
                  {request.allProducts && request.allProducts.length > 0 ? (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">
                        Products ({request.allProducts.length})
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
                                    Variant: {product.variant.color || 'N/A'}
                                    {product.variant.sku && ` | SKU: ${product.variant.sku}`}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {product.type === 'inventory' ? 'From Supplier Inventory' : 'From Products Catalog'}
                                </p>
                              </div>
                              <div className="ml-4 text-right">
                                <p className="text-sm font-semibold text-gray-900">Qty: {product.quantity}</p>
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
                            Products ({((request.supplier_inventory_ids?.length || 0) + (request.product_ids?.length || 0))})
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
                                <p className="text-xs text-gray-500 mt-1">From Supplier Inventory</p>
                              </div>
                            )}
                            {request.products && !request.supplier_inventory && (
                              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-medium text-gray-900">
                                  {request.products.title}
                                </p>
                                {request.product_variants && (
                                  <p className="text-xs text-gray-500">
                                    Color: {request.product_variants.color} | SKU: {request.product_variants.sku}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">From Products Catalog</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Product Name</Label>
                          <p className="text-sm font-medium text-gray-900 mt-1">{getProductName()}</p>
                        </div>
                      )}
                      {request.request_type === 'existing_product' && request.product_variants && !request.supplier_inventory && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Variant</Label>
                          <p className="text-sm text-gray-700 mt-1">
                            Color: {request.product_variants.color} | SKU: {request.product_variants.sku}
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
                      <Label className="text-sm font-medium text-gray-500">Description</Label>
                      <p className="text-sm text-gray-700 mt-1">{request.custom_product_description}</p>
                    </div>
                  )}

                  {request.custom_product_images && request.custom_product_images.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">Product Images</Label>
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
                      <Label className="text-sm font-medium text-gray-500 mb-2 block">Product Links</Label>
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
                  <Label className="text-sm font-medium text-gray-500">Variant</Label>
                  <p className="text-sm text-gray-700 mt-1">
                    Color: {request.product_variants.color} | SKU: {request.product_variants.sku}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Shipping Address</h2>
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
                <Label className="text-sm font-medium text-gray-500">Shipping Notes</Label>
                <p className="text-sm text-gray-700 mt-1">{request.shipping_notes}</p>
              </div>
            )}
          </div>

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">Admin Notes</h2>
              <p className="text-sm text-gray-700">{request.admin_notes}</p>
            </div>
          )}

          {/* Supplier Notes */}
          {request.supplier_notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">Supplier Notes</h2>
              <p className="text-sm text-gray-700">{request.supplier_notes}</p>
            </div>
          )}

          {/* Fulfillment & Tracking Information */}
          {(request.status === 'shipped' || request.status === 'delivered') && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-teal-600" />
                <h2 className="text-xl font-bold">Fulfillment & Tracking Details</h2>
              </div>
              {request.tracking_number ? (
                <div className="space-y-4">
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Shipping Carrier</Label>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {request.shipping_carrier ? getCarrierDisplayName(request.shipping_carrier) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Tracking Number</Label>
                        {(() => {
                          const trackingUrl = request.shipping_carrier && request.tracking_number
                            ? getTrackingUrl(request.shipping_carrier, request.tracking_number)
                            : null
                          return trackingUrl ? (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-teal-600 hover:text-teal-700 hover:underline mt-1 font-mono inline-block"
                            >
                              {request.tracking_number}
                            </a>
                          ) : (
                            <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">
                              {request.tracking_number}
                            </p>
                          )
                        })()}
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
                            Track Package
                          </a>
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    {request.shipped_at && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Shipped Date</Label>
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
                        <Label className="text-sm font-medium text-gray-500">Delivered Date</Label>
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
                    Tracking information has not been provided yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Supplier Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Supplier</h2>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">{getSupplierName()}</p>
              {request.supplier?.email && (
                <p className="text-sm text-gray-600">{request.supplier.email}</p>
              )}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Pricing</h2>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Sample Price</Label>
                <p className="text-lg font-semibold text-gray-900">${parseFloat(request.sample_price || '0').toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Shipping Cost</Label>
                <p className="text-lg font-semibold text-gray-900">${parseFloat(request.shipping_cost || '0').toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Pricing Model</Label>
                <p className="text-sm text-gray-700 mt-1 capitalize">
                  {request.pricing_model?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(request.total_amount || '0').toFixed(2)}</p>
              </div>
              {request.payment_id && (
                <Link href={`/admin/payments`}>
                  <Button variant="outline" className="w-full">
                    <DollarSign className="w-4 h-4 mr-2" />
                    View Payment
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Request Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Request Information</h2>
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-medium text-gray-500">Created</Label>
                <p className="text-sm text-gray-900">{new Date(request.created_at).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                <p className="text-sm text-gray-900">{new Date(request.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


