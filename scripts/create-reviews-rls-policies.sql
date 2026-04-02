-- ===========================
-- REVIEWS TABLE RLS POLICIES
-- ===========================
-- Allow public read access to approved, non-hidden reviews
-- Allow users to create their own reviews
-- Allow admins to manage all reviews

-- Enable RLS if not already enabled
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view approved reviews" ON reviews;
DROP POLICY IF EXISTS "Users can create their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can view all reviews" ON reviews;
DROP POLICY IF EXISTS "Admins can update all reviews" ON reviews;

-- Policy for SELECT: Public can view approved, non-hidden reviews
-- This allows anonymous users (public role) and all authenticated users to see approved reviews
CREATE POLICY "Public can view approved reviews" ON reviews
  FOR SELECT
  TO public, authenticated
  USING (
    is_approved = true 
    AND is_hidden = false
  );

-- Policy for SELECT: Admins can view all reviews (including hidden/unapproved)
-- This policy allows admins to see everything, including pending and hidden reviews
CREATE POLICY "Admins can view all reviews" ON reviews
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for INSERT: Users can create their own reviews
CREATE POLICY "Users can create their own reviews" ON reviews
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    -- Authenticated users can create reviews with their own user_id
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Allow anonymous reviews (user_id can be null)
    user_id IS NULL
    OR
    -- Admins can create reviews for anyone
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for UPDATE: Users can update their own reviews
CREATE POLICY "Users can update their own reviews" ON reviews
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own reviews
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  )
  WITH CHECK (
    -- Users can only update their own reviews
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Policy for UPDATE: Admins can update all reviews (including approval/hide status)
CREATE POLICY "Admins can update all reviews" ON reviews
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for DELETE: Only admins can delete reviews
CREATE POLICY "Admins can delete reviews" ON reviews
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ===========================
-- REVIEW_IMAGES TABLE RLS POLICIES
-- ===========================
-- Allow public to view images for approved, non-hidden reviews
-- Allow admins to manage all review images

-- Enable RLS if not already enabled
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view review images" ON review_images;
DROP POLICY IF EXISTS "Admins can manage review images" ON review_images;

-- Policy for SELECT: Public can view images for approved, non-hidden reviews
CREATE POLICY "Public can view review images" ON review_images
  FOR SELECT
  TO public, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_images.review_id
      AND reviews.is_approved = true
      AND reviews.is_hidden = false
    )
  );

-- Policy for ALL: Admins can manage all review images
CREATE POLICY "Admins can manage review images" ON review_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

