-- ===========================
-- UPSELL SYSTEM
-- ===========================
-- Comprehensive upsell system inspired by top Shopify apps:
-- - Kaching Bundle Quantity Breaks
-- - ReConvert
-- - Selleasy
-- - AOV.ai

-- Upsell Campaigns (Main container for upsell strategies)
CREATE TABLE IF NOT EXISTS upsell_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN (
    'product_bundle',      -- Buy X Get Y bundles
    'quantity_break',     -- Volume discounts
    'post_purchase',      -- After checkout upsells
    'cart_upsell',        -- Cart page upsells
    'one_click',          -- One-click upsells
    'frequently_bought',  -- Frequently bought together
    'volume_discount',    -- Quantity-based discounts
    'upsell_funnel'       -- Multi-step upsell funnels
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  
  -- Targeting
  target_products JSONB DEFAULT '[]'::jsonb, -- Product IDs this applies to
  target_categories JSONB DEFAULT '[]'::jsonb, -- Category IDs
  target_conditions JSONB DEFAULT '{}'::jsonb, -- Min cart value, customer segments, etc.
  
  -- Display settings
  display_settings JSONB DEFAULT '{}'::jsonb, -- Position, styling, timing
  priority INTEGER DEFAULT 0, -- Higher priority shows first
  
  -- A/B Testing
  ab_test_enabled BOOLEAN DEFAULT FALSE,
  ab_test_variants JSONB DEFAULT '[]'::jsonb,
  
  -- Analytics
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Product Bundles (Buy X Get Y)
CREATE TABLE IF NOT EXISTS product_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Bundle configuration
  bundle_type TEXT NOT NULL CHECK (bundle_type IN (
    'buy_x_get_y',        -- Buy 2 Get 1 Free
    'mix_match',          -- Mix and match bundles
    'combo',              -- Product combos
    'gift_with_purchase'  -- Free gift with purchase
  )),
  
  -- Products in bundle
  main_products JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, variant_id, quantity, required}]
  bonus_products JSONB DEFAULT '[]'::jsonb, -- [{product_id, variant_id, quantity, discount}]
  
  -- Pricing
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free')),
  discount_value DECIMAL(10,2),
  bundle_price DECIMAL(10,2), -- Fixed bundle price (optional)
  
  -- Rules
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  required_products JSONB DEFAULT '[]'::jsonb, -- Must include these products
  
  -- Display
  image_url TEXT,
  badge_text TEXT, -- "Best Value", "Save 20%", etc.
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quantity Breaks (Volume Discounts)
CREATE TABLE IF NOT EXISTS quantity_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Break configuration
  break_type TEXT NOT NULL CHECK (break_type IN (
    'quantity',     -- Buy 2+ get discount
    'tier',         -- Different discounts at different tiers
    'bulk'          -- Bulk pricing
  )),
  
  -- Break tiers: [{quantity: 2, discount_type: 'percentage', discount_value: 10}, ...]
  tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Display
  badge_text TEXT,
  show_on_product BOOLEAN DEFAULT TRUE,
  show_in_cart BOOLEAN DEFAULT TRUE,
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-Purchase Upsells
CREATE TABLE IF NOT EXISTS post_purchase_upsells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'order_value',      -- After order value threshold
    'product_purchased', -- After specific product purchase
    'category_purchased', -- After category purchase
    'always'            -- Show on all orders
  )),
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  
  -- Upsell products
  upsell_products JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, variant_id, discount}]
  
  -- Display settings
  display_delay INTEGER DEFAULT 0, -- Seconds to wait before showing
  display_duration INTEGER, -- How long to show (null = until dismissed)
  headline TEXT,
  description TEXT,
  cta_text TEXT DEFAULT 'Add to Order',
  image_url TEXT,
  
  -- Offer settings
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value DECIMAL(10,2),
  urgency_text TEXT, -- "Limited time offer!"
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cart Upsells
CREATE TABLE IF NOT EXISTS cart_upsells (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  
  -- Trigger conditions
  min_cart_value DECIMAL(10,2),
  max_cart_value DECIMAL(10,2),
  required_products JSONB DEFAULT '[]'::jsonb,
  excluded_products JSONB DEFAULT '[]'::jsonb,
  
  -- Upsell products
  upsell_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Display
  position TEXT CHECK (position IN ('top', 'bottom', 'sidebar', 'popup')),
  headline TEXT,
  description TEXT,
  cta_text TEXT DEFAULT 'Add to Cart',
  image_url TEXT,
  
  -- Offer
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2),
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frequently Bought Together
CREATE TABLE IF NOT EXISTS frequently_bought_together (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  main_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  
  -- Related products
  related_products JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, variant_id, weight}]
  
  -- Algorithm settings
  algorithm_type TEXT DEFAULT 'purchase_history' CHECK (algorithm_type IN (
    'purchase_history',  -- Based on actual purchase data
    'manual',            -- Manually selected
    'similar_products'   -- Based on product attributes
  )),
  
  -- Display
  max_products INTEGER DEFAULT 4,
  headline TEXT DEFAULT 'Frequently Bought Together',
  show_discount BOOLEAN DEFAULT TRUE,
  bundle_discount DECIMAL(10,2), -- Discount when buying all together
  
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upsell Analytics
CREATE TABLE IF NOT EXISTS upsell_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES upsell_campaigns(id) ON DELETE CASCADE,
  upsell_type TEXT NOT NULL, -- 'bundle', 'quantity_break', 'post_purchase', etc.
  upsell_id UUID NOT NULL, -- ID of the specific upsell
  
  -- Event tracking
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'add_to_cart', 'purchase', 'dismiss')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  
  -- Context
  cart_value DECIMAL(10,2),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_ids JSONB DEFAULT '[]'::jsonb,
  
  -- Revenue
  revenue DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_upsell_campaigns_type ON upsell_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_upsell_campaigns_status ON upsell_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_product_bundles_campaign ON product_bundles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_quantity_breaks_product ON quantity_breaks(product_id);
