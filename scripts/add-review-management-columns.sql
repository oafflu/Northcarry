-- ===========================
-- ADD REVIEW MANAGEMENT COLUMNS
-- ===========================
-- Adds is_hidden and helpful_count columns to reviews table
-- for advanced review management features

-- Add is_hidden column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add helpful_count column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name = 'helpful_count'
  ) THEN
    ALTER TABLE reviews ADD COLUMN helpful_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create index on is_hidden for faster filtering
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden);

-- Create index on helpful_count for sorting
CREATE INDEX IF NOT EXISTS idx_reviews_helpful_count ON reviews(helpful_count);

-- Update existing reviews to have default values
UPDATE reviews 
SET is_hidden = FALSE 
WHERE is_hidden IS NULL;

UPDATE reviews 
SET helpful_count = 0 
WHERE helpful_count IS NULL;

