"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Save } from "lucide-react"
import { getHeroBanner, saveHeroBanner } from "@/app/actions/cms"
import { toast } from "sonner"
import { ImagePicker } from "@/components/admin/image-picker"
import { MenuLinkAutocomplete } from "@/components/admin/menu-link-autocomplete"

export default function HeroManagementPage() {
  const [heroImage, setHeroImage] = useState("/images/brevi_banner_web.png")
  const [mobileHeroImage, setMobileHeroImage] = useState("")
  const [heading, setHeading] = useState("50% OFF")
  const [subheading, setSubheading] = useState("FOR A LIMITED TIME")
  const [buttonText, setButtonText] = useState("Shop Now")
  const [buttonLink, setButtonLink] = useState("/product")
  const [showRating, setShowRating] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadHeroBanner()
  }, [])

  const loadHeroBanner = async () => {
    setLoading(true)
    try {
      const result = await getHeroBanner()
      if (result.error) {
        toast.error('Failed to load hero banner settings')
      } else if (result.data) {
        setHeroImage(result.data.heroImage || "/images/brevi_banner_web.png")
        setMobileHeroImage(result.data.mobileHeroImage || "")
        // Preserve empty strings - only use fallback if value is null/undefined
        setHeading(result.data.heading !== undefined && result.data.heading !== null ? result.data.heading : "50% OFF")
        setSubheading(result.data.subheading !== undefined && result.data.subheading !== null ? result.data.subheading : "FOR A LIMITED TIME")
        setButtonText(result.data.buttonText || "Shop Now")
        setButtonLink(result.data.buttonLink || "/product")
        setShowRating(result.data.showRating !== false)
      }
    } catch (error) {
      console.error('Error loading hero banner:', error)
      toast.error('Failed to load hero banner settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveHeroBanner({
        heroImage,
        mobileHeroImage,
        heading,
        subheading,
        buttonText,
        buttonLink,
        showRating,
      })
      if (result.success) {
        toast.success('Hero banner settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save hero banner settings')
      }
    } catch (error) {
      console.error('Error saving hero banner:', error)
      toast.error('Failed to save hero banner settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading hero banner settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Hero Banner</h1>
          <p className="text-gray-600 mt-1">Customize homepage hero section</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Preview */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          <div className="relative h-[400px] rounded-lg overflow-hidden">
            <Image src={heroImage || "/placeholder.svg"} alt="Hero banner" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
              <div className="max-w-xl px-12">
                <h2 className="text-6xl font-bold text-white mb-2">{heading}</h2>
                <p className="text-2xl text-white font-medium mb-6">{subheading}</p>
                {showRating && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xl">
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-white">(323)</span>
                  </div>
                )}
                <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                  {buttonText}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <div>
            <ImagePicker
              value={heroImage}
              onChange={setHeroImage}
              label="Hero Image (Desktop)"
              bucket="cms-media"
              recommendedSize="1920x800px"
              previewWidth={400}
              previewHeight={200}
            />
          </div>

          <div>
            <ImagePicker
              value={mobileHeroImage}
              onChange={setMobileHeroImage}
              label="Hero Image (Mobile)"
              bucket="cms-media"
              recommendedSize="768x600px"
              previewWidth={300}
              previewHeight={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Heading</label>
              <input
                type="text"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subheading</label>
              <input
                type="text"
                value={subheading}
                onChange={(e) => setSubheading(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button Text</label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button Link</label>
              <MenuLinkAutocomplete
                value={buttonLink}
                onChange={setButtonLink}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showRating"
              checked={showRating}
              onChange={(e) => setShowRating(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded focus:ring-2 focus:ring-teal-500"
            />
            <label htmlFor="showRating" className="text-sm font-medium text-gray-700">
              Show star rating
            </label>
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
