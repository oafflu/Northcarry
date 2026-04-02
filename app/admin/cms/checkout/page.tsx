"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"

export default function CheckoutManagementPage() {
  const [content, setContent] = useState({
    title: "Checkout",
    subtitle: "Complete your purchase",
    trustBadges: [
      { text: "Secure Payment", icon: "🔒" },
      { text: "Free Shipping", icon: "🚚" },
      { text: "Easy Returns", icon: "↩️" },
    ],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCheckout()
  }, [])

  const loadCheckout = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('checkout')
      if (result.data) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('Error loading checkout settings:', error)
      toast.error('Failed to load checkout settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('checkout', content)
      if (result.success) {
        toast.success('Checkout settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save checkout settings')
      }
    } catch (error) {
      console.error('Error saving checkout:', error)
      toast.error('Failed to save checkout settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading checkout settings...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/cms" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Checkout Content</h1>
          <p className="text-gray-600 mt-1">Customize checkout page text and elements</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Page Title</label>
          <input
            type="text"
            value={content.title}
            onChange={(e) => setContent({ ...content, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
          <input
            type="text"
            value={content.subtitle}
            onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href="/admin/cms"
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

