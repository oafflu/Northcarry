-- ===========================
-- FIX ORDERS RLS POLICIES FOR SUPPLIERS
-- Allow suppliers to view orders assigned to them
-- 
-- IMPORTANT: This script ONLY modifies SELECT policies.
-- It preserves all existing INSERT, UPDATE, and DELETE policies.
-- ===========================

-- Enable RLS if not already enabled (safe - won't affect existing policies)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if it exists
-- This is safe - it only affects the SELECT policy, not INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can view own orders" ON orders;

-- Create new SELECT policy that includes suppliers
-- This policy allows:
-- 1. Customers to view their own orders (existing functionality)
-- 2. Admins to view all orders (existing functionality)
-- 3. Suppliers to view orders assigned to them (NEW - this is what we're adding)
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT
  USING (
    -- Authenticated users can view their own orders
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Admins can view all orders
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Suppliers can view orders assigned to them (NEW)
    EXISTS (
      SELECT 1 FROM supplier_order_assignments
      WHERE supplier_order_assignments.order_id = orders.id
      AND supplier_order_assignments.supplier_id = auth.uid()
    )
  );

-- ===========================
-- FIX ORDER_ITEMS RLS POLICIES FOR SUPPLIERS
-- Allow suppliers to view order items for orders assigned to them
-- 
-- IMPORTANT: This script ONLY modifies SELECT policies.
-- It preserves all existing INSERT, UPDATE, and DELETE policies.
-- ===========================

-- Enable RLS if not already enabled (safe - won't affect existing policies)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy if it exists
-- This is safe - it only affects the SELECT policy, not INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

-- Create new SELECT policy that includes suppliers
-- This policy allows:
-- 1. Customers to view items from their own orders (existing functionality)
-- 2. Admins to view all order items (existing functionality)
-- 3. Suppliers to view order items for orders assigned to them (NEW)
CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT
  USING (
    -- Authenticated users can view items from their own orders
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (
        (auth.uid() IS NOT NULL AND orders.user_id = auth.uid())
        OR
        -- Admins can view all order items
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
        OR
        -- Suppliers can view order items for orders assigned to them (NEW)
        EXISTS (
          SELECT 1 FROM supplier_order_assignments
          WHERE supplier_order_assignments.order_id = orders.id
          AND supplier_order_assignments.supplier_id = auth.uid()
        )
      )
    )
  );

-- ===========================
-- VERIFICATION QUERIES
-- Run these after executing the script to verify everything works
-- ===========================

-- Check that the SELECT policy exists and includes supplier access
-- This should return 1 row showing the policy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders' 
AND policyname = 'Users can view own orders'
AND cmd = 'SELECT';

-- Check that the order_items SELECT policy exists
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'order_items' 
AND policyname = 'Users can view own order items'
AND cmd = 'SELECT';

-- Verify that all other policies are still intact
-- This should show INSERT, UPDATE, DELETE policies (if they exist)
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd, policyname;

