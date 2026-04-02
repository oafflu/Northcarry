# Media Library Setup Guide

## Overview

The Media Library provides centralized media management for CMS content, product images/videos, and user profile images. All media is stored in Supabase Storage with separate buckets for organization.

## Storage Buckets

Three storage buckets are used:

1. **`cms-media`** - For CMS content (hero banners, logos, etc.)
   - Accepts: Images and Videos
   - File types: JPG, PNG, GIF, WEBP, SVG, BMP, TIFF, ICO, MP4, MOV, WEBM
   - Max image size: 20MB
   - Max video size: 100MB

2. **`product-media`** - For product images and videos
   - Accepts: Images and Videos
   - File types: Same as CMS media
   - Max image size: 20MB
   - Max video size: 100MB

3. **`user-media`** - For user profile images
   - Accepts: Images only
   - File types: JPG, PNG, GIF, WEBP, SVG, BMP, TIFF, ICO
   - Max image size: 20MB

## Setup Instructions

### 1. Create Storage Buckets in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **New bucket** and create the following buckets:

   **Bucket 1: `cms-media`**
   - Name: `cms-media`
   - Public: ✅ Yes (for public access to CMS content)
   - File size limit: 100MB
   - Allowed MIME types: `image/*,video/*`

   **Bucket 2: `product-media`**
   - Name: `product-media`
   - Public: ✅ Yes (for public access to product images)
   - File size limit: 100MB
   - Allowed MIME types: `image/*,video/*`

   **Bucket 3: `user-media`**
   - Name: `user-media`
   - Public: ✅ Yes (for public access to profile images)
   - File size limit: 20MB
   - Allowed MIME types: `image/*`

### 2. Run SQL Script

Run the SQL script to create the media metadata table and storage policies:

```bash
# In Supabase SQL Editor, run:
scripts/create-media-storage.sql
```

This script will:
- Create the `media_files` table for tracking media metadata
- Set up Row Level Security (RLS) policies
- Configure storage policies for each bucket

### 3. Verify Setup

1. Go to `/admin/media` in your admin panel
2. Try uploading a test image
3. Verify the file appears in the media library
4. Check that the file is accessible via public URL

## Usage

### Admin Media Library

Access the Media Library at `/admin/media`:

- **Upload Media**: Click "Upload Media" button or drag and drop files
- **Filter by Bucket**: Use tabs to filter by bucket (All, CMS, Product, User)
- **Filter by Type**: Filter by file type (Images, Videos, Documents)
- **Search**: Search by file name, alt text, or description
- **Edit**: Click edit icon to update alt text and description
- **Delete**: Click delete icon to remove files

### Using Media in CMS

When editing CMS content (hero banners, logos, etc.):

1. Click the media picker button
2. Select from `cms-media` bucket
3. Choose an image or video
4. The media URL will be automatically inserted

### Using Media in Products

When creating/editing products:

1. Click the media picker button
2. Select from `product-media` bucket
3. Choose product images or videos
4. Images will be linked to the product/variant

### Using Media in User Profiles

When users update their profile:

1. Click the profile image upload
2. Image is automatically uploaded to `user-media` bucket
3. Stored in user's folder: `{userId}/profile.jpg`

## File Type Restrictions

### Shopify-Compatible File Types

**Images:**
- JPEG/JPG
- PNG
- GIF
- WEBP
- SVG
- BMP
- TIFF
- ICO

**Videos:**
- MP4
- MOV (QuickTime)
- WEBM

**Documents:**
- PDF (for some contexts)

## API Reference

### Server Actions

Located in `app/actions/media.ts`:

- `uploadMediaFile(file, bucket, options?)` - Upload a file
- `getMediaFiles(bucket?, filters?)` - Get media files
- `deleteMediaFile(fileId)` - Delete a file
- `updateMediaFile(fileId, updates)` - Update metadata

### Components

- `MediaPicker` - Component for selecting media from library
  - Located in `components/admin/media-picker.tsx`
  - Props: `open`, `onClose`, `onSelect`, `bucket`, `fileType`, `multiple`

## Integration Examples

### CMS Hero Banner

```tsx
import { MediaPicker } from '@/components/admin/media-picker'

const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null)
const [pickerOpen, setPickerOpen] = useState(false)

<Button onClick={() => setPickerOpen(true)}>Select Image</Button>
<MediaPicker
  open={pickerOpen}
  onClose={() => setPickerOpen(false)}
  onSelect={(file) => setSelectedImage(file)}
  bucket="cms-media"
  fileType="image"
/>
```

### Product Image Upload

```tsx
import { uploadMediaFile } from '@/app/actions/media'

const handleImageUpload = async (file: File) => {
  const result = await uploadMediaFile(file, 'product-media', {
    associatedType: 'product',
    associatedId: productId,
  })
  
  if (result.success) {
    // Use result.data.url for the image URL
  }
}
```

## Security

- **RLS Policies**: All storage buckets have Row Level Security enabled
- **Admin Access**: Only admins can upload/manage CMS and Product media
- **User Access**: Users can only manage their own profile images
- **Public Access**: All buckets are public for serving media, but uploads are restricted

## Troubleshooting

### Files not uploading

1. Check bucket exists in Supabase Storage
2. Verify bucket is set to "Public"
3. Check file type is allowed
4. Verify file size is within limits
5. Check browser console for errors

### Files not displaying

1. Verify bucket is public
2. Check file path is correct
3. Verify RLS policies allow public read access
4. Check CORS settings in Supabase

### Permission errors

1. Verify user is authenticated
2. Check user role (admin for CMS/Product media)
3. Verify RLS policies are correctly set
4. Check storage policies in Supabase Dashboard

