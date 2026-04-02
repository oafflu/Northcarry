"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { ImagePicker } from "@/components/admin/image-picker"

export default function BrandingManagementPage() {
  const [content, setContent] = useState({
    logo: "/brevi-logo.png",
    favicon: "/favicon.ico",
    siteName: "BREVI",
    // SEO & Metadata
    siteTitle: "BREVI - Premium Toothbrushes",
    metaDescription: "Premium quality toothbrushes for a healthier smile",
    metaKeywords: "toothbrush, oral care, dental hygiene, premium toothbrushes",
    // Open Graph
    ogImage: "/images/brevi_banner_web.png",
    ogTitle: "BREVI - Premium Toothbrushes",
    ogDescription: "Premium quality toothbrushes for a healthier smile",
    ogType: "website",
    // Twitter Card
    twitterCard: "summary_large_image",
    twitterSite: "@brevibrushes",
    twitterCreator: "@brevibrushes",
    // Additional
    canonicalUrl: "https://brevibrushes.com",
    robots: "index, follow",
    author: "BREVI",
    language: "en",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBranding()
  }, [])

  const loadBranding = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('branding')
      if (result.data) {
        setContent(result.data)
      }
    } catch (error) {
      console.error('Error loading branding:', error)
      toast.error('Failed to load branding settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('branding', content)
      if (result.success) {
        toast.success('Branding settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save branding settings')
      }
    } catch (error) {
      console.error('Error saving branding:', error)
      toast.error('Failed to save branding settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading branding settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Logo & Branding</h1>
          <p className="text-gray-600 mt-1">Manage site branding, favicon, and SEO metadata</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
          <input
            type="text"
            value={content.siteName}
            onChange={(e) => setContent({ ...content, siteName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <ImagePicker
          value={content.logo}
          onChange={(url) => setContent({ ...content, logo: url })}
          label="Logo"
          bucket="cms-media"
          previewWidth={200}
          previewHeight={60}
        />

        <ImagePicker
          value={content.favicon}
          onChange={(url) => setContent({ ...content, favicon: url })}
          label="Favicon"
          bucket="cms-media"
          recommendedSize="32x32px"
          previewWidth={32}
          previewHeight={32}
        />

        {/* SEO & Metadata Section */}
        <div className="pt-6 border-t">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">SEO & Website Metadata</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Site Title <span className="text-gray-500">(Browser tab title)</span>
              </label>
              <input
                type="text"
                value={content.siteTitle}
                onChange={(e) => setContent({ ...content, siteTitle: e.target.value })}
                placeholder="BREVI - Premium Toothbrushes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <p className="mt-1 text-xs text-gray-500">Recommended: 50-60 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Description
              </label>
              <textarea
                value={content.metaDescription}
                onChange={(e) => setContent({ ...content, metaDescription: e.target.value })}
                rows={3}
                placeholder="Premium quality toothbrushes for a healthier smile"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <p className="mt-1 text-xs text-gray-500">Recommended: 150-160 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta Keywords <span className="text-gray-500">(Comma separated)</span>
              </label>
              <input
                type="text"
                value={content.metaKeywords}
                onChange={(e) => setContent({ ...content, metaKeywords: e.target.value })}
                placeholder="toothbrush, oral care, dental hygiene"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canonical URL
              </label>
              <input
                type="url"
                value={content.canonicalUrl}
                onChange={(e) => setContent({ ...content, canonicalUrl: e.target.value })}
                placeholder="https://brevibrushes.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Robots Meta
              </label>
              <select
                value={content.robots}
                onChange={(e) => setContent({ ...content, robots: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="index, follow">Index, Follow</option>
                <option value="index, nofollow">Index, No Follow</option>
                <option value="noindex, follow">No Index, Follow</option>
                <option value="noindex, nofollow">No Index, No Follow</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                <input
                  type="text"
                  value={content.author}
                  onChange={(e) => setContent({ ...content, author: e.target.value })}
                  placeholder="BREVI"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                <input
                  type="text"
                  value={content.language}
                  onChange={(e) => setContent({ ...content, language: e.target.value })}
                  placeholder="en"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Open Graph Section */}
        <div className="pt-6 border-t">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Graph (Social Media)</h2>
          
          <div className="space-y-4">
            <ImagePicker
              value={content.ogImage}
              onChange={(url) => setContent({ ...content, ogImage: url })}
              label="OG Image URL"
              bucket="cms-media"
              recommendedSize="1200x630px"
              previewWidth={400}
              previewHeight={210}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OG Title</label>
              <input
                type="text"
                value={content.ogTitle}
                onChange={(e) => setContent({ ...content, ogTitle: e.target.value })}
                placeholder="BREVI - Premium Toothbrushes"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OG Description</label>
              <textarea
                value={content.ogDescription}
                onChange={(e) => setContent({ ...content, ogDescription: e.target.value })}
                rows={2}
                placeholder="Premium quality toothbrushes for a healthier smile"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OG Type</label>
              <select
                value={content.ogType}
                onChange={(e) => setContent({ ...content, ogType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="website">Website</option>
                <option value="article">Article</option>
                <option value="product">Product</option>
                <option value="business.business">Business</option>
              </select>
            </div>
          </div>
        </div>

        {/* Twitter Card Section */}
        <div className="pt-6 border-t">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Twitter Card</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Twitter Card Type</label>
              <select
                value={content.twitterCard}
                onChange={(e) => setContent({ ...content, twitterCard: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="summary">Summary</option>
                <option value="summary_large_image">Summary Large Image</option>
                <option value="app">App</option>
                <option value="player">Player</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Twitter Site</label>
                <input
                  type="text"
                  value={content.twitterSite}
                  onChange={(e) => setContent({ ...content, twitterSite: e.target.value })}
                  placeholder="@brevibrushes"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Twitter Creator</label>
                <input
                  type="text"
                  value={content.twitterCreator}
                  onChange={(e) => setContent({ ...content, twitterCreator: e.target.value })}
                  placeholder="@brevibrushes"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
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

