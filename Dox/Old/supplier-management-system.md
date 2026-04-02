# BREVI Supplier Management System - Complete Implementation Guide

## 🎯 Overview

Add a complete Supplier role to BREVI with:
- Inventory management (stock, cost prices)
- Order fulfillment workflow
- Returns management
- Admin-Supplier real-time chat with tag system
- Product linking between Admin and Supplier inventories
- Restricted access (no retail pricing visibility)

---

## 📊 Database Schema Updates

### Step 1: Add Supplier Role & Tables

```sql
-- ===========================
-- UPDATE PROFILES TABLE
-- ===========================

-- Add role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
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
CREATE TABLE supplier_inventory (
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
CREATE TABLE product_supplier_links (
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
CREATE TABLE supplier_inventory_transactions (
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
CREATE TABLE supplier_order_assignments (
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
CREATE TABLE returns (
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
CREATE TABLE admin_supplier_chats (
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

CREATE TABLE admin_supplier_messages (
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
CREATE TABLE supplier_performance (
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

CREATE INDEX idx_supplier_inventory_supplier_id ON supplier_inventory(supplier_id);
CREATE INDEX idx_supplier_inventory_sku ON supplier_inventory(sku);
CREATE INDEX idx_supplier_inventory_status ON supplier_inventory(status);

CREATE INDEX idx_product_supplier_links_product_id ON product_supplier_links(product_id);
CREATE INDEX idx_product_supplier_links_variant_id ON product_supplier_links(variant_id);
CREATE INDEX idx_product_supplier_links_supplier_id ON product_supplier_links(supplier_id);

CREATE INDEX idx_supplier_inventory_transactions_inventory_id ON supplier_inventory_transactions(supplier_inventory_id);
CREATE INDEX idx_supplier_inventory_transactions_created_at ON supplier_inventory_transactions(created_at DESC);

CREATE INDEX idx_supplier_order_assignments_order_id ON supplier_order_assignments(order_id);
CREATE INDEX idx_supplier_order_assignments_supplier_id ON supplier_order_assignments(supplier_id);
CREATE INDEX idx_supplier_order_assignments_status ON supplier_order_assignments(assignment_status);

CREATE INDEX idx_returns_order_id ON returns(order_id);
CREATE INDEX idx_returns_customer_id ON returns(customer_id);
CREATE INDEX idx_returns_supplier_id ON returns(supplier_id);
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_return_number ON returns(return_number);

CREATE INDEX idx_admin_supplier_chats_admin_id ON admin_supplier_chats(admin_id);
CREATE INDEX idx_admin_supplier_chats_supplier_id ON admin_supplier_chats(supplier_id);
CREATE INDEX idx_admin_supplier_chats_status ON admin_supplier_chats(status);

CREATE INDEX idx_admin_supplier_messages_chat_id ON admin_supplier_messages(chat_id);
CREATE INDEX idx_admin_supplier_messages_sender_id ON admin_supplier_messages(sender_id);
CREATE INDEX idx_admin_supplier_messages_created_at ON admin_supplier_messages(created_at DESC);

CREATE INDEX idx_supplier_performance_supplier_id ON supplier_performance(supplier_id);

-- ===========================
-- ROW LEVEL SECURITY POLICIES
-- ===========================

-- Supplier Inventory - Only accessible by owner and admins
ALTER TABLE supplier_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own inventory" 
  ON supplier_inventory FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Suppliers can manage own inventory" 
  ON supplier_inventory FOR ALL 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Product Supplier Links - Visible to admins and linked suppliers
ALTER TABLE product_supplier_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view their product links" 
  ON product_supplier_links FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can manage product links" 
  ON product_supplier_links FOR ALL 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Supplier Order Assignments - Visible to assigned supplier and admins
ALTER TABLE supplier_order_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view assigned orders" 
  ON supplier_order_assignments FOR SELECT 
  USING (
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Suppliers can update assigned orders" 
  ON supplier_order_assignments FOR UPDATE 
  USING (supplier_id = auth.uid());

-- Returns - Visible to supplier, customer, and admin
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant returns" 
  ON returns FOR SELECT 
  USING (
    customer_id = auth.uid() OR 
    supplier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin-Supplier Chat - Only admins and suppliers involved
ALTER TABLE admin_supplier_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and suppliers can view their chats" 
  ON admin_supplier_chats FOR SELECT 
  USING (admin_id = auth.uid() OR supplier_id = auth.uid());

CREATE POLICY "Admins and suppliers can create chats" 
  ON admin_supplier_chats FOR INSERT 
  WITH CHECK (admin_id = auth.uid() OR supplier_id = auth.uid());

ALTER TABLE admin_supplier_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view chat messages" 
  ON admin_supplier_messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM admin_supplier_chats 
      WHERE id = admin_supplier_messages.chat_id 
      AND (admin_id = auth.uid() OR supplier_id = auth.uid())
    )
  );

-- ===========================
-- FUNCTIONS & TRIGGERS
-- ===========================

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
BEGIN
  -- Get supplier inventory for this variant
  SELECT si.id, NEW.quantity
  INTO v_supplier_inventory_id, v_quantity
  FROM product_supplier_links psl
  JOIN supplier_inventory si ON si.id = psl.supplier_inventory_id
  WHERE psl.variant_id = NEW.variant_id AND psl.is_primary_supplier = TRUE
  LIMIT 1;
  
  IF v_supplier_inventory_id IS NOT NULL THEN
    -- Reserve inventory
    UPDATE supplier_inventory
    SET 
      quantity_reserved = quantity_reserved + v_quantity,
      quantity_available = quantity_available - v_quantity
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
      quantity_reserved = quantity_reserved - oi.quantity,
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

CREATE TRIGGER trigger_update_chat_timestamp
  AFTER INSERT ON admin_supplier_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_last_message();

-- Auto-update timestamps
CREATE TRIGGER update_supplier_inventory_updated_at 
  BEFORE UPDATE ON supplier_inventory 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_supplier_links_updated_at 
  BEFORE UPDATE ON product_supplier_links 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_order_assignments_updated_at 
  BEFORE UPDATE ON supplier_order_assignments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_returns_updated_at 
  BEFORE UPDATE ON returns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🚀 Implementation: Supplier Portal

### Step 2: Create Supplier Middleware

```typescript
// middleware.ts - Update to include supplier routes
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect /supplier routes
  if (req.nextUrl.pathname.startsWith('/supplier')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    
    // Check if user is supplier
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    
    if (profile?.role !== 'supplier') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // Protect /account routes
  if (req.nextUrl.pathname.startsWith('/account') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protect /admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/account/:path*', '/admin/:path*', '/supplier/:path*']
}
```

---

## 📱 Supplier Portal Pages

### Dashboard (`/supplier/page.tsx`)

```typescript
// app/supplier/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, TruckIcon, AlertCircle, DollarSign } from 'lucide-react'

export default async function SupplierDashboard() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Parallel queries for dashboard stats
  const [
    { data: profile },
    { count: pendingOrders },
    { count: processingOrders },
    { data: lowStockItems },
    { data: recentOrders }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user?.id).single(),
    supabase.from('supplier_order_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', user?.id)
      .eq('assignment_status', 'pending'),
    supabase.from('supplier_order_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', user?.id)
      .eq('assignment_status', 'processing'),
    supabase.from('supplier_inventory')
      .select('*')
      .eq('supplier_id', user?.id)
      .lt('quantity_available', supabase.rpc('reorder_point'))
      .limit(10),
    supabase.from('supplier_order_assignments')
      .select(`
        *,
        orders (
          order_number,
          total,
          created_at,
          customer_email
        )
      `)
      .eq('supplier_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Supplier Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.company_name || profile?.first_name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting acknowledgment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <TruckIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processingOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {lowStockItems?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Need reordering
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${/* Calculate total inventory value */}
            </div>
            <p className="text-xs text-muted-foreground">
              Total cost value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Orders table component */}
        </CardContent>
      </Card>
    </div>
  )
}
```

### Inventory Management (`/supplier/inventory/page.tsx`)

```typescript
// app/supplier/inventory/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Edit, AlertTriangle } from 'lucide-react'
import { InventoryDialog } from '@/components/supplier/inventory-dialog'

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  // Fetch inventory with React Query
  const { data: inventory, isLoading } = useInventory()

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Inventory Item
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Items</option>
          <option value="active">Active</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
      </div>

      {/* Inventory Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Reserved</TableHead>
              <TableHead>Committed</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory?.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.product_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.quantity_available}
                    {item.quantity_available <= item.reorder_point && (
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                </TableCell>
                <TableCell>{item.quantity_reserved}</TableCell>
                <TableCell>{item.quantity_committed}</TableCell>
                <TableCell>${item.cost_price.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.quantity_available === 0
                        ? 'destructive'
                        : item.quantity_available <= item.reorder_point
                        ? 'warning'
                        : 'success'
                    }
                  >
                    {item.quantity_available === 0
                      ? 'Out of Stock'
                      : item.quantity_available <= item.reorder_point
                      ? 'Low Stock'
                      : 'In Stock'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item)
                      setIsDialogOpen(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Inventory Dialog */}
      <InventoryDialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          setSelectedItem(null)
        }}
        item={selectedItem}
      />
    </div>
  )
}
```

### Order Fulfillment (`/supplier/orders/page.tsx`)

```typescript
// app/supplier/orders/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Eye, Package, Truck } from 'lucide-react'
import Link from 'next/link'
import { useSupplierOrders } from '@/lib/hooks/use-supplier-orders'

