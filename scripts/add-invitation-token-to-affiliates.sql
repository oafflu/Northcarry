-- Add invitation_token and invitation_token_expiry columns to affiliates table
-- These columns are used for affiliate invitation functionality

ALTER TABLE affiliates
ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;

ALTER TABLE affiliates
ADD COLUMN IF NOT EXISTS invitation_token_expiry TIMESTAMPTZ;

-- Add index for faster lookups by invitation token
CREATE INDEX IF NOT EXISTS idx_affiliates_invitation_token ON affiliates(invitation_token);

