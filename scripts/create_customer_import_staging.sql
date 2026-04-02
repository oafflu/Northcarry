-- =============================================================================
-- CUSTOMER IMPORT STAGING TABLE
-- =============================================================================
-- Run this ENTIRE file in Supabase SQL Editor or psql. (Use only this file;
-- do not paste the README or any line starting with # -- that causes errors.)
--
-- Use this table to load CSV customer data (e.g. 88k Shopify export) before
-- processing into profiles + addresses. Run this migration first, then load
-- data using the generated SQL (see scripts/README-customer-import.md).
--
-- Flow:
--   1. Run this file: creates customer_import_staging
--   2. Run generated data SQL: node scripts/generate-customer-import-sql.js "<path-to-csv>"
--   3. Process into customers: use Admin Import or process-staging script
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_customer_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  country_code TEXT,
  postal_code TEXT,
  default_address_phone TEXT,
  total_spent TEXT,
  total_orders TEXT,
  accepts_email_marketing TEXT,
  tags TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_import_staging_email ON customer_import_staging(email);
CREATE INDEX IF NOT EXISTS idx_customer_import_staging_processed ON customer_import_staging(processed_at);

COMMENT ON TABLE customer_import_staging IS 'Staging table for bulk customer CSV import; process into profiles/addresses via process-staging-import script or Admin Import.';
