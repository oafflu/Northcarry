'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Stripe redirects here after 3DS (or other redirect-based auth).
 * URL will contain payment_intent and payment_intent_client_secret.
 * We create the order from the checkout snapshot and redirect to thank-you.
 */
function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent')
    if (!paymentIntentId) {
      setStatus('error')
      setMessage('Missing payment information. If you completed payment, check your email for the order confirmation.')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/checkout/complete-return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.success && (data.orderId || data.orderNumber)) {
          setStatus('success')
          const isNewAccount = false
          window.location.replace(
            `/thank-you?order=${encodeURIComponent(data.orderNumber)}&id=${encodeURIComponent(data.orderId)}${isNewAccount ? '&account=new' : ''}`
          )
          return
        }
        setStatus('error')
        setMessage(data.error || 'We could not create your order. Please contact support with your payment details.')
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setMessage('Something went wrong. If you were charged, contact support with your payment details.')
      }
    })()
    return () => { cancelled = true }
  }, [searchParams])

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
      {status === 'loading' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-lg text-gray-700">Completing your order...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-lg text-red-700 text-center max-w-md">{message}</p>
          <a href="/" className="mt-6 text-blue-600 hover:underline">Return to home</a>
        </>
      )}
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-lg text-gray-700">Completing your order...</p>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  )
}
