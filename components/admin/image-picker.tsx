'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Image as ImageIcon, X, FolderOpen } from 'lucide-react'
import Image from 'next/image'
import { MediaPicker } from './media-picker'
import { createMediaFileRecord, type MediaFile } from '@/app/actions/media'
import { createClient } from '@/lib/supabase/client'
import { validateFileType, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from '@/lib/media-utils'
import { toast } from 'sonner'

interface ImagePickerProps {
  value: string
  onChange: (url: string) => void
  label?: string
  bucket?: 'cms-media' | 'product-media' | 'user-media'
  recommendedSize?: string
  previewWidth?: number
  previewHeight?: number
}

export function ImagePicker({
  value,
  onChange,
  label = 'Image',
  bucket = 'cms-media',
  recommendedSize,
  previewWidth = 200,
  previewHeight = 200,
}: ImagePickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate image type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file type and size using bucket-specific limits
    const validation = validateFileType(file, bucket)
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      
      // Check authentication
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to upload images')
        return
      }

      // Generate file path
      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${timestamp}-${sanitizedFileName}`

      // Upload directly to Supabase Storage from client (bypasses Vercel function limits)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        toast.error(uploadError.message || 'Failed to upload image to storage')
        return
      }

      if (!uploadData) {
        toast.error('Upload succeeded but no data returned')
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      // Get image dimensions
      let width: number | undefined
      let height: number | undefined
      
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        try {
          const img = document.createElement('img')
          const imageLoadPromise = new Promise<void>((resolve, reject) => {
            img.onload = () => {
              width = img.naturalWidth
              height = img.naturalHeight
              resolve()
            }
            img.onerror = reject
            img.src = URL.createObjectURL(file)
          })
          await imageLoadPromise
          URL.revokeObjectURL(img.src)
        } catch (error) {
          console.warn('Failed to get image dimensions:', error)
        }
      }

      // Determine file type
      let fileType: 'image' | 'video' | 'document' = 'image'
      if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
        fileType = 'video'
      }

      // Create database record via server action
      const result = await createMediaFileRecord(
        filePath,
        bucket,
        file.name,
        fileType,
        file.type,
        file.size,
        {
          width,
          height,
          altText: file.name,
        }
      )

      if (result.success && result.data) {
        const imageUrl = result.data.url || publicUrl
        if (imageUrl) {
          onChange(imageUrl)
          toast.success('Image uploaded successfully')
        } else {
          toast.error('Failed to get image URL')
        }
      } else {
        // If database record creation fails, try to delete the uploaded file
        await supabase.storage.from(bucket).remove([filePath])
        toast.error(result.error || 'Failed to create media record')
      }
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleMediaSelect = (file: MediaFile) => {
    if (file.url) {
      onChange(file.url)
      setPickerOpen(false)
      toast.success('Image selected')
    }
  }

  const handleRemove = () => {
    onChange('')
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${label} URL or path`}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Media Library
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {recommendedSize && (
        <p className="text-xs text-gray-500">Recommended: {recommendedSize}</p>
      )}
      {value && (
        <div className="mt-4 border rounded-lg p-4 bg-gray-50">
          <div className="relative inline-block">
            <Image
              src={value}
              alt={`${label} preview`}
              width={previewWidth}
              height={previewHeight}
              className="object-contain border rounded"
              onError={() => {
                toast.error('Failed to load image preview')
              }}
            />
          </div>
        </div>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleMediaSelect}
        bucket={bucket}
        fileType="image"
      />
    </div>
  )
}

