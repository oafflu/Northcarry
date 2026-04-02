"use client"

import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CartContent } from "@/components/cart/cart-content"
import CartRecovery from "@/components/cart/cart-recovery"

export default function CartPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Suspense fallback={null}>
          <CartRecovery />
        </Suspense>
        <CartContent />
      </main>
      <Footer />
    </div>
  )
}
