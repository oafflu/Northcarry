-- Add receipt_url field to supplier_invoices table
ALTER TABLE supplier_invoices
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Add comment
COMMENT ON COLUMN supplier_invoices.receipt_url IS 'URL to the uploaded payment receipt file';

