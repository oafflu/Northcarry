"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { MenuLinkAutocomplete } from "@/components/admin/menu-link-autocomplete"
import {
  mergeFooterCMSContent,
  type FooterCMSContent,
} from "@/lib/footer-cms-defaults"

export default function FooterManagementPage() {
  const [content, setContent] = useState<FooterCMSContent>(() =>
    mergeFooterCMSContent(null)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFooter()
  }, [])

  const loadFooter = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('footer')
      setContent(mergeFooterCMSContent(result.data))
    } catch (error) {
      console.error('Error loading footer:', error)
      toast.error('Failed to load footer settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('footer', content)
      if (result.success) {
        toast.success('Footer settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save footer settings')
      }
    } catch (error) {
      console.error('Error saving footer:', error)
      toast.error('Failed to save footer settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading footer settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Footer</h1>
          <p className="text-gray-600 mt-1">Manage footer content and links</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Copyright Text</label>
          <input
            type="text"
            value={content.copyright}
            onChange={(e) => setContent({ ...content, copyright: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Get In Touch</h2>
          <p className="text-sm text-gray-500">
            Left column on the storefront footer (contact block above Customer Service).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Section heading</label>
              <input
                type="text"
                value={content.getInTouch.heading}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, heading: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Company / legal name</label>
              <input
                type="text"
                value={content.getInTouch.companyName}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, companyName: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address line 1</label>
              <input
                type="text"
                value={content.getInTouch.addressLine1}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, addressLine1: e.target.value },
                  })
                }
                placeholder="Street, suite, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address line 2</label>
              <input
                type="text"
                value={content.getInTouch.addressLine2}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, addressLine2: e.target.value },
                  })
                }
                placeholder="City, state, postal code, country"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={content.getInTouch.email}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, email: e.target.value },
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Chat support line</label>
              <input
                type="text"
                value={content.getInTouch.chatSupportText}
                onChange={(e) =>
                  setContent({
                    ...content,
                    getInTouch: { ...content.getInTouch, chatSupportText: e.target.value },
                  })
                }
                placeholder="e.g. Use our chat for instant support"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Footer Links</label>
          <div className="space-y-2">
            {content.links.map((link, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => {
                    const newLinks = [...content.links]
                    newLinks[index].label = e.target.value
                    setContent({ ...content, links: newLinks })
                  }}
                  placeholder="Label"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <div className="flex-1">
                  <MenuLinkAutocomplete
                    value={link.url}
                    onChange={(url) => {
                      const newLinks = [...content.links]
                      newLinks[index].url = url
                      setContent({ ...content, links: newLinks })
                    }}
                  />
                </div>
              </div>
            ))}
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