export default function SupplierOrdersPage() {
  const [activeTab, setActiveTab] = useState('pending')
  
  const { data: orders, isLoading } = useSupplierOrders(activeTab)

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      shipped: 'bg-teal-100 text-teal-800',
      delivered: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Order Fulfillment</h1>
        <p className="text-muted-foreground">Manage and fulfill customer orders</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {orders?.pending?.length > 0 && (
              <Badge className="ml-2" variant="destructive">
                {orders.pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="ready">Ready to Ship</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="all">All Orders</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-mono">
                      {assignment.orders.order_number}
                    </TableCell>
                    <TableCell>{assignment.orders.customer_email}</TableCell>
                    <TableCell>
                      {/* Item count */}
                    </TableCell>
                    <TableCell>
                      ${assignment.orders.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(assignment.assignment_status)}>
                        {assignment.assignment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/supplier/orders/${assignment.order_id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {assignment.assignment_status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeOrder(assignment.id)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Acknowledge
                          </Button>
                        )}
                        {assignment.assignment_status === 'ready' && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => openShippingDialog(assignment)}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Ship
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Order Detail with Fulfillment (`/supplier/orders/[id]/page.tsx`)

```typescript
// app/supplier/orders/[id]/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FulfillmentActions } from '@/components/supplier/fulfillment-actions'
import { OrderTimeline } from '@/components/supplier/order-timeline'

export default async function SupplierOrderDetailPage({
  params
}: {
  params: { id: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch order with assignment details
  const { data: assignment } = await supabase
    .from('supplier_order_assignments')
    .select(`
      *,
      orders (
        *,
        order_items (
          *,
          product_variants (
            *,
            products (*)
          )
        )
      )
    `)
    .eq('order_id', params.id)
    .eq('supplier_id', user?.id)
    .single()

  if (!assignment) {
    return <div>Order not found</div>
  }

  const order = assignment.orders

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Order {order.order_number}</h1>
            <p className="text-muted-foreground">
              Placed on {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge className={getStatusColor(assignment.assignment_status)}>
            {assignment.assignment_status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <img
                      src={item.product_variants.image_url}
                      alt={item.product_title}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.product_title}</h3>
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku} • Color: {item.variant_color}
                      </p>
                      <p className="text-sm">Quantity: {item.quantity}</p>
                    </div>
                    {/* Don't show retail price to supplier */}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Fulfillment Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline assignment={assignment} />
            </CardContent>
          </Card>

          {/* Shipping Information */}
          {assignment.tracking_number && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Carrier:</span>{' '}
                    {assignment.carrier}
                  </div>
                  <div>
                    <span className="font-semibold">Tracking Number:</span>{' '}
                    {assignment.tracking_number}
                  </div>
                  <div>
                    <span className="font-semibold">Estimated Delivery:</span>{' '}
                    {assignment.estimated_delivery_date}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Fulfillment Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <FulfillmentActions assignment={assignment} />
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold">Email:</span>
                <br />
                {order.customer_email}
              </div>
              <div>
                <span className="font-semibold">Phone:</span>
                <br />
                {order.customer_phone}
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <address className="not-italic text-sm">
                {order.shipping_address.address_line1}
                <br />
                {order.shipping_address.address_line2 && (
                  <>
                    {order.shipping_address.address_line2}
                    <br />
                  </>
                )}
                {order.shipping_address.city}, {order.shipping_address.state}{' '}
                {order.shipping_address.postal_code}
                <br />
                {order.shipping_address.country}
              </address>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full p-2 border rounded"
                rows={4}
                placeholder="Add notes about this order..."
                defaultValue={assignment.supplier_notes}
              />
              <Button className="mt-2 w-full" onClick={() => saveNotes()}>
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

### Returns Management (`/supplier/returns/page.tsx`)

```typescript
// app/supplier/returns/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import { Eye, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useSupplierReturns } from '@/lib/hooks/use-supplier-returns'

export default function SupplierReturnsPage() {
  const [activeTab, setActiveTab] = useState('requested')
  
  const { data: returns, isLoading } = useSupplierReturns(activeTab)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Returns Management</h1>
        <p className="text-muted-foreground">
          Process and manage product returns
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requested">Requested</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="return_shipped">In Transit</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="inspected">Inspected</TabsTrigger>
          <TabsTrigger value="all">All Returns</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns?.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    <TableCell className="font-mono">
                      {returnItem.return_number}
                    </TableCell>
                    <TableCell className="font-mono">
                      {returnItem.orders?.order_number}
                    </TableCell>
                    <TableCell>
                      {returnItem.profiles?.email}
                    </TableCell>
                    <TableCell>
                      {returnItem.order_items?.product_title}
                    </TableCell>
                    <TableCell>{returnItem.reason}</TableCell>
                    <TableCell>
                      <Badge>{returnItem.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(returnItem.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/supplier/returns/${returnItem.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {returnItem.status === 'requested' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveReturn(returnItem.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rejectReturn(returnItem.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

## 💬 Admin-Supplier Chat System

### Chat Component (`/components/admin-supplier-chat.tsx`)

```typescript
// components/admin-supplier-chat.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, Paperclip, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  sender_id: string
  sender_type: 'admin' | 'supplier'
  message: string
  tagged_orders: string[]
  tagged_products: string[]
  tagged_returns: string[]
  attachments: any[]
  created_at: string
  is_read: boolean
}

export function AdminSupplierChat({
  chatId,
  currentUserId,
  currentUserType
}: {
  chatId: string
  currentUserId: string
  currentUserType: 'admin' | 'supplier'
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load messages
  useEffect(() => {
    loadMessages()
    subscribeToMessages()
  }, [chatId])

  const loadMessages = async () => {
    const { data } = await supabase
      .from('admin_supplier_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
      markAsRead()
    }
  }

  // Real-time subscription
  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_supplier_messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const markAsRead = async () => {
    await supabase
      .from('admin_supplier_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .neq('sender_id', currentUserId)
      .is('read_at', null)
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return

    // Parse tags from message
    const orderTags = extractTags(newMessage, /\#ORDER-[\w-]+/g)
    const productTags = extractTags(newMessage, /\@SKU-[\w-]+/g)
    const returnTags = extractTags(newMessage, /\#RET-[\w-]+/g)

    const { error } = await supabase
      .from('admin_supplier_messages')
      .insert({
        chat_id: chatId,
        sender_id: currentUserId,
        sender_type: currentUserType,
        message: newMessage,
        tagged_orders: orderTags,
        tagged_products: productTags,
        tagged_returns: returnTags
      })

    if (!error) {
      setNewMessage('')
      scrollToBottom()
    }
  }

  const extractTags = (text: string, regex: RegExp): string[] => {
    const matches = text.match(regex)
    return matches ? matches.map(m => m.substring(1)) : []
  }

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_id === currentUserId

    // Render message with clickable tags
    const renderMessageWithTags = (text: string) => {
      // Replace order tags
      text = text.replace(/\#(ORDER-[\w-]+)/g, (match, orderNum) => {
        return `<a href="/orders/${orderNum}" class="text-blue-600 hover:underline">${match}</a>`
      })

      // Replace product tags
      text = text.replace(/\@(SKU-[\w-]+)/g, (match, sku) => {
        return `<a href="/inventory?sku=${sku}" class="text-green-600 hover:underline">${match}</a>`
      })

      // Replace return tags
      text = text.replace(/\#(RET-[\w-]+)/g, (match, retNum) => {
        return `<a href="/returns/${retNum}" class="text-orange-600 hover:underline">${match}</a>`
      })

      return { __html: text }
    }

    return (
      <div
        key={message.id}
        className={cn(
          'flex mb-4',
          isOwnMessage ? 'justify-end' : 'justify-start'
        )}
      >
        <div
          className={cn(
            'max-w-[70%] rounded-lg p-3',
            isOwnMessage
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-900'
          )}
        >
          <div
            dangerouslySetInnerHTML={renderMessageWithTags(message.message)}
            className="whitespace-pre-wrap"
          />

          {/* Show tagged entities as badges */}
          {(message.tagged_orders?.length > 0 ||
            message.tagged_products?.length > 0 ||
            message.tagged_returns?.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.tagged_orders?.map((order) => (
                <Badge key={order} variant="outline" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {order}
                </Badge>
              ))}
              {message.tagged_products?.map((product) => (
                <Badge key={product} variant="outline" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {product}
                </Badge>
              ))}
              {message.tagged_returns?.map((ret) => (
                <Badge key={ret} variant="outline" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  {ret}
                </Badge>
              ))}
            </div>
          )}

          <p className="text-xs mt-1 opacity-70">
            {new Date(message.created_at).toLocaleTimeString()}
          </p>
        </div>
      </div>
    )
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground mb-2">
          Use #ORDER-xxx, @SKU-xxx, or #RET-xxx to tag orders, products, or returns
        </div>
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message... (use # for orders, @ for products)"
            className="flex-1"
          />
          <Button variant="ghost" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button onClick={sendMessage}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Chat Page for Admin (`/admin/suppliers/chat/[supplierId]/page.tsx`)

```typescript
// app/admin/suppliers/chat/[supplierId]/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { AdminSupplierChat } from '@/components/admin-supplier-chat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminSupplierChatPage({
  params
}: {
  params: { supplierId: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get or create chat
  let { data: chat } = await supabase
    .from('admin_supplier_chats')
    .select('*')
    .eq('admin_id', user?.id)
    .eq('supplier_id', params.supplierId)
    .single()

  if (!chat) {
    const { data: newChat } = await supabase
      .from('admin_supplier_chats')
      .insert({
        admin_id: user?.id,
        supplier_id: params.supplierId
      })
      .select()
      .single()

    chat = newChat
  }

  // Get supplier info
  const { data: supplier } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', params.supplierId)
    .single()

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>
              Chat with {supplier?.company_name || supplier?.first_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminSupplierChat
              chatId={chat.id}
              currentUserId={user?.id!}
              currentUserType="admin"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Chat Page for Supplier (`/supplier/chat/page.tsx`)

```typescript
// app/supplier/chat/page.tsx
import { createServerClient } from '@/lib/supabase/server'
import { AdminSupplierChat } from '@/components/admin-supplier-chat'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SupplierChatPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get all admin users
  const { data: admins } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')

  // Get or create chat with primary admin
  const primaryAdmin = admins?.[0]

  let { data: chat } = await supabase
    .from('admin_supplier_chats')
    .select('*')
    .eq('supplier_id', user?.id)
    .eq('admin_id', primaryAdmin?.id)
    .single()

  if (!chat) {
    const { data: newChat } = await supabase
      .from('admin_supplier_chats')
      .insert({
        admin_id: primaryAdmin?.id,
        supplier_id: user?.id
      })
      .select()
      .single()

    chat = newChat
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Chat with Admin Team</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminSupplierChat
              chatId={chat.id}
              currentUserId={user?.id!}
              currentUserType="supplier"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

---

## 🔗 Admin: Link Products to Supplier Inventory

### Product Linking Component (`/components/admin/product-supplier-linker.tsx`)

```typescript
// components/admin/product-supplier-linker.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Link as LinkIcon, Unlink } from 'lucide-react'
import { linkProductToSupplier, unlinkProductFromSupplier } from '@/app/actions/suppliers'

export function ProductSupplierLinker({
  productId,
  variantId,
  currentLinks
}: {
  productId: string
  variantId: string
  currentLinks: any[]
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedInventoryItem, setSelectedInventoryItem] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState(3)

  const { data: suppliers } = useSuppliers()
  const { data: supplierInventory } = useSupplierInventory(selectedSupplier)

  const handleLink = async () => {
    await linkProductToSupplier({
      productId,
      variantId,
      supplierId: selectedSupplier,
      supplierInventoryId: selectedInventoryItem,
      leadTimeDays,
      isPrimarySupplier: currentLinks.length === 0
    })

    setIsDialogOpen(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold">Supplier Links</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
        >
          <LinkIcon className="w-4 h-4 mr-2" />
          Link to Supplier
        </Button>
      </div>

      {/* Current Links */}
      <div className="space-y-2">
        {currentLinks.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div>
              <p className="font-medium">{link.supplier.company_name}</p>
              <p className="text-sm text-muted-foreground">
                SKU: {link.supplier_inventory.sku}
                {link.is_primary_supplier && (
                  <Badge className="ml-2" variant="default">
                    Primary
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Lead time: {link.lead_time_days} days
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unlinkProductFromSupplier(link.id)}
            >
              <Unlink className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Link Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Product to Supplier Inventory</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Supplier</label>
              <Select
                value={selectedSupplier}
                onValueChange={setSelectedSupplier}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.company_name || supplier.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSupplier && (
              <div>
                <label className="text-sm font-medium">
                  Select Inventory Item
                </label>
                <Select
                  value={selectedInventoryItem}
                  onValueChange={setSelectedInventoryItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose inventory item" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierInventory?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.sku} - {item.product_name} (Available:{' '}
                        {item.quantity_available})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                Lead Time (days)
              </label>
              <Input
                type="number"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(parseInt(e.target.value))}
                min={1}
              />
            </div>

            <Button
              onClick={handleLink}
              disabled={!selectedSupplier || !selectedInventoryItem}
              className="w-full"
            >
              Link to Supplier
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

---

## 🚀 Server Actions

### Supplier Actions (`/app/actions/suppliers.ts`)

```typescript
// app/actions/suppliers.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function linkProductToSupplier(data: {
  productId: string
  variantId: string
  supplierId: string
  supplierInventoryId: string
  leadTimeDays: number
  isPrimarySupplier: boolean
}) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('product_supplier_links')
    .insert({
      product_id: data.productId,
      variant_id: data.variantId,
      supplier_id: data.supplierId,
      supplier_inventory_id: data.supplierInventoryId,
      lead_time_days: data.leadTimeDays,
      is_primary_supplier: data.isPrimarySupplier
    })

  if (error) throw error

  revalidatePath('/admin/products')
  return { success: true }
}

export async function unlinkProductFromSupplier(linkId: string) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('product_supplier_links')
    .delete()
    .eq('id', linkId)

  if (error) throw error

  revalidatePath('/admin/products')
  return { success: true }
}

export async function updateInventory(
  inventoryId: string,
  updates: {
    quantity_available?: number
    cost_price?: number
    reorder_point?: number
    status?: string
  }
) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('supplier_inventory')
    .update(updates)
    .eq('id', inventoryId)

  if (error) throw error

  // Log transaction if quantity changed
  if (updates.quantity_available !== undefined) {
    const { data: inventory } = await supabase
      .from('supplier_inventory')
      .select('quantity_available, supplier_id')
      .eq('id', inventoryId)
      .single()

    await supabase.from('supplier_inventory_transactions').insert({
      supplier_inventory_id: inventoryId,
      transaction_type: 'adjustment',
      quantity_change: updates.quantity_available - (inventory?.quantity_available || 0),
      quantity_after: updates.quantity_available,
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
  }

  revalidatePath('/supplier/inventory')
  return { success: true }
}

export async function acknowledgeOrder(assignmentId: string) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('supplier_order_assignments')
    .update({
      assignment_status: 'acknowledged',
      acknowledged_at: new Date().toISOString()
    })
    .eq('id', assignmentId)

  if (error) throw error

  revalidatePath('/supplier/orders')
  return { success: true }
}

export async function shipOrder(
  assignmentId: string,
  shippingData: {
    carrier: string
    tracking_number: string
    estimated_delivery_date: string
  }
) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('supplier_order_assignments')
    .update({
      assignment_status: 'shipped',
      shipped_at: new Date().toISOString(),
      ...shippingData
    })
    .eq('id', assignmentId)

  if (error) throw error

  // Also update main order tracking
  const { data: assignment } = await supabase
    .from('supplier_order_assignments')
    .select('order_id')
    .eq('id', assignmentId)
    .single()

  if (assignment) {
    await supabase.from('order_tracking').insert({
      order_id: assignment.order_id,
      carrier: shippingData.carrier,
      tracking_number: shippingData.tracking_number,
      status: 'shipped'
    })

    // Update order fulfillment status
    await supabase
      .from('orders')
      .update({ fulfillment_status: 'in_transit' })
      .eq('id', assignment.order_id)
  }

  revalidatePath('/supplier/orders')
  return { success: true }
}

export async function processReturn(
  returnId: string,
  action: 'approve' | 'reject' | 'receive' | 'inspect' | 'refund',
  data?: any
) {
  const supabase = createServerClient()

  const statusMap = {
    approve: 'approved',
    reject: 'rejected',
    receive: 'received',
    inspect: 'inspected',
    refund: 'refunded'
  }

  const updates: any = {
    status: statusMap[action]
  }

  if (action === 'approve') {
    updates.approved_at = new Date().toISOString()
  } else if (action === 'receive') {
    updates.received_at = new Date().toISOString()
  } else if (action === 'inspect') {
    updates.inspected_at = new Date().toISOString()
    updates.inspection_notes = data.inspection_notes
    updates.condition = data.condition
    updates.restockable = data.restockable
  } else if (action === 'refund') {
    updates.refunded_at = new Date().toISOString()
    updates.refund_amount = data.refund_amount
    updates.refund_method = data.refund_method
  }

  const { error } = await supabase
    .from('returns')
    .update(updates)
    .eq('id', returnId)

  if (error) throw error

  // If restockable, add back to inventory
  if (action === 'inspect' && data.restockable) {
    // Get return details
    const { data: returnData } = await supabase
      .from('returns')
      .select('order_item_id, quantity')
      .eq('id', returnId)
      .single()

    // Get supplier inventory
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('variant_id')
      .eq('id', returnData?.order_item_id)
      .single()

    const { data: link } = await supabase
      .from('product_supplier_links')
      .select('supplier_inventory_id')
      .eq('variant_id', orderItem?.variant_id)
      .single()

    if (link) {
      // Add back to inventory
      await supabase.rpc('increment_inventory', {
        inventory_id: link.supplier_inventory_id,
        amount: returnData?.quantity || 0
      })
    }
  }

  revalidatePath('/supplier/returns')
  return { success: true }
}
```

---

## 📊 Dashboard Features

### Supplier Performance Metrics

```typescript
// lib/analytics/supplier-performance.ts
export async function calculateSupplierPerformance(
  supplierId: string,
  startDate: Date,
  endDate: Date
) {
  const supabase = createServerClient()

  // Get all orders in period
  const { data: assignments } = await supabase
    .from('supplier_order_assignments')
    .select('*')
    .eq('supplier_id', supplierId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const totalOrders = assignments?.length || 0
  
  // Calculate on-time delivery
  const ordersOnTime = assignments?.filter(a => {
    if (!a.shipped_at || !a.created_at) return false
    const hoursDiff = (new Date(a.shipped_at).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60)
    return hoursDiff <= (a.lead_time_days * 24)
  }).length || 0

  // Calculate return rate
  const { count: totalReturns } = await supabase
    .from('returns')
    .select('*', { count: 'exact', head: true })
    .eq('supplier_id', supplierId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const metrics = {
    total_orders: totalOrders,
    orders_on_time: ordersOnTime,
    orders_late: totalOrders - ordersOnTime,
    on_time_delivery_rate: totalOrders > 0 ? (ordersOnTime / totalOrders) * 100 : 0,
    total_returns: totalReturns || 0,
    return_rate: totalOrders > 0 ? ((totalReturns || 0) / totalOrders) * 100 : 0,
    overall_score: calculateOverallScore(ordersOnTime, totalOrders, totalReturns || 0)
  }

  // Save to database
  await supabase.from('supplier_performance').upsert({
    supplier_id: supplierId,
    period_start: startDate,
    period_end: endDate,
    ...metrics
  })

  return metrics
}

function calculateOverallScore(onTime: number, total: number, returns: number): number {
  if (total === 0) return 0
  
  const onTimeScore = (onTime / total) * 70 // 70% weight
  const returnScore = Math.max(0, 100 - (returns / total) * 100) * 0.3 // 30% weight
  
  return Math.round(onTimeScore + returnScore)
}
```

---

## 🎯 Implementation Checklist

### Phase 1: Database & Auth (Week 1)
- [ ] Run SQL schema updates
- [ ] Add role column to profiles
- [ ] Create all supplier tables
- [ ] Set up RLS policies
- [ ] Update middleware for supplier routes
- [ ] Test database triggers

### Phase 2: Supplier Portal (Week 2)
- [ ] Create supplier dashboard
- [ ] Build inventory management page
- [ ] Add inventory item CRUD
- [ ] Implement order fulfillment page
- [ ] Create order detail page
- [ ] Add fulfillment actions (acknowledge, process, ship)
- [ ] Build returns management

### Phase 3: Admin Integration (Week 3)
- [ ] Add product-supplier linking UI
- [ ] Create supplier management page
- [ ] Build supplier list with performance metrics
- [ ] Add supplier creation/editing
- [ ] Implement inventory visibility for admin
- [ ] Create order assignment automation

### Phase 4: Chat System (Week 4)
- [ ] Implement chat database tables
- [ ] Build chat component with real-time
- [ ] Add tag parsing (#ORDER, @SKU, #RET)
- [ ] Create admin chat interface
- [ ] Create supplier chat interface
- [ ] Add file attachments
- [ ] Implement unread message indicators

### Phase 5: Testing & Polish (Week 5)
- [ ] Test entire fulfillment workflow
- [ ] Test inventory reservation/commitment
- [ ] Test returns process
- [ ] Test chat system
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Security audit

---

## 🎨 UI/UX Enhancements

### Supplier-Specific Features

1. **Low Stock Alerts**: Email/push notifications when inventory is low
2. **Bulk Actions**: Bulk update inventory, bulk acknowledge orders
3. **Print Labels**: Generate shipping labels
4. **Barcode Scanning**: Scan products for quick inventory updates
5. **Mobile App**: React Native app for on-the-go fulfillment

---

## 📈 Future Enhancements

1. **Multi-Warehouse Support**: Suppliers can have multiple warehouses
2. **Automated Purchase Orders**: Auto-generate POs when inventory is low
3. **Integration with 3PLs**: Connect to third-party logistics providers
4. **Advanced Analytics**: Forecasting, demand planning
5. **API Access**: Allow suppliers to integrate their own systems
6. **Quality Control**: Photo verification of products before shipping

---

This implementation gives you a complete supplier management system with inventory tracking, order fulfillment, returns management, and real-time communication between admin and suppliers! 🚀
