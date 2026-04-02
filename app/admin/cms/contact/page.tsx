"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"

export default function ContactManagementPage() {
  const [content, setContent] = useState({
    title: "Contact Us",
    subtitle: "Get in touch with us",
    email: "hello@brevibrushes.com",
    address: "10685-B Hazelhurst Dr. #34479\nHouston, TX 77043, USA",
    formEnabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadContact()
  }, [])

  const loadContact = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('contact')
      if (result.data) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('Error loading contact page:', error)
      toast.error('Failed to load contact page')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('contact', content)
      if (result.success) {
        toast.success('Contact page saved successfully')
      } else {
        toast.error(result.error || 'Failed to save contact page')
      }
    } catch (error) {
      console.error('Error saving contact page:', error)
      toast.error('Failed to save contact page')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading contact page...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Contact Page</h1>
          <p className="text-gray-600 mt-1">Manage contact page content and form</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={content.email}
            onChange={(e) => setContent({ ...content, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-xs text-gray-500 mt-1">Customers can also use the live chat feature for instant support.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
          <textarea
            value={content.address}
            onChange={(e) => setContent({ ...content, address: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="formEnabled"
            checked={content.formEnabled}
            onChange={(e) => setContent({ ...content, formEnabled: e.target.checked })}
            className="w-4 h-4 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
          />
          <label htmlFor="formEnabled" className="text-sm font-medium text-gray-700">
            Enable contact form
          </label>
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

