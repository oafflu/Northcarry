"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"

export default function PrivacyManagementPage() {
  const [content, setContent] = useState({
    title: "Privacy Policy",
    content: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPrivacy()
  }, [])

  const loadPrivacy = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('privacy')
      if (result.data) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('Error loading privacy policy:', error)
      toast.error('Failed to load privacy policy')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('privacy', content)
      if (result.success) {
        toast.success('Privacy policy saved successfully')
      } else {
        toast.error(result.error || 'Failed to save privacy policy')
      }
    } catch (error) {
      console.error('Error saving privacy policy:', error)
      toast.error('Failed to save privacy policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading privacy policy...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-1">Manage privacy policy page content</p>
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
            placeholder="Enter privacy policy content here..."
          />
          <p className="mt-1 text-xs text-gray-500">Supports HTML and markdown formatting</p>
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

