-- Create incomplete_payments table to track failed payment attempts
-- This is used for email marketing automations (abandoned cart, payment retry, etc.)

CREATE TABLE IF NOT EXISTS incomplete_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  
  -- Stripe payment information
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  payment_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  
  -- Payment failure details
  failure_reason TEXT, -- 'card_declined', 'insufficient_funds', 'expired_card', etc.
  failure_code TEXT, -- Stripe error code
  failure_message TEXT, -- Human-readable error message
  
  -- Order information (if order was created)
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_number TEXT,
  
  -- Cart information (stored as JSON for email marketing)
  cart_items JSONB, -- Array of cart items with product details
  
  -- Status tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  recovered BOOLEAN DEFAULT FALSE, -- True if payment was later successful
  recovered_at TIMESTAMPTZ,
  
  -- Email marketing flags
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  automation_triggered BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on stripe_payment_intent_id to prevent duplicates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'incomplete_payments_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE incomplete_payments 
    ADD CONSTRAINT incomplete_payments_stripe_payment_intent_id_key 
    UNIQUE (stripe_payment_intent_id);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_user_id ON incomplete_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_email ON incomplete_payments(customer_email);
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_stripe_payment_intent ON incomplete_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_recovered ON incomplete_payments(recovered) WHERE recovered = FALSE;
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_email_sent ON incomplete_payments(email_sent) WHERE email_sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_created_at ON incomplete_payments(created_at DESC);

-- Enable RLS
ALTER TABLE incomplete_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all incomplete payments" ON incomplete_payments;
DROP POLICY IF EXISTS "Users can view their own incomplete payments" ON incomplete_payments;

-- RLS Policies (admin can view all, users can view their own)
CREATE POLICY "Admins can view all incomplete payments" ON incomplete_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own incomplete payments" ON incomplete_payments
  FOR SELECT
  USING (auth.uid() = user_id OR customer_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_incomplete_payments_updated_at ON incomplete_payments;
CREATE TRIGGER update_incomplete_payments_updated_at
  BEFORE UPDATE ON incomplete_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

