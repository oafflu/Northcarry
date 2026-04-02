-- Add PayPal support to incomplete_payments table
-- This allows tracking incomplete PayPal orders alongside Stripe payments

-- Add PayPal-specific fields
ALTER TABLE incomplete_payments 
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'paypal'));

-- Create unique index for PayPal order IDs (separate from Stripe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_incomplete_payments_paypal_order_id 
ON incomplete_payments(paypal_order_id) 
WHERE paypal_order_id IS NOT NULL;

-- Update the existing unique constraint to allow both Stripe and PayPal
-- We'll handle uniqueness at the application level since we can't have
-- a single unique constraint that works for both payment methods

-- Add index for payment method filtering
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_payment_method 
ON incomplete_payments(payment_method);

-- Add index for PayPal order lookups
CREATE INDEX IF NOT EXISTS idx_incomplete_payments_paypal_order 
ON incomplete_payments(paypal_order_id) 
WHERE paypal_order_id IS NOT NULL;

