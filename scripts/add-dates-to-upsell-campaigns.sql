-- Add start and end date columns to upsell_campaigns table
ALTER TABLE upsell_campaigns
ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

