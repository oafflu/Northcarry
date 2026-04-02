'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, XCircle, Package, DollarSign, Truck, Mail } from 'lucide-react'
import { processReturn } from '@/app/actions/suppliers'
import { updateReplacementShipping, resendReplacementShippedEmails } from '@/app/actions/returns'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const CARRIERS = [
  'USPS',
  'FedEx',
  'UPS',
  'DHL',
  '4XP',
  'Canada Post',
  'Other',
]

export function ReturnActions({ returnItem }: { returnItem: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showReplacementShipping, setShowReplacementShipping] = useState(false)
  const [replacementTracking, setReplacementTracking] = useState('')
  const [replacementCarrier, setReplacementCarrier] = useState('')
  const [customCarrier, setCustomCarrier] = useState('')

  // Show replacement form if return is approved and no tracking yet
  useEffect(() => {
    if (returnItem.status === 'approved' && !returnItem.replacement_tracking_number) {
      setShowReplacementShipping(true)
    }
  }, [returnItem.status, returnItem.replacement_tracking_number])

  const handleApprove = async () => {
    setLoading(true)
    try {
      const result = await processReturn(returnItem.id, 'approve')
      if (result.success) {
        toast.success('Return approved successfully')
        setShowReplacementShipping(true) // Show replacement form after approval
        // Wait a moment for the database to commit, then redirect
        setTimeout(() => {
          router.push('/supplier/returns?tab=approved&refresh=' + Date.now())
        }, 500)
      } else {
        toast.error(result.error || 'Failed to approve return')
      }
    } catch (error: any) {
      console.error('Error approving return:', error)
      toast.error(error.message || 'Failed to approve return')
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this return?')) {
      return
    }

    setLoading(true)
    try {
      const result = await processReturn(returnItem.id, 'reject')
      if (result.success) {
        toast.success('Return rejected')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to reject return')
      }
    } catch (error: any) {
      console.error('Error rejecting return:', error)
      toast.error(error.message || 'Failed to reject return')
    } finally {
      setLoading(false)
    }
  }

  const handleReceive = async () => {
    setLoading(true)
    try {
      const result = await processReturn(returnItem.id, 'receive')
      if (result.success) {
        toast.success('Return marked as received')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to mark as received')
      }
    } catch (error: any) {
      console.error('Error receiving return:', error)
      toast.error(error.message || 'Failed to mark as received')
    } finally {
      setLoading(false)
    }
  }

  const handleInspect = async () => {
    const condition = prompt('Enter condition (excellent, good, fair, poor, damaged):')
    if (!condition) return

    const restockable = confirm('Is this item restockable?')
    const notes = prompt('Enter inspection notes (optional):') || ''

    setLoading(true)
    try {
      const result = await processReturn(returnItem.id, 'inspect', {
        condition,
        restockable,
        inspection_notes: notes
      })
      if (result.success) {
        toast.success('Return inspected successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to inspect return')
      }
    } catch (error: any) {
      console.error('Error inspecting return:', error)
      toast.error(error.message || 'Failed to inspect return')
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async () => {
    const amount = prompt('Enter refund amount:')
    if (!amount) return

    const method = prompt('Enter refund method (e.g., original payment, store credit):')
    if (!method) return

    setLoading(true)
    try {
      const result = await processReturn(returnItem.id, 'refund', {
        refund_amount: parseFloat(amount),
        refund_method: method
      })
      if (result.success) {
        toast.success('Refund processed successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to process refund')
      }
    } catch (error: any) {
      console.error('Error processing refund:', error)
      toast.error(error.message || 'Failed to process refund')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {returnItem.status === 'requested' && (
        <>
          <Button
            onClick={handleApprove}
            disabled={loading}
            className="w-full"
            variant="default"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve Return
          </Button>
          <Button
            onClick={handleReject}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject Return
          </Button>
        </>
      )}

      {returnItem.status === 'return_shipped' && (
        <Button
          onClick={handleReceive}
          disabled={loading}
          className="w-full"
          variant="default"
        >
          <Package className="w-4 h-4 mr-2" />
          Mark as Received
        </Button>
      )}

      {returnItem.status === 'received' && (
        <Button
          onClick={handleInspect}
          disabled={loading}
          className="w-full"
          variant="default"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Inspect Item
        </Button>
      )}

      {returnItem.status === 'inspected' && returnItem.restockable && (
        <Button
          onClick={handleRefund}
          disabled={loading}
          className="w-full"
          variant="default"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Process Refund
        </Button>
      )}

      {/* Replacement Shipping - Available after approval */}
      {(returnItem.status === 'approved' || returnItem.status === 'received' || returnItem.status === 'inspected' || returnItem.status === 'completed') && (
        <>
          {!showReplacementShipping && !returnItem.replacement_tracking_number && (
            <Button
              onClick={() => setShowReplacementShipping(true)}
              disabled={loading}
              className="w-full"
              variant="default"
            >
              <Truck className="w-4 h-4 mr-2" />
              Ship Replacement
            </Button>
          )}

          {showReplacementShipping && !returnItem.replacement_tracking_number && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <div>
                <h3 className="font-semibold mb-3 text-gray-900">Ship Replacement</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add tracking information for the replacement shipment. This will notify the customer, admin, and partner.
                </p>
              </div>
              
              <div>
                <Label htmlFor="tracking-number">Tracking Number *</Label>
                <Input
                  id="tracking-number"
                  value={replacementTracking}
                  onChange={(e) => setReplacementTracking(e.target.value)}
                  placeholder="Enter tracking number"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="carrier">Carrier *</Label>
                <Select value={replacementCarrier} onValueChange={(value) => {
                  setReplacementCarrier(value)
                  if (value !== 'Other') {
                    setCustomCarrier('')
                  }
                }}>
                  <SelectTrigger id="carrier" className="mt-1">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>{carrier}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {replacementCarrier === 'Other' && (
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
                    const finalCarrier = replacementCarrier === 'Other' ? customCarrier : replacementCarrier
                    
                    if (!replacementTracking) {
                      toast.error('Please enter a tracking number')
                      return
                    }
                    
                    if (!replacementCarrier) {
                      toast.error('Please select a carrier')
                      return
                    }
                    
                    if (replacementCarrier === 'Other' && !customCarrier.trim()) {
                      toast.error('Please enter a custom carrier name')
                      return
                    }
                    
                    setLoading(true)
                    try {
                      const result = await updateReplacementShipping(returnItem.id, {
                        tracking_number: replacementTracking,
                        carrier: finalCarrier
                      })
                      if (result.success) {
                        toast.success('Replacement shipped! Emails sent to customer, admin, and partner.')
                        setShowReplacementShipping(false)
                        setReplacementTracking('')
                        setReplacementCarrier('')
                        setCustomCarrier('')
                        router.refresh()
                      } else {
                        toast.error(result.error || 'Failed to update replacement shipping')
                      }
                    } catch (error: any) {
                      console.error('Error updating replacement shipping:', error)
                      toast.error(error.message || 'Failed to update replacement shipping')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading || !replacementTracking || !replacementCarrier || (replacementCarrier === 'Other' && !customCarrier.trim())}
                  className="flex-1"
                  variant="default"
                >
                  <Truck className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Mark as Shipped'}
                </Button>
                <Button
                  onClick={() => {
                    setShowReplacementShipping(false)
                    setReplacementTracking('')
                    setReplacementCarrier('')
                    setCustomCarrier('')
                  }}
                  variant="outline"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {returnItem.replacement_tracking_number && (
            <div className="p-4 border rounded-lg bg-green-50">
              <p className="text-sm font-semibold text-green-800 mb-2">Replacement Shipped</p>
              <p className="text-xs text-green-700">Tracking: {returnItem.replacement_tracking_number}</p>
              {returnItem.replacement_carrier && (
                <p className="text-xs text-green-700">Carrier: {returnItem.replacement_carrier}</p>
              )}
              <Button
                onClick={async () => {
                  setLoading(true)
                  try {
                    const result = await resendReplacementShippedEmails(returnItem.id)
                    if (result.success) {
                      toast.success('Emails resent successfully to customer, admin, and partner')
                    } else {
                      toast.error(result.error || 'Failed to resend emails')
                    }
                  } catch (error: any) {
                    console.error('Error resending emails:', error)
                    toast.error(error.message || 'Failed to resend emails')
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
                variant="outline"
                size="sm"
                className="mt-3 w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                {loading ? 'Resending...' : 'Resend Emails'}
              </Button>
            </div>
          )}
        </>
      )}

      {loading && (
        <p className="text-sm text-gray-500 text-center">Processing...</p>
      )}
    </div>
  )
}

