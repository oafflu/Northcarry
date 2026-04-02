-- ===========================
-- SUBSCRIPTIONS SYSTEM
-- ===========================

-- Subscription Products (Links products/variants to subscription configurations)
CREATE TABLE IF NOT EXISTS subscription_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Subscription configuration
  is_subscription_enabled BOOLEAN DEFAULT FALSE,
  shipping_days INTEGER NOT NULL DEFAULT 14, -- Days to ship (used to calculate billing intervals)
  
  -- Pricing for different purchase types
  one_time_price DECIMAL(10,2), -- One-time purchase price (from variant)
  subscription_price DECIMAL(10,2), -- Ongoing subscription price
  prepaid_price DECIMAL(10,2), -- Prepaid subscription price
  
  -- Available frequencies (stored as JSON array: [1, 2, 3] for months)
  available_frequencies INTEGER[] DEFAULT ARRAY[1], -- e.g., [1, 2, 3] for 1, 2, 3 months
  
  -- Status
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, variant_id)
);

-- Customer Subscriptions (Active subscriptions)
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_product_id UUID REFERENCES subscription_products(id) ON DELETE CASCADE NOT NULL,
  
  -- Subscription details
  frequency_months INTEGER NOT NULL, -- 1, 2, 3, etc.
  purchase_type TEXT CHECK (purchase_type IN ('ongoing', 'prepaid')) NOT NULL,
  quantity INTEGER DEFAULT 1,
  
  -- Pricing
  price_per_cycle DECIMAL(10,2) NOT NULL,
  total_prepaid_amount DECIMAL(10,2), -- For prepaid subscriptions
  
  -- Billing & Shipping
  next_billing_date DATE NOT NULL,
  next_shipment_date DATE NOT NULL,
  shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  billing_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES saved_payment_methods(id) ON DELETE SET NULL,
  
  -- Stripe subscription ID (if using Stripe subscriptions)
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'completed')) DEFAULT 'active',
  pause_reason TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  
  -- Prepaid tracking
  prepaid_cycles_remaining INTEGER DEFAULT 0, -- For prepaid subscriptions
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Orders (Orders generated from subscriptions)
CREATE TABLE IF NOT EXISTS subscription_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES customer_subscriptions(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Cycle information
  cycle_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  billing_date DATE NOT NULL,
  shipment_date DATE NOT NULL,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'billed', 'shipped', 'delivered', 'cancelled', 'failed')) DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(subscription_id, cycle_number)
);

-- Subscription History (Audit trail)
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES customer_subscriptions(id) ON DELETE CASCADE NOT NULL,
  
  action TEXT NOT NULL, -- 'created', 'paused', 'resumed', 'cancelled', 'billed', 'shipped', 'updated'
  details JSONB, -- Additional details about the action
  
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin who made the change (if applicable)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_products_product_id ON subscription_products(product_id);
CREATE INDEX IF NOT EXISTS idx_subscription_products_variant_id ON subscription_products(variant_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_user_id ON customer_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_next_billing ON customer_subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_order_id ON subscription_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription_id ON subscription_history(subscription_id);

-- Enable Row Level Security (RLS)
ALTER TABLE subscription_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_products
-- Admins can manage all subscription products
DROP POLICY IF EXISTS "Admins can manage subscription products" ON subscription_products;
CREATE POLICY "Admins can manage subscription products" ON subscription_products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Customers can view active subscription products
DROP POLICY IF EXISTS "Customers can view active subscription products" ON subscription_products;
CREATE POLICY "Customers can view active subscription products" ON subscription_products
  FOR SELECT
  USING (status = 'active' AND is_subscription_enabled = TRUE);

-- RLS Policies for customer_subscriptions
-- Users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view their subscriptions" ON customer_subscriptions;
CREATE POLICY "Users can view their subscriptions" ON customer_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own subscriptions
DROP POLICY IF EXISTS "Users can create subscriptions" ON customer_subscriptions;
CREATE POLICY "Users can create subscriptions" ON customer_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions (pause, cancel, etc.)
DROP POLICY IF EXISTS "Users can update their subscriptions" ON customer_subscriptions;
CREATE POLICY "Users can update their subscriptions" ON customer_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can manage all subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON customer_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON customer_subscriptions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for subscription_orders
-- Users can view orders from their subscriptions
DROP POLICY IF EXISTS "Users can view their subscription orders" ON subscription_orders;
CREATE POLICY "Users can view their subscription orders" ON subscription_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_subscriptions 
      WHERE id = subscription_orders.subscription_id 
      AND user_id = auth.uid()
    )
  );

-- Admins can manage all subscription orders
DROP POLICY IF EXISTS "Admins can manage subscription orders" ON subscription_orders;
CREATE POLICY "Admins can manage subscription orders" ON subscription_orders
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- RLS Policies for subscription_history
-- Users can view history of their subscriptions
DROP POLICY IF EXISTS "Users can view their subscription history" ON subscription_history;
CREATE POLICY "Users can view their subscription history" ON subscription_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_subscriptions 
      WHERE id = subscription_history.subscription_id 
      AND user_id = auth.uid()
    )
  );

-- Admins can view all subscription history
DROP POLICY IF EXISTS "Admins can view all subscription history" ON subscription_history;
CREATE POLICY "Admins can view all subscription history" ON subscription_history
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_products_updated_at
  BEFORE UPDATE ON subscription_products
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_products_updated_at();

CREATE OR REPLACE FUNCTION update_customer_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_subscriptions_updated_at
  BEFORE UPDATE ON customer_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_subscriptions_updated_at();

CREATE OR REPLACE FUNCTION update_subscription_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_orders_updated_at
  BEFORE UPDATE ON subscription_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_orders_updated_at();

-- Function to calculate next billing date based on frequency and shipping days
CREATE OR REPLACE FUNCTION calculate_next_billing_date(
  frequency_months INTEGER,
  shipping_days INTEGER,
  start_date DATE
)
RETURNS DATE AS $$
DECLARE
  billing_interval_days INTEGER;
  next_billing DATE;
  v_start_date DATE;
BEGIN
  -- Use provided date or current date if NULL
  v_start_date := COALESCE(start_date, CURRENT_DATE);
  
  -- Calculate billing interval: frequency in days minus shipping days
  -- This ensures product arrives at the end of the subscription period
  billing_interval_days := (frequency_months * 30) - shipping_days;
  
  -- If billing interval is negative or zero, default to frequency minus shipping
  IF billing_interval_days <= 0 THEN
    billing_interval_days := (frequency_months * 30) - shipping_days;
    -- Minimum 7 days between billing cycles
    IF billing_interval_days < 7 THEN
      billing_interval_days := 7;
    END IF;
  END IF;
  
  next_billing := v_start_date + (billing_interval_days || ' days')::INTERVAL;
  
  RETURN next_billing;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next shipment date
CREATE OR REPLACE FUNCTION calculate_next_shipment_date(
  frequency_months INTEGER,
  start_date DATE
)
RETURNS DATE AS $$
DECLARE
  v_start_date DATE;
BEGIN
  -- Use provided date or current date if NULL
  v_start_date := COALESCE(start_date, CURRENT_DATE);
  
  -- Shipment happens at the end of the subscription period
  RETURN v_start_date + (frequency_months || ' months')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

