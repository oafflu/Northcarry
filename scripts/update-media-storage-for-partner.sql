-- ===========================
-- UPDATE MEDIA STORAGE POLICIES FOR PARTNER ROLE
-- ===========================
-- This script updates existing storage policies to allow partner role
-- Run this after the initial create-media-storage.sql script

-- ===========================
-- CMS MEDIA BUCKET POLICIES
-- ===========================

-- Update upload policy to include partner
DROP POLICY IF EXISTS "Admins can upload CMS media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can upload CMS media" ON storage.objects;
CREATE POLICY "Admins and Partners can upload CMS media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Update read policy to include partner
DROP POLICY IF EXISTS "Admins can read CMS media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can read CMS media" ON storage.objects;
CREATE POLICY "Admins and Partners can read CMS media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Keep public read policy (already exists, no change needed)

-- Update update policy to include partner
DROP POLICY IF EXISTS "Admins can update CMS media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can update CMS media" ON storage.objects;
CREATE POLICY "Admins and Partners can update CMS media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Update delete policy to include partner
DROP POLICY IF EXISTS "Admins can delete CMS media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can delete CMS media" ON storage.objects;
CREATE POLICY "Admins and Partners can delete CMS media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cms-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- ===========================
-- PRODUCT MEDIA BUCKET POLICIES
-- ===========================

-- Update upload policy to include partner
DROP POLICY IF EXISTS "Admins can upload product media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can upload product media" ON storage.objects;
CREATE POLICY "Admins and Partners can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Update read policy to include partner
DROP POLICY IF EXISTS "Admins can read product media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can read product media" ON storage.objects;
CREATE POLICY "Admins and Partners can read product media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Keep public read policy (already exists, no change needed)

-- Update update policy to include partner
DROP POLICY IF EXISTS "Admins can update product media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can update product media" ON storage.objects;
CREATE POLICY "Admins and Partners can update product media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Update delete policy to include partner
DROP POLICY IF EXISTS "Admins can delete product media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can delete product media" ON storage.objects;
CREATE POLICY "Admins and Partners can delete product media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- ===========================
-- USER MEDIA BUCKET POLICIES
-- ===========================

-- Update admin management policy to include partner
DROP POLICY IF EXISTS "Admins can manage all user media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and Partners can manage all user media" ON storage.objects;
CREATE POLICY "Admins and Partners can manage all user media"
ON storage.objects FOR ALL
USING (
  bucket_id = 'user-media' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- ===========================
-- MEDIA FILES TABLE RLS POLICIES
-- ===========================

-- Update admin management policy to include partner
DROP POLICY IF EXISTS "Admins can manage all media files" ON media_files;
DROP POLICY IF EXISTS "Admins and Partners can manage all media files" ON media_files;
CREATE POLICY "Admins and Partners can manage all media files"
ON media_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Keep other policies (public view, user own media) - no changes needed
