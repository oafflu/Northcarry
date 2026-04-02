# BREVI E-Commerce Platform - Complete Implementation Prompt for Cursor AI

## 🎯 Project Overview

Implement a complete, production-ready e-commerce platform for BREVI (premium toothbrush brand) using Next.js 15+, React 19, TypeScript, Supabase (PostgreSQL), and Tailwind CSS v4. The system must be **extremely fast**, with optimized queries, edge functions, and real-time features.

---

## 🏗️ Technology Stack

### Core Framework
- **Next.js 15+** with App Router
- **React 19** with Server Components
- **TypeScript** (strict mode)
- **Tailwind CSS v4**
- **shadcn/ui** components

### Backend & Database
- **Supabase** (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
- **Prisma** or **Drizzle ORM** for type-safe queries
- **Supabase RLS** (Row Level Security) for data protection
- **Edge Functions** for serverless operations

### Performance Optimizations
- **Server Actions** for mutations
- **Parallel data fetching** with Promise.all()
- **Optimistic updates** for instant UI feedback
- **React Query / SWR** for client-side caching
- **Database indexes** on all foreign keys and frequently queried columns
- **Connection pooling** via Supabase Pooler (PgBouncer)
- **Image optimization** with Next.js Image and Supabase Storage CDN

---

## 📊 Database Schema Design

### Priority: Create optimized, normalized PostgreSQL schema with proper indexes

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ===========================
-- USERS & AUTHENTICATION
-- ===========================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('shipping', 'billing')), -- address type
  is_default BOOLEAN DEFAULT FALSE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- PRODUCTS & INVENTORY
-- ===========================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('active', 'draft', 'archived')) DEFAULT 'draft',
  base_price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL, -- Black, White, Green, Pink, Bamboo
  price DECIMAL(10,2) NOT NULL,
  inventory_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE multi_buy_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- ORDERS & CHECKOUT
-- ===========================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Customer info (denormalized for historical record)
  customer_email TEXT NOT NULL,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_phone TEXT,
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  
  -- Status
  fulfillment_status TEXT CHECK (fulfillment_status IN ('unfulfilled', 'processing', 'in_transit', 'fulfilled', 'cancelled')) DEFAULT 'unfulfilled',
  payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')) DEFAULT 'pending',
  
  -- Addresses
  shipping_address JSONB NOT NULL,
  billing_address JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Denormalized product info (for historical record)
  product_title TEXT NOT NULL,
  variant_color TEXT NOT NULL,
  sku TEXT NOT NULL,
  
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  carrier TEXT, -- USPS, FedEx, UPS, DHL
  tracking_number TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- SHOPPING CART
-- ===========================

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous users
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, variant_id),
  UNIQUE(session_id, variant_id)
);

-- ===========================
-- REVIEWS & RATINGS
-- ===========================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, user_id)
);

CREATE TABLE review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- LOYALTY PROGRAM
-- ===========================

CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL, -- Bronze, Silver, Gold, Platinum
  min_points INTEGER NOT NULL,
  points_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  benefits JSONB, -- Array of benefits
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE loyalty_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES loyalty_tiers(id),
  points_balance INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES loyalty_members(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL, -- Positive for earning, negative for spending
  transaction_type TEXT NOT NULL, -- purchase, review, referral, redemption, birthday
  reference_id UUID, -- Order ID, Review ID, etc.
  description TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type TEXT NOT NULL, -- discount, free_shipping, free_product
  reward_value JSONB NOT NULL, -- Discount amount, product ID, etc.
  is_active BOOLEAN DEFAULT TRUE,
  stock_limit INTEGER,
  stock_remaining INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID REFERENCES loyalty_members(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  redemption_code TEXT UNIQUE,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- PROMOTIONS & DISCOUNTS
-- ===========================

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'free_shipping', 'buy_x_get_y')) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Usage limits
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  
  -- Conditions
  min_purchase_amount DECIMAL(10,2),
  applies_to JSONB, -- Products, collections, or 'all'
  
  -- Dates
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  status TEXT CHECK (status IN ('active', 'scheduled', 'expired', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE promotion_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(promotion_id, order_id)
);

-- ===========================
-- EMAIL MARKETING
-- ===========================

CREATE TABLE email_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('active', 'unsubscribed', 'bounced')) DEFAULT 'active',
  tags TEXT[], -- Segmentation tags
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to_email TEXT,
  
  content JSONB NOT NULL, -- Email HTML and text
  
  status TEXT CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')) DEFAULT 'draft',
  
  -- Recipients
  recipient_segment JSONB, -- Filters for who receives this
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Metrics
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- new_subscriber, abandoned_cart, post_purchase, win_back
  trigger_config JSONB, -- Trigger conditions and delays
  
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metrics
  total_sent INTEGER DEFAULT 0,
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  conversion_rate DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID REFERENCES email_automations(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_hours INTEGER DEFAULT 0,
  
  subject TEXT NOT NULL,
  content JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- SUPPORT SYSTEM
-- ===========================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  
  subject TEXT NOT NULL,
  category TEXT CHECK (category IN ('order', 'product', 'shipping', 'technical', 'other')) NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('open', 'pending', 'resolved', 'closed')) DEFAULT 'open',
  
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_type TEXT CHECK (sender_type IN ('customer', 'admin')) NOT NULL,
  
  message TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT FALSE,
  
  attachments JSONB, -- Array of file URLs
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- CMS & CONTENT
-- ===========================

