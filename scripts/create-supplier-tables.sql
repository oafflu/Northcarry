-- ===========================
-- SUPPLIER MANAGEMENT SYSTEM
-- Database Schema
-- ===========================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- UPDATE PROFILES TABLE
-- ===========================

-- Add role column to profiles (if not exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE profiles ADD CONSTRAINT check_role CHECK (role IN ('customer', 'admin', 'supplier'));

-- Add supplier-specific fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_address JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ===========================
-- SUPPLIER TABLES
-- ===========================

-- Supplier Inventory (Master inventory managed by supplier)
CREATE TABLE IF NOT EXISTS supplier_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Product identification
  sku TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  -- Inventory tracking
  quantity_available INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0, -- Reserved for pending orders
  quantity_committed INTEGER DEFAULT 0, -- Committed to orders
  reorder_point INTEGER DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  
  -- Cost information (visible only to supplier)
  cost_price DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2), -- Per unit manufacturing cost
  
  -- Physical attributes
  weight DECIMAL(10,2), -- in kg
  dimensions JSONB, -- {length, width, height}
  
  -- Status
  status TEXT CHECK (status IN ('active', 'inactive', 'discontinued')) DEFAULT 'active',
  
  -- Metadata
  supplier_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link between Admin Products and Supplier Inventory
CREATE TABLE IF NOT EXISTS product_supplier_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Admin side
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Supplier side
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_inventory_id UUID REFERENCES supplier_inventory(id) ON DELETE CASCADE,
  
  -- Linking configuration
  is_primary_supplier BOOLEAN DEFAULT TRUE,
  lead_time_days INTEGER DEFAULT 3, -- How long to fulfill
  minimum_order_quantity INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(variant_id, supplier_id)
);

-- Supplier Inventory Transactions (Audit trail)
CREATE TABLE IF NOT EXISTS supplier_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_inventory_id UUID REFERENCES supplier_inventory(id) ON DELETE CASCADE,
  
  transaction_type TEXT CHECK (transaction_type IN (
    'restock', 
    'sale', 
    'return', 
    'adjustment', 
    'damage', 
    'reserved', 
    'released'
  )) NOT NULL,
  
  quantity_change INTEGER NOT NULL, -- Positive for additions, negative for deductions
  quantity_after INTEGER NOT NULL,
  
  -- Reference
  reference_type TEXT, -- order, return, adjustment
  reference_id UUID, -- Order ID, Return ID, etc.
  
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Order Assignments
CREATE TABLE IF NOT EXISTS supplier_order_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  assignment_status TEXT CHECK (assignment_status IN (
    'pending',     -- Newly assigned
    'acknowledged', -- Supplier confirmed
    'processing',  -- Supplier is processing
    'ready',       -- Ready to ship
    'shipped',     -- Shipped to customer
    'delivered',   -- Delivered (from carrier)
    'cancelled'    -- Cancelled
  )) DEFAULT 'pending',
  
  -- Fulfillment details
  acknowledged_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Shipping info (filled by supplier)
  carrier TEXT,
  tracking_number TEXT,
  shipping_cost DECIMAL(10,2),
  estimated_delivery_date DATE,
  
  -- Notes
  supplier_notes TEXT,
  internal_notes TEXT, -- Only visible to admin
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id, supplier_id)
);

-- Returns Management
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_number TEXT UNIQUE NOT NULL,
  
  -- Original order
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  
  -- Customer & Supplier
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Return details
  reason TEXT NOT NULL,
  detailed_reason TEXT,
  quantity INTEGER NOT NULL,
  
  -- Status workflow
  status TEXT CHECK (status IN (
    'requested',      -- Customer requested
    'approved',       -- Admin/Supplier approved
    'rejected',       -- Rejected
    'return_shipped', -- Customer shipped back
    'received',       -- Supplier received
    'inspected',      -- Inspected by supplier
    'refunded',       -- Refund issued
    'completed'       -- Process complete
  )) DEFAULT 'requested',
  
  -- Inspection results (filled by supplier)
  inspection_notes TEXT,
  condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  restockable BOOLEAN,
  
  -- Return shipping
  return_tracking_number TEXT,
  return_carrier TEXT,
  
  -- Refund information
  refund_amount DECIMAL(10,2),
  refund_method TEXT,
  refunded_at TIMESTAMPTZ,
  
  -- Images
  customer_images JSONB, -- Array of image URLs from customer
  supplier_images JSONB, -- Array of image URLs from supplier inspection
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ
);

