"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail, Edit, Trash2, Check, X, DollarSign, ShoppingBag, TrendingUp, Calendar, User, Building2, Globe, CreditCard, FileText } from "lucide-react"
import { getAffiliateById, updateAffiliate, approveAffiliate, deleteAffiliate, getAffiliateOrders, getAffiliateTiers, type Affiliate, type AffiliateOrder, type AffiliateTier } from "@/app/actions/affiliates"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AffiliateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const affiliateId = params.id as string

  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [affiliateOrders, setAffiliateOrders] = useState<AffiliateOrder[]>([])
  const [tiers, setTiers] = useState<AffiliateTier[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [approving, setApproving] = useState(false)

  const [editForm, setEditForm] = useState({
    company_name: "",
    website: "",
    tax_id: "",
    payment_method: "paypal",
    payment_details: {},
    tier_id: "",
    status: "pending" as "pending" | "active" | "suspended" | "inactive",
    notes: "",
  })

  useEffect(() => {
    if (affiliateId) {
      loadAffiliate()
      loadTiers()
    }
  }, [affiliateId])

  const loadTiers = async () => {
    try {
      const result = await getAffiliateTiers()
      if (result.success && result.data) {
        setTiers(result.data)
      }
    } catch (error) {
      console.error("Error loading tiers:", error)
    }
  }

  const loadAffiliate = async () => {
    setLoading(true)
    try {
      const [affiliateResult, ordersResult] = await Promise.all([
        getAffiliateById(affiliateId),
        getAffiliateOrders(affiliateId, { pageSize: 50 })
      ])

      if (affiliateResult.success && affiliateResult.data) {
        setAffiliate(affiliateResult.data)
        setEditForm({
          company_name: affiliateResult.data.company_name || "",
          website: affiliateResult.data.website || "",
          tax_id: affiliateResult.data.tax_id || "",
          payment_method: affiliateResult.data.payment_method || "paypal",
          payment_details: affiliateResult.data.payment_details || {},
          tier_id: affiliateResult.data.tier_id || "",
          status: affiliateResult.data.status,
          notes: affiliateResult.data.notes || "",
        })
      } else {
        toast.error(affiliateResult.error || "Affiliate not found")
        router.push("/admin/marketing/affiliate")
        return
      }

      if (ordersResult.success && ordersResult.data) {
        setAffiliateOrders(ordersResult.data)
      }
    } catch (error: any) {
      console.error("Error loading affiliate:", error)
      toast.error("Failed to load affiliate")
      router.push("/admin/marketing/affiliate")
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!user?.id || !affiliate) return

    setApproving(true)
    try {
      const result = await approveAffiliate(affiliate.id, user.id)
      if (result.success) {
        toast.success("Affiliate approved successfully")
        loadAffiliate()
      } else {
        toast.error(result.error || "Failed to approve affiliate")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to approve affiliate")
    } finally {
      setApproving(false)
    }
  }

  const handleUpdate = async () => {
    if (!affiliate) return

    setUpdating(true)
    try {
      const updateData = {
        ...editForm,
        tier_id: editForm.tier_id || null, // Convert empty string to null
      }
      const result = await updateAffiliate(affiliate.id, updateData)
      if (result.success) {
        toast.success("Affiliate updated successfully")
        setShowEditDialog(false)
        loadAffiliate()
      } else {
        toast.error(result.error || "Failed to update affiliate")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update affiliate")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!affiliate) return

    setDeleting(true)
    try {
      const result = await deleteAffiliate(affiliate.id)
      if (result.success) {
        toast.success("Affiliate deleted successfully")
        router.push("/admin/marketing/affiliate")
      } else {
        toast.error(result.error || "Failed to delete affiliate")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete affiliate")
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700"
      case "pending":
        return "bg-yellow-50 text-yellow-700"
      case "suspended":
        return "bg-red-50 text-red-700"
      case "inactive":
        return "bg-gray-50 text-gray-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!affiliate) {
    return (
      <div className="space-y-6">
        <Link href="/admin/marketing/affiliate" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Affiliates
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Affiliate not found</p>
        </div>
      </div>
    )
  }

  const affiliateName = affiliate.user?.first_name && affiliate.user?.last_name
    ? `${affiliate.user.first_name} ${affiliate.user.last_name}`
    : affiliate.user?.email || "Unknown"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/marketing/affiliate" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Affiliates
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Details</h1>
        </div>
        <div className="flex gap-2">
          {affiliate.status === "pending" && (
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => setShowEditDialog(true)}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Affiliate Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Affiliate Information</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="text-base font-medium text-gray-900">{affiliateName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-base font-medium text-gray-900">{affiliate.user?.email || "N/A"}</p>
                </div>
              </div>
              {affiliate.company_name && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Company Name</p>
                    <p className="text-base font-medium text-gray-900">{affiliate.company_name}</p>
                  </div>
                </div>
              )}
              {affiliate.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Website</p>
                    <a
                      href={affiliate.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium text-teal-600 hover:text-teal-700"
                    >
                      {affiliate.website}
                    </a>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Affiliate Code</p>
                  <code className="text-base font-mono bg-gray-100 px-2 py-1 rounded">
                    {affiliate.affiliate_code}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Tier</p>
                  <p className="text-base font-medium text-gray-900">
                    {affiliate.tier?.name || "No tier assigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Joined</p>
                  <p className="text-base font-medium text-gray-900">
                    {new Date(affiliate.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {(affiliate.payment_method || affiliate.tax_id) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
              <div className="space-y-4">
                {affiliate.payment_method && (
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Payment Method</p>
                      <p className="text-base font-medium text-gray-900 capitalize">
                        {affiliate.payment_method.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                )}
                {affiliate.tax_id && (
                  <div>
                    <p className="text-sm text-gray-500">Tax ID / EIN</p>
                    <p className="text-base font-medium text-gray-900">{affiliate.tax_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {affiliate.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{affiliate.notes}</p>
            </div>
          )}

          {/* Affiliate Orders */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Affiliate Orders</h2>
            {affiliateOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No orders found for this affiliate.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Order #</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Order Total</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Commission</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliateOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Link
                            href={`/admin/orders/${order.order_id}`}
                            className="text-teal-600 hover:text-teal-700 font-medium"
                          >
                            {order.order_number}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {new Date(order.order_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900">
                          {formatCurrency(order.order_total)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-teal-600">
                          {formatCurrency(order.commission_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            order.status === 'paid' ? 'bg-green-50 text-green-700' :
                            order.status === 'approved' ? 'bg-blue-50 text-blue-700' :
                            order.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(affiliate.status)}`}>
              {affiliate.status}
            </span>
            {affiliate.approved_at && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Approved on</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(affiliate.approved_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Total Clicks</p>
                <p className="text-2xl font-bold text-gray-900">{affiliate.total_clicks || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{affiliate.total_orders || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(affiliate.total_revenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Commission</p>
                <p className="text-2xl font-bold text-teal-600">
                  {formatCurrency(affiliate.total_commission || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid Commission</p>
                <p className="text-xl font-semibold text-gray-700">
                  {formatCurrency(affiliate.paid_commission || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending Commission</p>
                <p className="text-xl font-semibold text-yellow-600">
                  {formatCurrency(affiliate.pending_commission || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Affiliate</DialogTitle>
            <DialogDescription>
              Update affiliate information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Company Name</label>
              <input
                type="text"
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Website</label>
              <input
                type="url"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tax ID / EIN</label>
              <input
                type="text"
                value={editForm.tax_id}
                onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tier</label>
              <select
                value={editForm.tier_id}
                onChange={(e) => setEditForm({ ...editForm, tier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">No tier assigned</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({tier.commission_rate}% {tier.commission_type === 'percentage' ? 'commission' : 'fixed'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Payment Method</label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="paypal">PayPal</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Add notes about this affiliate..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Affiliate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Affiliate</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this affiliate? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Affiliate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

