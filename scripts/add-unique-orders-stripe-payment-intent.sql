-- Prevent duplicate orders for the same Stripe payment.
-- One payment intent must map to at most one order (race between createOrder and webhook
-- or double submit can otherwise create two orders).
--
-- If you get "Key (stripe_payment_intent_id)=(pi_xxx) is duplicated", run
--   scripts/fix-duplicate-orders-stripe-payment-intent.sql
-- first (it clears the duplicate PI id on extra orders, then creates this index).

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_unique
  ON orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
