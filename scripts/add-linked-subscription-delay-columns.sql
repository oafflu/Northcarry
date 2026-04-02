-- Add delay columns to linked_subscriptions table
-- This allows subscriptions to start after a delay (e.g., 2-3 months)
-- and billing to occur X days before delivery

ALTER TABLE linked_subscriptions
ADD COLUMN IF NOT EXISTS start_after_months INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS billing_days_before_delivery INTEGER DEFAULT 15;

-- Update existing records to have default values
UPDATE linked_subscriptions
SET 
  start_after_months = 2,
  billing_days_before_delivery = 15
WHERE start_after_months IS NULL OR billing_days_before_delivery IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN linked_subscriptions.start_after_months IS 'Start subscription after X months (e.g., 2 or 3 months for products that come with initial supply)';
COMMENT ON COLUMN linked_subscriptions.billing_days_before_delivery IS 'Bill X days before delivery (default: 15 days)';