-- Admin-Supplier Chat System
CREATE TABLE IF NOT EXISTS admin_supplier_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Participants
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Chat metadata
  subject TEXT,
  status TEXT CHECK (status IN ('open', 'resolved', 'archived')) DEFAULT 'open',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(admin_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS admin_supplier_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES admin_supplier_chats(id) ON DELETE CASCADE,
  
  -- Sender
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_type TEXT CHECK (sender_type IN ('admin', 'supplier')) NOT NULL,
  
  -- Message content
  message TEXT NOT NULL,
  
  -- Tagged entities (for @mentions and #references)
  tagged_orders TEXT[], -- Array of order numbers
  tagged_products TEXT[], -- Array of SKUs or product names
  tagged_returns TEXT[], -- Array of return numbers
  
  -- Attachments
  attachments JSONB, -- Array of {url, filename, type}
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier Performance Metrics
CREATE TABLE IF NOT EXISTS supplier_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Fulfillment metrics
  total_orders INTEGER DEFAULT 0,
  orders_on_time INTEGER DEFAULT 0,
  orders_late INTEGER DEFAULT 0,
  average_fulfillment_time_hours DECIMAL(10,2),
  
  -- Quality metrics
  total_returns INTEGER DEFAULT 0,
  return_rate DECIMAL(5,2),
  
  -- Inventory metrics
  stockout_incidents INTEGER DEFAULT 0,
  
  -- Calculated scores
  on_time_delivery_rate DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  overall_score DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(supplier_id, period_start, period_end)
);

-- ===========================
-- INDEXES FOR PERFORMANCE
-- ===========================

CREATE INDEX IF NOT EXISTS idx_supplier_inventory_supplier_id ON supplier_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_inventory_sku ON supplier_inventory(sku);
CREATE INDEX IF NOT EXISTS idx_supplier_inventory_status ON supplier_inventory(status);

CREATE INDEX IF NOT EXISTS idx_product_supplier_links_product_id ON product_supplier_links(product_id);
CREATE INDEX IF NOT EXISTS idx_product_supplier_links_variant_id ON product_supplier_links(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_supplier_links_supplier_id ON product_supplier_links(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_inventory_transactions_inventory_id ON supplier_inventory_transactions(supplier_inventory_id);
CREATE INDEX IF NOT EXISTS idx_supplier_inventory_transactions_created_at ON supplier_inventory_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_order_assignments_order_id ON supplier_order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_assignments_supplier_id ON supplier_order_assignments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_order_assignments_status ON supplier_order_assignments(assignment_status);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier_id ON returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON returns(return_number);

CREATE INDEX IF NOT EXISTS idx_admin_supplier_chats_admin_id ON admin_supplier_chats(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_supplier_chats_supplier_id ON admin_supplier_chats(supplier_id);
CREATE INDEX IF NOT EXISTS idx_admin_supplier_chats_status ON admin_supplier_chats(status);

CREATE INDEX IF NOT EXISTS idx_admin_supplier_messages_chat_id ON admin_supplier_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_admin_supplier_messages_sender_id ON admin_supplier_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_admin_supplier_messages_created_at ON admin_supplier_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_supplier_id ON supplier_performance(supplier_id);

-- ===========================
-- FUNCTIONS & TRIGGERS
-- ===========================

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign orders to suppliers based on product links
CREATE OR REPLACE FUNCTION auto_assign_order_to_supplier()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  -- Get supplier for each order item's variant
  FOR v_supplier_id IN 
    SELECT DISTINCT psl.supplier_id
    FROM order_items oi
    JOIN product_supplier_links psl ON psl.variant_id = oi.variant_id
    WHERE oi.order_id = NEW.id AND psl.is_primary_supplier = TRUE
  LOOP
    -- Create supplier assignment
    INSERT INTO supplier_order_assignments (
      order_id,
      supplier_id,
      assignment_status
    ) VALUES (
      NEW.id,
      v_supplier_id,
      'pending'
    )
    ON CONFLICT (order_id, supplier_id) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_supplier ON orders;
CREATE TRIGGER trigger_auto_assign_supplier
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_order_to_supplier();

-- Function to reserve inventory when order is placed
CREATE OR REPLACE FUNCTION reserve_inventory_on_order()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_inventory_id UUID;
  v_quantity INTEGER;
  v_current_available INTEGER;
BEGIN
  -- Get supplier inventory for this variant
  SELECT si.id, NEW.quantity, si.quantity_available
  INTO v_supplier_inventory_id, v_quantity, v_current_available
  FROM product_supplier_links psl
  JOIN supplier_inventory si ON si.id = psl.supplier_inventory_id
  WHERE psl.variant_id = NEW.variant_id AND psl.is_primary_supplier = TRUE
  LIMIT 1;
  
  IF v_supplier_inventory_id IS NOT NULL THEN
    -- Reserve inventory
    UPDATE supplier_inventory
    SET 
      quantity_reserved = quantity_reserved + v_quantity,
      quantity_available = GREATEST(0, quantity_available - v_quantity)
    WHERE id = v_supplier_inventory_id;
    
    -- Log transaction
    INSERT INTO supplier_inventory_transactions (
      supplier_inventory_id,
      transaction_type,
      quantity_change,
      quantity_after,
      reference_type,
      reference_id
    )
    SELECT 
      id,
      'reserved',
      -v_quantity,
      quantity_available,
      'order',
      NEW.order_id
    FROM supplier_inventory
    WHERE id = v_supplier_inventory_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reserve_inventory ON order_items;
CREATE TRIGGER trigger_reserve_inventory
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION reserve_inventory_on_order();

-- Function to commit inventory when order is shipped
CREATE OR REPLACE FUNCTION commit_inventory_on_shipment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_status = 'shipped' AND OLD.assignment_status != 'shipped' THEN
    -- Move from reserved to committed
    UPDATE supplier_inventory si
    SET 
      quantity_reserved = GREATEST(0, quantity_reserved - oi.quantity),
      quantity_committed = quantity_committed + oi.quantity
    FROM order_items oi
    JOIN product_supplier_links psl ON psl.variant_id = oi.variant_id
    WHERE 
      oi.order_id = NEW.order_id 
      AND si.id = psl.supplier_inventory_id
      AND psl.supplier_id = NEW.supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_commit_inventory ON supplier_order_assignments;
CREATE TRIGGER trigger_commit_inventory
  AFTER UPDATE ON supplier_order_assignments
  FOR EACH ROW
  EXECUTE FUNCTION commit_inventory_on_shipment();

-- Function to generate return number
CREATE OR REPLACE FUNCTION generate_return_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('return_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS return_number_seq;

-- Auto-update last_message_at in chats
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_supplier_chats
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON admin_supplier_messages;
CREATE TRIGGER trigger_update_chat_timestamp
  AFTER INSERT ON admin_supplier_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_last_message();

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_supplier_inventory_updated_at ON supplier_inventory;
CREATE TRIGGER update_supplier_inventory_updated_at 
  BEFORE UPDATE ON supplier_inventory 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_supplier_links_updated_at ON product_supplier_links;
CREATE TRIGGER update_product_supplier_links_updated_at 
  BEFORE UPDATE ON product_supplier_links 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_supplier_order_assignments_updated_at ON supplier_order_assignments;
CREATE TRIGGER update_supplier_order_assignments_updated_at 
  BEFORE UPDATE ON supplier_order_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_returns_updated_at ON returns;
CREATE TRIGGER update_returns_updated_at 
  BEFORE UPDATE ON returns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================
-- ROW LEVEL SECURITY POLICIES
-- ===========================

-- Supplier Inventory - Only accessible by owner and admins
ALTER TABLE supplier_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can view own inventory" ON supplier_inventory;
CREATE POLICY "Suppliers can view own inventory" 
  ON supplier_inventory FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Suppliers can manage own inventory" ON supplier_inventory;
CREATE POLICY "Suppliers can manage own inventory" 
  ON supplier_inventory FOR ALL 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Supplier Links - Visible to admins and linked suppliers
ALTER TABLE product_supplier_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can view their product links" ON product_supplier_links;
CREATE POLICY "Suppliers can view their product links" 
  ON product_supplier_links FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Only admins can manage product links" ON product_supplier_links;
CREATE POLICY "Only admins can manage product links" 
  ON product_supplier_links FOR ALL 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supplier Order Assignments - Visible to assigned supplier and admins
ALTER TABLE supplier_order_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can view assigned orders" ON supplier_order_assignments;
CREATE POLICY "Suppliers can view assigned orders" 
  ON supplier_order_assignments FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Suppliers can update assigned orders" ON supplier_order_assignments;
CREATE POLICY "Suppliers can update assigned orders" 
  ON supplier_order_assignments FOR UPDATE 
  USING (supplier_id = auth.uid());

-- Returns - Visible to supplier, customer, and admin
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant returns" ON returns;
CREATE POLICY "Users can view relevant returns" 
  ON returns FOR SELECT 
  USING (
    customer_id = auth.uid() OR 
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin-Supplier Chat - Only admins and suppliers involved
ALTER TABLE admin_supplier_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and suppliers can view their chats" ON admin_supplier_chats;
CREATE POLICY "Admins and suppliers can view their chats" 
  ON admin_supplier_chats FOR SELECT 
  USING (admin_id = auth.uid() OR supplier_id = auth.uid());

DROP POLICY IF EXISTS "Admins and suppliers can create chats" ON admin_supplier_chats;
CREATE POLICY "Admins and suppliers can create chats" 
  ON admin_supplier_chats FOR INSERT 
  WITH CHECK (admin_id = auth.uid() OR supplier_id = auth.uid());

ALTER TABLE admin_supplier_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view chat messages" ON admin_supplier_messages;
CREATE POLICY "Participants can view chat messages" 
  ON admin_supplier_messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM admin_supplier_chats 
      WHERE id = admin_supplier_messages.chat_id 
      AND (admin_id = auth.uid() OR supplier_id = auth.uid())
    )
  );

