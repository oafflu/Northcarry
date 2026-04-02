-- Add subscription frequency and prepaid cycles to order_items
-- Used by manual orders and subscription order items

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS frequency_months INTEGER,
ADD COLUMN IF NOT EXISTS prepaid_cycles_remaining INTEGER;

CREATE INDEX IF NOT EXISTS idx_order_items_frequency_months ON order_items(frequency_months) WHERE frequency_months IS NOT NULL;
