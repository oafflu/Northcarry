-- Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  status TEXT CHECK (status IN ('active', 'unsubscribed', 'bounced')) DEFAULT 'active',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'website', -- 'website', 'checkout', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscriptions(status);

-- RLS Policies
ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON newsletter_subscriptions;
DROP POLICY IF EXISTS "Admins can view all newsletter subscriptions" ON newsletter_subscriptions;
DROP POLICY IF EXISTS "Admins can update newsletter subscriptions" ON newsletter_subscriptions;
DROP POLICY IF EXISTS "Admins can delete newsletter subscriptions" ON newsletter_subscriptions;

-- Anyone can subscribe (for public form)
CREATE POLICY "Anyone can subscribe to newsletter"
  ON newsletter_subscriptions
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all newsletter subscriptions"
  ON newsletter_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update subscriptions
CREATE POLICY "Admins can update newsletter subscriptions"
  ON newsletter_subscriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete subscriptions
CREATE POLICY "Admins can delete newsletter subscriptions"
  ON newsletter_subscriptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('new', 'read', 'replied', 'archived')) DEFAULT 'new',
  admin_notes TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for contact messages
CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at DESC);

-- RLS Policies for contact messages
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can view all contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can update contact messages" ON contact_messages;

-- Anyone can submit contact messages
CREATE POLICY "Anyone can submit contact messages"
  ON contact_messages
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Admins can view all contact messages
CREATE POLICY "Admins can view all contact messages"
  ON contact_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update contact messages
CREATE POLICY "Admins can update contact messages"
  ON contact_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

