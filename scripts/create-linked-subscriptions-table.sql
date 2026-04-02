-- ===========================
-- LINKED SUBSCRIPTIONS SYSTEM
-- ===========================
-- Allows creating automatic subscriptions for one product when another product is purchased
-- Example: Purchase "Brevi™ Premium Nano Sonic Toothbrush" -> Auto-subscribe to "Replacement Head x 2"

CREATE TABLE IF NOT EXISTS linked_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Trigger product (the product that, when purchased, triggers the subscription)
  trigger_product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  trigger_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Subscription product (the product that will be subscribed to)
  subscription_product_id UUID REFERENCES subscription_products(id) ON DELETE CASCADE NOT NULL,
  
  -- Subscription configuration
  frequency_months INTEGER NOT NULL DEFAULT 1, -- How often to deliver (1, 2, 3 months, etc.)
  purchase_type TEXT CHECK (purchase_type IN ('ongoing', 'prepaid')) DEFAULT 'ongoing',
  quantity INTEGER DEFAULT 1, -- Quantity per subscription cycle
  
  -- Start delay (for products that come with initial supply)
  start_after_months INTEGER DEFAULT 2, -- Start subscription after X months (e.g., 2 or 3 months)
  billing_days_before_delivery INTEGER DEFAULT 15, -- Bill X days before delivery (default 15 days)
  
  -- Optional: Only create subscription if trigger product is purchased with specific conditions
  min_quantity INTEGER DEFAULT 1, -- Minimum quantity of trigger product to activate subscription
  auto_activate BOOLEAN DEFAULT TRUE, -- Automatically activate subscription (vs. requiring customer confirmation)
  
  -- Status
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  
  -- Metadata
  name TEXT, -- Optional name for this linked subscription rule
  description TEXT, -- Optional description
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique trigger product + variant + subscription product combination
  UNIQUE(trigger_product_id, trigger_variant_id, subscription_product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_linked_subscriptions_trigger_product ON linked_subscriptions(trigger_product_id);
CREATE INDEX IF NOT EXISTS idx_linked_subscriptions_trigger_variant ON linked_subscriptions(trigger_variant_id);
CREATE INDEX IF NOT EXISTS idx_linked_subscriptions_subscription_product ON linked_subscriptions(subscription_product_id);
CREATE INDEX IF NOT EXISTS idx_linked_subscriptions_status ON linked_subscriptions(status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE linked_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can manage linked subscriptions" ON linked_subscriptions;
CREATE POLICY "Admins can manage linked subscriptions" ON linked_subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Public can view active linked subscriptions" ON linked_subscriptions;
CREATE POLICY "Public can view active linked subscriptions" ON linked_subscriptions
  FOR SELECT
  USING (status = 'active');

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_linked_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_linked_subscriptions_updated_at
  BEFORE UPDATE ON linked_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_linked_subscriptions_updated_at();

