-- ===========================
-- FIX ORDERS RLS POLICIES
-- Allow order creation for both authenticated and anonymous users
-- ===========================

-- Enable RLS if not already enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;

-- Policy for SELECT: Users can view their own orders
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
  );

-- Policy for INSERT: Allow order creation (for both authenticated and anonymous users)
-- This is handled server-side via admin client, but we add this policy as a safety net
-- Note: Server actions use admin client to bypass RLS, but this policy allows direct inserts if needed
CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy for UPDATE: Users can update their own orders (for status changes, etc.)
CREATE POLICY "Users can update own orders" ON orders
  FOR UPDATE
  USING (
    -- Authenticated users can update their own orders
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Admins can update all orders
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for DELETE: Only admins can delete orders
CREATE POLICY "Admins can delete orders" ON orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ===========================
-- FIX ORDER_ITEMS RLS POLICIES
-- ===========================

-- Enable RLS if not already enabled
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
DROP POLICY IF EXISTS "Anyone can create order items" ON order_items;
DROP POLICY IF EXISTS "Admins can manage all order items" ON order_items;

-- Policy for SELECT: Users can view items from their own orders
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
      )
    )
  );

-- Policy for INSERT: Allow order item creation
CREATE POLICY "Anyone can create order items" ON order_items
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy for UPDATE/DELETE: Only admins can modify order items
CREATE POLICY "Admins can manage all order items" ON order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

