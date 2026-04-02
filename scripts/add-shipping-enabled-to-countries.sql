-- Add shipping_enabled flag to countries table to control availability in checkout and address forms
ALTER TABLE countries
ADD COLUMN IF NOT EXISTS shipping_enabled BOOLEAN DEFAULT TRUE;

-- Optional: ensure active countries without explicit flag remain enabled
UPDATE countries SET shipping_enabled = TRUE WHERE shipping_enabled IS NULL;

