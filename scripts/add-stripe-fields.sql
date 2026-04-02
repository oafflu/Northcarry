-- Add Stripe-related fields to orders table for webhook processing

-- Add Stripe payment intent ID to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add Stripe customer ID to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent ON orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_charge ON orders(stripe_charge_id);

-- Add refunds table if it doesn't exist
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  stripe_refund_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add disputes table if it doesn't exist
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status TEXT CHECK (status IN ('open', 'warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add saved payment methods table if it doesn't exist
CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  last4 TEXT,
  brand TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_saved_payment_methods_user_id ON saved_payment_methods(user_id);

-- Add RLS policies
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_payment_methods ENABLE ROW LEVEL SECURITY;

-- Refunds: Admins can read all, users can read their own
DROP POLICY IF EXISTS "Admins can manage refunds" ON refunds;
CREATE POLICY "Admins can manage refunds" ON refunds
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view their refunds" ON refunds;
CREATE POLICY "Users can view their refunds" ON refunds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = refunds.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Disputes: Admins can manage all
DROP POLICY IF EXISTS "Admins can manage disputes" ON disputes;
CREATE POLICY "Admins can manage disputes" ON disputes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Saved payment methods: Users can manage their own
DROP POLICY IF EXISTS "Users can manage their payment methods" ON saved_payment_methods;
CREATE POLICY "Users can manage their payment methods" ON saved_payment_methods
  FOR ALL
  USING (user_id = auth.uid());

