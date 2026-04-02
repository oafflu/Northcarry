-- ===========================
-- REVIEW REQUESTS TABLE
-- ===========================
-- Tracks review request emails sent to customers
-- Used by the review request automation system

CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT, -- 'already_reviewed', 'no_email', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_review_requests_order_id ON review_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_user_id ON review_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent ON review_requests(sent);
CREATE INDEX IF NOT EXISTS idx_review_requests_created_at ON review_requests(created_at);

-- RLS Policies
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage review requests" ON review_requests;
CREATE POLICY "Admins can manage review requests"
ON review_requests FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_review_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_review_requests_updated_at ON review_requests;
CREATE TRIGGER update_review_requests_updated_at
  BEFORE UPDATE ON review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_review_requests_updated_at();

