-- ===========================
-- ADMIN SETTINGS TABLES
-- ===========================

-- Main settings table (stores all settings as JSONB for flexibility)
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  setting_category TEXT NOT NULL, -- 'email', 'push', 'payment', 'general', 'countries', 'languages'
  description TEXT,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON admin_settings(setting_category);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- Countries table
CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- ISO 3166-1 alpha-2 (e.g., 'US', 'GB')
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL, -- ISO 4217 (e.g., 'USD', 'GBP')
  currency_symbol TEXT NOT NULL, -- '$', '£', etc.
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- ISO 4217 (e.g., 'USD', 'GBP', 'EUR')
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  symbol_position TEXT DEFAULT 'before', -- 'before' or 'after'
  decimal_places INTEGER DEFAULT 2,
  exchange_rate DECIMAL(10, 6) DEFAULT 1.0, -- Relative to base currency
  is_active BOOLEAN DEFAULT TRUE,
  is_base BOOLEAN DEFAULT FALSE, -- Base currency for exchange rates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- ISO 639-1 (e.g., 'en', 'es', 'fr')
  name TEXT NOT NULL,
  native_name TEXT NOT NULL, -- Name in the language itself
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE languages ENABLE ROW LEVEL SECURITY;

-- Admin settings: Only admins can read/write
DROP POLICY IF EXISTS "Admins can manage settings" ON admin_settings;
CREATE POLICY "Admins can manage settings" ON admin_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Countries: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Everyone can read countries" ON countries;
CREATE POLICY "Everyone can read countries" ON countries
  FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage countries" ON countries;
CREATE POLICY "Admins can manage countries" ON countries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Currencies: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Everyone can read currencies" ON currencies;
CREATE POLICY "Everyone can read currencies" ON currencies
  FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage currencies" ON currencies;
CREATE POLICY "Admins can manage currencies" ON currencies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Languages: Everyone can read, only admins can write
DROP POLICY IF EXISTS "Everyone can read languages" ON languages;
CREATE POLICY "Everyone can read languages" ON languages
  FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage languages" ON languages;
CREATE POLICY "Admins can manage languages" ON languages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON admin_settings;
CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_countries_updated_at ON countries;
CREATE TRIGGER update_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_currencies_updated_at ON currencies;
CREATE TRIGGER update_currencies_updated_at
  BEFORE UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_languages_updated_at ON languages;
CREATE TRIGGER update_languages_updated_at
  BEFORE UPDATE ON languages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO admin_settings (setting_key, setting_value, setting_category, description) VALUES
  ('email_provider', '{"provider": "smtp", "server_host": "smtp.office365.com", "server_port": "587", "server_user": "hello@brevibrushes.com", "server_password": "", "from_email": "hello@brevibrushes.com", "from_name": "BREVI"}', 'email', 'Email service provider configuration'),
  ('email_templates', '{"welcome": true, "order_confirmation": true, "shipping_notification": true}', 'email', 'Email template settings'),
  ('push_notifications', '{"enabled": false, "pusher_app_id": "", "pusher_key": "", "pusher_secret": "", "pusher_cluster": "us2"}', 'push', 'Push notification configuration'),
  ('stripe', '{"enabled": false, "publishable_key": "", "secret_key": "", "webhook_secret": ""}', 'payment', 'Stripe payment gateway settings'),
  ('paypal', '{"enabled": false, "client_id": "", "client_secret": "", "mode": "sandbox"}', 'payment', 'PayPal payment gateway settings'),
  ('afterpay', '{"enabled": false, "merchant_id": "", "secret_key": "", "environment": "sandbox"}', 'payment', 'AfterPay payment gateway settings'),
  ('general', '{"site_name": "BREVI", "site_url": "https://brevibrushes.com", "maintenance_mode": false, "allow_registration": true}', 'general', 'General website settings'),
  ('base_currency', '{"code": "USD", "symbol": "$"}', 'general', 'Base currency settings'),
  ('default_language', '{"code": "en", "name": "English"}', 'general', 'Default language settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default countries
INSERT INTO countries (code, name, currency_code, currency_symbol, is_default) VALUES
  ('US', 'United States', 'USD', '$', true),
  ('GB', 'United Kingdom', 'GBP', '£', false),
  ('CA', 'Canada', 'CAD', 'C$', false),
  ('AU', 'Australia', 'AUD', 'A$', false),
  ('DE', 'Germany', 'EUR', '€', false),
  ('FR', 'France', 'EUR', '€', false),
  ('ES', 'Spain', 'EUR', '€', false),
  ('IT', 'Italy', 'EUR', '€', false),
  ('NL', 'Netherlands', 'EUR', '€', false),
  ('BE', 'Belgium', 'EUR', '€', false)
ON CONFLICT (code) DO NOTHING;

-- Insert default currencies
INSERT INTO currencies (code, name, symbol, is_base, exchange_rate) VALUES
  ('USD', 'US Dollar', '$', true, 1.0),
  ('GBP', 'British Pound', '£', false, 0.79),
  ('EUR', 'Euro', '€', false, 0.92),
  ('CAD', 'Canadian Dollar', 'C$', false, 1.35),
  ('AUD', 'Australian Dollar', 'A$', false, 1.52)
ON CONFLICT (code) DO NOTHING;

-- Insert default languages
INSERT INTO languages (code, name, native_name, is_default) VALUES
  ('en', 'English', 'English', true),
  ('es', 'Spanish', 'Español', false),
  ('fr', 'French', 'Français', false),
  ('de', 'German', 'Deutsch', false),
  ('it', 'Italian', 'Italiano', false),
  ('nl', 'Dutch', 'Nederlands', false),
  ('pt', 'Portuguese', 'Português', false)
ON CONFLICT (code) DO NOTHING;

