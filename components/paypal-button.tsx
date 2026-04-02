'use client'

import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/lib/cart-context'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getSetting } from '@/app/actions/settings'

declare global {
  interface Window {
    paypal?: any
  }
}

interface PayPalButtonProps {
  amount: number
  currency?: string
  tax?: number
  shipping?: number
  discount?: number
  onSuccess?: (orderId: string) => void
  onError?: (error: string) => void
  style?: {
    layout?: 'vertical' | 'horizontal'
    color?: 'gold' | 'blue' | 'silver' | 'white' | 'black'
    shape?: 'rect' | 'pill'
    label?: 'paypal' | 'checkout' | 'buynow' | 'pay'
    tagline?: boolean
  }
  className?: string
}

export function PayPalButton({
  amount,
  currency = 'USD',
  tax = 0,
  shipping = 0,
  discount = 0,
  onSuccess,
  onError,
  style = {
    layout: 'vertical',
    color: 'gold',
    shape: 'rect',
    label: 'paypal',
    tagline: false,
  },
  className = '',
}: PayPalButtonProps) {
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const [paypalEnabled, setPaypalEnabled] = useState(false)
  const [clientId, setClientId] = useState<string>('')
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox')
  const [loading, setLoading] = useState(true)
  const paypalButtonRef = useRef<HTMLDivElement>(null)
  const buttonsInstanceRef = useRef<any>(null)
  const router = useRouter()
  const { items } = useCart()

  useEffect(() => {
    // Load PayPal settings
    const loadPayPalSettings = async () => {
      try {
        const result = await getSetting('paypal')
        if (result.data) {
          const settings = result.data as any
          if (settings.enabled && settings.client_id) {
            setPaypalEnabled(true)
            setClientId(settings.client_id)
            setMode(settings.mode || 'sandbox')
          } else {
            setPaypalEnabled(false)
          }
        } else {
          setPaypalEnabled(false)
        }
      } catch (error) {
        console.error('Error loading PayPal settings:', error)
        setPaypalEnabled(false)
      } finally {
        setLoading(false)
      }
    }

    loadPayPalSettings()
  }, [])

  useEffect(() => {
    if (!paypalEnabled || !clientId || paypalLoaded) return

    // Load PayPal SDK - disable Pay Later and Debit/Credit Card options
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&disable-funding=credit,card,paylater`
    script.async = true
    script.onload = () => {
      setPaypalLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load PayPal SDK')
      onError?.('Failed to load PayPal SDK')
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup script on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [paypalEnabled, clientId, currency, paypalLoaded])

  useEffect(() => {
    if (!paypalLoaded || !window.paypal || !paypalButtonRef.current) return

    // Clean up previous button instance if it exists
    if (buttonsInstanceRef.current) {
      try {
        buttonsInstanceRef.current.close()
      } catch (e) {
        // Ignore cleanup errors
      }
      buttonsInstanceRef.current = null
    }

    // Clear previous button
    if (paypalButtonRef.current) {
      paypalButtonRef.current.innerHTML = ''
    }

    // Create PayPal button
    const buttons = window.paypal.Buttons({
      style,
      createOrder: async (data: any, actions: any) => {
        try {
          // Check if cart has subscriptions
          const hasSubscriptions = items.some((item: any) => 
            item.purchaseType === 'subscription' || item.purchaseType === 'prepaid'
          )
          
          // Prepare order items with subscription metadata
          const orderItems = items.map((item: any) => {
            // Ensure price is a number and has a valid value
            const itemPrice = typeof item.price === 'number' 
              ? item.price 
              : parseFloat(item.price || item.variant?.price || item.product?.base_price || 0) || 0
            
            return {
              name: item.name || item.product?.title || item.variant?.products?.title || 'Product',
              quantity: item.quantity,
              price: itemPrice.toFixed(2),
              purchaseType: item.purchaseType || 'one-time',
              subscriptionId: item.subscriptionId,
              frequency: item.frequency,
              shippingDays: item.shippingDays,
            }
          })

          // Create order via API
          const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount,
              currency,
              tax,
              shipping,
              discount,
              items: orderItems,
              hasSubscriptions,
              subscriptionType: hasSubscriptions 
                ? (items.find((item: any) => item.purchaseType === 'subscription') ? 'ongoing' : 'prepaid')
                : undefined,
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create order')
          }

          const order = await response.json()
          return order.id
        } catch (error: any) {
          console.error('Error creating PayPal order:', error)
          onError?.(error.message || 'Failed to create order')
          throw error
        }
      },
      onApprove: async (data: any, actions: any) => {
        try {
          // Capture the order
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId: data.orderID,
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to capture order')
          }

          const captureData = await response.json()
          
          if (captureData.status === 'COMPLETED') {
            toast.success('Payment successful!')
            onSuccess?.(data.orderID)
          } else {
            throw new Error('Payment was not completed')
          }
        } catch (error: any) {
          console.error('Error capturing PayPal order:', error)
          onError?.(error.message || 'Failed to process payment')
        }
      },
      onError: (err: any) => {
        console.error('PayPal error:', err)
        onError?.(err.message || 'An error occurred with PayPal')
      },
      onCancel: () => {
        toast.info('Payment cancelled')
      },
    })

    // Store the buttons instance for cleanup
    buttonsInstanceRef.current = buttons

    // Render the button
    if (paypalButtonRef.current) {
      buttons.render(paypalButtonRef.current).catch((err: any) => {
        console.error('Error rendering PayPal button:', err)
        onError?.('Failed to render PayPal button')
      })
    }

    // Cleanup function
    return () => {
      if (buttonsInstanceRef.current) {
        try {
          buttonsInstanceRef.current.close()
        } catch (e) {
          // Ignore cleanup errors
        }
        buttonsInstanceRef.current = null
      }
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = ''
      }
    }
  }, [paypalLoaded, amount, currency, items.length, style, onSuccess, onError])

  if (!paypalEnabled || !clientId) {
    return null
  }

  return (
    <div className={className}>
      <div ref={paypalButtonRef} />
    </div>
  )
}

