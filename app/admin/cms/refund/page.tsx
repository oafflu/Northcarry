"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

export default function RefundManagementPage() {
  const [content, setContent] = useState({
    title: "Refund Policy",
    content: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadRefund()
  }, [])

  const loadRefund = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('refund')
      if (result.data) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('Error loading refund policy:', error)
      toast.error('Failed to load refund policy')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('refund', content)
      if (result.success) {
        toast.success('Refund policy saved successfully')
      } else {
        toast.error(result.error || 'Failed to save refund policy')
      }
    } catch (error) {
      console.error('Error saving refund policy:', error)
      toast.error('Failed to save refund policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading refund policy...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Refund Policy</h1>
          <p className="text-gray-600 mt-1">Manage refund policy page content</p>
          <p className="text-sm text-gray-500 mt-2">Note: We now offer a 5-day replacement policy for defective or damaged Brevi brushes instead of a 30-day money-back guarantee.</p>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
          <Textarea
            value={content.content}
            onChange={(e) => setContent({ ...content, content: e.target.value })}
            rows={20}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
            placeholder="Enter refund policy content here..."
          />
          <p className="mt-1 text-xs text-gray-500">Supports HTML and markdown formatting</p>
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">⚠️ Remember: We now offer a 5-day replacement policy for defective or damaged Brevi brushes, not a 30-day money-back guarantee.</p>
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

