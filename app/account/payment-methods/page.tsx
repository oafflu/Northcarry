'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getPaymentMethods, deletePaymentMethod, setDefaultPaymentMethod } from '@/app/actions/payment-methods'
import { Plus, CreditCard, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface PaymentMethod {
  id: string
  user_id: string
  stripe_payment_method_id: string
  type: string
  last4: string
  brand: string
  exp_month: number
  exp_year: number
  is_default: boolean
  created_at: string
}

export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadPaymentMethods()
    }
  }, [user])

  const loadPaymentMethods = async () => {
    if (!user?.id) return

    setLoading(true)
    const result = await getPaymentMethods()
    if (result.error) {
      toast.error('Failed to load payment methods')
    } else {
      setPaymentMethods(result.data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return

    try {
      const result = await deletePaymentMethod(id)
      if (!result.success) throw new Error(result.error)
      toast.success('Payment method removed successfully')
      loadPaymentMethods()
    } catch (error: any) {
      console.error('Error deleting payment method:', error)
      toast.error(error.message || 'Failed to remove payment method')
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const result = await setDefaultPaymentMethod(id)
      if (!result.success) throw new Error(result.error)
      toast.success('Default payment method updated')
      loadPaymentMethods()
    } catch (error: any) {
      console.error('Error setting default payment method:', error)
      toast.error(error.message || 'Failed to update default payment method')
    }
  }

  const getCardIcon = (brand: string) => {
    const brandLower = brand?.toLowerCase() || ''
    if (brandLower.includes('visa')) return '💳'
    if (brandLower.includes('mastercard')) return '💳'
    if (brandLower.includes('amex')) return '💳'
    if (brandLower.includes('discover')) return '💳'
    return '💳'
  }

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">Loading payment methods...</div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="mt-1 text-gray-600">Manage your saved payment methods</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <CreditCard className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-bold">No payment methods saved</h3>
          <p className="mb-6 text-gray-600">Add a payment method to make checkout faster</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                    {getCardIcon(method.brand)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold capitalize">
                        {method.brand} •••• {method.last4}
                      </h3>
                      {method.is_default && (
                        <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Expires {method.exp_month}/{method.exp_year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      title="Set as default"
                    >
                      <Check className="h-4 w-4" />
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="p-2 text-red-400 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Payment methods are saved securely through Stripe. Add a payment method during checkout
              to save it for future purchases.
            </p>
            <Button onClick={() => window.location.href = '/checkout'} className="w-full">
              Go to Checkout
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

