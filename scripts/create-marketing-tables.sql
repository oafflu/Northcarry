-- ===========================
-- MARKETING SYSTEM
-- ===========================

-- Marketing Integrations Table
CREATE TABLE IF NOT EXISTS marketing_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL, -- 'meta', 'google', 'tiktok'
  name TEXT NOT NULL,
  
  -- Configuration (stored as JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_connected BOOLEAN DEFAULT FALSE,
  
  -- Connection metadata
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  
  -- Account information
  account_id TEXT,
  account_name TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(platform, account_id)
);

-- Marketing Campaigns Table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES marketing_integrations(id) ON DELETE SET NULL,
  platform TEXT NOT NULL, -- 'meta', 'google', 'tiktok'
  
  -- Campaign details
  name TEXT NOT NULL,
  external_campaign_id TEXT, -- ID from the platform
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'archived'
  
  -- Budget and targeting
  budget_type TEXT, -- 'daily', 'lifetime'
  budget_amount DECIMAL(10,2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Metrics (cached from platform)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  
  -- Calculated metrics
  ctr DECIMAL(5,2) DEFAULT 0, -- Click-through rate
  cpc DECIMAL(10,2) DEFAULT 0, -- Cost per click
  cpa DECIMAL(10,2) DEFAULT 0, -- Cost per acquisition
  roas DECIMAL(5,2) DEFAULT 0, -- Return on ad spend
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing Events/Conversions Table
CREATE TABLE IF NOT EXISTS marketing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID REFERENCES marketing_integrations(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'purchase', 'add_to_cart', 'view_content', 'lead', etc.
  event_name TEXT,
  external_event_id TEXT, -- ID from the platform
  
  -- Order/Conversion details
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_number TEXT,
  revenue DECIMAL(10,2),
  
  -- Customer details
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email TEXT,
  
  -- Attribution
  click_id TEXT, -- Platform click ID
  conversion_time TIMESTAMPTZ,
  
  -- Event data
  event_data JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Tiers Table
CREATE TABLE IF NOT EXISTS affiliate_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Commission structure
  commission_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
  commission_rate DECIMAL(5,2) NOT NULL, -- Percentage or fixed amount
  min_sales DECIMAL(10,2) DEFAULT 0, -- Minimum sales to qualify
  max_sales DECIMAL(10,2), -- Maximum sales for this tier (null = unlimited)
  
  -- Additional benefits
  benefits JSONB DEFAULT '{}'::jsonb,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliates Table
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES affiliate_tiers(id) ON DELETE SET NULL,
  
  -- Affiliate details
  affiliate_code TEXT UNIQUE NOT NULL, -- Unique referral code
  company_name TEXT,
  website TEXT,
  tax_id TEXT,
  
  -- Payment information
  payment_method TEXT, -- 'paypal', 'bank_transfer', 'check'
  payment_details JSONB DEFAULT '{}'::jsonb, -- Payment account details
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'inactive'
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Statistics
  total_clicks INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  paid_commission DECIMAL(10,2) DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  
  -- Settings
  auto_approve BOOLEAN DEFAULT FALSE,
  notes TEXT,
  
  -- Invitation tracking
  invitation_token TEXT UNIQUE,
  invitation_token_expiry TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Links Table
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  
  -- Link details
  link_type TEXT NOT NULL DEFAULT 'product', -- 'product', 'category', 'home', 'custom'
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID, -- If category links are supported
  custom_url TEXT, -- For custom links
  
  -- Generated link
  affiliate_url TEXT NOT NULL, -- Full URL with affiliate code
  short_code TEXT UNIQUE, -- Optional short code for URL shortening
  
  -- Tracking
  total_clicks INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliate Orders/Commissions Table
CREATE TABLE IF NOT EXISTS affiliate_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Attribution
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
  click_id TEXT, -- Track the click that led to this order
  referral_code TEXT, -- The affiliate code used
  
  -- Order details
  order_number TEXT NOT NULL,
  order_total DECIMAL(10,2) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL,
  
  -- Commission calculation
  commission_rate DECIMAL(5,2) NOT NULL, -- Rate at time of order
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Payment tracking
  payment_id UUID, -- Reference to payment record if exists
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(affiliate_id, order_id)
);

-- Affiliate Clicks/Visits Table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE SET NULL,
  
  -- Visitor information
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  -- Tracking
  click_id TEXT UNIQUE, -- Unique identifier for this click
  session_id TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Conversion tracking
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing Attribution Table (for tracking conversions across platforms)
CREATE TABLE IF NOT EXISTS marketing_attribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Attribution details
  source TEXT, -- 'organic', 'direct', 'meta', 'google', 'tiktok', 'affiliate', 'email', etc.
  medium TEXT, -- 'cpc', 'social', 'email', 'referral', etc.
  campaign TEXT,
  term TEXT, -- Search term if applicable
  
  -- Platform-specific IDs
  click_id TEXT,
  gclid TEXT, -- Google Click ID
  fbclid TEXT, -- Facebook Click ID
  ttclid TEXT, -- TikTok Click ID
  
  -- Affiliate attribution
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  affiliate_code TEXT,
  
  -- Conversion path (multi-touch attribution)
  conversion_path JSONB DEFAULT '[]'::jsonb, -- Array of touchpoints
  
  -- Timestamps
  first_touch_at TIMESTAMPTZ,
  last_touch_at TIMESTAMPTZ,
  conversion_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_integrations_platform ON marketing_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_marketing_integrations_active ON marketing_integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_integration ON marketing_campaigns(integration_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_platform ON marketing_campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign ON marketing_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_order ON marketing_events(order_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_platform ON marketing_events(platform);
CREATE INDEX IF NOT EXISTS idx_marketing_events_type ON marketing_events(event_type);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_tier ON affiliates(tier_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate ON affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(short_code);

CREATE INDEX IF NOT EXISTS idx_affiliate_orders_affiliate ON affiliate_orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_order ON affiliate_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_orders_status ON affiliate_orders(status);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link ON affiliate_clicks(affiliate_link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_click_id ON affiliate_clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_converted ON affiliate_clicks(converted);

CREATE INDEX IF NOT EXISTS idx_marketing_attribution_order ON marketing_attribution(order_id);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_source ON marketing_attribution(source);
CREATE INDEX IF NOT EXISTS idx_marketing_attribution_affiliate ON marketing_attribution(affiliate_id);

-- RLS Policies (if needed)
-- Note: Adjust policies based on your security requirements
ALTER TABLE marketing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_attribution ENABLE ROW LEVEL SECURITY;

