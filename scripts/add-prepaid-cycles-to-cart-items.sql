-- Add explicit prepaid cycle count to cart items.
-- Frequency (frequency_months) remains delivery interval only.
ALTER TABLE cart_items
ADD COLUMN IF NOT EXISTS prepaid_cycles INTEGER;

-- Default to one prepaid cycle when missing.
UPDATE cart_items
SET prepaid_cycles = 1
WHERE prepaid_cycles IS NULL;

ALTER TABLE cart_items
ALTER COLUMN prepaid_cycles SET DEFAULT 1;

-- Keep data safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cart_items_prepaid_cycles_check'
  ) THEN
    ALTER TABLE cart_items
    ADD CONSTRAINT cart_items_prepaid_cycles_check
    CHECK (prepaid_cycles IS NULL OR prepaid_cycles >= 1);
  END IF;
END $$;
