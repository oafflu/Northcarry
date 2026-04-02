-- ===========================
-- ADD UPDATE POLICY FOR RETURNS TABLE
-- ===========================
-- This script adds RLS policies to allow suppliers to update returns
-- that they have access to (via supplier_id, order assignment, or product link)

-- Add UPDATE policy for suppliers
DROP POLICY IF EXISTS "Suppliers can update their returns" ON returns;
CREATE POLICY "Suppliers can update their returns" 
  ON returns FOR UPDATE 
  USING (
    -- Supplier owns the return
    supplier_id = auth.uid() OR
    -- Or order is assigned to supplier
    EXISTS (
      SELECT 1 FROM supplier_order_assignments 
      WHERE order_id = returns.order_id 
      AND supplier_id = auth.uid()
    ) OR
    -- Or order item variant is linked to supplier
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN product_supplier_links psl ON oi.variant_id = psl.variant_id
      WHERE oi.id = returns.order_item_id
      AND psl.supplier_id = auth.uid()
      AND psl.is_primary_supplier = true
    ) OR
    -- Admins can always update
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    -- Same conditions for the updated row
    supplier_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM supplier_order_assignments 
      WHERE order_id = returns.order_id 
      AND supplier_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM order_items oi
      JOIN product_supplier_links psl ON oi.variant_id = psl.variant_id
      WHERE oi.id = returns.order_item_id
      AND psl.supplier_id = auth.uid()
      AND psl.is_primary_supplier = true
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Also allow customers to update their own returns (for status changes like return_shipped)
DROP POLICY IF EXISTS "Customers can update their returns" ON returns;
CREATE POLICY "Customers can update their returns" 
  ON returns FOR UPDATE 
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