CREATE TABLE cms_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section TEXT UNIQUE NOT NULL, -- hero, topbar, menu, footer, etc.
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ===========================
-- ANALYTICS & METRICS
-- ===========================

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- page_view, add_to_cart, purchase, etc.
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  
  properties JSONB, -- Event-specific data
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================
-- INDEXES FOR PERFORMANCE
-- ===========================

-- Users & Profiles
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- Products
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_multi_buy_pricing_product_id ON multi_buy_pricing(product_id);

-- Orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_tracking_order_id ON order_tracking(order_id);

-- Cart
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_session_id ON cart_items(session_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);

-- Reviews
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX idx_review_images_review_id ON review_images(review_id);

-- Loyalty
CREATE INDEX idx_loyalty_members_user_id ON loyalty_members(user_id);
CREATE INDEX idx_loyalty_transactions_member_id ON loyalty_transactions(member_id);
CREATE INDEX idx_loyalty_redemptions_member_id ON loyalty_redemptions(member_id);

-- Promotions
CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotion_usage_promotion_id ON promotion_usage(promotion_id);

-- Email Marketing
CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);

-- Support
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);

-- Analytics
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_products_title_search ON products USING gin(to_tsvector('english', title));
CREATE INDEX idx_products_description_search ON products USING gin(to_tsvector('english', description));

-- ===========================
-- ROW LEVEL SECURITY (RLS)
-- ===========================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (Users can only access their own data)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own addresses" ON addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own cart" ON cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own cart" ON cart_items FOR ALL USING (auth.uid() = user_id);

-- Products are public
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (status = 'active');

