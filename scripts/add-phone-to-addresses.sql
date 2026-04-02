-- Add phone column to addresses table
ALTER TABLE addresses
ADD COLUMN IF NOT EXISTS phone TEXT;

