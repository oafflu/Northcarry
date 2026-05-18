"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getTopBar, saveTopBar } from "@/app/actions/cms"
import { toast } from "sonner"

export default function TopBarManagementPage() {
  const [message, setMessage] = useState("50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS")
  const [enabled, setEnabled] = useState(true)
  const [bgColor, setBgColor] = useState("#000000")
  const [textColor, setTextColor] = useState("#ffffff")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTopBar()
  }, [])

  const loadTopBar = async () => {
    setLoading(true)
    try {
      const result = await getTopBar()
      if (result.error) {
        toast.error('Failed to load top bar settings')
      } else if (result.data) {
        setMessage(result.data.message || "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS")
        setEnabled(result.data.enabled !== false)
        setBgColor(result.data.bgColor || "#000000")
        setTextColor(result.data.textColor || "#ffffff")
      }
    } catch (error) {
      console.error('Error loading top bar:', error)
      toast.error('Failed to load top bar settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveTopBar({
        message,
        enabled,
        bgColor,
        textColor,
      })
      if (result.success) {
        toast.success('Top bar settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save top bar settings')
      }
    } catch (error) {
      console.error('Error saving top bar:', error)
      toast.error('Failed to save top bar settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading top bar settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Top Bar</h1>
          <p className="text-gray-600 mt-1">Manage announcement bar</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Preview */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          {enabled && (
            <div
              className="py-3 px-6 text-center text-sm font-medium rounded-lg"
              style={{ backgroundColor: bgColor, color: textColor }}
            >
              {message}
            </div>
          )}
          {!enabled && (
            <div className="py-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              Top bar is currently disabled
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
              Enable top bar
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Announcement bar colors</h3>
            <p className="text-sm text-gray-500 mb-4">
              These colors apply to the strip above the main storefront header. Navigation header
              colors are managed under{" "}
              <Link href="/admin/cms/headers" className="text-teal-600 hover:underline">
                Headers
              </Link>
              .
            </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Background color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Text color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-10 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
          </div>
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
