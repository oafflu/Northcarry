-- ===========================
-- ADD MULTIPLE PRODUCTS SUPPORT TO SAMPLE REQUESTS
-- ===========================

-- Add columns for multiple products (using JSONB arrays)
ALTER TABLE sample_requests 
ADD COLUMN IF NOT EXISTS supplier_inventory_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS product_ids JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS variant_ids JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single product data to arrays
UPDATE sample_requests
SET 
  supplier_inventory_ids = CASE 
    WHEN supplier_inventory_id IS NOT NULL THEN jsonb_build_array(supplier_inventory_id::text)
    ELSE '[]'::jsonb
  END,
  product_ids = CASE 
    WHEN product_id IS NOT NULL THEN jsonb_build_array(product_id::text)
    ELSE '[]'::jsonb
  END,
  variant_ids = CASE 
    WHEN variant_id IS NOT NULL THEN jsonb_build_array(variant_id::text)
    ELSE '[]'::jsonb
  END
WHERE supplier_inventory_id IS NOT NULL OR product_id IS NOT NULL OR variant_id IS NOT NULL;

-- Add indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_sample_requests_supplier_inventory_ids ON sample_requests USING GIN (supplier_inventory_ids);
CREATE INDEX IF NOT EXISTS idx_sample_requests_product_ids ON sample_requests USING GIN (product_ids);
CREATE INDEX IF NOT EXISTS idx_sample_requests_variant_ids ON sample_requests USING GIN (variant_ids);

-- Add comment
COMMENT ON COLUMN sample_requests.supplier_inventory_ids IS 'Array of supplier inventory IDs (for multiple products)';
COMMENT ON COLUMN sample_requests.product_ids IS 'Array of product IDs (for multiple products)';
COMMENT ON COLUMN sample_requests.variant_ids IS 'Array of variant IDs (for multiple products)';

