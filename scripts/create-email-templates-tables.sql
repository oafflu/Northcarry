-- ===========================
-- EMAIL TEMPLATES SYSTEM
-- ===========================

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'marketing',
  subject TEXT,
  preview_text TEXT,
  
  -- Template content (project JSON for future use)
  project_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Raw HTML (for imported templates)
  html_content TEXT,
  
  -- Template metadata
  thumbnail_url TEXT,
  description TEXT,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Import metadata
  imported_from TEXT, -- 'klaviyo', 'manual', 'code_editor', etc.
  original_template_id TEXT, -- ID from source system if imported
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE, -- For sharing templates
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for category if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_templates_category_check'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_category_check 
    CHECK (category IN ('transactional', 'marketing', 'promotional', 'newsletter', 'automation'));
  END IF;
END $$;

-- Add check constraint for name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_templates_name_check'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_name_check 
    CHECK (char_length(name) > 0);
  END IF;
END $$;

-- Add foreign key constraint for created_by if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_templates_created_by_fkey'
  ) THEN
    ALTER TABLE email_templates 
    ADD CONSTRAINT email_templates_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Email Template Assets Table (for uploaded images/files)
CREATE TABLE IF NOT EXISTS email_template_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID,
  
  -- Asset info
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'file', etc.
  file_size INTEGER, -- in bytes
  
  -- Storage info
  storage_path TEXT, -- Path in Supabase Storage
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_template_assets_template_id_fkey'
  ) THEN
    ALTER TABLE email_template_assets 
    ADD CONSTRAINT email_template_assets_template_id_fkey 
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Email Template Variables Table (for dynamic content)
CREATE TABLE IF NOT EXISTS email_template_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID,
  
  variable_name TEXT NOT NULL,
  variable_type TEXT DEFAULT 'text',
  default_value TEXT,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add check constraint for variable_type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_template_variables_variable_type_check'
  ) THEN
    ALTER TABLE email_template_variables 
    ADD CONSTRAINT email_template_variables_variable_type_check 
    CHECK (variable_type IN ('text', 'image', 'url', 'color', 'number'));
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_template_variables_template_id_fkey'
  ) THEN
    ALTER TABLE email_template_variables 
    ADD CONSTRAINT email_template_variables_template_id_fkey 
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_template_variables_template_id_variable_name_key'
  ) THEN
    ALTER TABLE email_template_variables 
    ADD CONSTRAINT email_template_variables_template_id_variable_name_key 
    UNIQUE(template_id, variable_name);
  END IF;
END $$;

-- Indexes (using IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_imported_from ON email_templates(imported_from);
CREATE INDEX IF NOT EXISTS idx_email_template_assets_template_id ON email_template_assets(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_variables_template_id ON email_template_variables(template_id);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_templates
DROP POLICY IF EXISTS "Admins can view all email templates" ON email_templates;
CREATE POLICY "Admins can view all email templates" ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert email templates" ON email_templates;
CREATE POLICY "Admins can insert email templates" ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update email templates" ON email_templates;
CREATE POLICY "Admins can update email templates" ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete email templates" ON email_templates;
CREATE POLICY "Admins can delete email templates" ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_template_assets
DROP POLICY IF EXISTS "Admins can manage template assets" ON email_template_assets;
CREATE POLICY "Admins can manage template assets" ON email_template_assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_template_variables
DROP POLICY IF EXISTS "Admins can manage template variables" ON email_template_variables;
CREATE POLICY "Admins can manage template variables" ON email_template_variables
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

