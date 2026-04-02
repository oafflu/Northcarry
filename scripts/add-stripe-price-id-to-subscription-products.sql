-- Add stripe_price_id column to subscription_products table
-- This stores the Stripe Price ID for recurring subscriptions

ALTER TABLE subscription_products
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_products_stripe_price_id 
ON subscription_products(stripe_price_id) 
WHERE stripe_price_id IS NOT NULL;

