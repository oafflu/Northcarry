"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { createAffiliate } from "@/app/actions/affiliates"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

function AffiliateRegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register, user } = useAuth()
  const [step, setStep] = useState<"account" | "affiliate">("account")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const invitationToken = searchParams.get('token') || null

  // Account registration form
  const [accountForm, setAccountForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  // Affiliate application form
  const [affiliateForm, setAffiliateForm] = useState({
    company_name: "",
    website: "",
    tax_id: "",
    payment_method: "paypal",
    payment_details: {},
  })

  // If user is already logged in, skip to affiliate form
  useEffect(() => {
    if (user) {
      setStep("affiliate")
    }
  }, [user])

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (accountForm.password !== accountForm.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (accountForm.password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setLoading(true)

    try {
      await register(
        accountForm.email,
        accountForm.password,
        accountForm.firstName,
        accountForm.lastName
      )
      // After successful registration, move to affiliate form
      setStep("affiliate")
      toast.success("Account created successfully! Now complete your affiliate application.")
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
      toast.error(err.message || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAffiliateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user?.id) {
      setError("Please create an account first")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await createAffiliate({
        user_id: user.id,
        ...affiliateForm,
        invitation_token: invitationToken, // Pass invitation token to check for existing affiliate
      })

      if (result.success) {
        toast.success("Affiliate application submitted successfully! You'll be notified once approved.")
        router.push("/account/affiliate")
      } else {
        setError(result.error || "Failed to submit application")
        toast.error(result.error || "Failed to submit application")
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit application")
      toast.error(err.message || "Failed to submit application")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container max-w-4xl mx-auto py-12 px-4">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className={`flex items-center gap-2 ${step === "account" ? "text-teal-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === "account" ? "border-teal-600 bg-teal-50" : "border-gray-300"}`}>
                {step === "affiliate" ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <span className="font-medium">Create Account</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <div className={`flex items-center gap-2 ${step === "affiliate" ? "text-teal-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === "affiliate" ? "border-teal-600 bg-teal-50" : "border-gray-300"}`}>
                2
              </div>
              <span className="font-medium">Affiliate Application</span>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <Link
          href="/affiliate"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Affiliate Program
        </Link>

        {/* Step 1: Account Registration */}
        {step === "account" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Affiliate Account</h1>
              <p className="text-gray-600">
                Register to become a BREVI affiliate partner. This is separate from customer registration.
              </p>
            </div>

            <form onSubmit={handleAccountSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.firstName}
                    onChange={(e) => setAccountForm({ ...accountForm, firstName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountForm.lastName}
                    onChange={(e) => setAccountForm({ ...accountForm, lastName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={accountForm.email}
                  onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="you@example.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be your affiliate account email (not for shopping)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={accountForm.password}
                  onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="At least 8 characters"
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={accountForm.confirmPassword}
                  onChange={(e) => setAccountForm({ ...accountForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Confirm your password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Continue to Application"
                )}
              </Button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login?redirect=/affiliate/register" className="text-teal-600 hover:text-teal-700 font-medium">
                  Sign in here
                </Link>
              </p>
            </form>
          </div>
        )}

        {/* Step 2: Affiliate Application */}
        {step === "affiliate" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Affiliate Application</h1>
              <p className="text-gray-600">
                Complete your affiliate application. All fields are optional, but providing more information helps with faster approval.
              </p>
            </div>

            <form onSubmit={handleAffiliateSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  value={affiliateForm.company_name}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Your company or brand name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website/Blog/Social Media (Optional)
                </label>
                <input
                  type="url"
                  value={affiliateForm.website}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, website: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="https://yourwebsite.com or your social media profile"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Where will you promote BREVI products?
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax ID / EIN (Optional)
                </label>
                <input
                  type="text"
                  value={affiliateForm.tax_id}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, tax_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Required for tax reporting if earning over $600/year"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Payment Method
                </label>
                <select
                  value={affiliateForm.payment_method}
                  onChange={(e) => setAffiliateForm({ ...affiliateForm, payment_method: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="check">Check</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Your application will be reviewed by our team. You'll receive an email confirmation immediately, and another email once approved. 
                  This usually takes 1-2 business days.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>About Commission Tiers:</strong> Your commission tier will be assigned by our team when your application is approved. 
                  Tiers are based on factors like your audience size, promotional channels, and expected performance. 
                  You'll be notified of your tier assignment in your approval email.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}

export default function AffiliateRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    }>
      <AffiliateRegisterPageContent />
    </Suspense>
  )
}

