-- ===========================
-- MEDIA LIBRARY STORAGE SETUP
-- ===========================
-- This script sets up Supabase Storage buckets for media management
-- Buckets: cms-media, product-media, user-media

-- Note: Storage buckets must be created via Supabase Dashboard or API
-- This script creates the storage policies (RLS) for the buckets

-- ===========================
-- STORAGE BUCKETS
-- ===========================
-- Buckets should be created in Supabase Dashboard:
-- 1. cms-media (for CMS content: images, videos)
-- 2. product-media (for product images and videos)
-- 3. user-media (for user profile images)

-- ===========================
-- STORAGE POLICIES
-- ===========================

-- CMS Media Bucket Policies
-- Allow admins to upload, read, update, and delete
DROP POLICY IF EXISTS "Admins can upload CMS media" ON storage.objects;
CREATE POLICY "Admins can upload CMS media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read CMS media" ON storage.objects;
CREATE POLICY "Admins can read CMS media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Anyone can read public CMS media" ON storage.objects;
CREATE POLICY "Anyone can read public CMS media"
ON storage.objects FOR SELECT
USING (bucket_id = 'cms-media');

DROP POLICY IF EXISTS "Admins can update CMS media" ON storage.objects;
CREATE POLICY "Admins can update CMS media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete CMS media" ON storage.objects;
CREATE POLICY "Admins can delete CMS media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Product Media Bucket Policies
DROP POLICY IF EXISTS "Admins can upload product media" ON storage.objects;
CREATE POLICY "Admins can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read product media" ON storage.objects;
CREATE POLICY "Admins can read product media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Anyone can read public product media" ON storage.objects;
CREATE POLICY "Anyone can read public product media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Admins can update product media" ON storage.objects;
CREATE POLICY "Admins can update product media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete product media" ON storage.objects;
CREATE POLICY "Admins can delete product media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- User Media Bucket Policies
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read their own media" ON storage.objects;
CREATE POLICY "Users can read their own media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Anyone can read public user media" ON storage.objects;
CREATE POLICY "Anyone can read public user media"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-media');

DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Admins can manage all user media" ON storage.objects;
CREATE POLICY "Admins can manage all user media"
ON storage.objects FOR ALL
USING (
  bucket_id = 'user-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ===========================
-- MEDIA METADATA TABLE
-- ===========================
-- Track media files with metadata

CREATE TABLE IF NOT EXISTS media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id TEXT NOT NULL, -- 'cms-media', 'product-media', 'user-media'
  file_path TEXT NOT NULL, -- Full path in bucket
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'video', 'document'
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- Size in bytes
  width INTEGER, -- For images/videos
  height INTEGER, -- For images/videos
  duration INTEGER, -- For videos (in seconds)
  alt_text TEXT,
  description TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  associated_type TEXT, -- 'cms', 'product', 'variant', 'user', 'review'
  associated_id UUID, -- ID of associated entity
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(bucket_id, file_path)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_files_bucket ON media_files(bucket_id);
CREATE INDEX IF NOT EXISTS idx_media_files_type ON media_files(file_type);
CREATE INDEX IF NOT EXISTS idx_media_files_associated ON media_files(associated_type, associated_id);
CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by ON media_files(uploaded_by);

-- RLS for media_files
ALTER TABLE media_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all media files" ON media_files;
CREATE POLICY "Admins can manage all media files"
ON media_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can view public media files" ON media_files;
CREATE POLICY "Users can view public media files"
ON media_files FOR SELECT
USING (is_public = TRUE);

DROP POLICY IF EXISTS "Users can view their own media files" ON media_files;
CREATE POLICY "Users can view their own media files"
ON media_files FOR SELECT
USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own media files" ON media_files;
CREATE POLICY "Users can manage their own media files"
ON media_files FOR ALL
USING (uploaded_by = auth.uid());

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_media_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON media_files
  FOR EACH ROW
  EXECUTE FUNCTION update_media_files_updated_at();

