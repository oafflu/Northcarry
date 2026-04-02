"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { CheckCircle, Mail, Lock, ShoppingBag, Package, Heart, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubscriptionSettings } from "@/app/actions/subscription-settings"
import { PostPurchaseUpsellModal } from "@/components/upsells/post-purchase-modal"

function ThankYouContent() {
  const searchParams = useSearchParams()
  const orderNumber = searchParams.get("order")
  const orderId = searchParams.get("id")
  const isNewAccount = searchParams.get("account") === "new"
  const [showSubscriptionLink, setShowSubscriptionLink] = useState(false)
  const [postPurchaseUpsell, setPostPurchaseUpsell] = useState<any>(null)
  const [upsellProducts, setUpsellProducts] = useState<any[]>([])
  const [orderValue, setOrderValue] = useState<number>(0)

  const loadPostPurchaseUpsell = async () => {
    if (!orderId) return
    
    try {
      // Get order value
      const orderResponse = await fetch(`/api/orders/${orderId}/value`)
      if (orderResponse.ok) {
        const orderData = await orderResponse.json()
        setOrderValue(orderData.value || 0)
      }

      // Get product IDs from order
      const productsResponse = await fetch(`/api/orders/${orderId}/products`)
      const productsData = await productsResponse.ok ? await productsResponse.json() : { product_ids: [] }
      const productIds = productsData.product_ids || []

      // Load post-purchase upsells (use orderValue from state, but fetch fresh if needed)
      const currentOrderValue = orderValue || 0
      const response = await fetch(`/api/upsells/post-purchase?order_value=${currentOrderValue}&product_ids=${productIds.join(',')}`)
      const data = await response.json()
      
      if (data.upsells && data.upsells.length > 0) {
        // Show first applicable upsell
        const firstUpsell = data.upsells[0]
        setPostPurchaseUpsell(firstUpsell)

        // Load product data
        const upsellProductIds = new Set<string>()
        firstUpsell.upsell_products?.forEach((up: any) => upsellProductIds.add(up.product_id))
        
        if (upsellProductIds.size > 0) {
          const productsData = await fetch(`/api/products?ids=${Array.from(upsellProductIds).join(',')}`)
          const products = await productsData.json()
          setUpsellProducts(products.products || [])
        }

        // Show modal after delay
        if (firstUpsell.display_delay) {
          setTimeout(() => {
            setPostPurchaseUpsell(firstUpsell)
          }, firstUpsell.display_delay * 1000)
        }
      }
    } catch (error) {
      console.error('Error loading post-purchase upsell:', error)
    }
  }

  useEffect(() => {
    const checkSubscriptionSettings = async () => {
      if (!orderId) return
      
      try {
        // Check if order has subscriptions
        const response = await fetch(`/api/orders/${orderId}/has-subscriptions`)
        if (response.ok) {
          const data = await response.json()
          const hasSubs = data.hasSubscriptions || false
          
          // Check subscription settings
          if (hasSubs) {
            const settingsResult = await getSubscriptionSettings()
            if (settingsResult.data?.showPortalLinkAfterCheckout) {
              setShowSubscriptionLink(true)
            }
          }
        }
      } catch (error) {
        console.error('Error checking subscription settings:', error)
      }
    }
    
    checkSubscriptionSettings()
    loadPostPurchaseUpsell()
  }, [orderId])

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className="container max-w-4xl mx-auto py-12 px-4">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Thank You!</h1>
            <p className="text-xl text-gray-600">
              Your order has been placed successfully
            </p>
            {orderNumber && (
              <p className="text-lg font-semibold text-gray-800 mt-2">
                Order #{orderNumber}
              </p>
            )}
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
            <div className="space-y-6">
              {/* Order Confirmation */}
              <div className="border-b border-gray-200 pb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  What's Next?
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Mail className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Check Your Email
                      </h3>
                      <p className="text-gray-600">
                        We've sent you an order confirmation email with all the details. 
                        Please check your inbox (and spam folder if you don't see it).
                      </p>
                    </div>
                  </div>

                  {isNewAccount && (
                    <div className="flex items-start gap-4 bg-teal-50 p-4 rounded-lg border border-teal-200">
                      <div className="flex-shrink-0">
                        <Lock className="h-6 w-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          Your Account Has Been Created!
                        </h3>
                        <p className="text-gray-700 mb-3">
                          We've automatically created an account for you to track your orders, 
                          manage subscriptions, and more. Check your email for a magic link to access your account.
                        </p>
                        <div className="bg-white p-3 rounded border border-teal-200">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            How to Access Your Account:
                          </p>
                          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                            <li>Check your email inbox for a message from BREVI</li>
                            <li>Click the "Access Your Account" button in the email</li>
                            <li>You'll be automatically logged in (no password needed!)</li>
                            <li>You can set a password later if you'd like</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Package className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Order Processing
                      </h3>
                      <p className="text-gray-600">
                        Your order is being processed and will be shipped soon. 
                        You'll receive a shipping confirmation email with tracking information once your order ships.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription Portal Link */}
              {showSubscriptionLink && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Repeat className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Manage Your Subscription
                      </h3>
                      <p className="text-sm text-gray-700 mb-3">
                        You can manage your subscription, update delivery frequency, pause, or cancel anytime from your account.
                      </p>
                      <Button
                        asChild
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        <Link href="/account/subscriptions">
                          Go to Subscription Portal
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Benefits */}
              {isNewAccount && (
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    What You Can Do With Your Account:
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <ShoppingBag className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Track Orders</p>
                        <p className="text-sm text-gray-600">View order status and tracking</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Heart className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Manage Subscriptions</p>
                        <p className="text-sm text-gray-600">Update frequency and preferences</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Order History</p>
                        <p className="text-sm text-gray-600">View all past purchases</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Lock className="h-5 w-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Faster Checkout</p>
                        <p className="text-sm text-gray-600">Save payment methods</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                {orderId && (
                  <Button
                    asChild
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                  >
                    <Link href={`/account/orders/${orderId}`}>
                      View Order Details
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  variant="outline"
                  className="flex-1"
                >
                  <Link href="/">
                    Continue Shopping
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">
              Need Help?
            </h3>
            <p className="text-gray-600 mb-4">
              If you have any questions about your order, please don't hesitate to contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="outline">
                <Link href="/contact">Contact Support</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/faq">View FAQ</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Post-Purchase Upsell Modal */}
        {postPurchaseUpsell && upsellProducts.length > 0 && (
          <PostPurchaseUpsellModal
            upsell={postPurchaseUpsell}
            products={upsellProducts}
            orderValue={orderValue}
            onClose={() => setPostPurchaseUpsell(null)}
          />
        )}
      </div>
      
      {/* Post-Purchase Upsell Modal */}
      {postPurchaseUpsell && upsellProducts.length > 0 && (
        <PostPurchaseUpsellModal
          upsell={postPurchaseUpsell}
          products={upsellProducts}
          orderValue={orderValue}
          onClose={() => setPostPurchaseUpsell(null)}
        />
      )}
    </>
  )
}

export default function ThankYouPage() {
  return (
    <>
      <Header />
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
          </div>
        </div>
      }>
        <ThankYouContent />
      </Suspense>
    </>
  )
}
