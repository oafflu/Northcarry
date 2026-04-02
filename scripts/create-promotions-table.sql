-- ===========================
-- PROMOTIONS & DISCOUNTS TABLES
-- ===========================

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping', 'buy_x_get_y')) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Usage limits
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  
  -- Conditions
  min_purchase_amount DECIMAL(10,2),
  applies_to JSONB, -- Products, collections, or 'all'
  
  -- Dates
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  status TEXT CHECK (status IN ('active', 'scheduled', 'expired', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotion usage tracking
CREATE TABLE IF NOT EXISTS promotion_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(promotion_id, order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_user ON promotion_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_order ON promotion_usage(order_id);

-- RLS Policies
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can manage promotions" ON promotions;
DROP POLICY IF EXISTS "Admins can view promotion usage" ON promotion_usage;

-- Anyone can view active promotions (for checkout)
CREATE POLICY "Anyone can view active promotions" 
  ON promotions FOR SELECT 
  USING (status = 'active');

-- Admins can manage promotions
CREATE POLICY "Admins can manage promotions" 
  ON promotions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can view promotion usage
CREATE POLICY "Admins can view promotion usage" 
  ON promotion_usage FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can insert promotion usage (for checkout)
CREATE POLICY "Anyone can record promotion usage" 
  ON promotion_usage FOR INSERT 
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promotions_updated_at ON promotions;
CREATE TRIGGER trigger_update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

