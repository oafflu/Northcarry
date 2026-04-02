"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Lock } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Check if we have the necessary hash/token from Supabase
    // Supabase password reset links include hash in the URL or token in query params
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('token')
      
      // Supabase typically uses hash fragments for auth, but we'll check both
      // The session is established when the user lands on this page from the email link
      if (!hash && !token) {
        // Don't show error immediately - Supabase might handle it differently
        // The updateUser call will fail if there's no valid session
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Supabase handles password reset via updateUser
      // The hash in the URL contains the session token
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        console.error('Error updating password:', updateError)
        setError(updateError.message || 'Failed to reset password. The link may have expired.')
      } else {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login?password=reset')
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error in password reset:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 py-16">
          <div className="mx-auto max-w-md px-4">
            <div className="rounded-lg bg-white p-8 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Lock className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="mb-2 text-2xl font-bold">Password Reset Successful!</h2>
              <p className="mb-6 text-gray-600">
                Your password has been updated. Redirecting to login...
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-16">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <h1 className="mb-2 text-center text-3xl font-bold">Reset Password</h1>
            <p className="mb-6 text-center text-sm text-gray-600">
              Enter your new password below.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Enter new password"
                />
                <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold text-black hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

