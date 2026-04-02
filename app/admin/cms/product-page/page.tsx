"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Plus, X } from "lucide-react"
import { getProductPageContent, saveProductPageContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { ImagePicker } from "@/components/admin/image-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

export default function ProductPageManagementPage() {
  const [saleBannerText, setSaleBannerText] = useState("50% OFF EASTER SALE TODAY!")
  const [saleBannerEnabled, setSaleBannerEnabled] = useState(true)
  const [saleBannerBgColor, setSaleBannerBgColor] = useState("#3B82F6")
  const [saleBannerTextColor, setSaleBannerTextColor] = useState("#FFFFFF")
  const [showRating, setShowRating] = useState(true)
  const [defaultReviewCount, setDefaultReviewCount] = useState(233)
  const [defaultRating, setDefaultRating] = useState(5)
  const [paymentIcons, setPaymentIcons] = useState<Array<{ name: string; url: string; alt: string }>>([
    { name: 'Visa', url: '/placeholder.svg?height=24&width=40', alt: 'Visa' },
    { name: 'Mastercard', url: '/placeholder.svg?height=24&width=40', alt: 'Mastercard' },
    { name: 'Amex', url: '/placeholder.svg?height=24&width=40', alt: 'Amex' },
    { name: 'PayPal', url: '/placeholder.svg?height=24&width=40', alt: 'PayPal' },
    { name: 'Apple Pay', url: '/placeholder.svg?height=24&width=40', alt: 'Apple Pay' },
  ])
  const [useVariantImages, setUseVariantImages] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProductPageContent()
  }, [])

  const loadProductPageContent = async () => {
    setLoading(true)
    try {
      const result = await getProductPageContent()
      if (result.error) {
        toast.error('Failed to load product page settings')
      } else if (result.data) {
        setSaleBannerText(result.data.saleBannerText || "50% OFF EASTER SALE TODAY!")
        setSaleBannerEnabled(result.data.saleBannerEnabled !== false)
        setSaleBannerBgColor(result.data.saleBannerBgColor || "#3B82F6")
        setSaleBannerTextColor(result.data.saleBannerTextColor || "#FFFFFF")
        setShowRating(result.data.showRating !== false)
        setDefaultReviewCount(result.data.defaultReviewCount || 233)
        setDefaultRating(result.data.defaultRating || 5)
        setPaymentIcons(result.data.paymentIcons || [
          { name: 'Visa', url: '/placeholder.svg?height=24&width=40', alt: 'Visa' },
          { name: 'Mastercard', url: '/placeholder.svg?height=24&width=40', alt: 'Mastercard' },
          { name: 'Amex', url: '/placeholder.svg?height=24&width=40', alt: 'Amex' },
          { name: 'PayPal', url: '/placeholder.svg?height=24&width=40', alt: 'PayPal' },
          { name: 'Apple Pay', url: '/placeholder.svg?height=24&width=40', alt: 'Apple Pay' },
        ])
        setUseVariantImages(result.data.useVariantImages !== false)
      }
    } catch (error) {
      console.error('Error loading product page content:', error)
      toast.error('Failed to load product page settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveProductPageContent({
        saleBannerText,
        saleBannerEnabled,
        saleBannerBgColor,
        saleBannerTextColor,
        showRating,
        defaultReviewCount,
        defaultRating,
        paymentIcons,
        useVariantImages,
      })
      if (result.success) {
        toast.success('Product page settings saved successfully')
      } else {
        toast.error(result.error || 'Failed to save product page settings')
      }
    } catch (error) {
      console.error('Error saving product page content:', error)
      toast.error('Failed to save product page settings')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPaymentIcon = () => {
    setPaymentIcons([...paymentIcons, { name: '', url: '', alt: '' }])
  }

  const handleRemovePaymentIcon = (index: number) => {
    setPaymentIcons(paymentIcons.filter((_, i) => i !== index))
  }

  const handleUpdatePaymentIcon = (index: number, field: 'name' | 'url' | 'alt', value: string) => {
    const newIcons = [...paymentIcons]
    newIcons[index] = { ...newIcons[index], [field]: value }
    setPaymentIcons(newIcons)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading product page settings...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Product Page Settings</h1>
          <p className="text-gray-600 mt-1">Customize product page elements and display options</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Sale Banner */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Sale Banner</h2>
          <div className="flex items-center space-x-2">
            <Switch
              id="saleBannerEnabled"
              checked={saleBannerEnabled}
              onCheckedChange={setSaleBannerEnabled}
            />
            <Label htmlFor="saleBannerEnabled">Enable sale banner</Label>
          </div>
          {saleBannerEnabled && (
            <>
              <div>
                <Label htmlFor="saleBannerText" className="text-sm font-medium text-gray-700 mb-2 block">
                  Banner Text
                </Label>
                <Input
                  id="saleBannerText"
                  value={saleBannerText}
                  onChange={(e) => setSaleBannerText(e.target.value)}
                  placeholder="50% OFF EASTER SALE TODAY!"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="saleBannerBgColor" className="text-sm font-medium text-gray-700 mb-2 block">
                    Background Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="saleBannerBgColor"
                      type="color"
                      value={saleBannerBgColor}
                      onChange={(e) => setSaleBannerBgColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={saleBannerBgColor}
                      onChange={(e) => setSaleBannerBgColor(e.target.value)}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="saleBannerTextColor" className="text-sm font-medium text-gray-700 mb-2 block">
                    Text Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="saleBannerTextColor"
                      type="color"
                      value={saleBannerTextColor}
                      onChange={(e) => setSaleBannerTextColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={saleBannerTextColor}
                      onChange={(e) => setSaleBannerTextColor(e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <div 
                  className="px-4 py-2 rounded-lg inline-block"
                  style={{ 
                    backgroundColor: saleBannerBgColor,
                    color: saleBannerTextColor
                  }}
                >
                  <span className="font-bold">{saleBannerText || '50% OFF EASTER SALE TODAY!'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rating Display */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Rating Display</h2>
          <div className="flex items-center space-x-2">
            <Switch
              id="showRating"
              checked={showRating}
              onCheckedChange={setShowRating}
            />
            <Label htmlFor="showRating">Show rating stars</Label>
          </div>
          {showRating && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defaultReviewCount" className="text-sm font-medium text-gray-700 mb-2 block">
                  Default Review Count
                </Label>
                <Input
                  id="defaultReviewCount"
                  type="number"
                  value={defaultReviewCount}
                  onChange={(e) => setDefaultReviewCount(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>
              <div>
                <Label htmlFor="defaultRating" className="text-sm font-medium text-gray-700 mb-2 block">
                  Default Rating (1-5)
                </Label>
                <Input
                  id="defaultRating"
                  type="number"
                  value={defaultRating}
                  onChange={(e) => setDefaultRating(Math.min(5, Math.max(1, parseInt(e.target.value) || 5)))}
                  min={1}
                  max={5}
                />
              </div>
            </div>
          )}
        </div>

        {/* Variant Display */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Variant Display</h2>
          <div className="flex items-center space-x-2">
            <Switch
              id="useVariantImages"
              checked={useVariantImages}
              onCheckedChange={setUseVariantImages}
            />
            <Label htmlFor="useVariantImages">Use variant images instead of color circles</Label>
          </div>
          <p className="text-sm text-gray-500">
            When enabled, variant selection will show product images. When disabled, it will show color circles.
          </p>
        </div>

        {/* Payment Icons */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Payment Icons</h2>
            <Button variant="outline" size="sm" onClick={handleAddPaymentIcon}>
              <Plus className="w-4 h-4 mr-2" />
              Add Icon
            </Button>
          </div>
          <div className="space-y-3">
            {paymentIcons.map((icon, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Name</Label>
                    <Input
                      value={icon.name}
                      onChange={(e) => handleUpdatePaymentIcon(index, 'name', e.target.value)}
                      placeholder="Visa"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Alt Text</Label>
                    <Input
                      value={icon.alt}
                      onChange={(e) => handleUpdatePaymentIcon(index, 'alt', e.target.value)}
                      placeholder="Visa"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-600 mb-1 block">Image URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={icon.url}
                        onChange={(e) => handleUpdatePaymentIcon(index, 'url', e.target.value)}
                        placeholder="/icon.png"
                        className="text-sm flex-1"
                      />
                      <div className="w-10">
                        <ImagePicker
                          value={icon.url}
                          onChange={(url) => handleUpdatePaymentIcon(index, 'url', url)}
                          label=""
                          bucket="cms-media"
                          recommendedSize="40x24px"
                          previewWidth={40}
                          previewHeight={24}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemovePaymentIcon(index)}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
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

