-- Add role column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';

-- Drop existing role constraints if they exist
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;

-- Add constraint that includes all three roles
ALTER TABLE profiles ADD CONSTRAINT check_role CHECK (role IN ('customer', 'admin', 'supplier'));

-- Update admin user role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@brevibrushes.com';

