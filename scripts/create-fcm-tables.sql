-- FCM Device Tokens Table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('web', 'ios', 'android')) DEFAULT 'web',
  browser_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active) WHERE is_active = true;

-- Notification Log Table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token_id UUID REFERENCES fcm_tokens(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL, -- 'order_confirmed', 'order_shipped', 'low_stock', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status TEXT CHECK (status IN ('sent', 'failed', 'clicked')) DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  related_entity_type TEXT, -- 'order', 'product', 'support_ticket'
  related_entity_id TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  order_updates BOOLEAN DEFAULT true,
  shipping_updates BOOLEAN DEFAULT true,
  promotional BOOLEAN DEFAULT true,
  low_stock_alerts BOOLEAN DEFAULT true, -- For admins/suppliers
  new_orders BOOLEAN DEFAULT true, -- For admins/suppliers
  support_tickets BOOLEAN DEFAULT true, -- For admins
  review_posted BOOLEAN DEFAULT true, -- For admins
  abandoned_cart BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create preferences for new users.
-- SECURITY DEFINER required: trigger runs in auth context; notification_preferences has RLS
-- with no INSERT policy for that context, so without DEFINER the insert fails and Auth
-- returns "Database error creating new user".
CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- RLS Policies
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own tokens" ON fcm_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON fcm_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON fcm_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON fcm_tokens;
DROP POLICY IF EXISTS "Users can view own notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Admins can view all notification logs" ON notification_logs;
DROP POLICY IF EXISTS "Users can view own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON notification_preferences;

-- FCM Tokens Policies
CREATE POLICY "Users can view own tokens"
  ON fcm_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON fcm_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON fcm_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON fcm_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Notification Logs Policies
CREATE POLICY "Users can view own notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification logs"
  ON notification_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Notification Preferences Policies
CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to cleanup old inactive tokens (optional)
CREATE OR REPLACE FUNCTION cleanup_inactive_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM fcm_tokens
  WHERE is_active = false
  AND updated_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
