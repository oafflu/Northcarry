-- ===========================
-- ADD QUANTITIES TO SAMPLE REQUESTS
-- ===========================

-- Add quantities column for multiple products (using JSONB array)
ALTER TABLE sample_requests 
ADD COLUMN IF NOT EXISTS quantities JSONB DEFAULT '[]'::jsonb;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_sample_requests_quantities ON sample_requests USING GIN (quantities);

-- Add comment
COMMENT ON COLUMN sample_requests.quantities IS 'Array of quantities corresponding to products in supplier_inventory_ids and product_ids arrays';

