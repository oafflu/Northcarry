'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getCMSContent, saveCMSContent } from '@/app/actions/cms'
import { toast } from 'sonner'
import { Save, Upload, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function SEOSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [settings, setSettings] = useState({
    siteTitle: '',
    metaDescription: '',
    metaKeywords: '',
    canonicalUrl: 'https://brevibrushes.com',
    favicon: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    ogType: 'website',
    siteName: 'BREVI',
    language: 'en',
    robots: 'index, follow',
    twitterCard: 'summary_large_image',
    twitterSite: '@brevibrushes',
    twitterCreator: '@brevibrushes',
    author: 'BREVI',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('branding')
      if (result.data) {
        setSettings({
          siteTitle: result.data.siteTitle || '',
          metaDescription: result.data.metaDescription || '',
          metaKeywords: result.data.metaKeywords || '',
          canonicalUrl: result.data.canonicalUrl || 'https://brevibrushes.com',
          favicon: result.data.favicon || '',
          ogTitle: result.data.ogTitle || '',
          ogDescription: result.data.ogDescription || '',
          ogImage: result.data.ogImage || '',
          ogType: result.data.ogType || 'website',
          siteName: result.data.siteName || 'BREVI',
          language: result.data.language || 'en',
          robots: result.data.robots || 'index, follow',
          twitterCard: result.data.twitterCard || 'summary_large_image',
          twitterSite: result.data.twitterSite || '@brevibrushes',
          twitterCreator: result.data.twitterCreator || '@brevibrushes',
          author: result.data.author || 'BREVI',
        })
      }
    } catch (error) {
      console.error('Error loading SEO settings:', error)
      toast.error('Failed to load SEO settings')
    } finally {
      setLoading(false)
    }
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Favicon must be less than 2MB')
      return
    }

    setUploadingFavicon(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `favicon-${Date.now()}.${fileExt}`
      const filePath = `favicons/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      setSettings({ ...settings, favicon: publicUrl })
      toast.success('Favicon uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading favicon:', error)
      toast.error(error.message || 'Failed to upload favicon')
    } finally {
      setUploadingFavicon(false)
    }
  }

  const handleOGImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setUploadingFavicon(true)
    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `og-image-${Date.now()}.${fileExt}`
      const filePath = `og-images/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      setSettings({ ...settings, ogImage: publicUrl })
      toast.success('OG image uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading OG image:', error)
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploadingFavicon(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('branding', settings)
      if (result.success) {
        toast.success('SEO settings saved successfully!')
        // Force page reload to see new favicon
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving SEO settings:', error)
      toast.error('Failed to save SEO settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading SEO settings...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">SEO & Website Settings</h1>
        <p className="text-gray-600 mt-1">Configure website icon, metadata, and SEO settings</p>
      </div>

      {/* Favicon Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Website Icon (Favicon)</CardTitle>
          <CardDescription>
            Upload a favicon that will appear in browser tabs and search engine results. Recommended: 32x32px or 64x64px PNG/ICO file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {settings.favicon && (
              <div className="relative w-16 h-16 border rounded overflow-hidden bg-gray-100">
                <Image
                  src={settings.favicon}
                  alt="Favicon preview"
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div className="flex-1">
              <Label htmlFor="favicon">Favicon URL</Label>
              <Input
                id="favicon"
                value={settings.favicon}
                onChange={(e) => setSettings({ ...settings, favicon: e.target.value })}
                placeholder="/favicon.ico or https://..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="favicon-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  disabled={uploadingFavicon}
                >
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingFavicon ? 'Uploading...' : 'Upload'}
                  </span>
                </Button>
              </Label>
              <input
                id="favicon-upload"
                type="file"
                accept="image/*"
                onChange={handleFaviconUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic SEO */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Basic SEO Settings</CardTitle>
          <CardDescription>Core metadata for search engines</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="siteTitle">Site Title</Label>
            <Input
              id="siteTitle"
              value={settings.siteTitle}
              onChange={(e) => setSettings({ ...settings, siteTitle: e.target.value })}
              placeholder="BREVI - Premium Toothbrushes"
            />
            <p className="text-xs text-gray-500">Appears in browser tabs and search results</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={settings.metaDescription}
              onChange={(e) => setSettings({ ...settings, metaDescription: e.target.value })}
              placeholder="Premium quality toothbrushes for a healthier smile"
              rows={3}
            />
            <p className="text-xs text-gray-500">Recommended: 150-160 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaKeywords">Meta Keywords (comma-separated)</Label>
            <Input
              id="metaKeywords"
              value={settings.metaKeywords}
              onChange={(e) => setSettings({ ...settings, metaKeywords: e.target.value })}
              placeholder="toothbrush, dental care, oral hygiene"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="canonicalUrl">Canonical URL</Label>
            <Input
              id="canonicalUrl"
              type="url"
              value={settings.canonicalUrl}
              onChange={(e) => setSettings({ ...settings, canonicalUrl: e.target.value })}
              placeholder="https://brevibrushes.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="robots">Robots Meta Tag</Label>
            <Input
              id="robots"
              value={settings.robots}
              onChange={(e) => setSettings({ ...settings, robots: e.target.value })}
              placeholder="index, follow"
            />
            <p className="text-xs text-gray-500">Common values: "index, follow" or "noindex, nofollow"</p>
          </div>
        </CardContent>
      </Card>

      {/* Open Graph */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Open Graph (Social Media Sharing)</CardTitle>
          <CardDescription>How your site appears when shared on social media</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ogTitle">OG Title</Label>
            <Input
              id="ogTitle"
              value={settings.ogTitle}
              onChange={(e) => setSettings({ ...settings, ogTitle: e.target.value })}
              placeholder="BREVI - Premium Toothbrushes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogDescription">OG Description</Label>
            <Textarea
              id="ogDescription"
              value={settings.ogDescription}
              onChange={(e) => setSettings({ ...settings, ogDescription: e.target.value })}
              placeholder="Premium quality toothbrushes for a healthier smile"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogImage">OG Image URL</Label>
            <div className="flex items-center gap-4">
              <Input
                id="ogImage"
                value={settings.ogImage}
                onChange={(e) => setSettings({ ...settings, ogImage: e.target.value })}
                placeholder="/images/brevi_banner_web.png or https://..."
                className="flex-1"
              />
              <div>
                <Label htmlFor="og-image-upload" className="cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={uploadingFavicon}
                  >
                    <span>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Upload
                    </span>
                  </Button>
                </Label>
                <input
                  id="og-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleOGImageUpload}
                  className="hidden"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Recommended: 1200x630px image</p>
            {settings.ogImage && (
              <div className="relative w-full max-w-md h-48 border rounded overflow-hidden bg-gray-100 mt-2">
                <Image
                  src={settings.ogImage}
                  alt="OG image preview"
                  fill
                  className="object-contain"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ogType">OG Type</Label>
            <Input
              id="ogType"
              value={settings.ogType}
              onChange={(e) => setSettings({ ...settings, ogType: e.target.value })}
              placeholder="website"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteName">Site Name</Label>
            <Input
              id="siteName"
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
              placeholder="BREVI"
            />
          </div>
        </CardContent>
      </Card>

      {/* Twitter Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Twitter Card</CardTitle>
          <CardDescription>Twitter-specific metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="twitterCard">Twitter Card Type</Label>
            <Input
              id="twitterCard"
              value={settings.twitterCard}
              onChange={(e) => setSettings({ ...settings, twitterCard: e.target.value })}
              placeholder="summary_large_image"
            />
            <p className="text-xs text-gray-500">Options: "summary" or "summary_large_image"</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitterSite">Twitter Site</Label>
            <Input
              id="twitterSite"
              value={settings.twitterSite}
              onChange={(e) => setSettings({ ...settings, twitterSite: e.target.value })}
              placeholder="@brevibrushes"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitterCreator">Twitter Creator</Label>
            <Input
              id="twitterCreator"
              value={settings.twitterCreator}
              onChange={(e) => setSettings({ ...settings, twitterCreator: e.target.value })}
              placeholder="@brevibrushes"
            />
          </div>
        </CardContent>
      </Card>

      {/* Additional Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              placeholder="en"
            />
            <p className="text-xs text-gray-500">ISO 639-1 language code (e.g., "en", "es", "fr")</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={settings.author}
              onChange={(e) => setSettings({ ...settings, author: e.target.value })}
              placeholder="BREVI"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save SEO Settings'}
        </Button>
      </div>
    </div>
  )
}

