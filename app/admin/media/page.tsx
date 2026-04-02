'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Upload, Search, Filter, X, Image as ImageIcon, Video, File, Trash2, Edit, Download, Copy, Check } from 'lucide-react'
import Image from 'next/image'
import { getMediaFiles, deleteMediaFile, updateMediaFile, createMediaFileRecord, listStorageFiles, deleteStorageFile, type MediaFile } from '@/app/actions/media'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { validateFileType, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES } from '@/lib/media-utils'

export default function MediaLibraryPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'cms-media' | 'product-media' | 'user-media'>('all')
  const [mediaFiles, setMediaFiles] = useState<(MediaFile & { bucket_id?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'image' | 'video' | 'document'>('all')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<(MediaFile & { bucket_id?: string }) | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editAltText, setEditAltText] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [viewMode, setViewMode] = useState<'database' | 'storage' | 'all'>('storage')
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null)

  const loadMediaFiles = useCallback(async () => {
    setLoading(true)
    try {
      let files: (MediaFile & { bucket_id?: string })[] = []

      if (viewMode === 'database' || viewMode === 'all') {
    const bucket = activeTab === 'all' ? undefined : activeTab
    const result = await getMediaFiles(bucket, {
      fileType: fileTypeFilter === 'all' ? undefined : fileTypeFilter,
      search: searchQuery || undefined,
    })
    if (result.data) {
          files = [...files, ...(result.data as MediaFile[])]
        }
      }

      if (viewMode === 'storage' || viewMode === 'all') {
        const bucket = activeTab === 'all' ? undefined : activeTab
        const result = await listStorageFiles(bucket as any)
        if (result.data) {
          // Merge with existing files, avoiding duplicates
          const existingPaths = new Set(files.map(f => `${f.bucket_id || 'unknown'}/${f.file_path}`))
          const newFiles = result.data.filter(f => {
            const path = `${f.bucket_id}/${f.file_path}`
            return !existingPaths.has(path)
          })
          files = [...files, ...newFiles]
        }
      }

      // Apply filters
      if (fileTypeFilter !== 'all') {
        files = files.filter(f => f.file_type === fileTypeFilter)
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        files = files.filter(f => 
          f.file_name.toLowerCase().includes(query) ||
          f.alt_text?.toLowerCase().includes(query) ||
          f.description?.toLowerCase().includes(query) ||
          f.bucket_id?.toLowerCase().includes(query)
        )
      }

      // Sort by created_at descending
      files.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })

      setMediaFiles(files)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load media files')
    } finally {
      setLoading(false)
    }
  }, [activeTab, fileTypeFilter, searchQuery, viewMode])

  useEffect(() => {
    loadMediaFiles()
  }, [loadMediaFiles])

  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    setUploading(true)
    const bucket = activeTab === 'all' ? 'cms-media' : activeTab
    const total = files.length

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to upload files')
        return
      }

      const results: { success: boolean; error?: string; fileName: string }[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress({ current: i + 1, total, fileName: file.name })

        try {
          const validation = validateFileType(file, bucket as 'cms-media' | 'product-media' | 'user-media')
          if (!validation.valid) {
            results.push({ success: false, error: validation.error, fileName: file.name })
            continue
          }

          const timestamp = Date.now()
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const filePath = `${timestamp}-${sanitizedFileName}`

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
              contentType: file.type,
              upsert: false,
            })

          if (uploadError) {
            results.push({ success: false, error: uploadError.message || 'Failed to upload file', fileName: file.name })
            continue
          }

          let width: number | undefined
          let height: number | undefined
          if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
            try {
              const img = new Image()
              const objectUrl = URL.createObjectURL(file)
              await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                  width = img.width
                  height = img.height
                  URL.revokeObjectURL(objectUrl)
                  resolve()
                }
                img.onerror = reject
                img.src = objectUrl
              })
            } catch (err) {
              console.warn('Could not get image dimensions:', err)
            }
          }

          let fileType: 'image' | 'video' | 'document' = 'document'
          if (ALLOWED_IMAGE_TYPES.includes(file.type)) fileType = 'image'
          else if (ALLOWED_VIDEO_TYPES.includes(file.type)) fileType = 'video'

          const result = await createMediaFileRecord(
            filePath,
            bucket as 'cms-media' | 'product-media' | 'user-media',
            file.name,
            fileType,
            file.type,
            file.size,
            { width, height, altText: file.name }
          )

          if (result.success) {
            results.push({ success: true, fileName: file.name })
          } else {
            await supabase.storage.from(bucket).remove([filePath])
            results.push({ success: false, error: result.error || 'Failed to create media record', fileName: file.name })
          }
        } catch (error: any) {
          results.push({ success: false, error: error.message || 'Failed to upload file', fileName: file.name })
        }
      }

      setUploadProgress(null)
      const successCount = results.filter(r => r.success).length
      const errorCount = results.filter(r => !r.success).length

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file(s)`)
        loadMediaFiles()
      }
      if (errorCount > 0) {
        const errorMessages = results
          .filter(r => !r.success)
          .map(r => `${r.fileName}: ${r.error}`)
          .join('; ')
        toast.error(`Failed to upload ${errorCount} file(s): ${errorMessages}`)
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(null)
      setUploadDialogOpen(false)
    }
  }, [activeTab, loadMediaFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(Array.from(files))
    }
  }, [handleFiles])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }, [handleFiles])

  const handleDelete = async (file: MediaFile & { bucket_id?: string }) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return
    }

    // If file has bucket_id and file_path, delete directly from storage
    if (file.bucket_id && file.file_path) {
      const result = await deleteStorageFile(file.bucket_id as any, file.file_path)
      if (result.success) {
        toast.success('File deleted successfully')
        loadMediaFiles()
      } else {
        toast.error(result.error || 'Failed to delete file')
      }
    } else if (file.id) {
      // Try database deletion
      const result = await deleteMediaFile(file.id)
    if (result.success) {
      toast.success('File deleted successfully')
      loadMediaFiles()
    } else {
      toast.error(result.error || 'Failed to delete file')
      }
    } else {
      toast.error('Unable to delete file - missing information')
    }
  }

  const handleEdit = (file: MediaFile) => {
    setSelectedFile(file)
    setEditAltText(file.alt_text || '')
    setEditDescription(file.description || '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedFile) return

    const result = await updateMediaFile(selectedFile.id, {
      alt_text: editAltText,
      description: editDescription,
    })

    if (result.success) {
      toast.success('File updated successfully')
      setEditDialogOpen(false)
      loadMediaFiles()
    } else {
      toast.error(result.error || 'Failed to update file')
    }
  }

  const getFileIcon = (file: MediaFile) => {
    if (file.file_type === 'image') return <ImageIcon className="w-5 h-5" />
    if (file.file_type === 'video') return <Video className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleCopyUrl = async (file: MediaFile & { bucket_id?: string }) => {
    if (!file.url) {
      toast.error('No URL available for this file')
      return
    }

    try {
      await navigator.clipboard.writeText(file.url)
      setCopiedUrlId(file.id)
      toast.success('Image URL copied to clipboard!')
      // Reset the checkmark after 2 seconds
      setTimeout(() => {
        setCopiedUrlId(null)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('Failed to copy URL to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Library</h1>
          <p className="text-gray-600 mt-1">Manage all media files from Supabase storage buckets</p>
          <p className="text-sm text-gray-500 mt-1">
            All buckets (cms-media, product-media, user-media) are public and URLs can be used in email templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="storage">Storage Files</SelectItem>
              <SelectItem value="database">Database Files</SelectItem>
              <SelectItem value="all">All Files</SelectItem>
            </SelectContent>
          </Select>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Media
        </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search media files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={fileTypeFilter} onValueChange={(value: any) => setFileTypeFilter(value)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList>
          <TabsTrigger value="all">All Media</TabsTrigger>
          <TabsTrigger value="cms-media">CMS Media</TabsTrigger>
          <TabsTrigger value="product-media">Product Media</TabsTrigger>
          <TabsTrigger value="user-media">User Media</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading media files...</div>
          ) : mediaFiles.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-2">No media files found</p>
              <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First File
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {mediaFiles.map((file) => (
                <Card key={file.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="relative aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                      {file.file_type === 'image' && file.url ? (
                        <Image
                          src={file.url}
                          alt={file.alt_text || file.file_name}
                          fill
                          className="object-cover"
                        />
                      ) : file.file_type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <Video className="w-12 h-12 text-white" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <File className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopyUrl(file)}
                            title="Copy image URL"
                          >
                            {copiedUrlId === file.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleEdit(file)}
                            title="Edit metadata"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(file.url, '_blank')}
                            title="Open in new tab"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(file)}
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge variant="secondary" className="bg-black/70 text-white text-xs">
                          {getFileIcon(file)}
                        </Badge>
                        {file.bucket_id && (
                          <Badge variant="outline" className="bg-blue-500/80 text-white text-xs border-0">
                            {file.bucket_id.replace('-media', '')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium truncate" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)}
                      </p>
                        {file.bucket_id && (
                          <Badge variant="outline" className="text-xs">
                            {file.bucket_id}
                          </Badge>
                        )}
                      </div>
                      {file.width && file.height && (
                        <p className="text-xs text-gray-500">
                          {file.width} × {file.height}
                        </p>
                      )}
                      {file.url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full mt-2 text-xs"
                          onClick={() => handleCopyUrl(file)}
                        >
                          {copiedUrlId === file.id ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-green-500" />
                              URL Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copy URL
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Media</DialogTitle>
          </DialogHeader>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or click to select
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Images: JPG, PNG, GIF, WEBP, SVG, BMP, TIFF, ICO
              <br />
              Videos: MP4, MOV, WEBM
            </p>
            <Input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Label htmlFor="file-upload">
              <Button variant="outline" asChild>
                <span>Select Files</span>
              </Button>
            </Label>
          </div>
          {uploading && (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-gray-600">
                {uploadProgress
                  ? `Uploading file ${uploadProgress.current} of ${uploadProgress.total}...`
                  : 'Preparing upload...'}
              </p>
              {uploadProgress?.fileName && (
                <p className="text-xs text-gray-500 truncate max-w-full px-4" title={uploadProgress.fileName}>
                  {uploadProgress.fileName}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedFile && selectedFile.url && selectedFile.file_type === 'image' && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={selectedFile.url}
                  alt={selectedFile.alt_text || selectedFile.file_name}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div>
              <Label htmlFor="alt-text">Alt Text</Label>
              <Input
                id="alt-text"
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder="Describe this image for accessibility"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

