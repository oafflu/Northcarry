'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, Camera, Upload } from 'lucide-react'
import Image from 'next/image'
import { uploadMediaFile } from '@/app/actions/media'
import { toast } from 'sonner'

export default function AdminProfilePage() {
  const router = useRouter()
  const { user, loading, updateProfile } = useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        avatarUrl: user.avatarUrl || '',
      })
      setAvatarPreview(user.avatarUrl || null)
    }
  }, [user, loading, router])

  if (loading || !user) {
    return null
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image size must be less than 20MB')
      return
    }

    setUploadingAvatar(true)
    try {
      const result = await uploadMediaFile(file, 'user-media', {
        folder: user?.id,
        associatedType: 'user',
        associatedId: user?.id,
      })

      if (result.success && result.data) {
        setFormData({ ...formData, avatarUrl: result.data.url || '' })
        setAvatarPreview(result.data.url || null)
        await updateProfile({ avatarUrl: result.data.url || '' })
        toast.success('Profile picture updated successfully!')
      } else {
        toast.error(result.error || 'Failed to upload image')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)

    try {
      await updateProfile(formData)
      setSuccess(true)
      toast.success('Profile updated successfully!')
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">Manage your admin account information</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-800">
              Profile updated successfully!
            </div>
          )}

          {/* Profile Picture Section */}
          <div className="mb-8 border-b border-gray-200 pb-8">
            <Label className="mb-4 block text-base font-semibold">Profile Picture</Label>
            <div className="flex items-center gap-6">
              <div className="relative">
                {avatarPreview ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-gray-200">
                    <Image
                      src={avatarPreview}
                      alt="Profile picture"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-teal-500 text-2xl font-semibold text-white">
                    {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  <Button type="button" variant="outline" disabled={uploadingAvatar} asChild>
                    <span>
                      <Camera className="mr-2 h-4 w-4" />
                      {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                    </span>
                  </Button>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  JPG, PNG, GIF or WEBP. Max size 20MB.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="flex gap-4 border-t border-gray-200 pt-6">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

