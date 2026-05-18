"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { ImagePicker } from "@/components/admin/image-picker"
import {
  mergeHeadersCMSContent,
  type HeadersCMSContent,
} from "@/lib/header-cms-defaults"

function ColorField({
  label,
  hint,
  value,
  onChange,
  defaultHex,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  defaultHex: string
}) {
  const pickerValue = value.trim() || defaultHex
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultHex}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
        />
      </div>
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  )
}

export default function HeadersManagementPage() {
  const [content, setContent] = useState<HeadersCMSContent>(() =>
    mergeHeadersCMSContent(null)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHeaders()
  }, [])

  const loadHeaders = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent("headers")
      setContent(mergeHeadersCMSContent(result.data))
    } catch (error) {
      console.error("Error loading headers:", error)
      toast.error("Failed to load header settings")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent("headers", content)
      if (result.success) {
        toast.success("Header settings saved successfully")
      } else {
        toast.error(result.error || "Failed to save header settings")
      }
    } catch (error) {
      console.error("Error saving headers:", error)
      toast.error("Failed to save header settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading header settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Headers</h1>
          <p className="text-gray-600 mt-1">
            Storefront navigation bar and admin dashboard chrome
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Storefront header</h2>
            <p className="text-sm text-gray-500">
              Main site navigation below the announcement top bar. Logo is managed under Logo
              &amp; Branding.
            </p>
          </div>

          <div
            className="rounded-lg border p-4 flex items-center justify-between h-16"
            style={{
              backgroundColor: content.storefront.backgroundColor,
              borderColor: content.storefront.borderColor,
              color: content.storefront.textColor,
            }}
          >
            <span className="text-sm font-medium">Preview</span>
            <span className="text-sm opacity-80">Home · Shop · Cart</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Background color"
              value={content.storefront.backgroundColor}
              onChange={(backgroundColor) =>
                setContent({
                  ...content,
                  storefront: { ...content.storefront, backgroundColor },
                })
              }
              defaultHex="#ffffff"
            />
            <ColorField
              label="Text & icon color"
              value={content.storefront.textColor}
              onChange={(textColor) =>
                setContent({
                  ...content,
                  storefront: { ...content.storefront, textColor },
                })
              }
              defaultHex="#111827"
            />
            <ColorField
              label="Bottom border color"
              value={content.storefront.borderColor}
              onChange={(borderColor) =>
                setContent({
                  ...content,
                  storefront: { ...content.storefront, borderColor },
                })
              }
              defaultHex="#e5e7eb"
            />
          </div>
        </section>

        <section className="space-y-4 pt-6 border-t border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admin dashboard</h2>
            <p className="text-sm text-gray-500">
              Sidebar branding and top bar on admin pages.
            </p>
          </div>

          <ImagePicker
            value={content.admin.logo}
            onChange={(url) =>
              setContent({ ...content, admin: { ...content.admin, logo: url } })
            }
            label="Admin logo"
            bucket="cms-media"
            previewWidth={160}
            previewHeight={48}
          />
          <p className="text-sm text-gray-500 -mt-2">
            Shown in the sidebar. Leave empty to use the title below.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sidebar title (fallback)
            </label>
            <input
              type="text"
              value={content.admin.sidebarTitle}
              onChange={(e) =>
                setContent({
                  ...content,
                  admin: { ...content.admin, sidebarTitle: e.target.value },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Top header background"
              value={content.admin.headerBackgroundColor}
              onChange={(headerBackgroundColor) =>
                setContent({
                  ...content,
                  admin: { ...content.admin, headerBackgroundColor },
                })
              }
              defaultHex="#ffffff"
            />
            <ColorField
              label="Sidebar background"
              value={content.admin.sidebarBackgroundColor}
              onChange={(sidebarBackgroundColor) =>
                setContent({
                  ...content,
                  admin: { ...content.admin, sidebarBackgroundColor },
                })
              }
              defaultHex="#1a1a1a"
            />
          </div>
        </section>

        <p className="text-sm text-gray-500 pt-2 border-t border-gray-100">
          Announcement bar colors are configured on the{" "}
          <Link href="/admin/cms/topbar" className="text-teal-600 hover:underline">
            Top Bar
          </Link>{" "}
          page.
        </p>

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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
