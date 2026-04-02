-- ===========================
-- EMAIL MARKETING SYSTEM
-- ===========================

-- Email Subscribers Table (if not exists from previous migrations)
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID,
  status TEXT DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- Add constraints if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_subscribers_status_check'
  ) THEN
    ALTER TABLE email_subscribers 
    ADD CONSTRAINT email_subscribers_status_check 
    CHECK (status IN ('active', 'unsubscribed', 'bounced'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_subscribers_user_id_fkey'
  ) THEN
    ALTER TABLE email_subscribers 
    ADD CONSTRAINT email_subscribers_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Customer Segments Table
CREATE TABLE IF NOT EXISTS email_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Segment conditions (JSONB for flexibility)
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Computed subscriber count (cached)
  subscriber_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing email_segments table)
DO $$ 
BEGIN
  -- Add description if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'description'
  ) THEN
    ALTER TABLE email_segments ADD COLUMN description TEXT;
  END IF;
  
  -- Add conditions if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'conditions'
  ) THEN
    ALTER TABLE email_segments ADD COLUMN conditions JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Add subscriber_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'subscriber_count'
  ) THEN
    ALTER TABLE email_segments ADD COLUMN subscriber_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add created_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE email_segments ADD COLUMN created_by UUID;
  END IF;
  
  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE email_segments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add check constraint for name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_segments_name_check'
  ) THEN
    ALTER TABLE email_segments 
    ADD CONSTRAINT email_segments_name_check 
    CHECK (char_length(name) > 0);
  END IF;
END $$;

-- Add foreign key if it doesn't exist
DO $$ 
BEGIN
  -- Only add created_by foreign key if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_segments' AND column_name = 'created_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_segments_created_by_fkey'
  ) THEN
    ALTER TABLE email_segments 
    ADD CONSTRAINT email_segments_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Email Campaigns Table
CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to_email TEXT,
  
  -- Content (can be template ID or direct HTML)
  template_id UUID,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_content TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft',
  
  -- Recipients
  recipient_type TEXT DEFAULT 'all', -- 'all', 'segment', 'custom'
  segment_id UUID,
  recipient_list JSONB, -- For custom recipient lists
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Metrics
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  -- Add recipient_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'recipient_type'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN recipient_type TEXT DEFAULT 'all';
  END IF;
  
  -- Add segment_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'segment_id'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN segment_id UUID;
  END IF;
  
  -- Add recipient_list if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'recipient_list'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN recipient_list JSONB;
  END IF;
  
  -- Add template_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN template_id UUID;
  END IF;
  
  -- Add html_content if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'html_content'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN html_content TEXT;
  END IF;
  
  -- Add preview_text if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'preview_text'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN preview_text TEXT;
  END IF;
  
  -- Add reply_to_email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'reply_to_email'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN reply_to_email TEXT;
  END IF;
  
  -- Add from_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'from_name'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN from_name TEXT;
  END IF;
  
  -- Add from_email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'from_email'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN from_email TEXT;
  END IF;
  
  -- Add delivered_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'delivered_count'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN delivered_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add bounce_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'bounce_count'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN bounce_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add unsubscribe_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'unsubscribe_count'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN unsubscribe_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add created_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE email_campaigns ADD COLUMN created_by UUID;
  END IF;
END $$;

-- Add check constraint for name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_name_check'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_name_check 
    CHECK (char_length(name) > 0);
  END IF;
END $$;

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_status_check'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_status_check 
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));
  END IF;
  
  -- Only add recipient_type constraint if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_campaigns' AND column_name = 'recipient_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_recipient_type_check'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_recipient_type_check 
    CHECK (recipient_type IN ('all', 'segment', 'custom'));
  END IF;
  
  -- Only add template_id foreign key if email_templates table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'email_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_template_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_template_id_fkey 
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
  END IF;
  
  -- Only add segment_id foreign key if email_segments table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'email_segments'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_segment_id_fkey'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_segment_id_fkey 
    FOREIGN KEY (segment_id) REFERENCES email_segments(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaigns_created_by_fkey'
  ) THEN
    ALTER TABLE email_campaigns 
    ADD CONSTRAINT email_campaigns_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Email Automations Table
CREATE TABLE IF NOT EXISTS email_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metrics
  total_sent INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  conversion_rate DECIMAL(5,2),
  
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing email_automations table)
DO $$ 
BEGIN
  -- Add description if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'description'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN description TEXT;
  END IF;
  
  -- Add trigger_config if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'trigger_config'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN trigger_config JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add is_active if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Add total_sent if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'total_sent'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN total_sent INTEGER DEFAULT 0;
  END IF;
  
  -- Add open_rate if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'open_rate'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN open_rate DECIMAL(5,2);
  END IF;
  
  -- Add click_rate if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'click_rate'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN click_rate DECIMAL(5,2);
  END IF;
  
  -- Add conversion_rate if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'conversion_rate'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN conversion_rate DECIMAL(5,2);
  END IF;
  
  -- Add created_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN created_by UUID;
  END IF;
  
  -- Add updated_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE email_automations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add check constraint for name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automations_name_check'
  ) THEN
    ALTER TABLE email_automations 
    ADD CONSTRAINT email_automations_name_check 
    CHECK (char_length(name) > 0);
  END IF;
