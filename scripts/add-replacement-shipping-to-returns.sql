-- Add replacement shipping fields to returns table
-- All returns are treated as replacements according to policy

ALTER TABLE returns
ADD COLUMN IF NOT EXISTS replacement_tracking_number TEXT,
ADD COLUMN IF NOT EXISTS replacement_carrier TEXT,
ADD COLUMN IF NOT EXISTS replacement_shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requested_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS requested_by_partner BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_returns_replacement_shipped_at ON returns(replacement_shipped_at);
CREATE INDEX IF NOT EXISTS idx_returns_requested_by_admin ON returns(requested_by_admin);
CREATE INDEX IF NOT EXISTS idx_returns_requested_by_partner ON returns(requested_by_partner);

