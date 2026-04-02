"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { Upload, X, Camera } from "lucide-react"
import Image from "next/image"
import { uploadMediaFile } from "@/app/actions/media"
import { toast } from "sonner"
import { NotificationSettings } from "@/components/notification-settings"

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatarUrl: "",
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || "",
      })
      setAvatarPreview(user.avatarUrl || null)
    }
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Image size must be less than 20MB')
      return
    }

    setUploadingAvatar(true)
    try {
      // Upload to user-media bucket in user's folder
      const result = await uploadMediaFile(file, 'user-media', {
        folder: user?.id,
        associatedType: 'user',
        associatedId: user?.id,
      })

      if (result.success && result.data) {
        setFormData({ ...formData, avatarUrl: result.data.url || '' })
        setAvatarPreview(result.data.url || null)
        // Auto-save avatar
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
    } catch (error) {
      console.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="mt-1 text-gray-600">Manage your account information</p>
      </div>

          <div className="rounded-lg bg-white p-8 shadow-sm">
            {success && (
              <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-800">
                Profile updated successfully!
              </div>
            )}

            {/* Profile Picture Section */}
            <div className="mb-8 border-b border-gray-200 pb-8">
              <h3 className="mb-4 text-lg font-semibold">Profile Picture</h3>
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
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200 text-2xl font-semibold text-gray-600">
                      {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
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
                    <span className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                      <Camera className="h-4 w-4" />
                      {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                    </span>
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
                  <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex gap-4 border-t border-gray-200 pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-black px-6 py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <Link
                  href="/account"
                  className="rounded-md border border-gray-300 px-6 py-3 font-semibold transition-colors hover:bg-gray-50"
                >
                  Cancel
                </Link>
              </div>
            </form>

            <div className="mt-8 border-t border-gray-200 pt-8">
              <h3 className="mb-4 font-bold">Password</h3>
              <Link
                href="/account/change-password"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                Change Password
              </Link>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="mt-8">
            <NotificationSettings />
          </div>
    </div>
  )
}
