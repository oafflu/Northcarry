-- Track when payment-link email is sent to customers.
-- Run once in Supabase SQL editor.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_link_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.payment_link_email_sent_at IS
  'When the payment link email was sent to the customer.';

CREATE INDEX IF NOT EXISTS idx_orders_payment_link_email_sent_at
  ON orders (payment_link_email_sent_at)
  WHERE payment_link_email_sent_at IS NULL;
