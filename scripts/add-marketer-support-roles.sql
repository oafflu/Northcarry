-- Add 'marketer' and 'support' roles to profiles table
-- This script updates the role constraint to include the new roles

-- Drop existing role constraints if they exist
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;

-- Add the updated constraint that includes all roles
ALTER TABLE profiles ADD CONSTRAINT check_role CHECK (role IN ('customer', 'admin', 'supplier', 'marketer', 'support'));

-- Verify the constraint was added
-- You can check with: SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'profiles'::regclass AND conname = 'check_role';

