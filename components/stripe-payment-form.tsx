'use client'

import { useEffect, useState } from 'react'
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2, Lock } from 'lucide-react'

interface StripePaymentFormProps {
  clientSecret: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  isSubmitting: boolean
}

function PaymentForm({ clientSecret, onSuccess, onError, isSubmitting }: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        onError(submitError.message || 'Payment form validation failed')
        setProcessing(false)
        return
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: 'if_required', // Don't redirect, handle in JS
      })

      if (error) {
        console.error('Payment error:', error)
        onError(error.message || 'Payment failed')
        setProcessing(false)
      } else if (paymentIntent) {
        // Handle different payment intent statuses
        if (paymentIntent.status === 'succeeded') {
          onSuccess(paymentIntent.id)
          setProcessing(false)
        } else if (paymentIntent.status === 'requires_action') {
          // 3D Secure or other authentication: redirect customer to complete verification.
          // Without this, we were incorrectly showing an error and blocking every 3DS payment.
          const redirectUrl = (paymentIntent as any).next_action?.redirect_to_url?.url
          if (redirectUrl) {
            window.location.href = redirectUrl
            return // Keep processing true; page is navigating
          }
          // No redirect URL (e.g. in-place auth); show message and don't treat as terminal error
          console.log('Payment requires action (3D Secure):', paymentIntent.id)
          onError('Please complete the verification step in the window that opened, or try again.')
          setProcessing(false)
        } else if (paymentIntent.status === 'requires_payment_method') {
          // Payment method was declined or invalid
          console.error('Payment requires new payment method:', paymentIntent.id)
          onError('Your payment method was declined. Please try a different payment method.')
          setProcessing(false)
        } else if (paymentIntent.status === 'processing') {
          // Payment is being processed
          console.log('Payment is processing:', paymentIntent.id)
          onError('Your payment is being processed. Please wait a moment and check your email for confirmation.')
          setProcessing(false)
        } else {
          // Other statuses (canceled, requires_capture, etc.)
          console.warn('Unexpected payment status:', paymentIntent.status, paymentIntent.id)
          onError(`Payment status: ${paymentIntent.status}. Please try again or contact support.`)
          setProcessing(false)
        }
      } else {
        // No payment intent returned (shouldn't happen, but handle gracefully)
        console.error('No payment intent returned from confirmPayment')
        onError('Payment was not completed. Please try again.')
        setProcessing(false)
      }
    } catch (err: any) {
      onError(err.message || 'An unexpected error occurred')
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border-2 border-blue-600 rounded-lg">
        <PaymentElement 
          options={{
            layout: 'tabs',
            defaultValues: {
              billingDetails: {
                name: undefined, // Will be auto-filled from payment intent customer
              },
            },
            // Enable saved payment methods
            paymentMethodTypes: ['card', 'link'],
            // Show saved payment methods if customer is attached to payment intent
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
        />
      </div>
      <Button
        type="submit"
        className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
        disabled={!stripe || !elements || processing || isSubmitting}
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing payment...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-2" />
            Complete order
          </>
        )}
      </Button>
    </form>
  )
}

interface StripePaymentFormWrapperProps {
  publishableKey: string
  clientSecret: string
  onSuccess: (paymentIntentId: string) => void
  onError: (error: string) => void
  isSubmitting: boolean
}

export function StripePaymentFormWrapper({
  publishableKey,
  clientSecret,
  onSuccess,
  onError,
  isSubmitting,
}: StripePaymentFormWrapperProps) {
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null)

  useEffect(() => {
    if (publishableKey) {
      setStripePromise(loadStripe(publishableKey))
    }
  }, [publishableKey])

  if (!stripePromise) {
    return (
      <div className="p-4 border-2 border-gray-300 rounded-lg">
        <div className="text-center py-8 text-gray-500">Loading payment form...</div>
      </div>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe',
    },
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        clientSecret={clientSecret}
        onSuccess={onSuccess}
        onError={onError}
        isSubmitting={isSubmitting}
      />
    </Elements>
  )
}

