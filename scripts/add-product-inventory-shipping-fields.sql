-- Add Inventory and Shipping fields to products table

-- Inventory fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS inventory_tracked BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS shop_location TEXT DEFAULT '0',
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS sell_when_out_of_stock BOOLEAN DEFAULT FALSE;

-- Shipping fields
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS physical_product BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS product_weight DECIMAL(10,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
ADD COLUMN IF NOT EXISTS hs_code TEXT,
ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'default';