END $$;

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automations_trigger_type_check'
  ) THEN
    ALTER TABLE email_automations 
    ADD CONSTRAINT email_automations_trigger_type_check 
    CHECK (trigger_type IN ('new_subscriber', 'abandoned_cart', 'post_purchase', 'win_back', 'birthday', 'custom'));
  END IF;
  
  -- Only add created_by foreign key if the column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automations' AND column_name = 'created_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automations_created_by_fkey'
  ) THEN
    ALTER TABLE email_automations 
    ADD CONSTRAINT email_automations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Email Automation Steps Table
CREATE TABLE IF NOT EXISTS email_automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL,
  step_order INTEGER NOT NULL,
  delay_hours INTEGER DEFAULT 0,
  
  -- Email content
  template_id UUID,
  subject TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_content TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing email_automation_steps table)
DO $$ 
BEGIN
  -- Add template_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automation_steps' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE email_automation_steps ADD COLUMN template_id UUID;
  END IF;
  
  -- Add html_content if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automation_steps' AND column_name = 'html_content'
  ) THEN
    ALTER TABLE email_automation_steps ADD COLUMN html_content TEXT;
  END IF;
  
  -- Add delay_hours if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automation_steps' AND column_name = 'delay_hours'
  ) THEN
    ALTER TABLE email_automation_steps ADD COLUMN delay_hours INTEGER DEFAULT 0;
  END IF;
  
  -- Ensure content has default if it doesn't exist or is NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automation_steps' AND column_name = 'content'
  ) THEN
    ALTER TABLE email_automation_steps ADD COLUMN content JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add check constraint for step_order if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automation_steps_order_check'
  ) THEN
    ALTER TABLE email_automation_steps 
    ADD CONSTRAINT email_automation_steps_order_check 
    CHECK (step_order > 0);
  END IF;
END $$;

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automation_steps_automation_id_fkey'
  ) THEN
    ALTER TABLE email_automation_steps 
    ADD CONSTRAINT email_automation_steps_automation_id_fkey 
    FOREIGN KEY (automation_id) REFERENCES email_automations(id) ON DELETE CASCADE;
  END IF;
  
  -- Only add template_id foreign key if the column exists and email_templates table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_automation_steps' AND column_name = 'template_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'email_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_automation_steps_template_id_fkey'
  ) THEN
    ALTER TABLE email_automation_steps 
    ADD CONSTRAINT email_automation_steps_template_id_fkey 
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Email Campaign Events (for tracking opens, clicks, etc.)
CREATE TABLE IF NOT EXISTS email_campaign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL,
  subscriber_id UUID,
  email TEXT NOT NULL,
  
  event_type TEXT NOT NULL,
  event_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaign_events_campaign_id_fkey'
  ) THEN
    ALTER TABLE email_campaign_events 
    ADD CONSTRAINT email_campaign_events_campaign_id_fkey 
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaign_events_subscriber_id_fkey'
  ) THEN
    ALTER TABLE email_campaign_events 
    ADD CONSTRAINT email_campaign_events_subscriber_id_fkey 
    FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_campaign_events_event_type_check'
  ) THEN
    ALTER TABLE email_campaign_events 
    ADD CONSTRAINT email_campaign_events_event_type_check 
    CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_status ON email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_user_id ON email_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_email_segments_created_by ON email_segments(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_template_id ON email_campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_segment_id ON email_campaigns(segment_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled_at ON email_campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_automations_is_active ON email_automations(is_active);
CREATE INDEX IF NOT EXISTS idx_email_automations_trigger_type ON email_automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_email_automation_steps_automation_id ON email_automation_steps(automation_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_campaign_id ON email_campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_event_type ON email_campaign_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_subscriber_id ON email_campaign_events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_events_created_at ON email_campaign_events(created_at);

-- Enable RLS
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_subscribers
DROP POLICY IF EXISTS "Admins can manage email subscribers" ON email_subscribers;
CREATE POLICY "Admins can manage email subscribers" ON email_subscribers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_segments
DROP POLICY IF EXISTS "Admins can manage email segments" ON email_segments;
CREATE POLICY "Admins can manage email segments" ON email_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_campaigns
DROP POLICY IF EXISTS "Admins can manage email campaigns" ON email_campaigns;
CREATE POLICY "Admins can manage email campaigns" ON email_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_automations
DROP POLICY IF EXISTS "Admins can manage email automations" ON email_automations;
CREATE POLICY "Admins can manage email automations" ON email_automations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_automation_steps
DROP POLICY IF EXISTS "Admins can manage automation steps" ON email_automation_steps;
CREATE POLICY "Admins can manage automation steps" ON email_automation_steps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_campaign_events
DROP POLICY IF EXISTS "Admins can view campaign events" ON email_campaign_events;
CREATE POLICY "Admins can view campaign events" ON email_campaign_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Functions to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_email_segments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_email_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_email_automations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if exists and recreate
DROP TRIGGER IF EXISTS update_email_segments_updated_at ON email_segments;
CREATE TRIGGER update_email_segments_updated_at
  BEFORE UPDATE ON email_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_email_segments_updated_at();

DROP TRIGGER IF EXISTS update_email_campaigns_updated_at ON email_campaigns;
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_email_campaigns_updated_at();

DROP TRIGGER IF EXISTS update_email_automations_updated_at ON email_automations;
CREATE TRIGGER update_email_automations_updated_at
  BEFORE UPDATE ON email_automations
  FOR EACH ROW
  EXECUTE FUNCTION update_email_automations_updated_at();

