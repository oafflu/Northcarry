'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Image as ImageIcon, X, Search, Check } from 'lucide-react'
import Image from 'next/image'
import { getMediaFiles, type MediaFile } from '@/app/actions/media'

interface MediaPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (file: MediaFile) => void
  bucket?: 'cms-media' | 'product-media' | 'user-media'
  fileType?: 'image' | 'video' | 'document'
  multiple?: boolean
  selectedFiles?: MediaFile[]
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
  bucket = 'cms-media',
  fileType,
  multiple = false,
  selectedFiles = [],
}: MediaPickerProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeBucket, setActiveBucket] = useState(bucket)

  useEffect(() => {
    if (open) {
      loadMediaFiles()
    }
  }, [open, activeBucket, searchQuery])

  const loadMediaFiles = async () => {
    setLoading(true)
    const result = await getMediaFiles(activeBucket, {
      fileType,
      search: searchQuery || undefined,
    })
    if (result.data) {
      setMediaFiles(result.data as MediaFile[])
    }
    setLoading(false)
  }

  const isSelected = (file: MediaFile) => {
    return selectedFiles.some(f => f.id === file.id)
  }

  const handleSelect = (file: MediaFile) => {
    if (multiple) {
      // Toggle selection
      if (isSelected(file)) {
        // Already selected, do nothing or remove
      } else {
        onSelect(file)
      }
    } else {
      onSelect(file)
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Media</DialogTitle>
          <DialogDescription>
            Choose an image from your media library
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search media files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {!bucket && (
              <Select value={activeBucket} onValueChange={(value: any) => setActiveBucket(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cms-media">CMS Media</SelectItem>
                  <SelectItem value="product-media">Product Media</SelectItem>
                  <SelectItem value="user-media">User Media</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Media Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading media files...</div>
          ) : mediaFiles.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No media files found</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4 max-h-[50vh] overflow-y-auto">
              {mediaFiles.map((file) => {
                const selected = isSelected(file)
                return (
                  <div
                    key={file.id}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selected
                        ? 'border-blue-600 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    onClick={() => handleSelect(file)}
                  >
                    {file.file_type === 'image' && file.url ? (
                      <Image
                        src={file.url}
                        alt={file.alt_text || file.file_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {selected && (
                      <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                        <div className="bg-blue-600 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                      {file.file_name}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {multiple && (
            <Button onClick={onClose}>
              Select {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

