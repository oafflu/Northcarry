"use client"

import { useState, useEffect } from "react"
import { Minus, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Truck, MessageCircle, DollarSign, Star, Heart } from "lucide-react"
import { useCart } from "@/lib/cart-context"
import { useRouter } from "next/navigation"

export function CartContent() {
  const { items: cartItems, updateQuantity, removeItem, subtotal, loading } = useCart()
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(600) // 10 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    await updateQuantity(id, newQuantity)
  }

  const handleRemoveItem = async (id: string) => {
    await removeItem(id)
  }

  const handleCheckout = () => {
    router.push('/checkout')
  }

  const oldPrice = cartItems.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0)
  const discount = oldPrice - subtotal

  return (
    <div className="py-12 px-4 md:px-6 lg:px-8">
      <div className="container max-w-7xl mx-auto">
        {/* Need Assistance */}
        <div className="text-right mb-6">
          <p className="text-sm text-gray-600">
            Need Assistance?{" "}
            <span className="font-semibold">
              Call{" "}
              <a href="tel:8488004029" className="text-gray-900 hover:underline">
                (848) 800-4029
              </a>
            </span>
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items Section */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Your Cart</h1>
              {cartItems.length > 0 && (
                <Button 
                  size="lg" 
                  className="bg-[#0066FF] hover:bg-[#0052CC] text-white px-8"
                  onClick={handleCheckout}
                >
                  Proceed to Checkout
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading cart...</p>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">Your cart is empty</p>
                <Button onClick={() => router.push('/product')} className="bg-[#0066FF] hover:bg-[#0052CC] text-white">
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="bg-white border rounded-lg p-6 relative">
                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                      aria-label="Remove item"
                    >
                      <X className="w-5 h-5" />
                    </button>

                  <div className="flex gap-6">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        width={100}
                        height={100}
                        className="rounded object-cover"
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{item.name}</h3>

                      {/* Sale Badge */}
                      <div className="inline-block bg-[#0066FF] text-white text-xs px-3 py-1 rounded mb-3">
                        Checkout now to get this sale
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Color Selector */}
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Color</p>
                          <p className="font-medium">{item.color}</p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="text-xl font-bold text-[#0066FF]">${item.price.toFixed(2)}</p>
                          <p className="text-sm text-gray-500 line-through">${item.originalPrice.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>

          {/* Order Summary Section */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-6 sticky top-24">
              {/* Price Breakdown */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-gray-700">
                  <span>Old price</span>
                  <span>${oldPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Discount</span>
                  <span>- ${discount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Free Shipping */}
              <p className="text-center text-sm text-gray-600 mb-4">Free Shipping Today Only!</p>

              {/* Timer */}
              <div className="text-center mb-6">
                <p className="text-sm mb-2">We're reserving your price for</p>
                <p className="text-3xl font-bold text-[#0066FF]">{formatTime(timeLeft)}</p>
              </div>

              {/* Checkout Button */}
              <Button 
                className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white py-6 text-lg font-semibold mb-4"
                onClick={handleCheckout}
                disabled={cartItems.length === 0}
              >
                Proceed to Checkout
              </Button>

              {/* PayPal Button */}
              {cartItems.length > 0 && (
                <div className="mb-6">
                  <PayPalButton
                    amount={subtotal}
                    onSuccess={(orderId) => {
                      router.push(`/checkout/paypal/success?orderId=${orderId}`)
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

              {/* Payment Icons */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div className="w-10 h-6 bg-[#1A1F71] rounded flex items-center justify-center text-white text-[8px] font-bold">
                    VISA
                  </div>
                  <div className="w-10 h-6 bg-black rounded"></div>
                  <div className="w-10 h-6 bg-[#006FCF] rounded flex items-center justify-center text-white text-[8px] font-bold">
                    AMEX
                  </div>
                  <div className="w-10 h-6 bg-[#0070BA] rounded flex items-center justify-center text-white text-[8px] font-bold">
                    PP
                  </div>
                  <div className="w-10 h-6 bg-white border rounded flex items-center justify-center text-[10px] font-bold">
                    Pay
                  </div>
                  <div className="w-10 h-6 bg-white border rounded"></div>
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <div className="w-10 h-6 bg-[#006FCF] rounded"></div>
                  <div className="w-10 h-6 bg-white border rounded"></div>
                  <div className="w-10 h-6 bg-[#FF6000] rounded"></div>
                  <div className="w-10 h-6 bg-white border rounded"></div>
                  <div className="w-10 h-6 bg-[#EB001B] rounded"></div>
                  <div className="w-10 h-6 bg-white border rounded"></div>
                  <div className="w-10 h-6 bg-[#5A31F4] rounded"></div>
                  <div className="w-10 h-6 bg-[#1A1F71] rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-16 mb-16">
          <div className="flex flex-col items-center text-center">
            <Truck className="w-12 h-12 mb-3" />
            <p className="font-semibold text-sm">FREE Worldwide Express Shipping</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <MessageCircle className="w-12 h-12 mb-3" />
            <p className="font-semibold text-sm">24/7 Dedicated Customer Service</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <DollarSign className="w-12 h-12 mb-3" />
            <p className="font-semibold text-sm">Premium Quality Guaranteed - 5 Days Replacement</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <Star className="w-12 h-12 mb-3" />
            <p className="font-semibold text-sm">Not Available on Amazon or in Stores!</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <Heart className="w-12 h-12 mb-3" />
            <p className="font-semibold text-sm">We Guarantee that you will absolutely love it!</p>
          </div>
        </div>

        {/* About Your Delivery */}
        <div className="max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-center mb-6">About Your Delivery</h2>
          <p className="text-gray-700 text-center leading-relaxed">
            This is a location to explain your standard delivery procedures, how quickly it will be dispatched, general
            length of time for delivery etc.
          </p>
        </div>

        {/* Quality Guarantee */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6">Quality Guarantee</h2>
          <p className="text-gray-700 text-center leading-relaxed">
            We stand behind the quality of our Brevi brushes. If you receive a defective or damaged item, contact us 
            within 5 days of delivery and we'll send you a replacement at no additional cost. We're committed to ensuring 
            you receive a perfect product!
          </p>
        </div>
      </div>
    </div>
  )
}
