'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Package, Truck, CheckCircle, Loader2, Edit } from 'lucide-react'
import { acknowledgeOrder, updateOrderStatus, updateShippingDetails } from '@/app/actions/suppliers'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/translations/supplier/context'

export function FulfillmentActions({ assignment }: { assignment: any }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [showShippingDialog, setShowShippingDialog] = useState(false)
  const [showEditShippingDialog, setShowEditShippingDialog] = useState(false)
  const [shippingData, setShippingData] = useState({
    carrier: '',
    trackingNumber: '',
    estimatedDeliveryDate: '',
  })
  const [editShippingData, setEditShippingData] = useState({
    carrier: '',
    trackingNumber: '',
    estimatedDeliveryDate: '',
  })

  const handleAcknowledge = async () => {
    setLoading(true)
    try {
      const result = await acknowledgeOrder(assignment.id)
      if (result.success) {
        toast.success(t('orders.orderAcknowledgedSuccess'), {
          description: t('orders.orderAcknowledgedDesc'),
        })
        router.refresh()
      } else {
        toast.error(t('orders.failedToAcknowledge'), {
          description: result.error || t('common.error'),
        })
      }
    } catch (error: any) {
      console.error('Error acknowledging order:', error)
      toast.error(t('orders.failedToAcknowledge'), {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (status: 'processing' | 'ready' | 'acknowledged') => {
    setLoading(true)
    try {
      const result = await updateOrderStatus(assignment.id, status)
      if (result.success) {
        const statusLabel = 
          status === 'processing' ? t('orders.processing') : 
          status === 'ready' ? t('orders.readyToShip') : 
          t('orders.acknowledged')
        toast.success(`${t('orders.orderMarkedAs')} ${statusLabel}`, {
          description: t('orders.orderStatusUpdated'),
        })
        router.refresh()
      } else {
        toast.error(t('orders.failedToUpdate'), {
          description: result.error || t('common.error'),
        })
      }
    } catch (error: any) {
      console.error('Error updating order status:', error)
      toast.error(t('orders.failedToUpdate'), {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleShip = async () => {
    if (!shippingData.carrier || !shippingData.trackingNumber) {
      toast.error(t('orders.missingRequiredInfo'), {
        description: t('orders.provideCarrierTracking'),
      })
      return
    }

    setLoading(true)
    try {
      const result = await updateOrderStatus(assignment.id, 'shipped', {
        carrier: shippingData.carrier,
        tracking_number: shippingData.trackingNumber,
        estimated_delivery_date: shippingData.estimatedDeliveryDate || undefined,
      })
      if (result.success) {
        toast.success(t('orders.orderMarkedAsShipped'), {
          description: `${t('orders.trackingNumber')}: ${shippingData.trackingNumber} (${shippingData.carrier})`,
        })
        setShowShippingDialog(false)
        setShippingData({ carrier: '', trackingNumber: '', estimatedDeliveryDate: '' })
        router.refresh()
      } else {
        toast.error(t('orders.failedToUpdate'), {
          description: result.error || t('common.error'),
        })
      }
    } catch (error: any) {
      console.error('Error shipping order:', error)
      toast.error(t('orders.failedToUpdate'), {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditShipping = () => {
    // Pre-fill the form with current shipping details
    setEditShippingData({
      carrier: assignment.carrier || '',
      trackingNumber: assignment.tracking_number || '',
      estimatedDeliveryDate: assignment.estimated_delivery_date 
        ? new Date(assignment.estimated_delivery_date).toISOString().split('T')[0]
        : '',
    })
    setShowEditShippingDialog(true)
  }

  const handleUpdateShipping = async () => {
    if (!editShippingData.carrier || !editShippingData.trackingNumber) {
      toast.error(t('orders.missingRequiredInfo'), {
        description: t('orders.provideCarrierTracking'),
      })
      return
    }

    setLoading(true)
    try {
      const result = await updateShippingDetails(assignment.id, {
        carrier: editShippingData.carrier,
        tracking_number: editShippingData.trackingNumber,
        estimated_delivery_date: editShippingData.estimatedDeliveryDate || undefined,
      })
      if (result.success) {
        toast.success('Shipping details updated successfully', {
          description: `${t('orders.trackingNumber')}: ${editShippingData.trackingNumber} (${editShippingData.carrier})`,
        })
        setShowEditShippingDialog(false)
        setEditShippingData({ carrier: '', trackingNumber: '', estimatedDeliveryDate: '' })
        router.refresh()
      } else {
        toast.error('Failed to update shipping details', {
          description: result.error || t('common.error'),
        })
      }
    } catch (error: any) {
      console.error('Error updating shipping details:', error)
      toast.error('Failed to update shipping details', {
        description: error.message || t('common.error'),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <div className="space-y-3">
      {assignment.assignment_status === 'pending' && (
        <Button
          onClick={handleAcknowledge}
          disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700"
          variant="default"
        >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
          <Package className="w-4 h-4 mr-2" />
            )}
            {loading ? t('orders.acknowledging') : t('orders.acknowledgeOrder')}
        </Button>
      )}

      {assignment.assignment_status === 'acknowledged' && (
        <Button
          onClick={() => handleUpdateStatus('processing')}
          disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700"
          variant="default"
        >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
          <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {loading ? t('orders.updating') : t('orders.startProcessing')}
        </Button>
      )}

      {assignment.assignment_status === 'processing' && (
        <Button
          onClick={() => handleUpdateStatus('ready')}
          disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700"
          variant="default"
        >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
          <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {loading ? t('orders.updating') : t('orders.markAsReadyToShip')}
        </Button>
      )}

      {assignment.assignment_status === 'ready' && (
        <div className="space-y-2">
          <Button
            onClick={() => setShowShippingDialog(true)}
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700"
            variant="default"
          >
            <Truck className="w-4 h-4 mr-2" />
            {t('orders.shipOrder')}
          </Button>
          <Button
            onClick={() => handleUpdateStatus('processing')}
            disabled={loading}
            variant="outline"
            className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {loading ? t('orders.updating') : 'Back to Processing'}
          </Button>
          <Button
            onClick={() => handleUpdateStatus('acknowledged')}
            disabled={loading}
            variant="outline"
            className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {loading ? t('orders.updating') : 'Back to Acknowledged'}
          </Button>
        </div>
      )}

      {assignment.assignment_status === 'shipped' && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600 text-center py-2 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="font-medium text-green-800">{t('orders.orderHasBeenShipped')}</p>
            {assignment.tracking_number && (
              <p className="text-xs text-green-700 mt-1">
                {t('orders.trackingNumber')}: {assignment.tracking_number}
              </p>
            )}
          </div>
          <Button
            onClick={handleEditShipping}
            disabled={loading}
            variant="outline"
            className="w-full border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Shipping Details
          </Button>
        </div>
      )}
      </div>

      {/* Shipping Dialog */}
      <Dialog open={showShippingDialog} onOpenChange={setShowShippingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('orders.shipOrderDialog')}</DialogTitle>
            <DialogDescription>
              {t('orders.shipOrderDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="carrier">{t('orders.carrier')} *</Label>
              <select
                id="carrier"
                value={shippingData.carrier}
                onChange={(e) => setShippingData({ ...shippingData, carrier: e.target.value })}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a carrier...</option>
                <option value="UPS">UPS</option>
                <option value="FedEx">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
                <option value="4PX">4PX</option>
              </select>
            </div>
            <div>
              <Label htmlFor="trackingNumber">{t('orders.trackingNumber')} *</Label>
              <Input
                id="trackingNumber"
                placeholder={t('orders.trackingNumberPlaceholder')}
                value={shippingData.trackingNumber}
                onChange={(e) => setShippingData({ ...shippingData, trackingNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="estimatedDeliveryDate">{t('orders.estimatedDeliveryDate')}</Label>
              <Input
                id="estimatedDeliveryDate"
                type="date"
                value={shippingData.estimatedDeliveryDate}
                onChange={(e) => setShippingData({ ...shippingData, estimatedDeliveryDate: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('orders.deliveryDateHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowShippingDialog(false)
                setShippingData({ carrier: '', trackingNumber: '', estimatedDeliveryDate: '' })
              }}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleShip}
              disabled={loading || !shippingData.carrier || !shippingData.trackingNumber}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('orders.shipping')}
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  {t('orders.markAsShipped')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shipping Details Dialog */}
      <Dialog open={showEditShippingDialog} onOpenChange={setShowEditShippingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shipping Details</DialogTitle>
            <DialogDescription>
              Update the shipping information for this order. The customer will be notified if the tracking number changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editCarrier">{t('orders.carrier')} *</Label>
              <select
                id="editCarrier"
                value={editShippingData.carrier}
                onChange={(e) => setEditShippingData({ ...editShippingData, carrier: e.target.value })}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a carrier...</option>
                <option value="UPS">UPS</option>
                <option value="FedEx">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
                <option value="4PX">4PX</option>
              </select>
            </div>
            <div>
              <Label htmlFor="editTrackingNumber">{t('orders.trackingNumber')} *</Label>
              <Input
                id="editTrackingNumber"
                placeholder={t('orders.trackingNumberPlaceholder')}
                value={editShippingData.trackingNumber}
                onChange={(e) => setEditShippingData({ ...editShippingData, trackingNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="editEstimatedDeliveryDate">{t('orders.estimatedDeliveryDate')}</Label>
              <Input
                id="editEstimatedDeliveryDate"
                type="date"
                value={editShippingData.estimatedDeliveryDate}
                onChange={(e) => setEditShippingData({ ...editShippingData, estimatedDeliveryDate: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('orders.deliveryDateHint')}
              </p>
            </div>
    </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditShippingDialog(false)
                setEditShippingData({ carrier: '', trackingNumber: '', estimatedDeliveryDate: '' })
              }}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpdateShipping}
              disabled={loading || !editShippingData.carrier || !editShippingData.trackingNumber}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update Shipping Details
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

