-- ===========================
-- CMS TEMPLATE SYSTEM
-- ===========================

-- Page Templates (Home, Product, etc.)
CREATE TABLE IF NOT EXISTS cms_page_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_type TEXT NOT NULL, -- 'home', 'product', 'cart', 'checkout'
  template_name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(page_type, template_name)
);

-- Template Sections (Individual sections within a page template)
CREATE TABLE IF NOT EXISTS cms_template_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES cms_page_templates(id) ON DELETE CASCADE NOT NULL,
  section_type TEXT NOT NULL, -- 'hero', 'features', 'product_showcase', 'reviews', etc.
  section_order INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- Section configuration (JSONB for flexibility)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Section content (JSONB for rich content)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  
  -- Note: No UNIQUE constraint on (template_id, section_type) to allow multiple instances of the same section type
  -- This allows admins to reuse sections like "Image + Text" multiple times in a template
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cms_page_templates_page_type ON cms_page_templates(page_type);
CREATE INDEX IF NOT EXISTS idx_cms_page_templates_active ON cms_page_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_cms_template_sections_template_id ON cms_template_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_cms_template_sections_order ON cms_template_sections(template_id, section_order);

-- Enable RLS
ALTER TABLE cms_page_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_template_sections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cms_page_templates
-- Admins can manage all templates
DROP POLICY IF EXISTS "Admins can manage page templates" ON cms_page_templates;
CREATE POLICY "Admins can manage page templates" ON cms_page_templates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view active templates
DROP POLICY IF EXISTS "Everyone can view active templates" ON cms_page_templates;
CREATE POLICY "Everyone can view active templates" ON cms_page_templates
  FOR SELECT
  USING (is_active = TRUE);

-- RLS Policies for cms_template_sections
-- Admins can manage all sections
DROP POLICY IF EXISTS "Admins can manage template sections" ON cms_template_sections;
CREATE POLICY "Admins can manage template sections" ON cms_template_sections
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Everyone can view sections of active templates
DROP POLICY IF EXISTS "Everyone can view sections of active templates" ON cms_template_sections;
CREATE POLICY "Everyone can view sections of active templates" ON cms_template_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cms_page_templates
      WHERE id = cms_template_sections.template_id
      AND is_active = TRUE
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cms_page_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cms_page_templates_updated_at
  BEFORE UPDATE ON cms_page_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_cms_page_templates_updated_at();

CREATE OR REPLACE FUNCTION update_cms_template_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cms_template_sections_updated_at
  BEFORE UPDATE ON cms_template_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_cms_template_sections_updated_at();

-- Insert default home page template
INSERT INTO cms_page_templates (page_type, template_name, is_active)
VALUES ('home', 'Default', TRUE)
ON CONFLICT (page_type, template_name) DO NOTHING;

-- Insert default product page template
INSERT INTO cms_page_templates (page_type, template_name, is_active)
VALUES ('product', 'Default', TRUE)
ON CONFLICT (page_type, template_name) DO NOTHING;

-- Get the template IDs for inserting default sections
DO $$
DECLARE
  home_template_id UUID;
  product_template_id UUID;
BEGIN
  SELECT id INTO home_template_id FROM cms_page_templates WHERE page_type = 'home' AND template_name = 'Default';
  SELECT id INTO product_template_id FROM cms_page_templates WHERE page_type = 'product' AND template_name = 'Default';
  
  -- Default home page sections
  IF home_template_id IS NOT NULL THEN
    INSERT INTO cms_template_sections (template_id, section_type, section_order, is_enabled, config, content)
    VALUES
      (home_template_id, 'hero', 1, TRUE, 
       '{"height": "600px", "overlay": true}'::jsonb,
       '{"title": "", "subtitle": "", "buttonText": "Shop Now", "buttonLink": "/product", "image": "/images/brevi_banner_web.png"}'::jsonb),
      (home_template_id, 'features', 2, TRUE,
       '{"columns": 4, "layout": "grid"}'::jsonb,
       '{"items": [{"icon": "Award", "title": "Premium Quality"}, {"icon": "Wallet", "title": "Wallet Friendly"}, {"icon": "Leaf", "title": "Eco Safe"}, {"icon": "Heart", "title": "Organic"}]}'::jsonb),
      (home_template_id, 'product_showcase', 3, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (home_template_id, 'reviews', 4, TRUE,
       '{}'::jsonb,
       '{}'::jsonb)
    ON CONFLICT (template_id, section_type) DO NOTHING;
  END IF;
  
  -- Default product page sections
  IF product_template_id IS NOT NULL THEN
    INSERT INTO cms_template_sections (template_id, section_type, section_order, is_enabled, config, content)
    VALUES
      (product_template_id, 'product_hero', 1, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (product_template_id, 'product_features', 2, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (product_template_id, 'bristles_section', 3, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (product_template_id, 'brush_section', 4, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (product_template_id, 'confidence_section', 5, TRUE,
       '{}'::jsonb,
       '{}'::jsonb),
      (product_template_id, 'reviews', 6, TRUE,
       '{}'::jsonb,
       '{}'::jsonb)
    ON CONFLICT (template_id, section_type) DO NOTHING;
  END IF;
END $$;

