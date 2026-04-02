"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import Header from "@/components/header"
import Footer from "@/components/footer"

export default function LoginPage() {
  const router = useRouter()
  const { login, user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if already logged in (but wait for auth to finish loading)
  useEffect(() => {
    if (!mounted) return // Wait for mount
    
    if (!authLoading && user) {
      // Redirect immediately without delay to prevent flash
      if (user.role === 'admin' || user.role === 'marketer' || user.role === 'support' || user.role === 'partner') {
        router.replace('/admin')
      } else if (user.role === 'supplier') {
        router.replace('/supplier')
      } else {
        router.replace('/account')
      }
    }
  }, [mounted, user, authLoading, router])

  // Show loading state while checking auth or not mounted
  if (!mounted || authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </main>
        <Footer />
      </div>
    )
  }

  // Don't render login form if user is already logged in - redirect will happen
  if (user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Redirecting...</p>
        </main>
        <Footer />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const loggedInUser = await login(email, password)
      
      // Check if user needs to change password
      if (loggedInUser?.needsPasswordChange) {
        // Redirect to change password page
        window.location.href = "/account/change-password?force=true"
        return
      }
      
      // Use window.location.href for full page reload to prevent hydration mismatches
      // This ensures server and client are in sync after login
      if (loggedInUser?.role === 'admin' || loggedInUser?.role === 'marketer' || loggedInUser?.role === 'support' || loggedInUser?.role === 'partner') {
        window.location.href = "/admin"
      } else if (loggedInUser?.role === 'supplier') {
        window.location.href = "/supplier"
      } else {
        window.location.href = "/account"
      }
    } catch (err) {
      setError("Invalid email or password")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-16">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <h1 className="mb-6 text-center text-3xl font-bold">Login</h1>

            {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link href="/forgot-password" className="text-gray-600 hover:text-black">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Accounts are created automatically when you make a purchase.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
