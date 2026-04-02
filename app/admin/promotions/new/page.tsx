"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { createPromotion } from "@/app/actions/promotions"
import { toast } from "sonner"

export default function NewPromotionPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [type, setType] = useState<"percentage" | "fixed" | "free_shipping">("percentage")
  const [value, setValue] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [minPurchase, setMinPurchase] = useState("")
  const [status, setStatus] = useState<"active" | "scheduled" | "disabled">("active")
  const [submitting, setSubmitting] = useState(false)

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
      const result = await createPromotion({
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
        toast.success('Promotion created successfully')
        router.push('/admin/promotions')
      } else {
        toast.error(result.error || 'Failed to create promotion')
      }
    } catch (error) {
      console.error('Error creating promotion:', error)
      toast.error('Failed to create promotion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/promotions" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Promotion</h1>
          <p className="text-gray-600 mt-1">Set up a new discount code</p>
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
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Creating...' : 'Create Promotion'}
          </button>
        </div>
      </form>
    </div>
  )
}
