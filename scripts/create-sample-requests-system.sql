-- ===========================
-- SAMPLE REQUESTS SYSTEM
-- Database Schema
-- ===========================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sample Requests Table
CREATE TABLE IF NOT EXISTS sample_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Request details
  request_type TEXT NOT NULL CHECK (request_type IN ('existing_product', 'custom_product')),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Existing product request (if request_type = 'existing_product')
  supplier_inventory_id UUID REFERENCES supplier_inventory(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Custom product request (if request_type = 'custom_product')
  custom_product_name TEXT,
  custom_product_description TEXT,
  custom_product_images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
  custom_product_links JSONB DEFAULT '[]'::jsonb, -- Array of web links
  
  -- Shipping information
  shipping_address JSONB NOT NULL, -- {name, address_line1, address_line2, city, state, postal_code, country, phone}
  shipping_notes TEXT,
  
  -- Pricing (set by supplier)
  sample_price DECIMAL(10,2) DEFAULT 0.00,
  shipping_cost DECIMAL(10,2) DEFAULT 0.00,
  pricing_model TEXT NOT NULL DEFAULT 'free' CHECK (pricing_model IN ('free', 'free_sample_paid_shipping', 'paid_sample_free_shipping', 'paid_sample_paid_shipping')),
  
  -- Payment information
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_id UUID, -- Will add foreign key constraint after payments table is created
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'shipped', 'delivered', 'cancelled')),
  
  -- Admin notes
  admin_notes TEXT,
  
  -- Supplier notes
  supplier_notes TEXT,
  
  -- Tracking information
  tracking_number TEXT,
  shipping_carrier TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sample_requests_admin_id ON sample_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_supplier_id ON sample_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sample_requests_status ON sample_requests(status);
CREATE INDEX IF NOT EXISTS idx_sample_requests_payment_status ON sample_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_sample_requests_created_at ON sample_requests(created_at DESC);

-- Add comment
COMMENT ON TABLE sample_requests IS 'Sample requests from admin to suppliers for product samples';

-- Add foreign key constraint for payment_id if payments table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    -- Drop existing constraint if it exists (in case of re-running)
    IF EXISTS (
      SELECT FROM pg_constraint 
      WHERE conname = 'sample_requests_payment_id_fkey'
    ) THEN
      ALTER TABLE sample_requests DROP CONSTRAINT sample_requests_payment_id_fkey;
    END IF;
    
    -- Add foreign key constraint
    ALTER TABLE sample_requests 
    ADD CONSTRAINT sample_requests_payment_id_fkey 
    FOREIGN KEY (payment_id) 
    REFERENCES payments(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- ===========================
-- UPDATE PAYMENTS TABLE
-- ===========================
-- Note: The payments table should be created first using scripts/create-payments-table.sql
-- This section adds the foreign key constraint for sample_request_id

-- Add foreign key constraint if payments table exists and sample_request_id column exists
DO $$ 
BEGIN
  -- Check if payments table exists and sample_request_id column exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) AND EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'sample_request_id'
  ) THEN
    -- Drop existing constraint if it exists (in case of re-running)
    IF EXISTS (
      SELECT FROM pg_constraint 
      WHERE conname = 'payments_sample_request_id_fkey'
    ) THEN
      ALTER TABLE payments DROP CONSTRAINT payments_sample_request_id_fkey;
    END IF;
    
    -- Add foreign key constraint
    ALTER TABLE payments 
    ADD CONSTRAINT payments_sample_request_id_fkey 
    FOREIGN KEY (sample_request_id) 
    REFERENCES sample_requests(id) 
    ON DELETE SET NULL;

    -- Create index for sample request payments (if not exists)
    CREATE INDEX IF NOT EXISTS idx_payments_sample_request_id ON payments(sample_request_id);

    -- Add comment
    COMMENT ON COLUMN payments.sample_request_id IS 'Reference to sample_request if this payment is for a sample request';
  END IF;
END $$;

