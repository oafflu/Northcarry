-- Verify incomplete_payments table exists and check structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'incomplete_payments'
ORDER BY ordinal_position;

-- Check if unique constraint exists
SELECT 
  conname AS constraint_name,
  contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'incomplete_payments'::regclass
AND conname = 'incomplete_payments_stripe_payment_intent_id_key';

-- Check if policies exist
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'incomplete_payments';

-- Count existing records (if any)
SELECT COUNT(*) as total_incomplete_payments FROM incomplete_payments;

