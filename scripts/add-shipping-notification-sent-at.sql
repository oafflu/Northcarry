-- Records when the customer received the transactional "order shipped" email.
-- Used to avoid duplicate sends and to target "pending" notifications after backfills.
-- Run in Supabase SQL Editor once before using admin "Send pending shipping emails".

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_notification_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.shipping_notification_sent_at IS 'When the shipping notification email was sent to the customer (if tracked).';

CREATE INDEX IF NOT EXISTS idx_orders_shipping_notification_sent_at
  ON orders (shipping_notification_sent_at)
  WHERE shipping_notification_sent_at IS NULL;