-- ===========================
-- FUNCTIONS & TRIGGERS
-- ===========================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'BREVI-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TICKET-' || LPAD(NEXTVAL('ticket_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq;
```

---

## 🚀 Implementation Requirements

### 1. **Supabase Setup & Configuration**

```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createClient = () => createClientComponentClient()

export const createServerClient = () => createServerComponentClient({ cookies })

// Environment variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. **Authentication System**

**Requirements:**
- Implement Supabase Auth for login, registration, password reset
- Protected routes using middleware
- Session management with cookies
- Email verification flow
- Social login (optional: Google, Facebook)

```typescript
// middleware.ts - Protect routes
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect /account routes
  if (req.nextUrl.pathname.startsWith('/account') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Protect /admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    
    // Check if user is admin
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
  matcher: ['/account/:path*', '/admin/:path*']
}
```

### 3. **Performance Optimization Strategies**

**Critical Requirements:**

#### A. Server Components & Data Fetching
```typescript
// app/product/page.tsx - Use Server Component for initial data
export default async function ProductPage() {
  const supabase = createServerClient()
  
  // Parallel queries for speed
  const [
    { data: product },
    { data: variants },
    { data: reviews }
  ] = await Promise.all([
    supabase.from('products').select('*').eq('slug', 'brevi-toothbrush').single(),
    supabase.from('product_variants').select('*').eq('product_id', productId),
    supabase.from('reviews').select('*, review_images(*), profiles(first_name)').eq('product_id', productId).eq('is_approved', true).limit(20)
  ])
  
  return <ProductHero product={product} variants={variants} reviews={reviews} />
}
```

#### B. Caching Strategy
```typescript
// Use Next.js cache and revalidation
export const revalidate = 3600 // Revalidate every hour

// For frequently changing data, use React Query
'use client'
import { useQuery } from '@tanstack/react-query'

export function CartItems() {
  const { data: cart } = useQuery({
    queryKey: ['cart'],
    queryFn: () => supabase.from('cart_items').select('*, product_variants(*)'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
```

#### C. Database Query Optimization
```typescript
// GOOD: Select only needed columns
const { data } = await supabase
  .from('orders')
  .select('id, order_number, total, created_at')
  .eq('user_id', userId)

// GOOD: Use joins efficiently
const { data } = await supabase
  .from('cart_items')
  .select(`
    id,
    quantity,
    product_variants (
      id,
      color,
      price,
      products (title, base_price)
    )
  `)

// GOOD: Pagination
const { data, count } = await supabase
  .from('orders')
  .select('*', { count: 'exact' })
  .range(0, 19) // First 20 items
```

#### D. Realtime Features (Cart Updates)
```typescript
// lib/hooks/use-cart.ts
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useCart(userId: string) {
  const supabase = createClient()
  
  useEffect(() => {
    const channel = supabase
      .channel('cart-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_items',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Invalidate cart query
          queryClient.invalidateQueries(['cart'])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
```

#### E. Image Optimization
```typescript
// Use Supabase Storage + Next.js Image
import Image from 'next/image'

export function ProductImage({ path }: { path: string }) {
  const supabase = createClient()
  const { data } = supabase.storage.from('products').getPublicUrl(path)
  
  return (
    <Image
      src={data.publicUrl}
      alt="Product"
      width={800}
      height={800}
      priority
      quality={85}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  )
}
```

### 4. **Shopping Cart Implementation**

**Requirements:**
- Server Actions for mutations (add, update, remove)
- Optimistic updates for instant UI feedback
- Persistent cart across sessions
- Support for anonymous users (session-based)

```typescript
// app/actions/cart.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addToCart(variantId: string, quantity: number) {
  const supabase = createServerClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user.id
  
  // Upsert cart item
  const { data, error } = await supabase
    .from('cart_items')
    .upsert({
      user_id: userId,
      variant_id: variantId,
      quantity,
      updated_at: new Date().toISOString()
    })
    .select()
  
  if (error) throw error
  
  revalidatePath('/cart')
  return { success: true, data }
}

export async function removeFromCart(cartItemId: string) {
  const supabase = createServerClient()
  
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
  
  if (error) throw error
  
  revalidatePath('/cart')
  return { success: true }
}
```

### 5. **Checkout & Order Processing**

**Requirements:**
- Single-page checkout flow
- Server-side order creation
- Payment processing with Stripe
- Inventory management (reduce stock)
- Order confirmation emails

```typescript
// app/actions/checkout.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function createOrder(formData: CheckoutFormData) {
  const supabase = createServerClient()
  
  // Start transaction
  const { data: cart } = await supabase
    .from('cart_items')
    .select('*, product_variants(*)')
    .eq('user_id', formData.userId)
  
  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.product_variants.price), 0)
  const total = subtotal + formData.shippingCost - formData.discountAmount
  
  // Create Stripe payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100), // Convert to cents
    currency: 'usd',
    metadata: {
      userId: formData.userId
    }
  })
  
  // Create order
  const { data: order } = await supabase
    .from('orders')
    .insert({
      order_number: await generateOrderNumber(),
      user_id: formData.userId,
      customer_email: formData.email,
      subtotal,
      total,
      shipping_address: formData.shippingAddress,
      billing_address: formData.billingAddress,
      payment_status: 'pending'
    })
    .select()
    .single()
  
  // Create order items
  const orderItems = cart.map(item => ({
    order_id: order.id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: item.product_variants.price,
    line_total: item.quantity * item.product_variants.price
  }))
  
  await supabase.from('order_items').insert(orderItems)
  
  // Clear cart
  await supabase.from('cart_items').delete().eq('user_id', formData.userId)
  
  // Send confirmation email (via Edge Function or Resend)
  
  return { orderId: order.id, clientSecret: paymentIntent.client_secret }
}
```

### 6. **Product Reviews System**

**Requirements:**
- Submit reviews with ratings (1-5 stars)
- Upload review images to Supabase Storage
- Approve/reject reviews (admin)
- Filter and sort reviews
- Verified purchase badges

```typescript
// app/actions/reviews.ts
'use server'

export async function submitReview(productId: string, reviewData: ReviewData) {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) throw new Error('Must be logged in')
  
  // Check if user purchased this product
  const { data: hasPurchased } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', productId)
    .eq('orders.user_id', session.user.id)
    .limit(1)
  
  // Insert review
  const { data: review } = await supabase
    .from('reviews')
    .insert({
      product_id: productId,
      user_id: session.user.id,
      rating: reviewData.rating,
      title: reviewData.title,
      comment: reviewData.comment,
      is_verified_purchase: hasPurchased.length > 0
    })
    .select()
    .single()
  
  // Upload images if provided
  if (reviewData.images?.length > 0) {
    for (const image of reviewData.images) {
      const fileName = `${review.id}/${Date.now()}-${image.name}`
      const { data: upload } = await supabase.storage
        .from('review-images')
        .upload(fileName, image)
      
      await supabase.from('review_images').insert({
        review_id: review.id,
        image_url: upload.path
      })
    }
  }
  
  return { success: true, reviewId: review.id }
}
```

### 7. **Loyalty Program**

**Requirements:**
- Automatic points on purchase
- Points for reviews, referrals, birthdays
- Tiered membership (Bronze, Silver, Gold, Platinum)
- Rewards catalog with redemption
- Points transaction history

```typescript
// lib/loyalty/points.ts
export async function awardPoints(
  userId: string,
  points: number,
  type: 'purchase' | 'review' | 'referral' | 'birthday',
  referenceId?: string
) {
  const supabase = createServerClient()
  
  // Get member
  const { data: member } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  const newBalance = member.points_balance + points
  
  // Update member balance
  await supabase
    .from('loyalty_members')
    .update({
      points_balance: newBalance,
      lifetime_points: member.lifetime_points + points
    })
    .eq('id', member.id)
  
  // Record transaction
  await supabase.from('loyalty_transactions').insert({
    member_id: member.id,
    points_change: points,
    transaction_type: type,
    reference_id: referenceId,
    balance_after: newBalance
  })
  
  // Check tier upgrade
  await checkTierUpgrade(member.id, newBalance)
}
```

### 8. **Email Marketing & Automations**

**Requirements:**
- Campaign creation with rich content
- Subscriber management
- Automated flows (Welcome, Abandoned Cart, Post-Purchase, Win-back)
- Email templates with personalization
- Analytics (opens, clicks, conversions)

**Use Resend or SendGrid for email delivery:**

```typescript
// lib/email/automations.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail(email: string, firstName: string) {
  await resend.emails.send({
    from: 'BREVI <hello@brevibrushes.com>',
    to: email,
    subject: 'Welcome to BREVI! 🎉',
    html: `<p>Hi ${firstName},</p><p>Welcome to BREVI...</p>`
  })
  
  // Log to database
  const supabase = createServerClient()
  await supabase.from('email_automation_logs').insert({
    automation_type: 'welcome',
    recipient_email: email,
    sent_at: new Date().toISOString()
  })
}

// Trigger via Edge Function or Supabase webhook
export async function triggerAbandonedCartEmail(cartId: string) {
  // Check if cart was abandoned for 1 hour
  // Send email with cart contents
}
```

### 9. **Admin Dashboard**

**Requirements:**
- Protected admin routes (role-based)
- Dashboard with key metrics
- Product management (CRUD)
- Order fulfillment interface
- CMS content editor
- Analytics visualization
- Support ticket management with AI suggestions

```typescript
// app/admin/page.tsx - Dashboard
export default async function AdminDashboard() {
  const supabase = createServerClient()
  
  // Parallel queries for dashboard stats
  const [
    { count: totalOrders },
    { data: recentOrders },
    { data: revenue }
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.rpc('calculate_revenue', { period: '30d' })
  ])
  
  return <AdminDashboardUI stats={{ totalOrders, recentOrders, revenue }} />
}
```

### 10. **AI Chat Support**

**Requirements:**
- Chat widget on all pages
- AI-powered responses using OpenAI
- Escalation to human support
- Chat history per user
- Admin panel for managing conversations

```typescript
// app/api/chat/route.ts
import OpenAI from 'openai'
import { createServerClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  const { message, userId } = await req.json()
  
  const supabase = createServerClient()
  
  // Get conversation history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(10)
  
  const messages = history.map(h => ({
    role: h.role,
    content: h.content
  }))
  
  messages.push({ role: 'user', content: message })
  
  // Get AI response
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful BREVI customer support agent. Help customers with product questions, orders, and general inquiries.'
      },
      ...messages
    ]
  })
  
  const aiResponse = completion.choices[0].message.content
  
  // Save messages
  await supabase.from('chat_messages').insert([
    { user_id: userId, role: 'user', content: message },
    { user_id: userId, role: 'assistant', content: aiResponse }
  ])
  
  return Response.json({ message: aiResponse })
}
```

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up Next.js 15 project with TypeScript
- [ ] Configure Tailwind CSS v4
- [ ] Install and configure Supabase client
- [ ] Create database schema (run SQL above)
- [ ] Set up authentication (login, register, password reset)
- [ ] Create protected route middleware
- [ ] Implement basic layout (header, footer)
- [ ] Set up shadcn/ui components

### Phase 2: Core E-Commerce (Week 2)
- [ ] Product listing page with filtering
- [ ] Product detail page with variants
- [ ] Shopping cart (add, update, remove) with Server Actions
- [ ] Cart drawer component with realtime updates
- [ ] Multi-buy pricing calculation
- [ ] Checkout page (single-page flow)
- [ ] Stripe payment integration
- [ ] Order confirmation and email

### Phase 3: Customer Features (Week 3)
- [ ] Customer account dashboard
- [ ] Order history and tracking
- [ ] Profile settings with address management
- [ ] Product review submission with images
- [ ] Review filtering and sorting
- [ ] Loyalty program (earn points, view rewards)
- [ ] Loyalty rewards redemption
- [ ] Referral program

### Phase 4: Admin System (Week 4)
- [ ] Admin dashboard with metrics
- [ ] Product management (CRUD) with variants
- [ ] Order management with fulfillment
- [ ] Order tracking number assignment
- [ ] CMS content editor (hero, menu, topbar)
- [ ] Email campaign creation
- [ ] Email automations setup
- [ ] Promotions/discount codes management
- [ ] Analytics dashboard with charts

### Phase 5: Advanced Features (Week 5)
- [ ] Support ticket system
- [ ] AI chat widget with OpenAI integration
- [ ] AI-suggested support responses
- [ ] Advanced analytics (revenue, conversion, customer insights)
- [ ] Loyalty program admin panel
- [ ] Email automation triggers
- [ ] Abandoned cart recovery
- [ ] Win-back campaigns

### Phase 6: Performance & Polish (Week 6)
- [ ] Optimize database queries (add missing indexes)
- [ ] Implement caching strategy (React Query)
- [ ] Image optimization (Supabase Storage CDN)
- [ ] Server Component optimization
- [ ] Bundle size optimization
- [ ] Lighthouse performance audit (target 95+)
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing
- [ ] Security audit (XSS, CSRF, SQL injection)
- [ ] Load testing

---

## 🎨 UI/UX Requirements

### Design Consistency
- Use shadcn/ui components throughout
- Maintain BREVI color scheme (mint/teal green: `hsl(160 84% 39%)`)
- Consistent spacing and typography
- Smooth transitions and animations
- Loading states for all async operations
- Error handling with user-friendly messages

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly interactive elements (48px minimum)
- Optimized images for different screen sizes

### Accessibility
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Focus states on interactive elements
- Color contrast ratio (WCAG AA)

---

## ⚡ Performance Targets

### Core Web Vitals
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Database Performance
- All queries must use indexed columns
- Join queries should complete in < 50ms
- Use connection pooling (Supabase Pooler)
- Implement query result caching

### Page Load Times
- Homepage: < 1.5s (FCP)
- Product page: < 2s (FCP)
- Cart/Checkout: < 1s (FCP)
- Admin dashboard: < 2s (FCP)

---

## 🔒 Security Requirements

### Authentication
- Supabase Auth with email verification
- Password hashing (bcrypt via Supabase)
- JWT tokens with httpOnly cookies
- Session timeout (7 days)
- Rate limiting on auth endpoints

### Data Protection
- Row Level Security (RLS) on all user tables
- Input validation on all forms
- SQL injection prevention (Supabase parameterized queries)
- XSS protection (React auto-escaping)
- CSRF tokens on forms

### Payment Security
- PCI compliance via Stripe
- No credit card data stored locally
- Stripe Elements for secure card input
- 3D Secure support

---

## 📦 Deployment

### Environment Setup
```bash
# Production environment variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=https://brevibrushes.com
```

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Supabase Production Setup
1. Create production project on Supabase
2. Run database migrations
3. Configure RLS policies
4. Set up Supabase Storage buckets (products, review-images)
5. Enable Supabase Realtime for cart_items table
6. Configure email auth settings

---

## 🧪 Testing Requirements

### Unit Tests
- Test all utility functions
- Test cart calculations
- Test loyalty points calculations
- Test discount code validation

### Integration Tests
- Test checkout flow end-to-end
- Test order creation and fulfillment
- Test review submission
- Test loyalty redemption

### E2E Tests (Playwright)
- Test user registration and login
- Test add to cart → checkout → order confirmation
- Test admin product creation
- Test order fulfillment workflow

---

## 📚 Documentation Requirements

- [ ] API documentation for all Server Actions
- [ ] Database schema diagram
- [ ] Component documentation (Storybook optional)
- [ ] Deployment guide
- [ ] Admin user guide
- [ ] Customer user guide

---

## 🚨 Critical Implementation Notes

1. **ALWAYS use Server Components by default** - only use 'use client' when necessary
2. **NEVER expose service role key** - only use on server-side
3. **Implement optimistic updates** for instant UI feedback
4. **Use parallel queries** (Promise.all) wherever possible
5. **Index all foreign keys** and frequently queried columns
6. **Use Supabase Pooler** for production (PgBouncer mode)
7. **Implement proper error boundaries** for graceful error handling
8. **Use Suspense and loading.tsx** for better UX
9. **Validate all inputs** on both client and server
10. **Log all critical operations** (orders, payments, auth)

---

## 🎯 Success Criteria

The implementation is complete when:

✅ All frontend pages match the README specifications  
✅ All admin features are functional  
✅ Database is properly set up with indexes and RLS  
✅ Authentication and authorization work correctly  
✅ Shopping cart and checkout flow are smooth  
✅ Order tracking is real-time and accurate  
✅ Email automations trigger correctly  
✅ Loyalty program functions end-to-end  
✅ AI chat provides helpful responses  
✅ Performance targets are met (Lighthouse 95+)  
✅ Security best practices are implemented  
✅ All critical user flows are tested  

---

## 💡 Additional Recommendations

### State Management
- Use **Server State**: React Query for data fetching
- Use **UI State**: Zustand or React Context for global UI state
- Use **Form State**: React Hook Form with Zod validation

### Error Handling
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
  }
}

