-- Add subscription metadata columns to cart_items table
-- This allows storing subscription purchase type, frequency, and other metadata

ALTER TABLE cart_items
ADD COLUMN IF NOT EXISTS purchase_type TEXT CHECK (purchase_type IN ('one-time', 'subscription', 'prepaid')),
ADD COLUMN IF NOT EXISTS subscription_product_id UUID REFERENCES subscription_products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS frequency_months INTEGER,
ADD COLUMN IF NOT EXISTS shipping_days INTEGER;

-- Add index for subscription queries
CREATE INDEX IF NOT EXISTS idx_cart_items_subscription_product_id ON cart_items(subscription_product_id) WHERE subscription_product_id IS NOT NULL;

-- Update unique constraints to allow same variant with different purchase types
-- Remove old unique constraints
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_variant_id_key;
ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_session_id_variant_id_key;

-- Add new unique constraints that include purchase_type
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_variant_purchase_unique 
  ON cart_items(user_id, variant_id, COALESCE(purchase_type, 'one-time')) 
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_session_variant_purchase_unique 
  ON cart_items(session_id, variant_id, COALESCE(purchase_type, 'one-time')) 
  WHERE session_id IS NOT NULL;

