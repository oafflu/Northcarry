-- Fix role constraint to include 'supplier'
-- This script updates the profiles table to allow 'supplier' as a valid role

-- Drop existing role constraints (they might have different names)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;

-- Add the updated constraint that includes 'supplier'
ALTER TABLE profiles ADD CONSTRAINT check_role CHECK (role IN ('customer', 'admin', 'supplier'));

-- Verify the constraint was added
-- You can check with: SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'profiles'::regclass AND conname = 'check_role';

