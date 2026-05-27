"use client"

import { Header } from "@/components/header"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useCart } from "@/lib/cart-context"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"
import { ChevronRight, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createOrder, createPaymentIntent } from "@/app/actions/checkout"
import { validateDiscountCode } from "@/app/actions/promotions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { StripePaymentFormWrapper } from "@/components/stripe-payment-form"
import { PayPalButton } from "@/components/paypal-button"
import { getSetting } from "@/app/actions/settings"
import { getAddresses } from "@/app/actions/addresses"
import {
  parseTaxExemptions,
  taxAmountForCheckout,
  type TaxExemptionEntry,
} from "@/lib/tax"

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart()
  const { user } = useAuth()
  const router = useRouter()
  const [paypalEnabled, setPaypalEnabled] = useState(false)
  
  // Form state
  const [email, setEmail] = useState(user?.email || "")
  const [showEmailOffers, setShowEmailOffers] = useState(false)
  const [shippingMethod, setShippingMethod] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [discountCode, setDiscountCode] = useState("")
  const [discountAmount, setDiscountAmount] = useState(0)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [validatingDiscount, setValidatingDiscount] = useState(false)
  
  // Address fields
  const [firstName, setFirstName] = useState(user?.firstName || "")
  const [lastName, setLastName] = useState(user?.lastName || "")
  const [addressLine1, setAddressLine1] = useState("")
  const [addressLine2, setAddressLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("US")
  const [phone, setPhone] = useState(user?.phone || "")
  
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true)
  const [countries, setCountries] = useState<any[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [countryError, setCountryError] = useState<string | null>(null)
  
  // Payment state
  const [stripePublishableKey, setStripePublishableKey] = useState<string>("")
  const [clientSecret, setClientSecret] = useState<string>("")
  const [paymentIntentId, setPaymentIntentId] = useState<string>("")
  const [subscriptionId, setSubscriptionId] = useState<string>("")
  const [linkedSubscriptionId, setLinkedSubscriptionId] = useState<string>("")
  const [isSubscriptionCheckout, setIsSubscriptionCheckout] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [orderCreated, setOrderCreated] = useState(false)
  const [orderId, setOrderId] = useState<string>("")
  const [orderNumber, setOrderNumber] = useState<string>("")
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [error, setError] = useState("")
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<any[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [availableShippingMethods, setAvailableShippingMethods] = useState<any[]>([])
  const [loadingShipping, setLoadingShipping] = useState(true)
  const [taxExemptions, setTaxExemptions] = useState<TaxExemptionEntry[]>([])
  const [externalProcessing, setExternalProcessing] = useState(false)
  const [externalGatewayVerificationPending, setExternalGatewayVerificationPending] = useState(false)

  const externalGatewayIds = ['2checkout', 'kora', 'chipper', 'paystack']

  // Calculate shipping cost based on selected method
  const selectedShipping = availableShippingMethods.find(m => m.id === shippingMethod)
  const shipping = selectedShipping?.price || 0
  // Calculate tax on subtotal after discount (matches server: shipping address country/state)
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
  const tax = taxAmountForCheckout(
    subtotalAfterDiscount,
    country,
    state,
    taxExemptions
  )
  const total = subtotalAfterDiscount + shipping + tax

  // Validate discount code when it changes
  useEffect(() => {
    const validateDiscount = async () => {
      if (!discountCode.trim()) {
        setDiscountAmount(0)
        setDiscountError(null)
        return
      }

      setValidatingDiscount(true)
      setDiscountError(null)

      try {
        const result = await validateDiscountCode(discountCode.replace(/\s+/g, ' ').trim(), subtotal)
        if (result.valid) {
          setDiscountAmount(result.discountAmount)
          setDiscountError(null)
        } else {
          setDiscountAmount(0)
          setDiscountError(result.error || 'Invalid discount code')
        }
      } catch (error) {
        console.error('Error validating discount:', error)
        setDiscountAmount(0)
        setDiscountError('Error validating discount code')
      } finally {
        setValidatingDiscount(false)
      }
    }

    // Debounce validation
    const timeoutId = setTimeout(() => {
      validateDiscount()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [discountCode, subtotal])

  // Load Stripe config, payment methods and shipping methods
  useEffect(() => {
    const loadStripeConfig = async () => {
      try {
        const response = await fetch('/api/stripe-config')
        if (response.ok) {
          const result = await response.json()
          if (result.publishableKey) {
            setStripePublishableKey(result.publishableKey)
          }
        }
      } catch (error) {
        console.error('Error loading Stripe config:', error)
      }
    }

    const loadPaymentMethods = async () => {
      try {
        const response = await fetch('/api/payment-methods')
        const result = await response.json()
        if (result.data) {
          setAvailablePaymentMethods(result.data)
        }
      } catch (error) {
        console.error('Error loading payment methods:', error)
      } finally {
        setLoadingMethods(false)
      }
    }

    const loadShippingMethods = async () => {
      try {
        const response = await fetch('/api/shipping-methods')
        const result = await response.json()
        if (result.data && result.data.length > 0) {
          // Log for debugging
          console.log('Shipping methods loaded:', JSON.stringify(result.data, null, 2))
          setAvailableShippingMethods(result.data)
          // Set default to first enabled method
          const firstEnabled = result.data.find((m: any) => m.enabled)
          if (firstEnabled) {
            setShippingMethod(firstEnabled.id)
          }
        }
      } catch (error) {
        console.error('Error loading shipping methods:', error)
        // Fallback to default methods with estimated days
        setAvailableShippingMethods([
          { id: 'standard', name: 'Standard Shipping', price: 0, enabled: true, description: 'Free standard shipping', estimatedDaysMin: 7, estimatedDaysMax: 14, showEstimatedDays: true },
          { id: 'express', name: 'Express Shipping', price: 4.99, enabled: true, description: 'Fast express delivery', estimatedDaysMin: 2, estimatedDaysMax: 5, showEstimatedDays: true },
        ])
        setShippingMethod('standard')
      } finally {
        setLoadingShipping(false)
      }
    }

    const loadPayPalSettings = async () => {
      try {
        const result = await getSetting('paypal')
        if (result.data) {
          const settings = result.data as any
          setPaypalEnabled(settings.enabled === true && !!settings.client_id)
        }
      } catch (error) {
        console.error('Error loading PayPal settings:', error)
        setPaypalEnabled(false)
      }
    }

    const loadTaxExemptions = async () => {
      try {
        const result = await getSetting('tax_exemptions')
        setTaxExemptions(parseTaxExemptions(result.data))
      } catch (error) {
        console.error('Error loading tax exemptions:', error)
        setTaxExemptions([])
      }
    }

    const loadCountries = async () => {
      try {
        const response = await fetch('/api/countries')
        if (response.ok) {
          const result = await response.json()
          const list = result.data || []
          setCountries(list)
          if (list.length > 0) {
            const defaultCountry = list.find((c: any) => c.is_default) || list[0]
            setCountry(defaultCountry.code)
          }
        } else {
          console.error('Failed to load countries')
          setCountries([])
        }
      } catch (error) {
        console.error('Error loading countries:', error)
        setCountries([])
      } finally {
        setCountriesLoading(false)
      }
    }

    loadStripeConfig()
    loadPaymentMethods()
    loadShippingMethods()
    loadPayPalSettings()
    loadTaxExemptions()
    loadCountries()
  }, [])

  // Load saved addresses for logged-in users
  useEffect(() => {
    const loadSavedAddresses = async () => {
      if (user?.id) {
        try {
          const result = await getAddresses()
          if (result.data && result.data.length > 0) {
            // Find default shipping address or use first shipping address
            const defaultShipping = result.data.find(
              (addr: any) => addr.type === 'shipping' && addr.is_default
            ) || result.data.find((addr: any) => addr.type === 'shipping')
            
            if (defaultShipping) {
              // Load saved address - this will auto-populate the form for returning customers
              setFirstName(user?.firstName || "")
              setLastName(user?.lastName || "")
              setAddressLine1(defaultShipping.address_line1 || "")
              setAddressLine2(defaultShipping.address_line2 || "")
              setCity(defaultShipping.city || "")
              setState(defaultShipping.state || "")
              setPostalCode(defaultShipping.postal_code || "")
              setCountry(defaultShipping.country || "US")
              setPhone(defaultShipping.phone || user?.phone || "")
            }
          }
        } catch (error) {
          console.error('Error loading saved addresses:', error)
          // Silently fail - user can still enter address manually
        }
      }
    }

    loadSavedAddresses()
  }, [user?.id])

  // Create payment intent when form is ready
  const startExternalGatewayCheckout = async (gateway: string) => {
    const snapshot = {
      userId: user?.id,
      email,
      firstName,
      lastName,
      phone: phone || undefined,
      shippingAddress: {
        address_line1: addressLine1,
        address_line2: addressLine2 || undefined,
        city,
        state,
        postal_code: postalCode,
        country,
      },
      billingAddress: {
        address_line1: addressLine1,
        address_line2: addressLine2 || undefined,
        city,
        state,
        postal_code: postalCode,
        country,
      },
      shippingMethod,
      discountCode: discountCode && discountCode.trim() && !discountError ? discountCode.trim() : undefined,
      paymentMethod: gateway,
    }

    try {
      localStorage.setItem('externalCheckoutSnapshot', JSON.stringify(snapshot))
      setExternalProcessing(true)

      const response = await fetch('/api/payments/external/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          amount: total,
          currency: 'USD',
          email,
          metadata: {
            cart_items: items.length,
            shipping_method: shippingMethod,
          },
        }),
      })
      const result = await response.json()
      if (!response.ok || !result?.redirectUrl) {
        throw new Error(result?.error || `Failed to initialize ${gateway} checkout`)
      }
      window.location.href = result.redirectUrl
    } catch (err: any) {
      console.error('External gateway initialize error:', err)
      setError(err?.message || 'Failed to initialize external gateway checkout')
      toast.error('Payment initialization failed', {
        description: err?.message || 'Failed to initialize external gateway checkout',
      })
      setExternalProcessing(false)
    }
  }

  const handlePreparePayment = async () => {
    console.log('handlePreparePayment called')
    setError("")
    setCountryError(null)
    
    if (items.length === 0) {
      setError("Your cart is empty")
      toast.error("Cart is empty")
      return
    }

    if (!email || !firstName || !lastName || !addressLine1 || !city || !state || !postalCode) {
      setError("Please fill in all required fields")
      return
    }

    // Validate country is allowed for shipping
    const allowedCountry = countries.find((c) => c.code === country)
    if (!allowedCountry) {
      setCountryError("We currently do not ship to this country.")
      setError("We currently do not ship to the selected country.")
      return
    }

    if (!shippingMethod) {
      setError("Please select a shipping method")
      return
    }

    if (externalGatewayIds.includes(paymentMethod)) {
      await startExternalGatewayCheckout(paymentMethod)
      return
    }

    // Validate discount code if provided
    if (discountCode && discountError) {
      setError(`Invalid discount code: ${discountError}`)
      return
    }

    setIsSubmitting(true)
    console.log('Preparing payment...', { email, firstName, lastName, shippingMethod, discountCode })

    try {
      // Create payment intent first
      // Check if this is a free order (handled differently)
      console.log('Calling createPaymentIntent...')
      const paymentResult = await createPaymentIntent({
        userId: user?.id,
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        shippingAddress: {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        },
        billingAddress: billingSameAsShipping ? {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        } : {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        },
        shippingMethod,
        discountCode: discountCode && discountCode.trim() && !discountError ? discountCode.trim() : undefined,
        paymentMethod: paymentMethod,
      })

      console.log('Payment result:', { success: paymentResult.success, error: paymentResult.error, isFreeOrder: paymentResult.isFreeOrder })

          if (paymentResult.success) {
            // Handle free orders (no payment needed)
            if (paymentResult.isFreeOrder) {
              // For free orders, skip payment and create order directly
              setShowPaymentForm(false)
              setIsSubmitting(false)
              // Create order immediately for free orders
              const orderResult = await createOrder({
                userId: user?.id,
                email,
                firstName,
                lastName,
                phone: phone || undefined,
                shippingAddress: {
                  address_line1: addressLine1,
                  address_line2: addressLine2 || undefined,
                  city,
                  state,
                  postal_code: postalCode,
                  country,
                },
                billingAddress: billingSameAsShipping ? {
                  address_line1: addressLine1,
                  address_line2: addressLine2 || undefined,
                  city,
                  state,
                  postal_code: postalCode,
                  country,
                } : {
                  address_line1: addressLine1,
                  address_line2: addressLine2 || undefined,
                  city,
                  state,
                  postal_code: postalCode,
                  country,
                },
                shippingMethod,
                discountCode: discountCode && discountCode.trim() && !discountError ? discountCode.trim() : undefined,
                paymentMethod: paymentMethod,
                paymentIntentId: undefined, // No payment intent for free orders
                subscriptionId: paymentResult.subscriptionId || undefined,
              })
              
              if (orderResult.success) {
                setOrderCreated(true)
                setOrderId(orderResult.orderId)
                setOrderNumber(orderResult.orderNumber)
                await clearCart()
                
                // Redirect to thank you page
                const isNewAccount = !user?.id // Guest customer = new account
                router.push(`/thank-you?order=${orderResult.orderNumber}&id=${orderResult.orderId}${isNewAccount ? '&account=new' : ''}`)
              } else {
                setError(orderResult.error || "Failed to create order")
                toast.error("Order failed", {
                  description: orderResult.error || "Failed to create order",
                })
              }
            } else if (paymentResult.clientSecret) {
              // Regular paid order or subscription - show payment form
              setClientSecret(paymentResult.clientSecret)
              setPaymentIntentId(paymentResult.paymentIntentId || "")
              setSubscriptionId(paymentResult.subscriptionId || "")
              setLinkedSubscriptionId((paymentResult as any).linkedSubscriptionId || "")
              setIsSubscriptionCheckout(paymentResult.isSubscription || false)
              setShowPaymentForm(true)
              setIsSubmitting(false)
            } else {
              setError("Failed to initialize payment")
              setIsSubmitting(false)
            }
          } else {
            const errorMsg = paymentResult.error || "Failed to initialize payment"
            setError(errorMsg)
            toast.error("Payment initialization failed", {
              description: errorMsg,
              duration: 10000,
            })
            setIsSubmitting(false)
          }
    } catch (err: any) {
      const errorMessage = err?.message || err?.error || "An error occurred. Please try again."
      setError(errorMessage)
      console.error("Error preparing payment:", err)
      toast.error("Payment preparation failed", {
        description: errorMessage,
        duration: 10000,
      })
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('payment_status')
    const gateway = params.get('gateway')
    const reference = params.get('reference')
    if (status !== 'success' || !gateway || !reference) return
    if (!externalGatewayIds.includes(gateway)) return
    if (externalGatewayVerificationPending) return

    const completeExternalPayment = async () => {
      setExternalGatewayVerificationPending(true)
      try {
        const verifyRes = await fetch('/api/payments/external/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gateway, reference }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData?.paid) {
          throw new Error(verifyData?.error || `Unable to verify ${gateway} payment`)
        }

        const snapshotRaw = localStorage.getItem('externalCheckoutSnapshot')
        if (!snapshotRaw) {
          throw new Error('Checkout snapshot missing. Please place the order again.')
        }
        const snapshot = JSON.parse(snapshotRaw)
        const orderResult = await createOrder({
          ...snapshot,
          paymentMethod: gateway,
          externalGateway: gateway,
          externalTransactionId: reference,
          externalPaymentStatus: 'paid',
        } as any)

        if (!orderResult.success) {
          throw new Error(orderResult.error || 'Order creation failed after payment verification')
        }

        localStorage.removeItem('externalCheckoutSnapshot')
        await clearCart()
        const isNewAccount = !user?.id
        router.replace(
          `/thank-you?order=${orderResult.orderNumber}&id=${orderResult.orderId}${isNewAccount ? '&account=new' : ''}`
        )
      } catch (err: any) {
        console.error('External payment completion error:', err)
        setError(err?.message || 'Failed to complete external payment')
        toast.error('Payment verification failed', {
          description: err?.message || 'Failed to complete external payment',
        })
      } finally {
        setExternalGatewayVerificationPending(false)
        setExternalProcessing(false)
      }
    }

    completeExternalPayment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalGatewayVerificationPending, user?.id, clearCart, router])

  // Handle payment success - create order
  const handlePaymentSuccess = async (confirmedPaymentIntentId: string) => {
    setIsProcessingPayment(true)
    setError("")

    try {
      // Use stored subscription info from payment result
      const actualSubscriptionId = subscriptionId || undefined
      const actualLinkedSubscriptionId = linkedSubscriptionId || undefined
      const actualPaymentIntentId = confirmedPaymentIntentId || undefined
      const isSubscription = isSubscriptionCheckout

      // Create order with confirmed payment intent or subscription
      // Note: We use the calculated total (not the rounded-up $0.50) for the order record
      // The payment intent may have charged $0.50 minimum, but the order should reflect the actual discount
      const result = await createOrder({
        userId: user?.id,
        email,
        firstName,
        lastName,
        phone: phone || undefined,
        shippingAddress: {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        },
        billingAddress: billingSameAsShipping ? {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        } : {
          address_line1: addressLine1,
          address_line2: addressLine2 || undefined,
          city,
          state,
          postal_code: postalCode,
          country,
        },
        shippingMethod,
        discountCode: discountCode && discountCode.trim() && !discountError ? discountCode.trim() : undefined,
        paymentMethod: paymentMethod,
        paymentIntentId: actualPaymentIntentId,
        subscriptionId: actualSubscriptionId,
        linkedSubscriptionId: actualLinkedSubscriptionId,
        isSubscription: isSubscription,
      })

      if (result.success) {
        setOrderCreated(true)
        setOrderId(result.orderId)
        setOrderNumber(result.orderNumber)
        await clearCart()
        
        // Redirect to thank you page
        const isNewAccount = !user?.id // Guest customer = new account
        router.push(`/thank-you?order=${result.orderNumber}&id=${result.orderId}${isNewAccount ? '&account=new' : ''}`)
      } else {
        // Before showing error, check if order was actually created (idempotency check)
        // This handles cases where order creation succeeded but returned an error due to post-processing issues
        if (confirmedPaymentIntentId) {
          try {
            const checkResponse = await fetch(`/api/orders/check?paymentIntentId=${confirmedPaymentIntentId}`)
            if (checkResponse.ok) {
              const checkData = await checkResponse.json()
              if (checkData.exists && checkData.orderId) {
                // Order exists, redirect to thank you page
                setOrderCreated(true)
                setOrderId(checkData.orderId)
                setOrderNumber(checkData.orderNumber)
                await clearCart()
                const isNewAccount = !user?.id
                router.push(`/thank-you?order=${checkData.orderNumber}&id=${checkData.orderId}${isNewAccount ? '&account=new' : ''}`)
                return
              }
            }
          } catch (checkError) {
            console.error('Error checking order existence:', checkError)
          }
        }
        
        setError(result.error || "Failed to create order. Please try again.")
        toast.error("Order failed", {
          description: result.error || "Failed to create order. Please try again.",
        })
      }
    } catch (err: any) {
      // Before showing error, check if order was actually created (idempotency check)
      // This handles cases where order creation succeeded but an error occurred in post-processing
      if (confirmedPaymentIntentId) {
        try {
          const checkResponse = await fetch(`/api/orders/check?paymentIntentId=${confirmedPaymentIntentId}`)
          if (checkResponse.ok) {
            const checkData = await checkResponse.json()
            if (checkData.exists && checkData.orderId) {
              // Order exists, redirect to thank you page
              setOrderCreated(true)
              setOrderId(checkData.orderId)
              setOrderNumber(checkData.orderNumber)
              await clearCart()
              const isNewAccount = !user?.id
              router.push(`/thank-you?order=${checkData.orderNumber}&id=${checkData.orderId}${isNewAccount ? '&account=new' : ''}`)
              return
            }
          }
        } catch (checkError) {
          console.error('Error checking order existence:', checkError)
        }
      }
      
      const errorMessage = err?.message || "An error occurred while creating your order. Please contact support."
      const errorDetails = err?.details || err?.code || ''
      
      setError(errorMessage)
      console.error("Error creating order:", {
        error: err,
        message: err?.message,
        details: err?.details,
        code: err?.code,
        paymentIntentId: confirmedPaymentIntentId,
      })
      
      toast.error("Order creation failed", {
        description: `Payment was successful but order creation failed. ${errorDetails ? `Error: ${errorDetails}` : 'Please contact support with your payment confirmation.'}`,
        duration: 10000,
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }

  // Handle payment error
  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage)
    toast.error("Payment failed", {
      description: errorMessage,
    })
    setIsProcessingPayment(false)
  }

  // Handle going back to edit order details
  const handleGoBack = () => {
    setShowPaymentForm(false)
    setClientSecret("")
    setPaymentIntentId("")
    setError("")
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="container max-w-7xl mx-auto py-8 px-4">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          <div>
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Checkout Form */}
              <div className="space-y-6">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm">
                <a href="/cart" className="text-blue-600 hover:underline">
                  Cart
                </a>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="font-medium">Information</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Shipping</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400">Payment</span>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Contact</h2>
                  {!user && (
                    <div className="text-sm">
                      <span className="text-gray-600">Have an account? </span>
                      <a href="/login" className="text-blue-600 hover:underline">
                        Log in
                      </a>
                    </div>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEmailOffers}
                    onChange={(e) => setShowEmailOffers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Email me with news and offers</span>
                </label>
              </div>

              {/* Delivery */}
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Delivery</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Address"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
                />
                <input
                  type="text"
                  placeholder="Apartment, suite, etc. (optional)"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
                />
                <div className="grid grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="text"
                    placeholder="ZIP code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value)
                      setCountryError(null)
                    }}
                    disabled={countriesLoading}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  >
                    {countriesLoading && <option>Loading countries...</option>}
                    {!countriesLoading && countries.length === 0 && (
                      <option value="">No countries available</option>
                    )}
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {countryError && (
                    <p className="text-sm text-red-600 mt-1">{countryError}</p>
                  )}
                  {!countryError && countries.length === 0 && !countriesLoading && (
                    <p className="text-sm text-red-600 mt-1">
                      No shipping countries are configured. Please contact support.
                    </p>
                  )}
                </div>
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mt-4"
                />
              </div>

              {/* Shipping Method */}
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Shipping method</h2>
                {loadingShipping ? (
                  <div className="text-center py-8 text-gray-500">Loading shipping methods...</div>
                ) : availableShippingMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No shipping methods available. Please contact support.</div>
                ) : (
                  <div className="space-y-3">
                    {availableShippingMethods
                      .filter((method: any) => method.enabled)
                      .map((method: any) => (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                            shippingMethod === method.id
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shipping"
                              value={method.id}
                              checked={shippingMethod === method.id}
                              onChange={(e) => setShippingMethod(e.target.value)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <div>
                              <span className="font-medium block">{method.name}</span>
                              {method.description && (
                                <span className="text-xs text-gray-500">{method.description}</span>
                              )}
                              {/* Show estimated days if enabled and values exist */}
                              {method.showEstimatedDays !== false && (
                                <>
                                  {/* New range format */}
                                  {method.estimatedDaysMin != null && method.estimatedDaysMax != null && 
                                   Number(method.estimatedDaysMin) > 0 && Number(method.estimatedDaysMax) > 0 && (
                                    <span className="text-xs text-gray-500 block">
                                      Est. {Number(method.estimatedDaysMin) === Number(method.estimatedDaysMax) 
                                        ? `${method.estimatedDaysMin} days` 
                                        : `${method.estimatedDaysMin}-${method.estimatedDaysMax} days`}
                                    </span>
                                  )}
                                  {/* Legacy single number format - only show if range format not available */}
                                  {(!method.estimatedDaysMin || !method.estimatedDaysMax) && 
                                   method.estimatedDays != null && Number(method.estimatedDays) > 0 && (
                                    <span className="text-xs text-gray-500 block">Est. {method.estimatedDays} days</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`font-bold ${method.price === 0 ? 'text-green-600' : ''}`}>
                            {method.price === 0 ? 'FREE' : `$${method.price.toFixed(2)}`}
                          </span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Payment</h2>
                <p className="text-sm text-gray-600 mb-4">All transactions are secure and encrypted.</p>

                {/* PayPal Button - Only show if PayPal is enabled */}
                {paypalEnabled && (
                  <div className="mb-4">
                    <PayPalButton
                    amount={total}
                    tax={tax}
                    shipping={shipping}
                    discount={discountAmount}
                    onSuccess={async (orderId) => {
                      // Create order after PayPal payment success
                      try {
                        const orderResult = await createOrder({
                          email,
                          firstName,
                          lastName,
                          phone,
                          shippingAddress: {
                            address_line1: addressLine1,
                            address_line2: addressLine2 || undefined,
                            city,
                            state,
                            postal_code: postalCode,
                            country,
                          },
                          billingAddress: billingSameAsShipping ? {
                            address_line1: addressLine1,
                            address_line2: addressLine2 || undefined,
                            city,
                            state,
                            postal_code: postalCode,
                            country,
                          } : {
                            address_line1: addressLine1,
                            address_line2: addressLine2 || undefined,
                            city,
                            state,
                            postal_code: postalCode,
                            country,
                          },
                          shippingMethod,
                          paymentMethod: 'paypal',
                          paymentIntentId: orderId,
                          discountCode: discountCode || undefined,
                        })

                        if (orderResult.success) {
                          setOrderCreated(true)
                          setOrderId(orderResult.orderId)
                          setOrderNumber(orderResult.orderNumber)
                          await clearCart()
                          router.push(`/thank-you?order=${orderResult.orderNumber}&id=${orderResult.orderId}`)
                        } else {
                          toast.error('Order creation failed', {
                            description: orderResult.error || 'Failed to create order',
                          })
                        }
                      } catch (error: any) {
                        toast.error('Error creating order', {
                          description: error.message || 'An error occurred',
                        })
                      }
                    }}
                    onError={(error) => {
                      toast.error('PayPal payment failed', {
                        description: error,
                      })
                    }}
                    style={{
                      layout: 'vertical',
                      color: 'gold',
                      shape: 'rect',
                      label: 'paypal',
                      tagline: false,
                    }}
                  />
                  </div>
                )}

                {loadingMethods ? (
                  <div className="text-center py-8 text-gray-500">Loading payment methods...</div>
                ) : availablePaymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No payment methods available. Please contact support.</div>
                ) : (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">OR</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* Show enabled payment methods */}
                      {availablePaymentMethods.map((method: any) => (
                      <label
                        key={method.id}
                        className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === method.stripeType || paymentMethod === method.type
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            value={method.stripeType || method.type}
                            checked={paymentMethod === (method.stripeType || method.type)}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          {/* Show payment method image or icon */}
                          {method.imageUrl ? (
                            <Image 
                              src={method.imageUrl} 
                              alt={method.name} 
                              width={40} 
                              height={24}
                              className="object-contain"
                            />
                          ) : method.icon && (
                            <span className="text-xl mr-2">{method.icon}</span>
                          )}
                          <span className="font-medium">{method.name}</span>
                        </div>
                        {/* Show card type images for Card payment method */}
                        {(method.category === 'cards' || method.type === 'card') && method.cardImages && method.cardImages.length > 0 && (
                          <div className="flex gap-2">
                            {method.cardImages.map((cardImage: any, idx: number) => (
                              <Image 
                                key={idx}
                                src={cardImage.url || '/placeholder.svg?height=20&width=32'} 
                                alt={cardImage.alt || cardImage.name || 'Card'} 
                                width={32} 
                                height={20}
                                className="object-contain"
                              />
                            ))}
                          </div>
                        )}
                      </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Payment Form - Show Stripe Elements if payment intent is ready */}
              {showPaymentForm && clientSecret && stripePublishableKey && paymentMethod === "card" ? (
                <div className="bg-white rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Complete Payment</h2>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGoBack}
                      className="text-sm"
                    >
                      ← Edit Order
                    </Button>
                  </div>
                  <StripePaymentFormWrapper
                    publishableKey={stripePublishableKey}
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    isSubmitting={isProcessingPayment}
                  />
                </div>
              ) : orderCreated ? (
                <div className="bg-white rounded-lg p-6">
                  <div className="text-center py-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Order Placed Successfully!</h2>
                    <p className="text-gray-600 mb-4">
                      Your order #{orderNumber} has been confirmed.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                      You will receive a confirmation email shortly with your order details and a magic link to access your account.
                    </p>
                    <div className="flex gap-4 justify-center">
                      <Button
                        onClick={() => router.push(`/account/orders/${orderId}`)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        View Order
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push('/')}
                      >
                        Continue Shopping
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button 
                  type="button"
                  onClick={handlePreparePayment}
                  className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting || externalProcessing || items.length === 0 || !shippingMethod}
                >
                  <Lock className="w-5 h-5 mr-2" />
                  {isSubmitting || externalProcessing ? "Preparing payment..." : "Continue to Payment"}
                </Button>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white rounded-lg p-6">
                <h2 className="text-xl font-bold mb-6">Order summary</h2>

                {/* Cart Items */}
                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="relative">
                        <Image
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="rounded border"
                        />
                        <span className="absolute -top-2 -right-2 bg-gray-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{item.name}</h3>
                        <p className="text-xs text-gray-500">Color: {item.color}</p>
                        {(item.purchaseType === 'subscription' || item.purchaseType === 'prepaid') && (
                          <p className="text-xs text-teal-600 font-medium mt-1">
                            {item.purchaseType === 'prepaid' ? 'Prepaid Subscription' : 'Subscription'}
                            {item.frequency && ` • Every ${item.frequency} ${item.frequency === 1 ? 'Month' : 'Months'}`}
                            {item.purchaseType === 'prepaid' && item.prepaidCycles
                              ? ` • ${item.prepaidCycles} ${item.prepaidCycles === 1 ? 'cycle' : 'cycles'}`
                              : ''}
                          </p>
                        )}
                        <p className="text-sm font-bold mt-2">
                          ${(item.price * item.quantity).toFixed(2)}
                          {item.purchaseType === 'prepaid' && item.frequency && item.prepaidCycles && (
                            <span className="text-xs text-gray-500 font-normal ml-1">
                              (for {item.prepaidCycles} {item.prepaidCycles === 1 ? 'delivery' : 'deliveries'} over{' '}
                              {item.prepaidCycles * item.frequency} {item.prepaidCycles * item.frequency === 1 ? 'month' : 'months'})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Discount Code - Only show before payment form is shown */}
                {!showPaymentForm && (
                  <div className="mb-6">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Discount code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                            discountError
                              ? 'border-red-300'
                              : discountAmount > 0
                              ? 'border-green-300'
                              : 'border-gray-300'
                          }`}
                        />
                        {validatingDiscount && (
                          <p className="text-xs text-gray-500 mt-1">Validating...</p>
                        )}
                        {discountError && (
                          <p className="text-xs text-red-600 mt-1">{discountError}</p>
                        )}
                        {discountAmount > 0 && !discountError && (
                          <p className="text-xs text-green-600 mt-1">Discount applied! ${discountAmount.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-3 pt-6 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount {discountCode && `(${discountCode})`}</span>
                      <span className="font-medium text-green-600">-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium text-green-600">
                      {shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Estimated taxes</span>
                    <span className="font-medium">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 border-t">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                  {showPaymentForm && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500 text-center">
                        Payment amount: <span className="font-semibold text-gray-900">${total.toFixed(2)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Trust Badges */}
              <div className="mt-6 space-y-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Secure checkout with 256-bit encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.707 6.707l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L9 10.586l3.293-3.293a1 1 0 011.414 1.414z" />
                  </svg>
                  <Link href="/refund" className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                    5-day replacement policy
                  </Link>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
