"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { getPromotion, updatePromotion } from "@/app/actions/promotions"
import { toast } from "sonner"

export default function EditPromotionPage() {
  const router = useRouter()
  const params = useParams()
  const promotionId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [code, setCode] = useState("")
  const [type, setType] = useState<"percentage" | "fixed" | "free_shipping">("percentage")
  const [value, setValue] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minPurchase, setMinPurchase] = useState("")
  const [status, setStatus] = useState<"active" | "scheduled" | "disabled">("active")

  useEffect(() => {
    if (promotionId) {
      loadPromotion()
    }
  }, [promotionId])

  const loadPromotion = async () => {
    setLoading(true)
    try {
      const result = await getPromotion(promotionId)
      if (result.error || !result.data) {
        toast.error(result.error || 'Promotion not found')
        router.push('/admin/promotions')
        return
      }

      const promo = result.data
      setCode(promo.code || "")
      setType(promo.discount_type || "percentage")
      setValue(promo.discount_value?.toString() || "")
      setUsageLimit(promo.usage_limit?.toString() || "")
      setMinPurchase(promo.min_purchase_amount?.toString() || "")
      setStatus(promo.status || "active")
      
      // Format dates for input fields
      if (promo.starts_at) {
        const start = new Date(promo.starts_at)
        setStartDate(start.toISOString().split('T')[0])
      }
      if (promo.ends_at) {
        const end = new Date(promo.ends_at)
        setEndDate(end.toISOString().split('T')[0])
      }
    } catch (error) {
      console.error('Error loading promotion:', error)
      toast.error('Failed to load promotion')
      router.push('/admin/promotions')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!code.trim()) {
      toast.error('Please enter a promotion code')
      return
    }

    if (type !== 'free_shipping' && !value) {
      toast.error(`Please enter a ${type === 'percentage' ? 'percentage' : 'discount amount'}`)
      return
    }

    if (type === 'percentage' && (parseFloat(value) < 0 || parseFloat(value) > 100)) {
      toast.error('Percentage must be between 0 and 100')
      return
    }

    if (type === 'fixed' && parseFloat(value) <= 0) {
      toast.error('Discount amount must be greater than 0')
      return
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error('End date must be after start date')
      return
    }

    setSubmitting(true)
    try {
      const result = await updatePromotion(promotionId, {
        code: code.trim(),
        discount_type: type,
        discount_value: type === 'free_shipping' ? 0 : parseFloat(value),
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
        min_purchase_amount: minPurchase ? parseFloat(minPurchase) : null,
        starts_at: startDate || null,
        ends_at: endDate || null,
        status,
      })

      if (result.success) {
        toast.success('Promotion updated successfully')
        router.push('/admin/promotions')
      } else {
        toast.error(result.error || 'Failed to update promotion')
      }
    } catch (error) {
      console.error('Error updating promotion:', error)
      toast.error('Failed to update promotion')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/promotions" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Promotion</h1>
            <p className="text-gray-600 mt-1">Update promotion details</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
          <p className="mt-4 text-gray-600">Loading promotion...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/promotions" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Promotion</h1>
          <p className="text-gray-600 mt-1">Update promotion details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discount Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "percentage" | "fixed" | "free_shipping")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
              <option value="free_shipping">Free Shipping</option>
            </select>
          </div>

          {type !== "free_shipping" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {type === "percentage" ? "Percentage Off" : "Amount Off"}
              </label>
              <div className="relative">
                {type === "percentage" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                )}
                {type === "fixed" && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === "percentage" ? "50" : "10.00"}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 ${
                    type === "fixed" ? "pl-8" : "pr-8"
                  }`}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Usage Limit</label>
            <input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Leave empty for unlimited"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Purchase</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minPurchase}
                onChange={(e) => setMinPurchase(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "scheduled" | "disabled")}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t">
          <Link
            href="/admin/promotions"
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Update Promotion
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

