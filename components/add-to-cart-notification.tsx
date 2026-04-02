"use client"

import { CheckCircle } from "lucide-react"
import { useCart } from "@/lib/cart-context"

export function AddToCartNotification() {
  const { showNotification } = useCart()

  if (!showNotification) return null

  return (
    <div className="fixed top-24 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
        <CheckCircle className="w-5 h-5" />
        <span className="font-medium">Item added to cart!</span>
      </div>
    </div>
  )
}
