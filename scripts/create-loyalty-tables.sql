-- ===========================
-- LOYALTY PROGRAM TABLES
-- ===========================
-- This script creates all tables needed for the loyalty program system
-- Run this in your Supabase SQL editor

-- Loyalty Tiers Table
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL, -- Bronze, Silver, Gold, Platinum
  min_points INTEGER NOT NULL,
  points_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  benefits JSONB DEFAULT '[]'::jsonb, -- Array of benefits
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Members Table
CREATE TABLE IF NOT EXISTS loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
  points_balance INTEGER DEFAULT 0 NOT NULL,
  lifetime_points INTEGER DEFAULT 0 NOT NULL,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Transactions Table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL, -- Positive for earning, negative for spending
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'review', 'referral', 'redemption', 'birthday', 'adjustment')),
  reference_id UUID, -- Order ID, Review ID, etc.
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Rewards Table
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount', 'free_shipping', 'free_product')),
  reward_value JSONB NOT NULL DEFAULT '{}'::jsonb, -- Discount amount, product ID, etc.
  is_active BOOLEAN DEFAULT TRUE,
  stock_limit INTEGER,
  stock_remaining INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty Redemptions Table
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  redemption_code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- INDEXES
-- ===========================

-- Indexes for loyalty_tiers
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_name ON loyalty_tiers(name);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_min_points ON loyalty_tiers(min_points);

-- Indexes for loyalty_members
CREATE INDEX IF NOT EXISTS idx_loyalty_members_user_id ON loyalty_members(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_tier_id ON loyalty_members(tier_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_referral_code ON loyalty_members(referral_code);

-- Indexes for loyalty_transactions
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member_id ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_reference_id ON loyalty_transactions(reference_id);

-- Indexes for loyalty_rewards
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_is_active ON loyalty_rewards(is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_reward_type ON loyalty_rewards(reward_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_points_cost ON loyalty_rewards(points_cost);

-- Indexes for loyalty_redemptions
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_member_id ON loyalty_redemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_reward_id ON loyalty_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_redemption_code ON loyalty_redemptions(redemption_code);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_is_used ON loyalty_redemptions(is_used);

-- ===========================
-- ROW LEVEL SECURITY (RLS)
-- ===========================

-- Enable RLS on all tables
ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Loyalty Tiers: Public read access, admin write access
CREATE POLICY "Anyone can view loyalty tiers"
  ON loyalty_tiers FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage loyalty tiers"
  ON loyalty_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

-- Loyalty Members: Users can view their own, admins can view all
CREATE POLICY "Users can view their own loyalty membership"
  ON loyalty_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all loyalty members"
  ON loyalty_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

CREATE POLICY "System can create loyalty members"
  ON loyalty_members FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update loyalty members"
  ON loyalty_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

-- Loyalty Transactions: Users can view their own, admins can view all
CREATE POLICY "Users can view their own transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_transactions.member_id
      AND loyalty_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

CREATE POLICY "System can create transactions"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (true);

-- Loyalty Rewards: Public read access for active rewards, admin write access
CREATE POLICY "Anyone can view active rewards"
  ON loyalty_rewards FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all rewards"
  ON loyalty_rewards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

CREATE POLICY "Only admins can manage rewards"
  ON loyalty_rewards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

-- Loyalty Redemptions: Users can view their own, admins can view all
CREATE POLICY "Users can view their own redemptions"
  ON loyalty_redemptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loyalty_members
      WHERE loyalty_members.id = loyalty_redemptions.member_id
      AND loyalty_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all redemptions"
  ON loyalty_redemptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

CREATE POLICY "System can create redemptions"
  ON loyalty_redemptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update redemptions"
  ON loyalty_redemptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'partner')
    )
  );

-- ===========================
-- TRIGGERS
-- ===========================

-- Update updated_at timestamp for loyalty_tiers
CREATE OR REPLACE FUNCTION update_loyalty_tiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_tiers_updated_at
  BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_tiers_updated_at();

-- Update updated_at timestamp for loyalty_members
CREATE OR REPLACE FUNCTION update_loyalty_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_members_updated_at
  BEFORE UPDATE ON loyalty_members
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_members_updated_at();

-- ===========================
-- SEED DATA (Optional)
-- ===========================

-- Insert default tiers if they don't exist
INSERT INTO loyalty_tiers (name, min_points, points_multiplier, benefits, sort_order)
VALUES 
  ('Bronze', 0, 1.00, '["1 point per $1", "Birthday reward", "Early sale access"]'::jsonb, 1),
  ('Silver', 1000, 1.50, '["1.5 points per $1", "Free shipping", "Exclusive products"]'::jsonb, 2),
  ('Gold', 5000, 2.00, '["2 points per $1", "Priority support", "VIP events"]'::jsonb, 3)
ON CONFLICT (name) DO NOTHING;

-- ===========================
-- COMMENTS
-- ===========================

COMMENT ON TABLE loyalty_tiers IS 'Defines membership tiers (Bronze, Silver, Gold, etc.) with point requirements and multipliers';
COMMENT ON TABLE loyalty_members IS 'Tracks customer loyalty program membership and point balances';
COMMENT ON TABLE loyalty_transactions IS 'Records all point transactions (earnings and redemptions)';
COMMENT ON TABLE loyalty_rewards IS 'Catalog of available rewards that can be redeemed with points';
COMMENT ON TABLE loyalty_redemptions IS 'Tracks reward redemptions by members';

COMMENT ON COLUMN loyalty_tiers.benefits IS 'Array of benefit descriptions as JSON';
COMMENT ON COLUMN loyalty_rewards.reward_value IS 'JSON object containing reward-specific data (discount amount, product ID, etc.)';
COMMENT ON COLUMN loyalty_transactions.points_change IS 'Positive for earning points, negative for spending points';
