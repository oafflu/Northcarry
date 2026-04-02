-- Checkout snapshots: persist cart + address keyed by payment_intent_id so we can
-- recover full orders (items + address) when payment succeeds but createOrder never ran,
-- or when admin recovers from incomplete_payments.
-- Snapshots are saved when createPaymentIntent runs; cleared when createOrder succeeds or after recovery.

CREATE TABLE IF NOT EXISTS checkout_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_intent_id TEXT NOT NULL UNIQUE,
  order_number TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_snapshots_payment_intent_id ON checkout_snapshots(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_checkout_snapshots_created_at ON checkout_snapshots(created_at);

COMMENT ON TABLE checkout_snapshots IS 'Stores cart + address snapshot when PaymentIntent is created so recovery and webhook can create full orders if createOrder never runs.';
