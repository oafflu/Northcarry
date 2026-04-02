-- ===========================
-- SYSTEM LOGS TABLE
-- ===========================
-- Comprehensive logging system for all user actions

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User Information
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT CHECK (user_role IN ('admin', 'supplier', 'marketer', 'partner', 'customer')),
  user_name TEXT, -- Full name or company name
  
  -- Action Details
  action_type TEXT NOT NULL, -- e.g., 'order_created', 'product_updated', 'customer_deleted'
  action_category TEXT NOT NULL CHECK (action_category IN (
    'order_management',
    'customer_management',
    'product_management',
    'inventory_management',
    'cms',
    'support',
    'media_library',
    'settings',
    'subscriptions',
    'email_marketing',
    'authentication',
    'other'
  )),
  action_description TEXT NOT NULL, -- Human-readable description
  action_details JSONB, -- Additional context (before/after values, IDs, etc.)
  
  -- Resource Information
  resource_type TEXT, -- e.g., 'order', 'product', 'customer'
  resource_id UUID, -- ID of the affected resource
  resource_name TEXT, -- Name/title of the affected resource
  
  -- Request Information
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Request Details
  request_method TEXT, -- GET, POST, PUT, DELETE, etc.
  request_path TEXT,
  request_query JSONB,
  
  -- Status
  status TEXT CHECK (status IN ('success', 'error', 'warning')) DEFAULT 'success',
  error_message TEXT,
  error_stack TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_role ON system_logs(user_role);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_category ON system_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_type ON system_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_resource_type ON system_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_resource_id ON system_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_ip_address ON system_logs(ip_address);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_system_logs_category_date ON system_logs(action_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_date ON system_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_role_date ON system_logs(user_role, created_at DESC);

-- Full-text search index for action_description
CREATE INDEX IF NOT EXISTS idx_system_logs_description_search ON system_logs USING gin(to_tsvector('english', action_description));

-- Comments for documentation
COMMENT ON TABLE system_logs IS 'Comprehensive system activity log for all user actions';
COMMENT ON COLUMN system_logs.action_details IS 'JSONB object containing before/after values, metadata, and additional context';
COMMENT ON COLUMN system_logs.resource_id IS 'UUID of the affected resource (order, product, customer, etc.)';
COMMENT ON COLUMN system_logs.ip_address IS 'IP address of the user who performed the action';
COMMENT ON COLUMN system_logs.latitude IS 'Geographic latitude of the user location';
COMMENT ON COLUMN system_logs.longitude IS 'Geographic longitude of the user location';
