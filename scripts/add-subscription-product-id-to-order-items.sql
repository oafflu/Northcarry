-- Add subscription_product_id column to order_items table
-- This allows tracking which subscription product an order item belongs to

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS subscription_product_id UUID REFERENCES subscription_products(id) ON DELETE SET NULL;

-- Add index for subscription queries
CREATE INDEX IF NOT EXISTS idx_order_items_subscription_product_id ON order_items(subscription_product_id) WHERE subscription_product_id IS NOT NULL;

