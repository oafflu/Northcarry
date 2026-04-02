-- ===========================
-- PAYMENTS TABLE
-- General payments table for tracking various payment types
-- ===========================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User/Customer information
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  
  -- Payment details
  payment_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_method TEXT, -- 'stripe', 'paypal', 'sample_request', etc.
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  
  -- Payment provider IDs
  stripe_payment_intent_id TEXT,
  paypal_order_id TEXT,
  
  -- Reference to related entities
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  sample_request_id UUID, -- Will add foreign key constraint after sample_requests table is created
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_email ON payments(customer_email);
CREATE INDEX IF NOT EXISTS idx_payments_payment_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_sample_request_id ON payments(sample_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- Add comment
COMMENT ON TABLE payments IS 'General payments table for tracking various payment types including orders and sample requests';

