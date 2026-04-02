-- Add purchase_type column to order_items table
-- This allows tracking whether an order item is a one-time purchase, subscription, or prepaid subscription

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS purchase_type TEXT CHECK (purchase_type IN ('one-time', 'subscription', 'prepaid')) DEFAULT 'one-time';

-- Add index for purchase type queries
CREATE INDEX IF NOT EXISTS idx_order_items_purchase_type ON order_items(purchase_type) WHERE purchase_type IS NOT NULL;

-- Update existing order_items to have 'one-time' as default
UPDATE order_items
SET purchase_type = 'one-time'
WHERE purchase_type IS NULL;

