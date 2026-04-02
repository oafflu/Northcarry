"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import {
  UserCheck,
  Link2,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Copy,
  Check,
  Plus,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getAffiliateById,
  getAffiliateLinks,
  getAffiliateOrders,
  createAffiliateLink,
  createAffiliate,
  type Affiliate,
  type AffiliateLink,
  type AffiliateOrder,
} from "@/app/actions/affiliates"
import { toast } from "sonner"

export default function AffiliateDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [links, setLinks] = useState<AffiliateLink[]>([])
  const [orders, setOrders] = useState<AffiliateOrder[]>([])
  const [showSignupForm, setShowSignupForm] = useState(false)
  const [signupForm, setSignupForm] = useState({
    company_name: "",
    website: "",
    tax_id: "",
    payment_method: "paypal",
    payment_details: {},
  })
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkForm, setLinkForm] = useState({
    link_type: "home" as "product" | "category" | "home" | "custom",
    product_id: "",
    custom_url: "",
  })
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login?redirect=/account/affiliate")
        return
      }
      loadAffiliateData()
    }
  }, [user, authLoading, router])

  const loadAffiliateData = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Check if user is already an affiliate
      const { getAffiliateByUserId } = await import("@/app/actions/affiliates")
      const result = await getAffiliateByUserId(user.id)
      if (result.success && result.data) {
        setAffiliate(result.data)
        
        // Load links and orders
        const [linksResult, ordersResult] = await Promise.all([
          getAffiliateLinks(result.data.id),
          getAffiliateOrders(result.data.id),
        ])
        
        if (linksResult.success) setLinks(linksResult.data)
        if (ordersResult.success) setOrders(ordersResult.data)
      } else {
        setShowSignupForm(true)
      }
    } catch (error) {
      console.error("Error loading affiliate data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!user?.id) return

    try {
      const result = await createAffiliate({
        user_id: user.id,
        ...signupForm,
      })

      if (result.success) {
        toast.success("Affiliate application submitted! Waiting for approval.")
        setShowSignupForm(false)
        loadAffiliateData()
      } else {
        toast.error(result.error || "Failed to submit application")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application")
    }
  }

  const handleCreateLink = async () => {
    if (!affiliate) return

    try {
      const result = await createAffiliateLink({
        affiliate_id: affiliate.id,
        ...linkForm,
      })

      if (result.success) {
        toast.success("Affiliate link created!")
        setShowLinkModal(false)
        setLinkForm({
          link_type: "home",
          product_id: "",
          custom_url: "",
        })
        loadAffiliateData()
      } else {
        toast.error(result.error || "Failed to create link")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create link")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedLink(text)
    toast.success("Link copied to clipboard!")
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (showSignupForm) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Become an Affiliate</h1>
          <p className="text-gray-600 mt-1">Join our affiliate program and earn commissions on every sale</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Form</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Optional)</label>
              <input
                type="text"
                value={signupForm.company_name}
                onChange={(e) => setSignupForm({ ...signupForm, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website (Optional)</label>
              <input
                type="url"
                value={signupForm.website}
                onChange={(e) => setSignupForm({ ...signupForm, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID (Optional)</label>
              <input
                type="text"
                value={signupForm.tax_id}
                onChange={(e) => setSignupForm({ ...signupForm, tax_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Tax identification number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={signupForm.payment_method}
                onChange={(e) => setSignupForm({ ...signupForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="paypal">PayPal</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>
            <Button onClick={handleSignup} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              Submit Application
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!affiliate) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Affiliate Dashboard</h1>
        <p className="text-gray-600 mt-1">Track your performance and manage your affiliate links</p>
      </div>

      {/* Status Banner */}
      {affiliate.status === "pending" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Pending Approval:</strong> Your affiliate application is being reviewed. You'll be notified once approved.
          </p>
        </div>
      )}

      {affiliate.status === "suspended" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <strong>Account Suspended:</strong> Your affiliate account has been suspended. Please contact support.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Clicks</p>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{affiliate.total_clicks.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Orders</p>
            <ShoppingCart className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{affiliate.total_orders}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(affiliate.total_revenue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Commission</p>
            <DollarSign className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(affiliate.total_commission)}</p>
        </div>
      </div>

      {/* Affiliate Code */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Affiliate Code</h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-mono text-lg">
            {affiliate.affiliate_code}
          </code>
          <Button
            onClick={() => copyToClipboard(affiliate.affiliate_code)}
            variant="outline"
            size="sm"
          >
            {copiedLink === affiliate.affiliate_code ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Add <code className="bg-gray-100 px-1 py-0.5 rounded">?ref={affiliate.affiliate_code}</code> to any URL to track referrals
        </p>
      </div>

      {/* Affiliate Links */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Affiliate Links</h2>
          {affiliate.status === "active" && (
            <Button
              onClick={() => setShowLinkModal(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Link
            </Button>
          )}
        </div>

        {links.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No affiliate links yet. Create your first link to get started!</p>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{link.affiliate_url}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>{link.total_clicks} clicks</span>
                    <span>{link.total_conversions} conversions</span>
                    <span>{formatCurrency(link.total_revenue)} revenue</span>
                  </div>
                </div>
                <Button
                  onClick={() => copyToClipboard(link.affiliate_url)}
                  variant="outline"
                  size="sm"
                >
                  {copiedLink === link.affiliate_url ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders/Commissions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders & Commissions</h2>
        {orders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No orders yet. Start sharing your links to earn commissions!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.order_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(order.order_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(order.order_total)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-teal-600">
                      {formatCurrency(order.commission_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === "paid"
                            ? "bg-green-50 text-green-700"
                            : order.status === "approved"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Affiliate Link</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Type</label>
                <select
                  value={linkForm.link_type}
                  onChange={(e) =>
                    setLinkForm({ ...linkForm, link_type: e.target.value as any, product_id: "", custom_url: "" })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="home">Homepage</option>
                  <option value="product">Product</option>
                  <option value="custom">Custom URL</option>
                </select>
              </div>
              {linkForm.link_type === "product" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <input
                    type="text"
                    value={linkForm.product_id}
                    onChange={(e) => setLinkForm({ ...linkForm, product_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Enter product ID"
                  />
                </div>
              )}
              {linkForm.link_type === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom URL</label>
                  <input
                    type="url"
                    value={linkForm.custom_url}
                    onChange={(e) => setLinkForm({ ...linkForm, custom_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://brevibrushes.com/..."
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreateLink} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                Create Link
              </Button>
              <Button
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkForm({ link_type: "home", product_id: "", custom_url: "" })
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

