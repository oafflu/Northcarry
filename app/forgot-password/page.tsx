"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Use Supabase's built-in password reset (configured with Custom SMTP in Supabase dashboard)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
      })

      if (error) {
        console.error('Error sending password reset email:', error)
        // Still show success message for security (don't reveal if email exists)
        setSubmitted(true)
      } else {
        setSubmitted(true)
      }
    } catch (error: any) {
      console.error('Error in password reset:', error)
      // Still show success message for security
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-16">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-lg bg-white p-8 shadow-sm">
            {!submitted ? (
              <>
                <h1 className="mb-2 text-center text-3xl font-bold">Reset Password</h1>
                <p className="mb-6 text-center text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-md bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-600">
                  Remember your password?{" "}
                  <Link href="/login" className="font-semibold text-black hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Check your email</h2>
                <p className="mb-6 text-gray-600">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <Link
                  href="/login"
                  className="inline-block rounded-md bg-black px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