// Usage in Server Actions
export async function addToCart(variantId: string, quantity: number) {
  try {
    // ... code
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message, code: error.code }
    }
    return { error: 'An unexpected error occurred', code: 'UNKNOWN_ERROR' }
  }
}
```

### Monitoring & Logging
- Set up Sentry for error tracking
- Use Vercel Analytics for performance monitoring
- Log all Stripe webhooks
- Track key business metrics (conversion rate, AOV, cart abandonment)

### SEO Optimization
- Implement proper meta tags (next/head or Metadata API)
- Generate sitemap.xml
- Add structured data (JSON-LD) for products
- Optimize images with alt text
- Implement canonical URLs

---

## 🔗 Useful Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [React Query](https://tanstack.com/query/latest)
- [Playwright Testing](https://playwright.dev)

---

## 📝 Final Notes

This prompt provides a complete blueprint for implementing the BREVI e-commerce platform with:

1. **Optimized Supabase setup** with proper indexing and RLS
2. **High-performance architecture** using Server Components and parallel queries
3. **Complete feature set** including loyalty, reviews, email automation, and AI support
4. **Security best practices** with authentication and data protection
5. **Scalable database schema** that can handle growth
6. **Clear implementation roadmap** with phased approach

**Start with Phase 1 (Foundation) and work through each phase systematically. Test thoroughly at each stage before moving forward.**

Good luck with the implementation! 🚀
