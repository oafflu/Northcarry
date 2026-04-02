// Media file validation utilities

// Shopify-compatible file types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
]

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
]

export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
]

// Bucket-specific file size limits (matching Supabase Storage settings)
export const BUCKET_SIZE_LIMITS = {
  'user-media': 20 * 1024 * 1024, // 20 MB - images only
  'product-media': 40 * 1024 * 1024, // 40 MB - images and videos
  'cms-media': 200 * 1024 * 1024, // 200 MB - images and videos
} as const

// Legacy constants for backward compatibility (deprecated - use bucket-specific limits)
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB

// Validate file type and size based on bucket
export function validateFileType(file: File, bucket: 'cms-media' | 'product-media' | 'user-media'): { valid: boolean; error?: string } {
  // CMS and Product buckets accept images and videos
  if (bucket === 'cms-media' || bucket === 'product-media') {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: Images (${ALLOWED_IMAGE_TYPES.map(t => t.split('/')[1]).join(', ')}) and Videos (${ALLOWED_VIDEO_TYPES.map(t => t.split('/')[1]).join(', ')})`,
      }
    }
  }
  
  // User media bucket accepts images only
  if (bucket === 'user-media') {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Only images are allowed for user media.`,
      }
    }
  }

  // Check file size based on bucket limit
  const bucketLimit = BUCKET_SIZE_LIMITS[bucket]
  if (file.size > bucketLimit) {
    const limitMB = bucketLimit / 1024 / 1024
    return { 
      valid: false, 
      error: `File size exceeds maximum of ${limitMB}MB for ${bucket} bucket` 
    }
  }

  return { valid: true }
}

