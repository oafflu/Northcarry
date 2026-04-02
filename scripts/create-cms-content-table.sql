-- ===========================
-- CMS CONTENT TABLE
-- For storing general CMS content (menu, topbar, footer, etc.)
-- ===========================

CREATE TABLE IF NOT EXISTS cms_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section TEXT UNIQUE NOT NULL, -- 'menu', 'topbar', 'footer', etc.
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cms_content_section ON cms_content(section);

-- Enable RLS
ALTER TABLE cms_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can manage all CMS content
DROP POLICY IF EXISTS "Admins can manage CMS content" ON cms_content;
CREATE POLICY "Admins can manage CMS content" ON cms_content
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view CMS content
DROP POLICY IF EXISTS "Everyone can view CMS content" ON cms_content;
CREATE POLICY "Everyone can view CMS content" ON cms_content
  FOR SELECT
  USING (TRUE);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cms_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cms_content_updated_at
  BEFORE UPDATE ON cms_content
  FOR EACH ROW
  EXECUTE FUNCTION update_cms_content_updated_at();