CREATE INDEX IF NOT EXISTS idx_post_purchase_campaign ON post_purchase_upsells(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cart_upsells_campaign ON cart_upsells(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fbt_main_product ON frequently_bought_together(main_product_id);
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_campaign ON upsell_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_event ON upsell_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_created ON upsell_analytics(created_at);

-- Enable RLS
ALTER TABLE upsell_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantity_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_purchase_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequently_bought_together ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins can manage all
DROP POLICY IF EXISTS "Admins can manage upsell campaigns" ON upsell_campaigns;
CREATE POLICY "Admins can manage upsell campaigns" ON upsell_campaigns
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage product bundles" ON product_bundles;
CREATE POLICY "Admins can manage product bundles" ON product_bundles
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage quantity breaks" ON quantity_breaks;
CREATE POLICY "Admins can manage quantity breaks" ON quantity_breaks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage post purchase upsells" ON post_purchase_upsells;
CREATE POLICY "Admins can manage post purchase upsells" ON post_purchase_upsells
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage cart upsells" ON cart_upsells;
CREATE POLICY "Admins can manage cart upsells" ON cart_upsells
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage frequently bought together" ON frequently_bought_together;
CREATE POLICY "Admins can manage frequently bought together" ON frequently_bought_together
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view active campaigns (for frontend)
DROP POLICY IF EXISTS "Everyone can view active upsell campaigns" ON upsell_campaigns;
CREATE POLICY "Everyone can view active upsell campaigns" ON upsell_campaigns
  FOR SELECT
  USING (status = 'active');

-- Everyone can insert analytics
DROP POLICY IF EXISTS "Everyone can insert upsell analytics" ON upsell_analytics;
CREATE POLICY "Everyone can insert upsell analytics" ON upsell_analytics
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all analytics
DROP POLICY IF EXISTS "Admins can view all upsell analytics" ON upsell_analytics;
CREATE POLICY "Admins can view all upsell analytics" ON upsell_analytics
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Update triggers
CREATE OR REPLACE FUNCTION update_upsell_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_upsell_campaigns_updated_at
  BEFORE UPDATE ON upsell_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

CREATE TRIGGER update_product_bundles_updated_at
  BEFORE UPDATE ON product_bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

CREATE TRIGGER update_quantity_breaks_updated_at
  BEFORE UPDATE ON quantity_breaks
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

CREATE TRIGGER update_post_purchase_upsells_updated_at
  BEFORE UPDATE ON post_purchase_upsells
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

CREATE TRIGGER update_cart_upsells_updated_at
  BEFORE UPDATE ON cart_upsells
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

CREATE TRIGGER update_frequently_bought_together_updated_at
  BEFORE UPDATE ON frequently_bought_together
  FOR EACH ROW
  EXECUTE FUNCTION update_upsell_campaigns_updated_at();

