'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { validateFileType, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_DOCUMENT_TYPES, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_DOCUMENT_SIZE } from '@/lib/media-utils'

export interface MediaFile {
  id: string
  bucket_id: string
  file_path: string
  file_name: string
  file_type: 'image' | 'video' | 'document'
  mime_type: string
  file_size: number
  width?: number
  height?: number
  duration?: number
  alt_text?: string
  description?: string
  uploaded_by?: string
  associated_type?: string
  associated_id?: string
  is_public: boolean
  created_at: string
  updated_at: string
  url?: string // Public URL
}


// Create media file record in database (after client-side upload to storage)
export async function createMediaFileRecord(
  filePath: string,
  bucket: 'cms-media' | 'product-media' | 'user-media',
  fileName: string,
  fileType: 'image' | 'video' | 'document',
  mimeType: string,
  fileSize: number,
  options?: {
    width?: number
    height?: number
    duration?: number
    altText?: string
    description?: string
    associatedType?: string
    associatedId?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    // Create media file record
    const { data: mediaFile, error: dbError } = await supabase
      .from('media_files')
      .insert({
        bucket_id: bucket,
        file_path: filePath,
        file_name: fileName,
        file_type: fileType,
        mime_type: mimeType,
        file_size: fileSize,
        width: options?.width,
        height: options?.height,
        duration: options?.duration,
        alt_text: options?.altText,
        description: options?.description,
        uploaded_by: user.id,
        associated_type: options?.associatedType,
        associated_id: options?.associatedId,
        is_public: true,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      console.error('Error details:', JSON.stringify(dbError, null, 2))
      // Try to delete uploaded file
      await supabase.storage.from(bucket).remove([filePath])
      return { success: false, error: dbError.message || 'Failed to save file record to database' }
    }
    
    if (!mediaFile) {
      return { success: false, error: 'File uploaded but record not created' }
    }

    revalidatePath('/admin/media')
    return {
      success: true,
      data: {
        ...mediaFile,
        url: publicUrl,
      },
    }
  } catch (error: any) {
    console.error('Create media record error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    return { success: false, error: error.message || 'Failed to create media file record' }
  }
}

// Upload file to Supabase Storage (server-side - kept for backward compatibility)
// NOTE: This has Vercel function size limits (4.5MB). Use client-side upload for larger files.
export async function uploadMediaFile(
  file: File,
  bucket: 'cms-media' | 'product-media' | 'user-media',
  options?: {
    folder?: string
    altText?: string
    description?: string
    associatedType?: string
    associatedId?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate file
  const validation = validateFileType(file, bucket)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  try {
    // Check file size before processing
    if (file.size === 0) {
      return { success: false, error: 'File is empty' }
    }

    // Generate file path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = options?.folder
      ? `${options.folder}/${timestamp}-${sanitizedFileName}`
      : `${timestamp}-${sanitizedFileName}`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return { success: false, error: 'Failed to read file data' }
    }

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      console.error('Error details:', JSON.stringify(uploadError, null, 2))
      return { success: false, error: uploadError.message || 'Failed to upload file to storage' }
    }
    
    if (!uploadData) {
      return { success: false, error: 'Upload succeeded but no data returned' }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    // Get file dimensions for images/videos
    let width: number | undefined
    let height: number | undefined
    let duration: number | undefined

    // Determine file type
    let fileType: 'image' | 'video' | 'document' = 'document'
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      fileType = 'image'
    } else if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
      fileType = 'video'
    }

    // Create media file record
    const { data: mediaFile, error: dbError } = await supabase
      .from('media_files')
      .insert({
        bucket_id: bucket,
        file_path: filePath,
        file_name: file.name,
        file_type: fileType,
        mime_type: file.type,
        file_size: file.size,
        width,
        height,
        duration,
        alt_text: options?.altText,
        description: options?.description,
        uploaded_by: user.id,
        associated_type: options?.associatedType,
        associated_id: options?.associatedId,
        is_public: true,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      console.error('Error details:', JSON.stringify(dbError, null, 2))
      // Try to delete uploaded file
      await supabase.storage.from(bucket).remove([filePath])
      return { success: false, error: dbError.message || 'Failed to save file record to database' }
    }
    
    if (!mediaFile) {
      return { success: false, error: 'File uploaded but record not created' }
    }

    revalidatePath('/admin/media')
    return {
      success: true,
      data: {
        ...mediaFile,
        url: publicUrl,
      },
    }
  } catch (error: any) {
    console.error('Upload error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    return { success: false, error: error.message || 'Failed to upload file' }
  }
}

// Get media files
export async function getMediaFiles(
  bucket?: 'cms-media' | 'product-media' | 'user-media',
  filters?: {
    fileType?: 'image' | 'video' | 'document'
    associatedType?: string
    associatedId?: string
    search?: string
  }
) {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('media_files')
    .select('*')
    .order('created_at', { ascending: false })

  if (bucket) {
    query = query.eq('bucket_id', bucket)
  }

  if (filters?.fileType) {
    query = query.eq('file_type', filters.fileType)
  }

  if (filters?.associatedType) {
    query = query.eq('associated_type', filters.associatedType)
  }

  if (filters?.associatedId) {
    query = query.eq('associated_id', filters.associatedId)
  }

  if (filters?.search) {
    query = query.or(`file_name.ilike.%${filters.search}%,alt_text.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching media files:', error)
    return { data: [], error: error.message }
  }

  // Add public URLs
  const filesWithUrls = (data || []).map((file: any) => {
    const { data: { publicUrl } } = supabase.storage
      .from(file.bucket_id)
      .getPublicUrl(file.file_path)
    
    return {
      ...file,
      url: publicUrl,
    }
  })

  return { data: filesWithUrls, error: null }
}

// List all files directly from Supabase storage buckets
export async function listStorageFiles(
  bucket?: 'cms-media' | 'product-media' | 'user-media',
  folder?: string
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const buckets: ('cms-media' | 'product-media' | 'user-media')[] = bucket
    ? [bucket]
    : ['cms-media', 'product-media', 'user-media']

  const allFiles: Array<MediaFile & { bucket_id: string }> = []

  try {
    for (const bucketName of buckets) {
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(folder || '', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        console.error(`Error listing files from ${bucketName}:`, error)
        continue
      }

      if (files) {
        for (const file of files) {
          // Skip folders
          if (!file.id) continue

          const filePath = folder ? `${folder}/${file.name}` : file.name
          const { data: { publicUrl } } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath)

          // Determine file type from mime type or file extension
          let fileType: 'image' | 'video' | 'document' = 'document'
          const metadata = file.metadata || {}
          const mimeType = metadata.mimetype || metadata.contentType || ''
          const fileName = file.name.toLowerCase()
          
          if (ALLOWED_IMAGE_TYPES.includes(mimeType) || 
              /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i.test(fileName)) {
            fileType = 'image'
          } else if (ALLOWED_VIDEO_TYPES.includes(mimeType) || 
                     /\.(mp4|mov|webm|avi)$/i.test(fileName)) {
            fileType = 'video'
          } else if (/\.(pdf)$/i.test(fileName)) {
            fileType = 'document'
          }

          allFiles.push({
            id: file.id || filePath,
            bucket_id: bucketName,
            file_path: filePath,
            file_name: file.name,
            file_type: fileType,
            mime_type: mimeType || 'application/octet-stream',
            file_size: metadata.size || metadata.cacheControl || 0,
            width: metadata.width,
            height: metadata.height,
            duration: metadata.duration,
            alt_text: null,
            description: null,
            uploaded_by: file.owner || undefined,
            associated_type: null,
            associated_id: null,
            is_public: true,
            created_at: file.created_at || new Date().toISOString(),
            updated_at: file.updated_at || file.created_at || new Date().toISOString(),
            url: publicUrl,
          })
        }
      }
    }

    // Sort by created_at descending
    allFiles.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA
    })

    return { data: allFiles, error: null }
  } catch (error: any) {
    console.error('Error listing storage files:', error)
    return { data: [], error: error.message || 'Failed to list storage files' }
  }
}

// Delete file directly from storage
export async function deleteStorageFile(
  bucket: 'cms-media' | 'product-media' | 'user-media',
  filePath: string
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized - Admin access required' }
  }

  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      return { success: false, error: storageError.message || 'Failed to delete file from storage' }
    }

    // Also try to delete from database if it exists
    const { data: dbFile } = await supabase
      .from('media_files')
      .select('id')
      .eq('bucket_id', bucket)
      .eq('file_path', filePath)
      .single()

    if (dbFile) {
      await supabase
        .from('media_files')
        .delete()
        .eq('id', dbFile.id)
    }

    revalidatePath('/admin/media')
    return { success: true }
  } catch (error: any) {
    console.error('Delete storage file error:', error)
    return { success: false, error: error.message || 'Failed to delete file' }
  }
}

// Delete media file
export async function deleteMediaFile(fileId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Get file info
  const { data: file, error: fetchError } = await supabase
    .from('media_files')
    .select('*')
    .eq('id', fileId)
    .single()

  if (fetchError || !file) {
    return { success: false, error: 'File not found' }
  }

  // Check permissions (admin or owner)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'partner'
  const isOwner = file.uploaded_by === user.id

  if (!isAdmin && !isOwner) {
    return { success: false, error: 'Unauthorized' }
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from(file.bucket_id)
    .remove([file.file_path])

  if (storageError) {
    console.error('Storage delete error:', storageError)
    // Continue to delete DB record even if storage delete fails
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('media_files')
    .delete()
    .eq('id', fileId)

  if (dbError) {
    console.error('Database delete error:', dbError)
    return { success: false, error: dbError.message }
  }

  revalidatePath('/admin/media')
  return { success: true }
}

// Update media file metadata
export async function updateMediaFile(
  fileId: string,
  updates: {
    alt_text?: string
    description?: string
    associated_type?: string
    associated_id?: string
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check permissions
  const { data: file } = await supabase
    .from('media_files')
    .select('uploaded_by')
    .eq('id', fileId)
    .single()

  if (!file) {
    return { success: false, error: 'File not found' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'partner'
  const isOwner = file.uploaded_by === user.id

  if (!isAdmin && !isOwner) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('media_files')
    .update(updates)
    .eq('id', fileId)

  if (error) {
    console.error('Update error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/media')
  return { success: true }
}

