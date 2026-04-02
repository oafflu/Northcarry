-- ===========================
-- ADD PARTNER ACCESS TO MEDIA LIBRARY
-- Update RLS policies to allow partners to manage media files
-- ===========================

-- Update the admin policy to include partners
DROP POLICY IF EXISTS "Admins can manage all media files" ON media_files;
CREATE POLICY "Admins and Partners can manage all media files"
ON media_files FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'partner')
  )
);

-- Add comment
COMMENT ON POLICY "Admins and Partners can manage all media files" ON media_files IS 'Allows admin and partner roles to manage all media files';

