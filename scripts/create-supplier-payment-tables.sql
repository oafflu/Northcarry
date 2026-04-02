-- Supplier Payment Methods
CREATE TABLE IF NOT EXISTS supplier_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Payment method type
  method_type TEXT CHECK (method_type IN ('bank', 'paypal', 'stripe', 'other')) NOT NULL,
  
  -- Bank details
  bank_name TEXT,
  account_holder_name TEXT,
  account_number TEXT, -- Encrypted in production
  routing_number TEXT, -- Encrypted in production
  iban TEXT, -- For international
  swift_code TEXT,
  
  -- PayPal details
  paypal_email TEXT,
  
  -- Stripe details
  stripe_account_id TEXT,
  
  -- Other payment method
  other_details JSONB,
  
  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Invoices
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Order information (just order numbers, no details)
  order_numbers TEXT[] NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- Alias for total_amount for compatibility
  
  -- Status
  status TEXT CHECK (status IN ('draft', 'sent', 'pending', 'paid', 'cancelled')) DEFAULT 'draft',
  
  -- Supplier company information (from invoice generation)
  company_name TEXT,
  tax_id TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  contact_number TEXT,
  email TEXT,
  business_registration_number TEXT,
  
  -- Payment information
  payment_method_id UUID REFERENCES supplier_payment_methods(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  paid_amount DECIMAL(10,2),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payment_methods_supplier_id ON supplier_payment_methods(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payment_methods_is_default ON supplier_payment_methods(supplier_id, is_default) WHERE is_default = TRUE;

-- Partial unique index for bank accounts (prevent duplicate bank accounts for same supplier)
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_payment_methods_bank_unique 
  ON supplier_payment_methods(supplier_id, method_type, account_number) 
  WHERE method_type = 'bank' AND account_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_invoice_number ON supplier_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_created_at ON supplier_invoices(created_at DESC);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  year_part TEXT;
  month_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  month_part := TO_CHAR(CURRENT_DATE, 'MM');
  
  -- Get the next sequence number for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO seq_num
  FROM supplier_invoices
  WHERE invoice_number LIKE 'INV-' || year_part || month_part || '-%';
  
  new_number := 'INV-' || year_part || month_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

