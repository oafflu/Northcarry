-- Add dedicated external payment tracking columns to orders for strict querying/reporting.
-- Run this in Supabase SQL editor or via your migration workflow.

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS external_payment_gateway TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS external_payment_reference TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS external_payment_status TEXT
  CHECK (external_payment_status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled'));

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS external_payment_verified_at TIMESTAMPTZ;

-- Query/index support
CREATE INDEX IF NOT EXISTS idx_orders_external_payment_gateway
  ON orders (external_payment_gateway);

CREATE INDEX IF NOT EXISTS idx_orders_external_payment_reference
  ON orders (external_payment_reference);

CREATE INDEX IF NOT EXISTS idx_orders_external_payment_status
  ON orders (external_payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_external_payment_verified_at
  ON orders (external_payment_verified_at DESC);

-- Enforce idempotency/uniqueness per gateway reference.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_gateway_reference_unique
  ON orders (external_payment_gateway, external_payment_reference)
  WHERE external_payment_reference IS NOT NULL;

-- Backfill from metadata for older rows only if metadata column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'metadata'
  ) THEN
    UPDATE orders
    SET
      external_payment_gateway = COALESCE(external_payment_gateway, metadata->>'external_gateway'),
      external_payment_reference = COALESCE(external_payment_reference, metadata->>'external_transaction_id')
    WHERE
      (metadata ? 'external_gateway' OR metadata ? 'external_transaction_id')
      AND (
        external_payment_gateway IS NULL
        OR external_payment_reference IS NULL
      );
  END IF;
END $$;

UPDATE orders
SET external_payment_status = COALESCE(external_payment_status, payment_status)
WHERE external_payment_reference IS NOT NULL
  AND external_payment_status IS NULL;

UPDATE orders
SET external_payment_verified_at = COALESCE(external_payment_verified_at, created_at)
WHERE external_payment_reference IS NOT NULL
  AND external_payment_verified_at IS NULL;

COMMENT ON COLUMN orders.external_payment_gateway IS 'External gateway key (e.g. 2checkout, kora, chipper, paystack).';
COMMENT ON COLUMN orders.external_payment_reference IS 'Gateway transaction/reference id used for verification and idempotency.';
COMMENT ON COLUMN orders.external_payment_status IS 'Payment lifecycle status reported by external provider.';
COMMENT ON COLUMN orders.external_payment_verified_at IS 'Timestamp when external payment was verified by the backend.';
