'use client'

import { useEffect, useRef } from 'react'

type PayoneerEmbeddedCheckoutProps = {
  longId: string
  env: 'test' | 'live'
  onSuccess: (data: unknown) => void
  onFailure: (error: unknown) => void
}

export function PayoneerEmbeddedCheckout({
  longId,
  env,
  onSuccess,
  onFailure,
}: PayoneerEmbeddedCheckoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!longId || !containerRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        const { CheckoutWeb } = await import('@payoneer/checkout-web')
        if (cancelled || !containerRef.current) return

        const checkout = await CheckoutWeb({
          env,
          longId,
          onPaymentSuccess: (data: unknown) => onSuccess(data),
          onPaymentFailure: (error: unknown) => onFailure(error),
        })

        const dropIn = checkout.dropIn('cards').mount(containerRef.current)
        cleanupRef.current = () => {
          if (typeof dropIn?.unmount === 'function') {
            dropIn.unmount()
          }
        }
      } catch (error) {
        if (!cancelled) onFailure(error)
      }
    })()

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [longId, env, onSuccess, onFailure])

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600 mb-3">Complete your payment below.</p>
      <div ref={containerRef} className="min-h-[280px] w-full" />
    </div>
  )
}
