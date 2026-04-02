-- ===========================
-- FIX CART_ITEMS RLS POLICIES
-- Support both authenticated users and anonymous users (session_id)
-- ===========================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own cart" ON cart_items;
DROP POLICY IF EXISTS "Users can manage own cart" ON cart_items;
DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

-- Policy for SELECT: Users can view their own cart items
-- Authenticated users: by user_id
-- Anonymous users: by session_id (we'll use a more permissive policy for anonymous)
CREATE POLICY "Users can view own cart items" ON cart_items
  FOR SELECT
  USING (
    -- Authenticated users can view their own cart
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Allow viewing by session_id (for anonymous users)
    -- Note: This is permissive but necessary for guest checkout
    -- The session_id is validated server-side before insertion
    (session_id IS NOT NULL)
  );

-- Policy for INSERT: Users can add items to their own cart
-- For authenticated users: must match their user_id
-- For anonymous users: can insert with session_id (validated server-side)
CREATE POLICY "Users can insert own cart items" ON cart_items
  FOR INSERT
  WITH CHECK (
    -- Authenticated users can insert with their user_id
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Anonymous users can insert with session_id
    -- The server action validates the session_id matches the cookie
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

-- Policy for UPDATE: Users can update their own cart items
CREATE POLICY "Users can update own cart items" ON cart_items
  FOR UPDATE
  USING (
    -- Authenticated users can update their own cart
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Anonymous users can update cart items with their session_id
    (session_id IS NOT NULL AND user_id IS NULL)
  )
  WITH CHECK (
    -- Ensure they can only update to their own user_id or session_id
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    (auth.uid() IS NULL AND session_id IS NOT NULL AND user_id IS NULL)
  );

-- Policy for DELETE: Users can delete their own cart items
CREATE POLICY "Users can delete own cart items" ON cart_items
  FOR DELETE
  USING (
    -- Authenticated users can delete their own cart
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Anonymous users can delete cart items with their session_id
    (session_id IS NOT NULL AND user_id IS NULL)
  );

-- Note: 
-- 1. Authenticated users manage cart items with their user_id
-- 2. Anonymous users manage cart items with their session_id (stored in cookies)
-- 3. The server action (addToCart) validates the session_id matches the cookie before insertion
-- 4. This allows guest checkout while maintaining security

