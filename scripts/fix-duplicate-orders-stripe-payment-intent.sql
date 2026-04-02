-- Fix duplicate stripe_payment_intent_id then add unique index.
-- Run the ENTIRE script in one go in Supabase SQL Editor.

-- 1) Clear stripe_payment_intent_id on duplicate orders (keep earliest order per payment intent)
UPDATE orders o
SET stripe_payment_intent_id = NULL
WHERE o.stripe_payment_intent_id IS NOT NULL
  AND o.id <> (
    SELECT o2.id
    FROM orders o2
    WHERE o2.stripe_payment_intent_id = o.stripe_payment_intent_id
    ORDER BY o2.created_at ASC
    LIMIT 1
  );

-- 2) Create unique index (prevents future duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_unique
  ON orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
