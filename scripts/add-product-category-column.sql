-- Add category column to products table if it doesn't exist
-- This allows products to be categorized for better organization and filtering

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Create index for faster category-based queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Add comment
COMMENT ON COLUMN products.category IS 'Product category (e.g., toothbrushes, oral-care, accessories)';

