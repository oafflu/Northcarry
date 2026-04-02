# Northcarry - E-Commerce Platform

A comprehensive e-commerce platform for BREVI, a sustainable premium toothbrush brand. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4.

## Recent updates (late March 2026)

### Checkout, subscriptions, and Stripe

- **Duplicate ongoing subscriptions**: Fixed a race where `customer.subscription.created` could create a `customer_subscriptions` row before checkout finished, and `createCustomerSubscription` would insert a second row. The webhook now **defers** auto-insert when Stripe subscription metadata includes a Brevi `orderNumber` (checkout-owned rows), links pending rows only when `subscription_product_id` matches, and **`createCustomerSubscription`** reuses an existing row by **`stripe_subscription_id`** when present (idempotent first-cycle / `subscription_orders` linking).
- **`payment_intent.succeeded`**: Removed an early exit that skipped snapshot-based order recovery when `has_subscription_items` was true but the order row was not found yet—webhook processing can continue to fallbacks and incomplete-payment handling.
- **Cart / prepaid**: Subscription cart lines support **`prepaid_cycles`** (see `scripts/add-prepaid-cycles-to-cart-items.sql` if migrating); checkout and subscription creation use it for prepaid totals and cycles.

### Email marketing and segments

- **Segment member list**: Admins can open **`/admin/email-marketing/segments/[id]`** from the segments grid (segment title or **View list**) to see **searchable, paginated** customers in the segment, with **View** (customer detail) and **Unsubscribe** (marketing opt-out) actions.
- **Unified segment resolution**: **`resolveSegmentConditionsToEmails`** in `app/actions/email-segments.ts` drives **subscriber counts**, **campaign recipient lists**, and the detail page so behavior stays consistent.
- **Marketing opt-out segment**: Segment builder includes **“Marketing emails (subscribed / unsubscribed)”** (`newsletter_status` equals `unsubscribed` or `active`) to target customers who opted out (or in), using `email_subscribers` and `newsletter_subscriptions`.
- **Unsubscribe ↔ admin customer UI**: Public **`/api/unsubscribe`** now sets **`user_id`** on `email_subscribers` when the email matches a customer profile; **`GET /api/admin/customers/email-opt`** falls back to email and newsletter tables. **Mailgun** `unsubscribed` events also sync the same tables so the **Marketing Emails** toggle on **`/admin/customers/[id]`** stays accurate.

### Admin “Research & updates” vs sample requests

- **Supplier portal** still uses the sidebar label **Research & updates** at **`/supplier/research-updates`**.
- **Admin** lists and edits the same workflow under **Sample requests** at **`/admin/sample-requests`**; per-supplier context remains on **`/admin/suppliers/[id]`** → **Research** tab. Only the **nav label** differs.

## 🌟 Features

### Frontend Features
- **Responsive Design**: Fully responsive desktop and mobile layouts
- **Product Catalog**: Browse and filter products with variant selection
- **Shopping Cart**: Real-time cart updates with drawer interface
- **Checkout System**: Shopify-inspired one-page checkout
- **Product Variants**: Color selection (Black, White, Green, Pink, Bamboo)
- **Multi-Buy Pricing**: Quantity discounts (Buy 2: 10% off, Buy 3: 15% off, Buy 5: 20% off)
- **Real-time Notifications**: Toast notifications for cart actions
- **Trust Badges**: Shipping, quality, and guarantee indicators
- **Customer Accounts**: Full authentication system with login, registration, and password reset
- **Order Tracking**: Real-time order status with fulfillment timeline
- **Product Reviews**: Customer reviews with ratings, photos, and verified purchase badges
- **Loyalty Program**: Points-based rewards system with tiered membership levels

### Admin Features
- **Dashboard**: Shopify-inspired dashboard with comprehensive metrics (Revenue, Orders, AOV, COGs, Profit, Sessions, Subscriptions, New Customers) with date range selection and period comparison
- **Product Management**: CRUD operations for products with variants and pricing
- **Product-Supplier Linking**: Link product variants to supplier inventory with lead times
- **Inventory Management**: View and manage supplier inventory across all suppliers
- **Customer Management**: Shopify-style customer management with order history, spending analytics, and CSV import with auto-segment creation
- **User Management**: Create and manage users (customers, suppliers, admins) with role-based access
- **CMS System**: Content management for all website sections
- **Order Management**: Order tracking with fulfillment status, supplier assignments, customer address editing with email notifications, and replacement request functionality
- **Returns & Replacements Management**: Complete return/replacement system with admin/partner request creation, supplier fulfillment tracking, and customer notifications
- **Email Marketing**: Campaign creation and subscriber management
- **Email Automations**: Trigger-based email flows (Welcome, Abandoned Cart, Post-Purchase, Win-back)
- **Email Templates**: Role-specific welcome emails (Customer, Admin, Supplier) with test functionality
- **Email Segments**: Advanced segmentation with auto-creation for imported customers; **per-segment member browser** at `/admin/email-marketing/segments/[id]` (search, pagination, view customer, unsubscribe); **marketing subscribed/unsubscribed** rules aligned with `email_subscribers`, campaigns, and customer detail
- **Promotions**: Discount code management with advanced rules
- **AI Support System**: Intelligent ticket management with AI-suggested responses, order tracking integration, and dynamic reply templates
- **Advanced Analytics**: Detailed revenue tracking, conversion rates, and customer insights
- **Loyalty Management**: Configure rewards, tiers, and redemption options
- **Media Library**: Centralized media management with Supabase Storage (CMS, products, user profiles)
- **Review Management**: Full review moderation system with bulk actions, email automation, and advanced filtering
- **Admin Settings**: Comprehensive settings management (General, Email, Push Notifications, Payment, Countries, Currencies, Languages)
- **User Management**: Create and manage users (customers, suppliers, admins) with automatic welcome emails
- **Marketing System**: Complete marketing platform with Meta, Google, TikTok integrations, and comprehensive affiliate program
- **Affiliate Management**: Full affiliate system with tier management, invitation system, commission tracking, and payout processing
- **Suppliers Management**: Supplier directory with KPIs (assignments, fulfillment, invoices); per-supplier detail at `/admin/suppliers/[id]` with **Overview**, **Messages** (admin–supplier chat), **Performance** (assignment log), **Payments** (recent invoices), and **Research & updates** (sample requests by type). Chat and sample workflows trigger **email** and **FCM web push** to the right roles.

### Supplier Features
- **Supplier Portal**: Dedicated dashboard for supplier account management
- **Inventory Management**: Manage product inventory with SKU tracking, stock levels, and reorder points
- **Order Fulfillment**: View assigned orders, acknowledge, process, and ship orders with tracking
- **Returns Management**: Process customer returns with inspection and restocking capabilities, replacement shipping with tracking, and email notifications to customers, admins, and partners
- **Performance Metrics**: Track fulfillment rates, on-time delivery, and quality scores
- **Messages**: Threaded conversations with BREVI admins at `/supplier/messages`; new admin messages notify suppliers by **email** and **push**; supplier replies notify admins and partners the same way.
- **Research & updates**: Unified hub at `/supplier/research-updates` for **new product research** (custom samples) and **existing product** sample / catalog updates—the same data as sample requests, aligned with the admin supplier **Research & updates** tab. The legacy list URL `/supplier/sample-requests` redirects here; request details stay at `/supplier/sample-requests/[id]` (deep links from email/push still work).

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **State Management**: React Context API
- **Image Optimization**: Next.js Image component
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **Push notifications**: Firebase Cloud Messaging (FCM) for in-app and web push; configured under Admin → Settings → Notifications / Push (see `env.example` for `NEXT_PUBLIC_FIREBASE_*` and server `FIREBASE_*` keys)
- **Storage**: Supabase Storage
- **Backend**: Server Actions (Next.js)

## 📁 Project Structure

\`\`\`
brevi/
├── app/
│   ├── layout.tsx                  # Root layout with providers
│   ├── page.tsx                    # Homepage
│   ├── globals.css                 # Global styles and design tokens
│   ├── product/
│   │   └── page.tsx               # Product detail page
│   ├── cart/
│   │   └── page.tsx               # Shopping cart page
│   ├── checkout/
│   │   └── page.tsx               # Checkout page
│   ├── login/
│   │   └── page.tsx               # Customer login
│   ├── register/
│   │   └── page.tsx               # Customer registration
│   ├── forgot-password/
│   │   └── page.tsx               # Password reset
│   ├── account/
│   │   ├── page.tsx               # Account dashboard
│   │   ├── orders/
│   │   │   ├── page.tsx           # Order history
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Order tracking details
│   │   ├── profile/
│   │   │   └── page.tsx           # Profile settings
│   │   └── loyalty/
│   │       └── page.tsx           # Loyalty rewards dashboard
│   └── admin/
│       ├── layout.tsx             # Admin layout with sidebar
│       ├── page.tsx               # Admin dashboard
│       ├── products/
│       │   ├── page.tsx           # Products listing
│       │   ├── new/
│       │   │   └── page.tsx       # Add new product
│       │   └── [id]/
│       │       └── page.tsx       # Edit product
│       ├── orders/
│       │   ├── page.tsx           # Orders listing
│       │   └── [id]/
│       │       └── page.tsx       # Order details & fulfillment
│       ├── cms/
│       │   ├── page.tsx           # CMS hub
│       │   ├── hero/
│       │   │   └── page.tsx       # Hero banner management
│       │   ├── menu/
│       │   │   └── page.tsx       # Navigation menu management
│       │   └── topbar/
│       │       └── page.tsx       # Top bar announcement
│       ├── email-marketing/
│       │   ├── page.tsx           # Campaigns dashboard
│       │   ├── new/
│       │   │   └── page.tsx       # Create campaign
│       │   ├── segments/
│       │   │   ├── page.tsx       # Segment list & builder
│       │   │   └── [id]/
│       │   │       └── page.tsx   # Segment members (search, view, unsubscribe)
│       │   └── automations/
│       │       └── page.tsx       # Email automation flows
│       ├── promotions/
│       │   ├── page.tsx           # Promotions listing
│       │   └── new/
│       │       └── page.tsx       # Create promotion
│       ├── analytics/
│       │   └── page.tsx           # Advanced analytics dashboard
│       ├── loyalty/
│       │   └── page.tsx           # Loyalty program management
│       └── support/
│           ├── page.tsx           # Support tickets dashboard
│           └── [id]/
│               └── page.tsx       # Ticket details with AI suggestions
│       ├── inventory/
│       │   └── page.tsx           # Inventory management across suppliers
│       ├── customers/
│       │   └── page.tsx           # Customer management (Shopify-style)
│       ├── users/
│       │   └── page.tsx           # User management (create/edit customers, suppliers, admins)
│       └── suppliers/
│           ├── page.tsx           # Suppliers directory
│           └── [id]/
│               └── page.tsx       # Supplier detail (overview, messages, performance, payments, research)
│   └── supplier/
│       ├── layout.tsx             # Supplier portal layout
│       ├── page.tsx               # Supplier dashboard
│       ├── messages/
│       │   └── page.tsx           # Admin–supplier message threads
│       ├── research-updates/
│       │   └── page.tsx           # Research & updates (sample requests hub)
│       ├── sample-requests/
│       │   ├── page.tsx           # Redirects to /supplier/research-updates
│       │   └── [id]/
│       │       └── page.tsx       # Sample request detail & supplier actions
│       ├── notifications/
│       │   └── page.tsx           # In-app notifications
│       ├── inventory/
│       │   └── page.tsx           # Supplier inventory management
│       ├── orders/
│       │   ├── page.tsx           # Supplier orders listing
│       │   └── [id]/
│       │       └── page.tsx       # Order detail and fulfillment
│       ├── returns/
│       │   ├── page.tsx           # Returns management
│       │   └── [id]/
│       │       └── page.tsx       # Return detail and processing
│       ├── performance/
│       │   └── page.tsx           # Performance metrics dashboard
│       └── payment/               # Payment methods, history, invoices
├── components/
│   ├── header.tsx                 # Site header with cart
│   ├── footer.tsx                 # Site footer
│   ├── hero-section.tsx           # Homepage hero
│   ├── features-section.tsx       # Feature icons
│   ├── cart-drawer.tsx            # Sliding cart drawer
│   ├── add-to-cart-notification.tsx  # Toast notifications
│   ├── product/
│   │   ├── product-hero.tsx       # Product images & details
│   │   ├── product-features.tsx   # Product trust badges
│   │   ├── bristles-section.tsx   # 12,000 bristles section
│   │   ├── brush-section.tsx      # Brush features
│   │   ├── sensitive-section.tsx  # Sensitive variant showcase
│   │   ├── bamboo-section.tsx     # Bamboo variant showcase
│   │   ├── confidence-section.tsx # Buy with confidence
│   │   ├── reviews-section.tsx    # Customer reviews display
│   │   ├── review-form.tsx        # Review submission form
│   │   └── interactive-reviews.tsx # Reviews with filtering
│   ├── cart/
│   │   └── cart-content.tsx       # Cart items & summary
│   └── ui/                        # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── textarea.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       └── ... (other UI components)
├── lib/
│   ├── cart-context.tsx           # Cart state management
│   ├── auth-context.tsx           # Authentication state management
│   ├── email.ts                   # Email service (Mailgun/SMTP)
│   ├── permissions.ts             # Role-based access control
│   └── utils.ts                   # Utility functions
├── app/
│   └── actions/
│       ├── affiliates.ts          # Affiliate management actions
│       ├── marketing.ts           # Marketing metrics actions
│       ├── marketing-integrations.ts  # Platform integration actions
│       └── attribution.ts         # Attribution tracking actions
├── app/
│   └── api/
│       └── affiliate/
│           └── track/
│               └── route.ts      # Affiliate click tracking API
├── components/
│   └── affiliate-tracker.tsx      # Client-side affiliate tracking component
└── scripts/
    └── create-marketing-tables.sql  # Marketing system database schema
├── public/
│   ├── brevi-logo.png            # Main logo
│   └── images/                    # Product and banner images
│       └── brevi_banner_web.png
└── README.md

\`\`\`

## 🌐 Frontend Pages

### 1. Homepage (`/`)
**Route**: `/`  
**Component**: `app/page.tsx`

**Sections**:
- **Header**: Logo, navigation (Home, Shop Now, About Us), cart icon with badge
- **Top Bar**: "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS"
- **Hero Section**: Large banner with 50% off promotion and Shop Now button
- **Features**: Five trust badges (Premium Quality, Wallet Friendly, Eco Safe, Organic, People Welcome)
- **Product Sections**: 
  - Ultra-Soft Bristles
  - Sensitive (with mint background)
  - Bamboo Toothbrush
- **Reviews**: Customer testimonials and ratings
- **Footer**: Contact info, customer service links, newsletter signup

**Key Features**:
- Responsive layout with mobile and desktop views
- Interactive star ratings
- Smooth scrolling between sections
- Newsletter subscription form

### 2. Product Page (`/product`)
**Route**: `/product`  
**Component**: `app/product/page.tsx`

**Sections**:
- **Product Hero**:
  - Product image gallery with thumbnails
  - Product title: "BREVI™ Nordic-Inspired Premium Nano Toothbrush"
  - Star rating (5 stars, 339 reviews)
  - Price: $14.99 (was $30.99) - 50% OFF EASTER SALE TODAY!
  - Color variants: Black, White, Green, Pink, Bamboo
  - Multi-buy options:
    - Buy 1: $14.99
    - Buy 2: $26.98 (10% off)
    - Buy 3: $38.22 (15% off - Most Popular)
    - Buy 5: $59.96 (20% off)
  - Quantity selector
  - Add to Cart button
  - Inventory status
  - Payment method icons

- **Trust Features**: Free shipping, 24/7 support, premium quality, 30-day guarantee, not available on Amazon, love it guarantee

- **12,000 Bristles Section**: 80μm bristle technology with key benefits

- **The Brush Section**: Lightweight & ergonomic design features

- **Sensitive Section**: SENSITIVE variant showcase with mint background

- **Buy With Confidence**: Money-back guarantee information

- **Reviews Section**: 
  - Customer testimonials with photos and ratings
  - Interactive review submission form (requires login)
  - Star rating selector
  - Photo upload capability
  - Review filtering by rating (5★, 4★, 3★, etc.)
  - Sorting options (Most Recent, Highest Rating, Lowest Rating, Most Helpful)
  - Verified purchase badges
  - Review statistics and distribution

**Key Features**:
- Image gallery with thumbnail navigation
- Color variant selector with image switching
- Multi-buy pricing calculator
- Real-time cart updates
- Toast notifications on add to cart
- Cart drawer opens automatically after adding item
- Submit reviews with ratings and photos
- Filter and sort customer reviews
- Verified purchase indicators

### 3. Cart Page (`/cart`)
**Route**: `/cart`  
**Component**: `app/cart/page.tsx`

**Sections**:
- **Cart Header**: "Your Cart" heading with "Need Assistance? Call (848) 800-4029"
- **Cart Items**:
  - Product image
  - Product name and variant
  - Color indicator
  - Quantity controls (+/-)
  - Price (current and original)
  - Remove button
  - "Checkout now to get this sale" badge

- **Order Summary** (Sidebar):
  - Old price
  - Discount
  - Subtotal
  - Free Shipping Today Only
  - Price reservation timer (countdown)
  - Proceed to Checkout button
  - Payment method icons

- **Trust Badges**:
  - FREE Worldwide Express Shipping
  - 24/7 Dedicated Customer Service
  - Premium Quality Guaranteed
  - 30 Days Money Back
  - Not Available on Amazon or in Stores!
  - We Guarantee that you will absolutely love it!

- **About Your Delivery**: Shipping information

- **Love it, or Your Money Back**: 30-day guarantee details

**Key Features**:
- Real-time quantity updates
- Price calculations with discounts
- Countdown timer for price reservation
- Empty cart state handling
- Continue shopping option

### 4. Checkout Page (`/checkout`)
**Route**: `/checkout`  
**Component**: `app/checkout/page.tsx`

**Structure**: Two-column layout (Shopify-style)

**Left Column - Checkout Form**:
1. **Express Checkout**: Shop Pay, PayPal, Google Pay buttons
2. **Contact Section**:
   - Email or mobile phone number
   - "Email me with news and offers" checkbox
3. **Delivery Section**:
   - Country/Region dropdown
   - First name & Last name
   - Address fields
   - City, State, ZIP code
   - Phone number (optional)
   - "Save this information for next time" checkbox
4. **Shipping Method**:
   - Standard Shipping (4-10 business days) - FREE
   - Express Shipping (2-5 business days) - $4.99
5. **Payment Section**:
   - Card number
   - Expiration date
   - Security code
   - Name on card
   - Billing address same as shipping checkbox
6. **Pay Now Button**

**Right Column - Order Summary**:
- Product list with images, quantities, and prices
- Discount code input
- Subtotal
- Shipping cost
- Total amount

**Key Features**:
- Form validation
- Real-time total calculations
- Secure payment processing
- Mobile-responsive design
- Progress indicators

## 👤 Customer Account Pages

### 5. Login Page (`/login`)
**Route**: `/login`  
**Component**: `app/login/page.tsx`

**Features**:
- Email/password login form
- "Remember me" checkbox
- Form validation
- Error handling
- "Forgot password?" link
- "Create account" link
- Redirect to account dashboard on success

**Demo Credentials**:
\`\`\`
Email: customer@brevibrushes.com
Password: customer123
\`\`\`

### 6. Registration Page (`/register`)
**Route**: `/register`  
**Component**: `app/register/page.tsx`

**Features**:
- Create new account form
  - First name
  - Last name
  - Email
  - Password
  - Password confirmation
- Form validation
- Email format validation
- Password strength indicator
- Terms of service acceptance
- Already have account link
- Automatic login after registration

### 7. Forgot Password (`/forgot-password`)
**Route**: `/forgot-password`  
**Component**: `app/forgot-password/page.tsx`

**Features**:
- Email input for password reset
- Send reset link via email
- Success message confirmation
- Back to login link

### 8. Account Dashboard (`/account`)
**Route**: `/account`  
**Component**: `app/account/page.tsx`

**Protected Route**: Requires authentication

**Sections**:
- **Welcome Message**: "Welcome back, [Customer Name]!"
- **Order Summary Cards**:
  - Total Orders
  - Pending Orders
  - Completed Orders
  - Total Spent
- **Recent Orders**: Quick view of last 5 orders with status
- **Account Details**:
  - Name
  - Email
  - Phone
  - Member since date
  - Edit profile link
- **Quick Actions**:
  - View all orders
  - Track order
  - Edit profile
  - View loyalty rewards
- **Loyalty Program Summary**:
  - Current points balance
  - Tier level
  - Points to next tier
  - Available rewards

### 9. Order History (`/account/orders`)
**Route**: `/account/orders`  
**Component**: `app/account/orders/page.tsx`

**Features**:
- Complete order history table
- Search orders by number or product
- Filter by status:
  - All Orders
  - Processing
  - Shipped
  - Delivered
  - Cancelled
- Date range filter
- Orders display:
  - Order number (clickable)
  - Order date
  - Status badge
  - Items count
  - Total amount
  - Track order button
- Pagination
- Empty state for no orders

### 10. Order Tracking (`/account/orders/[id]`)
**Route**: `/account/orders/[id]`  
**Component**: `app/account/orders/[id]/page.tsx`

**Sections**:
1. **Order Header**:
   - Order number
   - Order date
   - Status badge
   - Estimated delivery date

2. **Tracking Timeline**:
   - Order placed ✓
   - Processing ✓
   - Shipped (with tracking number and carrier)
   - In transit
   - Out for delivery
   - Delivered
   - Visual progress indicator

3. **Order Items**:
   - Product images
   - Product names and variants
   - Quantities
   - Prices
   - Subtotal per item

4. **Order Summary**:
   - Subtotal
   - Shipping
   - Tax
   - Discount (if applied)
   - Total

5. **Shipping Information**:
   - Shipping address
   - Shipping method
   - Tracking number (with carrier link)

6. **Billing Information**:
   - Payment method (last 4 digits)
   - Billing address

**Actions**:
- Track package (external carrier link)
- View invoice
- Reorder
- Contact support
- Leave review (for delivered orders)

### 11. Profile Settings (`/account/profile`)
**Route**: `/account/profile`  
**Component**: `app/account/profile/page.tsx`

**Form Sections**:
1. **Personal Information**:
   - First name
   - Last name
   - Email (read-only, with change option)
   - Phone number
   - Date of birth (optional)

2. **Default Addresses**:
   - **Shipping Address**:
     - Address line 1
     - Address line 2
     - City
     - State/Province
     - ZIP/Postal code
     - Country
   - **Billing Address**:
     - Same as shipping checkbox
     - Separate billing address form

3. **Password Management**:
   - Current password
   - New password
   - Confirm new password
   - Password strength indicator

4. **Email Preferences**:
   - Marketing emails
   - Order updates
   - New product announcements
   - Special offers

5. **Account Actions**:
   - Delete account (with confirmation)

**Actions**:
- Save changes
- Cancel
- Delete account

### 12. Loyalty Rewards (`/account/loyalty`)
**Route**: `/account/loyalty`  
**Component**: `app/account/loyalty/page.tsx`

**Sections**:
1. **Points Summary Card**:
   - Current points balance (large display)
   - Points earned this month
   - Lifetime points earned
   - Points expiring soon (if any)

2. **Membership Tier**:
   - Current tier badge (Bronze, Silver, Gold, Platinum)
   - Tier benefits list
   - Progress to next tier
   - Points needed for next tier

3. **Ways to Earn Points**:
   - Purchase: 1 point per $1 spent
   - Product review: 50 points
   - Referral: 100 points
   - Birthday bonus: 200 points
   - Social media share: 25 points

4. **Rewards Catalog**:
   - Available rewards cards:
     - $5 off coupon (500 points)
     - $10 off coupon (900 points)
     - Free shipping (300 points)
     - Free product (2000 points)
   - Redeem button for each reward
   - "Not enough points" state

5. **Points History**:
   - Transaction log
   - Date
   - Activity (Purchase, Review, Redemption)
   - Points earned/spent
   - Balance after transaction
   - Pagination

6. **Referral Program**:
   - Unique referral link
   - Copy link button
   - Share on social media buttons
   - Referral stats (invites sent, signups, rewards earned)

**Features**:
- Real-time points balance
- Tier progression visualization
- One-click reward redemption
- Points expiration warnings
- Referral link sharing

## 🔧 Admin System

Access the admin at `/admin`

**Demo Admin Credentials**:
\`\`\`
Email: admin@brevibrushes.com
Password: admin123
\`\`\`

### Admin Dashboard (`/admin`)
**Component**: `app/admin/page.tsx`

**Features** (Shopify-Inspired Design):
- **Date Range Selector**: 
  - Quick options: Today, This Week, Last Week, This Month, Last Month
  - Custom date range picker
  - Compare toggle to compare current period with previous period

- **Key Metrics Cards** (with comparison indicators):
  - **Revenue**: Total revenue with percentage change vs previous period
  - **Orders**: Total order count with trend indicator
  - **AOV (Average Order Value)**: Average order value calculation
  - **COGs (Cost of Goods Sold)**: Calculated from supplier inventory costs
  - **Profit**: Revenue minus COGs
  - **Sessions**: Website traffic sessions
  - **Subscriptions**: Active subscription count
  - **New Customers**: New customer registrations

- **Subscription Overview**:
  - Active subscriptions count
  - Subscription revenue
  - Churn rate
  - Growth metrics

- **Traffic Sources**:
  - Breakdown by source (Organic, Direct, Social, Email, Referral, Paid)
  - Traffic percentage and session counts
  - Visual charts and graphs

- **Recent Orders Table**:
  - Order number
  - Customer name
  - Status (Fulfilled, Processing, Unfulfilled)
  - Amount
  - Date
  - Quick view action

- **Quick Actions**:
  - Add New Product
  - Create Campaign
  - View Orders
  - Manage Support

**Navigation Sidebar**:
- Dashboard
- Products
- Orders
- Customers
- CMS
- Email Marketing
- Marketing (with sub-items: Dashboard, Meta, Google, TikTok, Affiliate)
- Promotions
- Support
- Settings

### Product Management (`/admin/products`)

#### Products Listing (`/admin/products`)
**Component**: `app/admin/products/page.tsx`

**Features**:
- Search products by title
- Filter by status (All, Active, Draft)
- Sort by newest, oldest, price
- Products table with:
  - Product image
  - Title
  - Status badge
  - Price
  - Variants count
  - Stock level
  - Actions (Edit, Delete)
- Add Product button
- Bulk actions
- Pagination

#### Add/Edit Product (`/admin/products/new` or `/admin/products/[id]`)
**Component**: `app/admin/products/new/page.tsx`

**Form Sections**:
1. **Basic Information**:
   - Product title
   - Description (textarea)
   - Product status (Active/Draft)

2. **Pricing**:
   - Regular price
   - Compare at price (for showing discounts)

3. **Product Images**:
   - Multiple image upload
   - Drag and drop interface
   - Image preview
   - Set primary image

4. **Variants**:
   - Color variants: Black, White, Green, Pink, Bamboo
   - Enable/disable variants
   - SKU per variant
   - Inventory per variant

5. **Multi-Buy Pricing**:
   - Add pricing tiers
   - Set quantity thresholds
   - Set discount percentages
   - Example tiers:
     - Buy 1: $14.99
     - Buy 2: 10% off
     - Buy 3: 15% off
     - Buy 5: 20% off

6. **Inventory**:
   - Track inventory checkbox
   - Stock quantity
   - Low stock threshold

**Actions**:
- Save product
- Save as draft
- Delete product (for edit mode)
- Cancel

### Order Management (`/admin/orders`)

#### Orders Listing (`/admin/orders`)
**Component**: `app/admin/orders/page.tsx`

**Features**:
- Search orders by number or customer
- Filter by status:
  - All Orders
  - Unfulfilled
  - Processing
  - Fulfilled
  - Cancelled
- Date range filter
- Orders table with:
  - Order number
  - Customer name
  - Order date
  - Fulfillment status badge
  - Payment status
  - Total amount
  - Items count
  - Actions (View details)
- Export orders button
- Pagination

#### Order Details (`/admin/orders/[id]`)
**Component**: `app/admin/orders/[id]/page.tsx`

**Sections**:
1. **Order Header**:
   - Order number
   - Order date
   - Fulfillment status badge
   - Payment status badge

2. **Order Items**:
   - Product image
   - Product name & variant
   - Quantity
   - Price per item
   - Line total

3. **Order Summary**:
   - Subtotal
   - Shipping
   - Tax
   - Discount
   - Total

4. **Fulfillment Management**:
   - Current status dropdown (Unfulfilled, Processing, In Transit, Fulfilled)
   - Tracking number input
   - Shipping carrier dropdown (USPS, FedEx, UPS, DHL)
   - Add tracking button
   - Fulfillment timeline

5. **Customer Information**:
   - Customer name
   - Email
   - Phone
   - Order count

6. **Shipping Address**:
   - Full address
   - Edit address option

7. **Order Notes**:
   - Add internal notes
   - Note history
   - Timestamps

**Actions**:
- Update fulfillment status
- Send tracking email
- Refund order
- Cancel order
- Print packing slip
- Print invoice

### CMS Management (`/admin/cms`)

#### CMS Hub (`/admin/cms`)
**Component**: `app/admin/cms/page.tsx`

**Sections Grid**:
- **Homepage Editor**: Visual editor for homepage sections
- **Product Template Editor**: Visual editor for product page templates
- **Hero Banners**: Manage homepage hero section
- **Navigation Menu**: Edit menu items and links
- **Top Bar**: Update announcement bar
- **Logo**: Upload and manage logo
- **Footer**: Edit footer content and links
- **About Page**: Manage about us content
- **Checkout Page**: Customize checkout content

**Features**:
- Quick access cards for each section
- Last updated timestamps
- Status indicators
- Preview links

#### Homepage Visual Editor (`/admin/cms/homepage-editor`)
**Component**: `app/admin/cms/homepage-editor/page.tsx`

**Features**:
- **Visual Preview**: Real-time preview of homepage with desktop/mobile toggle
- **Section Management**: 
  - Add, edit, delete, and reorder sections
  - Enable/disable sections (hidden sections remain in list)
  - Drag-and-drop section reordering
- **Section Types**:
  - Hero Banner
  - Image Banner
  - Carousel
  - Product Grid
  - Reviews Section
  - Testimonials
  - Multi-Column Content
  - Countdown Timer
  - Trust Badges
  - Stats Section
  - FAQ Section
  - Team Section
- **Editor Features**:
  - Live preview with responsive modes (desktop/mobile)
  - Section-specific editors with rich content controls
  - Image picker integration
  - Link autocomplete for menu items
  - Content validation
- **Layout Management**:
  - Sections list sidebar (collapsible)
  - Section editor sidebar
  - Main preview area
  - Dynamic layout adjustment based on admin sidebar state
- **Preview Modes**:
  - Desktop preview (full width)
  - Mobile preview (responsive width)
  - Toggle between modes with visual indicators

#### Product Template Visual Editor (`/admin/cms/product-template`)
**Component**: `app/admin/cms/product-template/page.tsx`

**Features**:
- **Multiple Templates**: Create and manage multiple product page templates
- **Template Assignment**: Each product can be assigned a specific template
- **Template Management**:
  - Create new templates (copies sections from "Default" template)
  - Set default template (used for products without assigned template)
  - Delete templates
  - Template name editing
- **Section Management**:
  - Add, edit, delete, and reorder sections
  - Enable/disable sections
  - Section-specific editors with default content
- **Section Types**:
  - Product Features
  - Bristles Section (with image, diameter, benefits)
  - Brush Section (with gradient backgrounds, content items)
  - Confidence Section (with image and content paragraphs)
  - Image + Text Section (two-column layout, configurable background)
  - Reviews Section (with advanced filtering options)
- **Review Section Configuration**:
  - Number of reviews to display (1-50)
  - Product selection (Current Product or specific product)
  - Review type filter (All, Verified, With Images, 5 Star, 4-5 Star)
  - Show/hide rating breakdown
  - Show/hide review form button
  - Default sort order (Recent, Helpful, Highest Rating, Lowest Rating)
- **Editor Features**:
  - Live preview with responsive modes
  - Section-specific editors with rich controls
  - Background color pickers
  - Image upload and management
  - Content validation
  - Default content population for new sections
- **Template Assignment Logic**:
  - Products can be assigned specific templates via `template_id` in product edit page
  - Products without assigned template use the default (active) template
  - Multiple templates can be active simultaneously (one per product)
  - `is_active` flag only determines default template, not exclusivity

#### Hero Banner Management (`/admin/cms/hero`)
**Component**: `app/admin/cms/hero/page.tsx`

**Form Fields**:
- Banner image upload
- Headline text
- Subheadline text
- Button text
- Button link
- Background color overlay
- Text color
- Enable/disable banner
- Desktop and mobile preview

**Actions**:
- Save changes
- Reset to default
- Preview live

#### Menu Management (`/admin/cms/menu`)
**Component**: `app/admin/cms/menu/page.tsx`

**Features**:
- Add/remove menu items
- Drag and drop to reorder
- Menu item fields:
  - Label
  - URL/Link
  - Open in new tab option
  - Enable/disable
- Nested menu support (dropdowns)
- Mobile menu preview

**Current Menu Items**:
- Home (/)
- Shop Now (/product)
- About Us (/about)

#### Top Bar Management (`/admin/cms/topbar`)
**Component**: `app/admin/cms/topbar/page.tsx`

**Form Fields**:
- Announcement text
- Background color picker
- Text color picker
- Enable/disable top bar
- Link URL (optional)
- Auto-hide after X seconds

**Current Content**:
"50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS"

### Email Marketing (`/admin/email-marketing`)

#### Campaigns Dashboard (`/admin/email-marketing`)
**Component**: `app/admin/email-marketing/page.tsx`

**Stats Overview**:
- Total Subscribers: 2,847
- Active Campaigns: 3
- Total Sent: 45,230
- Average Open Rate: 34.2%
- Average Click Rate: 4.8%

**Campaigns Table**:
- Campaign name
- Status (Draft, Scheduled, Sent)
- Subject line
- Recipients count
- Send date
- Open rate
- Click rate
- Actions (Edit, View report, Duplicate, Delete)

**Actions**:
- Create campaign button
- Import subscribers
- Export subscriber list
- Manage segments

#### Create Campaign (`/admin/email-marketing/new`)
**Component**: `app/admin/email-marketing/new/page.tsx`

**Form Sections**:
1. **Campaign Settings**:
   - Campaign name (internal)
   - Subject line
   - Preview text
   - From name
   - From email
   - Reply-to email

2. **Recipients**:
   - All subscribers
   - Specific segment
   - Custom list
   - Exclude list

3. **Content**:
   - Email template selector
   - Rich text editor
   - Personalization tags
   - Image upload
   - Product blocks
   - Button blocks

4. **Scheduling**:
   - Send immediately
   - Schedule for later
   - Timezone selection

5. **Preview & Test**:
   - Desktop preview
   - Mobile preview
   - Send test email

**Actions**:
- Save draft
- Send test
- Schedule send
- Send now

#### Campaign sending (batches and resume)
Sending runs **one batch per request** so progress is reliable on serverless (no fire-and-forget).

- **Send flow**: "Send Campaign Now" stores the recipient list and sets status to `sending`; the browser then calls `POST /api/admin/email-campaigns/process-batch` to send the first batch. Progress is shown as **Sent X / Y** on the campaign detail page (updates every 30s while sending).
- **Resume**: "Resume Sending" on a partially sent campaign calls the same process-batch API once per click (one batch). Cron also calls it once per campaign per run.
- **Batch sizes**: **Non-personalized**: 5,000 per batch. **Personalized** (e.g. `{{firstName}}`/`{{name}}`): 1,000 per batch by default (to finish within serverless timeout; personalized sends in sub-batches of 100).
- **Cron**: `/api/cron/email-campaigns-resume` runs **every 5 minutes** (`*/5 * * * *`); each run processes **one batch per** "sending" campaign and updates `sent_count`.
- **API**: `POST /api/admin/email-campaigns/process-batch` — body `{ "campaignId": "uuid" }`. Sends one batch and returns `{ success, sent, total, done }`.
- **Env (optional)**:
  - `EMAIL_PERSONALIZED_BATCH_SIZE` — batch size for personalized campaigns (default 1000). Use 2000 or 3000 if your function timeout is long enough.
  - `EMAIL_BATCH_SIZE` — batch size for non-personalized (default 5000).
  - `MAX_CAMPAIGN_SEND_PER_GO` is in `lib/email-campaigns-config.ts` (50,000).

### Email Automations (`/admin/email-marketing/automations`)
**Route**: `/admin/email-marketing/automations`  
**Component**: `app/admin/email-marketing/automations/page.tsx`

**Features**:
- **Automation Flows List**:
  1. **Welcome Series**:
     - Trigger: New subscriber
     - Emails: 3
     - Status: Active
     - Performance: 45% open rate, 8% click rate
  
  2. **Abandoned Cart**:
     - Trigger: Cart abandoned for 1 hour
     - Emails: 3 (1hr, 24hr, 72hr)
     - Status: Active
     - Recovery rate: 15%
  
  3. **Post-Purchase Follow-up**:
     - Trigger: Order delivered
     - Emails: 2
     - Status: Active
     - Review collection rate: 22%
  
  4. **Win-back Campaign**:
     - Trigger: No purchase in 90 days
     - Emails: 2
     - Status: Active
     - Re-engagement rate: 8%
  
  5. **Review Request**:
     - Trigger: 25 days after order completion
     - Emails: 1
     - Status: Active
     - Automated via cron job (`/api/cron/review-requests`)
     - Smart logic: Skips if customer already reviewed or request already sent

- **Automation Builder**:
  - Drag and drop workflow builder
  - Trigger selection
  - Delay settings
  - A/B testing options
  - Conditional logic

- **Performance Metrics**:
  - Total automations active
  - Total emails sent
  - Average open rate
  - Average click rate
  - Revenue generated

**Actions**:
- Create automation
- Edit automation
- Pause/Resume
- Duplicate
- View detailed analytics
- Test automation

### Promotions (`/admin/promotions`)

#### Promotions Listing (`/admin/promotions`)
**Component**: `app/admin/promotions/page.tsx`

**Features**:
- Active promotions count
- Filter by status (All, Active, Scheduled, Expired)
- Search promotions
- Promotions table with:
  - Promotion code
  - Type (Percentage, Fixed amount, Free shipping)
  - Value
  - Usage (times used / limit)
  - Start date
  - End date
  - Status badge
  - Actions (Edit, Duplicate, Delete)

**Actions**:
- Create promotion button
- Bulk enable/disable
- Export promotion report

#### Create Promotion (`/admin/promotions/new`)
**Component**: `app/admin/promotions/new/page.tsx`

**Form Sections**:
1. **Promotion Type**:
   - Percentage discount
   - Fixed amount discount
   - Free shipping
   - Buy X Get Y

2. **Discount Details**:
   - Discount code
   - Discount value (% or $)
   - Auto-generate code option

3. **Applies To**:
   - All products
   - Specific products
   - Specific collections
   - Minimum purchase amount

4. **Usage Limits**:
   - Total usage limit
   - One per customer
   - Limit per customer

5. **Active Dates**:
   - Start date & time
   - End date & time
   - No end date option

6. **Conditions**:
   - Minimum purchase amount
   - Minimum quantity
   - Customer eligibility (All, Specific customers, Customer segments)

**Actions**:
- Save promotion
- Save as draft
- Delete promotion

### Analytics Dashboard (`/admin/analytics`)
**Route**: `/admin/analytics`  
**Component**: `app/admin/analytics/page.tsx`

**Features**:
- **Date Range Selector**: Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, Custom Range

- **Key Metrics Cards**:
  - Total Revenue (with percentage change)
  - Total Orders (with trend indicator)
  - Average Order Value
  - Conversion Rate
  - New Customers
  - Returning Customers

- **Revenue Trend Chart**:
  - Daily revenue bars
  - 7-day moving average line
  - Hover tooltips with details
  - Export chart data

- **Top Selling Products**:
  - Product ranking table
  - Units sold
  - Revenue generated
  - Growth percentage
  - Product images

- **Sales by Channel**:
  - Direct (website)
  - Social media
  - Email marketing
  - Referrals
  - Progress bars showing percentage
  - Revenue per channel

- **Customer Insights**:
  - New vs. Returning customers
  - Customer retention rate
  - Average customer lifetime value
  - Customer acquisition cost
  - Geographic distribution map

- **Traffic Sources**:
  - Organic search
  - Paid ads
  - Social media
  - Direct
  - Referrals
  - Pie chart visualization

**Actions**:
- Export report (PDF/CSV)
- Schedule automated reports
- Share dashboard
- Customize metrics

### Loyalty Program Management (`/admin/loyalty`)
**Route**: `/admin/loyalty`  
**Component**: `app/admin/loyalty/page.tsx`

**Features**:
- **Program Overview**:
  - Total active members
  - Points issued (lifetime)
  - Points redeemed
  - Redemption rate
  - Average points per customer

- **Membership Tiers Configuration**:
  1. **Bronze** (Default):
     - Requirements: 0 points
     - Benefits: 1 point per $1, birthday bonus
  
  2. **Silver**:
     - Requirements: 500 points
     - Benefits: 1.25 points per $1, early access
  
  3. **Gold**:
     - Requirements: 2000 points
     - Benefits: 1.5 points per $1, free shipping
  
  4. **Platinum**:
     - Requirements: 5000 points
     - Benefits: 2 points per $1, exclusive products

- **Points Rules**:
  - Purchase earning rate
  - Review points
  - Referral points
  - Birthday bonus
  - Social share points
  - Points expiration (365 days)

- **Rewards Catalog Management**:
  - Add/edit rewards
  - Set point costs
  - Stock limits
  - Expiration dates
  - Terms and conditions

- **Member Directory**:
  - Search members
  - Filter by tier
  - View member details
  - Manual point adjustments
  - Member communication

**Actions**:
- Configure tiers
- Add/edit rewards
- Adjust points manually
- Export member data
- Send tier-specific campaigns

### Inventory Management (`/admin/inventory`)
**Route**: `/admin/inventory`  
**Component**: `app/admin/inventory/page.tsx`

**Features**:
- View all supplier inventory across all suppliers
- Search by SKU or product name
- Filter by supplier
- View inventory levels (available, reserved, committed)
- Monitor low stock and out-of-stock items
- View cost prices (admin-only visibility)
- Summary statistics dashboard
- Quick links to supplier profiles

**Key Metrics**:
- Total inventory items
- Low stock alerts
- Out of stock items
- Total suppliers

**Inventory Display**:
- SKU (unique identifier)
- Product name
- Supplier name (clickable link)
- Available quantity
- Reserved quantity (for pending orders)
- Committed quantity (for confirmed orders)
- Cost price
- Stock status (In Stock, Low Stock, Out of Stock)

### Customer Management (`/admin/customers`)
**Route**: `/admin/customers`  
**Component**: `app/admin/customers/page.tsx`

**Features** (Shopify-style):
- Customer list with search and filtering
- Customer profile cards with avatars
- Order history and statistics per customer
- Total spent tracking
- Last order date
- Member since date
- Quick actions (view details, edit)
- Customer statistics dashboard

**Customer Statistics Dashboard**:
- Total customers count
- Total orders across all customers
- Total revenue (lifetime value)
- Average order value

**Customer Information Displayed**:
- Name and email
- Phone number (if available)
- Order count
- Total lifetime value
- Last order date
- Account creation date

**Actions**:
- View customer details
- Edit customer information
- Create new customer (links to user management)

### User Management (`/admin/users`)
**Route**: `/admin/users`  
**Component**: `app/admin/users/page.tsx`

**Features**:
- Create users with role selection (Customer, Supplier, Admin)
- Edit existing users
- Delete users (with confirmation)
- Search by name, email, or company
- Filter by role
- Role-based statistics cards
- Supplier-specific fields (company name, tax ID, contact person)

**User Types**:
- **Customer**: Standard customer account with loyalty program enrollment
- **Supplier**: Supplier account with company information and inventory access
- **Admin**: Full admin access to all system features

**Form Fields**:
- Email (required)
- Password (required for new users, optional for updates)
- First Name (required)
- Last Name (required)
- Role (required)
- Phone (optional)
- Company Name (for suppliers)
- Tax ID (for suppliers)
- Contact Person (for suppliers)

**Statistics Cards**:
- Total users
- Total customers
- Total suppliers
- Total admins

### Product-Supplier Linking
**Component**: `components/admin/product-supplier-linker.tsx`  
**Location**: Product edit page (`/admin/products/[id]`)

**Features**:
- Link product variants to supplier inventory
- Set lead times for fulfillment
- Mark primary suppliers
- View existing links
- Unlink products from suppliers
- Display supplier information and inventory status

**Integration**:
- Available in product edit page for each variant
- Real-time inventory status from supplier
- Shows supplier company name and SKU
- Displays lead time in days

### Supplier Management System

#### Supplier Portal Overview
The supplier management system provides a complete portal for suppliers to manage their inventory, fulfill orders, process returns, and communicate with the admin team.

#### Supplier Dashboard (`/supplier`)
**Route**: `/supplier`  
**Component**: `app/supplier/page.tsx`

**Features**:
- Key metrics overview:
  - Pending orders count
  - Processing orders count
  - Low stock items alert
  - Total inventory value
- Recent orders list
- Quick access to all supplier features

#### Supplier Inventory (`/supplier/inventory`)
**Route**: `/supplier/inventory`  
**Component**: `app/supplier/inventory/page.tsx`

**Features**:
- Add new inventory items with SKU
- Edit existing inventory items
- Search and filter inventory
- Track available, reserved, and committed quantities
- Set reorder points and reorder quantities
- Monitor cost prices (supplier-only visibility)
- Real-time inventory updates
- Low stock and out-of-stock alerts

**Inventory Fields**:
- SKU (unique identifier)
- Product name
- Description
- Category
- Quantity available
- Quantity reserved (for pending orders)
- Quantity committed (for confirmed orders)
- Cost price
- Reorder point
- Reorder quantity
- Status (active, inactive, discontinued)

#### Supplier Orders (`/supplier/orders`)
**Route**: `/supplier/orders`  
**Component**: `app/supplier/orders/page.tsx`

**Features**:
- View all assigned orders
- Filter by fulfillment status (pending, acknowledged, processing, ready, shipped, delivered)
- Acknowledge new orders
- Update order status through fulfillment workflow
- Add shipping information (carrier, tracking number, estimated delivery)
- View order details and customer information

**Order Status Workflow**:
1. **Pending**: Newly assigned order
2. **Acknowledged**: Supplier confirmed receipt
3. **Processing**: Supplier is preparing order
4. **Ready**: Order ready for shipment
5. **Shipped**: Order shipped with tracking
6. **Delivered**: Order delivered to customer

#### Order Detail (`/supplier/orders/[id]`)
**Route**: `/supplier/orders/[id]`  
**Component**: `app/supplier/orders/[id]/page.tsx`

**Features**:
- Complete order information
- Order items with product details
- Customer shipping address
- Fulfillment timeline
- Shipping information display
- Fulfillment actions (acknowledge, process, mark ready, ship)
- Supplier notes section

#### Supplier Returns (`/supplier/returns`)
**Route**: `/supplier/returns`  
**Component**: `app/supplier/returns/page.tsx`

**Features**:
- View all returns assigned to supplier
- Filter by return status
- Approve or reject return requests
- Mark returns as received
- Inspect returned items
- Process refunds
- Restock items if restockable

**Return Status Workflow**:
1. **Requested**: Customer requested return
2. **Approved**: Supplier approved return
3. **Rejected**: Return rejected
4. **Return Shipped**: Customer shipped item back
5. **Received**: Supplier received returned item
6. **Inspected**: Item inspected by supplier
7. **Refunded**: Refund issued to customer
8. **Completed**: Process complete

#### Return Detail (`/supplier/returns/[id]`)
**Route**: `/supplier/returns/[id]`  
**Component**: `app/supplier/returns/[id]/page.tsx`

**Features**:
- Complete return information
- Original order details
- Customer information
- Return reason and details
- Inspection form (condition, restockable status, notes)
- Refund processing
- Image uploads (customer and supplier)

#### Supplier Performance (`/supplier/performance`)
**Route**: `/supplier/performance`  
**Component**: `app/supplier/performance/page.tsx`

**Features**:
- Performance metrics dashboard
- On-time delivery rate
- Quality score
- Return rate
- Fulfillment time averages
- Stockout incidents
- Overall performance score
- Time period filtering

#### Supplier Chat (`/supplier/chat`)
**Route**: `/supplier/chat`  
**Component**: `app/supplier/chat/page.tsx`

**Features**:
- Real-time chat with admin team
- Tag system for referencing orders, products, and returns
- Message history
- Read receipts
- File attachments support

**Tag System**:
- `#ORDER-xxx` - Tag orders (clickable links)
- `@SKU-xxx` - Tag products by SKU (clickable links)
- `#RET-xxx` - Tag returns (clickable links)

### Admin-Supplier Chat (`/admin/suppliers/chat/[supplierId]`)
**Route**: `/admin/suppliers/chat/[supplierId]`  
**Component**: `app/admin/suppliers/chat/[supplierId]/page.tsx`

**Features**:
- Real-time chat with specific supplier
- Supplier information display
- Tag system for quick reference
- Message history
- Clickable tags linking to orders/products/returns

### Customer-Admin Chat System
**Route**: Integrated in customer account and admin support  
**Components**: `components/customer-chat.tsx`, `components/admin-customer-chat.tsx`

**Features**:
- Real-time chat between customers and admin
- AI chatbot initial response
- "human" keyword to escalate to admin
- Admin can convert chat to support ticket
- Customer name and email display in admin interface
- Clickable customer links to customer detail page
- Message read receipts
- Auto-reply system with admin override

**Chat Workflow**:
1. Customer initiates chat
2. AI chatbot responds automatically
3. Customer types "human" to request agent
4. Admin receives notification
5. Admin responds in real-time
6. Admin can convert to support ticket if needed

### Settings Management (`/admin/settings`)

#### Settings Overview
The admin settings system provides comprehensive configuration management for all aspects of the platform.

#### General Settings (`/admin/settings/general`)
**Route**: `/admin/settings/general`  
**Component**: `app/admin/settings/general/page.tsx`

**Features**:
- Site name and URL configuration
- Maintenance mode toggle
- Registration control (allow/deny new user registration)
- Basic website information management

#### Email Settings (`/admin/settings/email`)
**Route**: `/admin/settings/email`  
**Component**: `app/admin/settings/email/page.tsx`

**Features**:
- Email provider selection (SMTP - Microsoft 365, Resend, SendGrid, Mailgun)
- **SMTP Configuration** (Microsoft 365):
  - SMTP Server Host: `smtp.office365.com`
  - SMTP Port: `587` (STARTTLS - Recommended) or `465` (SSL)
  - SMTP Username: Your Microsoft 365 email address
  - SMTP Password: Your password or app-specific password
- From email and name settings
- Email template toggles:
  - Welcome email
  - Order confirmation
  - Shipping notifications

**Default Configuration**:
- Provider: SMTP (Microsoft 365 / Office 365)
- Server: `smtp.office365.com`
- Port: `587`
- Username: `hello@brevibrushes.com`
- From Email: `hello@brevibrushes.com` (matches SMTP user to avoid SendAsDenied errors)
- From Name: `BREVI`

**Email Template Testing**:
- Test email functionality available directly in settings page
- Enter test email address and send test emails for all templates
- Templates include: Welcome Email, Order Confirmation, Shipping Notification
- Role-specific welcome emails: Customer, Admin, Supplier (with login credentials)

#### Push Notifications (`/admin/settings/push`)
**Route**: `/admin/settings/push`  
**Component**: `app/admin/settings/push/page.tsx`

**Features**:
- Enable/disable push notifications for the storefront and admin experiences
- **Firebase Cloud Messaging (FCM)** is used for web push (VAPID, service worker, token registration via `/api/fcm/register`); server sends via Firebase Admin (`lib/firebase-admin.ts`)
- Legacy **Pusher** fields may still appear in settings for older references; new work should use FCM as documented in `env.example`

#### Payment Settings (`/admin/settings/payment`)
**Route**: `/admin/settings/payment`  
**Component**: `app/admin/settings/payment/page.tsx`

**Features**:
- **Stripe Configuration**:
  - Enable/disable Stripe
  - Publishable Key
  - Secret Key
  - Main Webhook Secret (Brevi - for payment, refunds, disputes, etc.)
  - Account Events Webhook Secret (exquisite-celebration-thin - for account-related events)
- **PayPal Configuration**:
  - Enable/disable PayPal
  - Client ID
  - Client Secret
  - Mode (Sandbox/Live)
- **AfterPay Configuration**:
  - Enable/disable AfterPay
  - Merchant ID
  - Secret Key
  - Environment (Sandbox/Production)

**Tabbed Interface**: Each payment gateway has its own tab for easy configuration.

#### Countries & Regions (`/admin/settings/countries`)
**Route**: `/admin/settings/countries`  
**Component**: `app/admin/settings/countries/page.tsx`

**Features**:
- Add/edit/delete countries
- ISO 3166-1 country codes
- Currency association per country
- Active/inactive status
- Default country selection
- Sort order management

#### Currencies (`/admin/settings/currencies`)
**Route**: `/admin/settings/currencies`  
**Component**: `app/admin/settings/currencies/page.tsx`

**Features**:
- Add/edit/delete currencies
- ISO 4217 currency codes
- Exchange rate management
- Base currency selection
- Symbol position (before/after amount)
- Decimal places configuration
- Active/inactive status

#### Languages (`/admin/settings/languages`)
**Route**: `/admin/settings/languages`  
**Component**: `app/admin/settings/languages/page.tsx`

**Features**:
- Add/edit/delete languages
- ISO 639-1 language codes
- Native language names
- Default language selection
- Active/inactive status
- Sort order management

### Stripe Webhook Configuration

#### Webhook Endpoint
**URL**: `https://yourdomain.com/api/webhooks/stripe`  
**Handler**: `app/api/webhooks/stripe/route.ts`

#### Required Webhook Events

**🔴 Critical Events (Must Configure):**
1. **`payment_intent.succeeded`**
   - Updates order payment status to 'paid'
   - Awards loyalty points
   - Triggers order assignment to suppliers
   - Reserves inventory
   - Sends order confirmation email

2. **`payment_intent.payment_failed`**
   - Updates order payment status to 'failed'
   - Releases reserved inventory
   - Sends payment failure notification

3. **`charge.refunded`**
   - Updates order payment status
   - Creates refund record
   - Reverses loyalty points (if applicable)
   - Restocks inventory
   - Sends refund confirmation email

**🟡 Important Events (Recommended):**
4. **`charge.dispute.created`**
   - Creates dispute record
   - Notifies admin team
   - Freezes order fulfillment if needed

5. **`charge.dispute.updated`**
   - Updates dispute status
   - Handles dispute resolution

6. **`charge.dispute.closed`**
   - Finalizes dispute resolution
   - Processes refunds if dispute lost

**🟢 Optional Events:**
7. **`payment_method.attached`** - Save customer payment methods
8. **`customer.created`** - Sync customer data
9. **`customer.updated`** - Keep customer data in sync
10. **`payment_intent.created`** - Track payment initiation
11. **`payment_intent.canceled`** - Handle canceled payments

#### Webhook Setup Steps

1. **In Stripe Dashboard:**
   - Go to Developers > Webhooks
   - Click "Add endpoint"
   - Enter webhook URL: `https://yourdomain.com/api/webhooks/stripe`
   - Select events (see list above)
   - Copy the webhook signing secret

2. **In Admin Settings:**
   - Navigate to `/admin/settings/payment`
   - Go to Stripe tab
   - Paste main webhook secret in "Main Webhook Secret (Brevi)" field
   - Paste account events webhook secret in "Account Events Webhook Secret (exquisite-celebration-thin)" field
   - Save settings

3. **Environment Variables (Optional):**
   - Add `STRIPE_WEBHOOK_SECRET=whsec_...` to `.env.local` (for main webhook)
   - Add `STRIPE_WEBHOOK_SECRET_ACCOUNT=whsec_...` to `.env.local` (for account events webhook)
   - Note: Settings saved in admin panel take precedence over environment variables

#### Webhook Handler Features

The webhook handler (`app/api/webhooks/stripe/route.ts`) automatically:
- Verifies webhook signatures using multiple secrets (supports multiple webhook endpoints)
- Tries each configured webhook secret until one matches (for handling multiple event destinations)
- Updates order payment statuses
- Awards/reverses loyalty points
- Assigns orders to suppliers
- Manages inventory reservations
- Creates refund and dispute records
- Sends email notifications
- Updates analytics

#### Multiple Webhook Secrets Support

If you have multiple Stripe webhook endpoints pointing to the same URL (e.g., one for main events and one for account events), you can configure both webhook secrets in the admin settings. The handler will automatically try each secret until it finds a match, allowing you to receive events from multiple webhook endpoints.

### Support System (`/admin/support`)

#### Tickets Dashboard (`/admin/support`)
**Component**: `app/admin/support/page.tsx`

**Stats Cards**:
- Open Tickets: 23
- Pending Response: 12
- Resolved Today: 18
- Average Response Time: 2.5 hours

**Filters**:
- All Tickets
- Open
- Pending
- Resolved
- Priority (High, Medium, Low)

**Tickets Table**:
- Ticket ID
- Customer name & email
- Subject
- Category (Order, Product, Shipping, Technical, Other)
- Priority badge
- Status badge
- Last update
- Assigned to
- Actions (View, Assign)

**Actions**:
- Create ticket button
- Export tickets
- Bulk update status
- Settings

#### Ticket Details (`/admin/support/[id]`)
**Component**: `app/admin/support/[id]/page.tsx`

**Sections**:
1. **Ticket Header**:
   - Ticket number
   - Subject
   - Status dropdown
   - Priority dropdown
   - Assign to admin dropdown

2. **Conversation Timeline**:
   - Customer messages
   - Admin responses
   - Internal notes
   - Timestamps
   - Status change history

3. **AI Suggestions Panel**:
   - "AI-Suggested Responses" heading
   - Multiple suggested responses based on:
     - Common questions
     - Order status
     - Product information
     - Shipping policies
   - Copy to reply button for each suggestion
   - Refresh suggestions button

4. **Reply Form**:
   - Rich text editor
   - Insert AI suggestion
   - Attach files
   - Add internal note checkbox
   - Canned responses dropdown

5. **Customer Information** (Sidebar):
   - Customer name
   - Email
   - Phone
   - Total orders
   - Customer since
   - Recent orders list
   - Customer notes

**Actions**:
- Send reply
- Save draft
- Mark as resolved
- Add internal note
- Close ticket
- Escalate

**AI Features**:
- Automatic response suggestions based on ticket content
- Order tracking integration in suggestions
- Sentiment analysis
- Priority prediction
- Category auto-tagging
- Similar ticket suggestions
- Dynamic order details replacement in replies using `{order}` tag

### Marketing System (`/admin/marketing`)

#### Marketing Dashboard (`/admin/marketing`)
**Component**: `app/admin/marketing/page.tsx`

**Features**:
- **Overall Marketing Metrics**:
  - ROAS (Return on Ad Spend)
  - CPA (Cost Per Acquisition)
  - MER (Marketing Efficiency Ratio)
  - CPC (Cost Per Click)
  - CTR (Click-Through Rate)
  - Total Revenue by Platform
  - Total Spend by Platform

- **Platform Breakdown Cards**:
  - **Meta**: Revenue, Spend, ROAS, Orders
  - **Google**: Revenue, Spend, ROAS, Orders
  - **TikTok**: Revenue, Spend, ROAS, Orders
  - **Affiliate**: Revenue, Commission, ROAS, Orders, Active Affiliates

- **Traffic Sources**:
  - Organic search
  - Direct traffic
  - Social media
  - Email marketing
  - Referrals
  - Paid advertising
  - Affiliate traffic

- **Quick Actions**:
  - Connect Meta Business account
  - Connect Google account
  - Connect TikTok Ads Manager
  - Manage Affiliate Program

#### Meta Integration (`/admin/marketing/meta`)
**Component**: `app/admin/marketing/meta/page.tsx`

**Features**:
- Connect Meta Business account
- Meta Pixel configuration
- Campaign tracking and management
- Catalog sync capabilities
- Conversion event tracking
- Performance analytics
- Ad spend tracking
- Revenue attribution

**Integration Capabilities**:
- Meta Business API connection
- Pixel event tracking (PageView, AddToCart, Purchase, Lead)
- Campaign data sync
- Audience management
- Custom conversions

#### Google Integration (`/admin/marketing/google`)
**Component**: `app/admin/marketing/google/page.tsx`

**Features**:
- Connect Google account
- Google Analytics integration
- Google Ads API connection
- Google Merchant Center sync
- Campaign performance tracking
- Conversion tracking
- Search Console integration

**Integration Capabilities**:
- Google Analytics 4 (GA4) integration
- Google Ads API for campaign management
- Google Merchant Center for product feeds
- Conversion tracking setup
- Performance metrics sync

#### TikTok Integration (`/admin/marketing/tiktok`)
**Component**: `app/admin/marketing/tiktok/page.tsx`

**Features**:
- Connect TikTok Business account
- TikTok Ads Manager integration
- Campaign management
- TikTok Pixel setup
- Creative tools access
- Performance analytics
- Conversion tracking

**Integration Capabilities**:
- TikTok Marketing API connection
- Pixel event tracking
- Campaign data sync
- Audience insights
- Creative performance tracking

#### Affiliate Management (`/admin/marketing/affiliate`)
**Component**: `app/admin/marketing/affiliate/page.tsx`

**Features**:
- **Affiliates Tab**:
  - View all affiliates with status (Pending, Approved, Rejected, Suspended)
  - Affiliate performance metrics (clicks, orders, revenue, commissions)
  - Approve/Reject affiliate applications
  - Suspend/Activate affiliates
  - View affiliate details
  - Invite new affiliates
  - Process payouts

- **Tiers Tab**:
  - Create affiliate tiers
  - Edit tier details (name, description, commission rate, commission type)
  - Set minimum sales thresholds
  - Delete tiers
  - View tier statistics

- **Invite Affiliate Modal**:
  - Email address
  - First name and last name
  - Company name (optional)
  - Website (optional)
  - Tier assignment (optional)
  - Automatic user account creation
  - Invitation email with registration link

- **Affiliate Statistics**:
  - Total affiliates
  - Active affiliates
  - Pending applications
  - Total revenue generated
  - Total commissions paid
  - Average commission rate

**Actions**:
- Invite affiliate
- Approve affiliate
- Reject affiliate
- Suspend affiliate
- Update affiliate tier
- Process payout
- Create/edit/delete tier

### Affiliate System

#### Affiliate Landing Page (`/affiliate`)
**Component**: `app/affiliate/page.tsx`

**Features**:
- Hero section with program benefits
- Commission structure overview
- Program statistics (affiliates, commissions paid, etc.)
- How it works section
- Features and benefits
- Call-to-action to register
- Link in website footer

**Sections**:
- Hero with "Join the BREVI Affiliate Program" headline
- Stats showcase (total affiliates, commissions paid, etc.)
- Benefits list (competitive commissions, easy tracking, timely payouts)
- How it works (3-step process)
- Features (dashboard, link generation, real-time tracking)
- Registration CTA button

#### Affiliate Registration (`/affiliate/register`)
**Component**: `app/affiliate/register/page.tsx`

**Two-Step Registration Process**:

**Step 1: Create Account** (if not logged in):
- Email address
- Password
- First name
- Last name
- Create account button
- Already have account? Login link

**Step 2: Affiliate Application**:
- Company name (optional)
- Website (optional)
- Tax ID (optional)
- Payment method preference
- Submit application button
- Note about review process (1-2 business days)

**Features**:
- Separate from customer registration
- Clear messaging that this is for affiliates only
- Application confirmation email sent immediately
- Redirect to affiliate dashboard after approval

#### Affiliate Dashboard (`/account/affiliate`)
**Component**: `app/account/affiliate/page.tsx`

**Features** (for approved affiliates):
- **Performance Overview**:
  - Total clicks
  - Total orders
  - Total revenue generated
  - Total commissions earned
  - Pending commissions
  - Paid commissions
  - Conversion rate

- **Affiliate Code Display**:
  - Unique affiliate code
  - Copy code button
  - Usage instructions

- **Affiliate Links Management**:
  - Create new affiliate link
  - Link name
  - Destination URL (homepage, product page, category, custom)
  - Short code generation
  - Link preview
  - Copy link button
  - View link statistics (clicks)

- **Commissions Table**:
  - Order number
  - Order date
  - Order total
  - Commission rate
  - Commission amount
  - Status (Pending, Approved, Paid)
  - Payment date (if paid)

- **Link Performance**:
  - Link name
  - Destination URL
  - Total clicks
  - Orders generated
  - Revenue generated
  - Commission earned

**Features** (for pending affiliates):
- Application status display
- "Your application is under review" message
- Estimated review time
- Contact information for questions

### Affiliate Tracking System

#### Click Tracking API (`/api/affiliate/track`)
**Route**: `/api/affiliate/track`  
**Component**: `app/api/affiliate/track/route.ts`

**Features**:
- Tracks affiliate clicks via URL parameters (`?ref=CODE&link_id=ID`)
- Captures click metadata:
  - IP address
  - User agent
  - Referrer
  - Session ID
  - User ID (if authenticated)
- Sets cookies for attribution:
  - `affiliate_ref`: Affiliate code (30-day expiry)
  - `affiliate_click_id`: Unique click ID (30-day expiry)
- Returns click ID for tracking

#### Client-Side Tracker (`components/affiliate-tracker.tsx`)
**Component**: `components/affiliate-tracker.tsx`

**Features**:
- Automatically detects affiliate parameters in URL
- Calls tracking API on page load
- Wrapped in Suspense for client-side rendering
- Integrated in root layout for site-wide tracking

#### Checkout Integration
**Location**: `app/actions/checkout.ts`

**Features**:
- Detects affiliate cookies on checkout
- Calculates commission based on affiliate tier
- Creates affiliate order record
- Creates marketing attribution record
- Updates affiliate statistics:
  - Total orders
  - Total revenue
  - Total commission
  - Pending commission

### Attribution Tracking System

#### Multi-Touch Attribution
**Component**: `app/actions/attribution.ts`

**Features**:
- **Touchpoint Tracking**:
  - First-touch attribution
  - Last-touch attribution
  - Conversion path tracking
  - Platform-specific click IDs (gclid, fbclid, ttclid)
  - UTM parameter tracking

- **Attribution Models**:
  - First-touch: First interaction gets credit
  - Last-touch: Last interaction gets credit
  - Multi-touch: Full conversion path stored

- **Order Attribution**:
  - Automatic attribution on order completion
  - Source tracking (affiliate, Meta, Google, TikTok, organic, direct)
  - Conversion path storage
  - Attribution metrics by source

#### Attribution Database
**Tables**:
- `marketing_attribution`: Links orders to marketing sources
- `marketing_events`: Tracks pixel events and conversions
- `affiliate_clicks`: Detailed affiliate click tracking
- `affiliate_orders`: Commission records

## 🎨 Design System

### Color Palette
**Design Tokens** (defined in `app/globals.css`):

\`\`\`css
--background: 0 0% 100%;
--foreground: 0 0% 3.9%;
--primary: 160 84% 39%;        /* Mint/Teal Green */
--primary-foreground: 0 0% 98%;
--secondary: 0 0% 96.1%;
--secondary-foreground: 0 0% 9%;
--muted: 0 0% 96.1%;
--muted-foreground: 0 0% 45.1%;
--accent: 160 84% 39%;
--accent-foreground: 0 0% 9%;
--border: 0 0% 89.8%;
--radius: 0.5rem;
\`\`\`

### Typography
- **Headings**: Geist Sans (Bold, 600-800 weights)
- **Body**: Geist Sans (Regular, 400-500 weights)
- **Mono**: Geist Mono (for code/technical content)

### Component Design
- **Buttons**: Rounded corners (0.5rem), shadow on hover, clear states
- **Cards**: Subtle borders, white background, shadow on hover
- **Forms**: Consistent spacing, clear labels, validation states
- **Badges**: Color-coded status indicators
- **Tables**: Zebra striping, hover states, sticky headers

## 🚀 Getting Started

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/brevi.git

# Navigate to project directory
cd brevi

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### Development

\`\`\`bash
# Run development server
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Build for Production

\`\`\`bash
# Create production build
npm run build

# Start production server
npm start
\`\`\`

### Available Scripts

\`\`\`bash
# Development
npm run dev          # Start development server

# Production
npm run build        # Build for production (Next 16 uses Turbopack; use `next build --webpack` if needed)
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint

# Database & Data
npm run seed:users   # Seed user data
npm run seed:role    # Add role column to profiles
npm run update:admin # Update admin role
npm run populate:reviews  # Populate review data (for testing)

# Testing
npm run test:chat    # Test chat profiles
\`\`\`

For a full list of database setup scripts (create tables, add columns, fix RLS), cron jobs, incomplete payments recovery, and bulk import, see **scripts/README.md**.

### Email marketing (Mailgun webhooks)

- **Signing key** (required to verify webhook POSTs): either paste **HTTP webhook signing key** in **`/admin/settings/email`** (Mailgun section), or set **`MAILGUN_WEBHOOK_SIGNING_KEY`** in `.env.local` (env wins if both are set).
- In Mailgun: your domain → **Webhooks** → add **`https://<your-domain>/api/mailgun/webhook`** and subscribe to **delivered**, **opened**, **clicked**, **bounced**, **failed** / **permanent_fail**.
- Sending email only needs API key + domain in admin; webhooks need this **separate** signing key from the same Mailgun webhooks screen.
- After substantial email/analytics changes, run **`npm run build`** to verify the app compiles.

### Cron Jobs

The project includes automated cron jobs configured in `vercel.json`:

1. **Subscription Orders** (`/api/cron/subscription-orders`)
   - Schedule: Daily at 2:00 AM UTC (`0 2 * * *`)
   - Purpose: Create subscription orders for active subscriptions due to ship

2. **Abandoned Cart** (`/api/cron/abandoned-carts`)
   - Schedule: Hourly (`0 * * * *`)
   - Purpose: Send abandoned cart reminder emails

3. **Win-back Campaign** (`/api/cron/win-back`)
   - Schedule: Daily at 3:00 AM UTC (`0 3 * * *`)
   - Purpose: Re-engage customers who haven't purchased in 90 days

4. **Birthday Campaign** (`/api/cron/birthday`)
   - Schedule: Daily at 4:00 AM UTC (`0 4 * * *`)
   - Purpose: Send birthday bonus emails to customers

5. **Review Requests** (`/api/cron/review-requests`)
   - Schedule: Daily at 9:00 AM UTC (`0 9 * * *`)
   - Purpose: Send review request emails 25 days after purchase

6. **Email Campaigns Resume** (`/api/cron/email-campaigns-resume`)
   - Schedule: Every 5 minutes (`*/5 * * * *`)
   - Purpose: Sends **one batch per** "sending" campaign per run (e.g. 1,000 personalized or 5,000 non-personalized), updates `sent_count`; no fire-and-forget so progress is reliable on serverless

**Note**: Set `CRON_SECRET` in Vercel (or your host). For Vercel, cron jobs are configured automatically; for other platforms, call these endpoints with `Authorization: Bearer <CRON_SECRET>`. Full setup: **CRON_JOBS_SETUP.md**.

## 🔐 Environment Variables

Create a `.env.local` file in the root directory. You can use `env.example` as a template:

\`\`\`bash
cp env.example .env.local
\`\`\`

Then fill in your actual values:

\`\`\`env
# Site Configuration
NEXT_PUBLIC_SITE_URL=https://brevibrushes.com
NEXT_PUBLIC_SITE_NAME=BREVI

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Configuration (Microsoft 365 SMTP)
EMAIL_SERVER_HOST=smtp.office365.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=hello@brevibrushes.com
EMAIL_SERVER_PASSWORD=your-password-or-app-password
EMAIL_FROM=hello@brevibrushes.com

# Payment Gateway (Stripe)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # Main webhook secret (Brevi - 94 events)
STRIPE_WEBHOOK_SECRET_ACCOUNT=whsec_... # Account events webhook secret (exquisite-celebration-thin - 17 events)

# AI Support (OpenAI for chat suggestions)
OPENAI_API_KEY=sk-...

# Push notifications — Firebase Cloud Messaging (primary)
# See env.example: NEXT_PUBLIC_FIREBASE_* (client), FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (server)

# Push / realtime — Pusher (optional / legacy if still referenced)
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=us2
\`\`\`

## 📱 Responsive Breakpoints

\`\`\`css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
\`\`\`

## 🎯 Key User Flows

### Customer Journey

1. **Discovery**:
   - Land on homepage → See hero banner with 50% off
   - Scroll through features and product sections
   - Click "Shop Now" button
   - **OR** Click affiliate link from influencer/blogger → Affiliate code tracked automatically

2. **Product Selection**:
   - View product details and images
   - Read customer reviews
   - Select color variant
   - Choose multi-buy option for discount
   - Adjust quantity
   - Click "Add to Cart"

3. **Cart Review**:
   - Cart drawer opens automatically
   - Review items and quantities
   - See countdown timer for price hold
   - Click "Proceed to Checkout" or "Continue Shopping"

4. **Checkout**:
   - Enter contact and shipping information
   - Select shipping method
   - Enter payment details
   - Review order summary
   - Complete purchase
   - **Affiliate Attribution**: If arrived via affiliate link, commission automatically calculated and assigned

5. **Post-Purchase**:
   - Receive order confirmation email
   - Log in to account
   - Track order status in real-time
   - Receive shipping notification with tracking
   - Track package through fulfillment timeline
   - Receive delivery confirmation
   - **Order Updates**: Receive email if admin updates shipping address or phone number

6. **Review & Loyalty**:
   - Receive review request email
   - Log in to account
   - Submit product review with photos
   - Earn loyalty points for review
   - Browse rewards catalog
   - Redeem points for discounts

7. **Support**:
   - Contact support via email at hello@brevibrushes.com
   - View order history if logged in
   - Submit support tickets through account dashboard
   - **Email Replies**: Reply to support emails directly (replies update ticket automatically)

### Affiliate Journey

1. **Discovery**:
   - Visit affiliate landing page (`/affiliate`)
   - Learn about program benefits and commission structure
   - Click "Get Started Free"

2. **Registration**:
   - **Option A - Self-Registration**:
     - Navigate to `/affiliate/register`
     - Step 1: Create account (email, password, name)
     - Step 2: Complete affiliate application (company, website, tax ID, payment method)
     - Submit application
     - **Email**: Application confirmation sent immediately
   
   - **Option B - Admin Invitation**:
     - Receive invitation email from admin
     - Click invitation link
     - Complete registration (tier may be pre-assigned)
     - **Email**: Invitation email with tier information

3. **Approval**:
   - Admin reviews application
   - Admin approves and optionally assigns tier
   - **Email**: Approval notification sent with affiliate code and tier details

4. **Active Affiliate**:
   - Log in to affiliate dashboard (`/account/affiliate`)
   - View performance metrics (clicks, orders, revenue, commissions)
   - Generate affiliate links:
     - Homepage links
     - Product-specific links
     - Category links
     - Custom URL links
   - Copy and share links
   - Track link performance

5. **Earning Commissions**:
   - Customers click affiliate links
   - System tracks clicks automatically
   - Customer completes purchase
   - Commission calculated based on tier
   - Affiliate order record created
   - Statistics updated in real-time

6. **Payout**:
   - Admin processes payout
   - **Email**: Payout notification sent with amount and transaction details
   - Funds received via selected payment method

### Admin Marketing Journey

1. **Dashboard Overview**:
   - View comprehensive metrics on admin dashboard
   - Select date range (Today, This Week, Last Month, Custom)
   - Toggle comparison to compare periods
   - Analyze revenue, orders, AOV, COGs, profit, sessions, subscriptions

2. **Customer Import**:
   - Navigate to Customers page
   - Click "Import Customers"
   - Upload CSV file
   - Enter optional segment name
   - System processes import in chunks
   - Segment automatically created for imported customers with emails

3. **Order Management**:
   - View order details
   - Edit customer address if needed
   - System sends email notification to customer
   - Update tracking information
   - Manage fulfillment status

4. **Affiliate Management**:
   - View all affiliates and performance
   - Create affiliate tiers with commission rates
   - Invite new affiliates (with tier assignment)
   - Approve affiliate applications
   - Process payouts
   - View affiliate analytics

5. **Marketing Platform**:
   - Connect Meta Business account
   - Connect Google account (Analytics, Ads, Merchant Center)
   - Connect TikTok Ads Manager
   - Sync campaign data
   - Track conversion events
   - View marketing metrics dashboard

6. **Support Management**:
   - View support tickets
   - Use AI suggestions for responses
   - Include order tracking in replies using `{order}` tag
   - Close, reopen, or resolve tickets
   - Track ticket performance

### Admin Workflow

1. **Product Management**:
   - Login to admin
   - Navigate to Products
   - Add new product with variants and pricing
   - Upload images
   - Set multi-buy discounts
   - Publish product

2. **Order Fulfillment**:
   - View new orders on dashboard
   - Navigate to Orders
   - Open order details
   - Update fulfillment status
   - Add tracking number
   - Send tracking email to customer

3. **Content Updates**:
   - Navigate to CMS
   - Select section to edit (Hero, Menu, etc.)
   - Update content
   - Preview changes
   - Save and publish

4. **Marketing Campaign**:
   - Navigate to Email Marketing
   - Create new campaign
   - Select template and recipients
   - Write content
   - Schedule or send immediately

5. **Automation Setup**:
   - Navigate to Email Automations
   - Create new flow (Welcome, Abandoned Cart, etc.)
   - Configure triggers and email sequences
   - Monitor performance metrics

6. **Promotions Management**:
   - Navigate to Promotions
   - Create new discount codes or offers
   - Set usage limits and active dates
   - Publish promotions

7. **Analytics Review**:
   - Navigate to Analytics
   - Review key metrics and trends
   - Analyze top-performing products and channels
   - Export reports for stakeholders

8. **Loyalty Program Configuration**:
   - Navigate to Loyalty Management
   - Define membership tiers and benefits
   - Set up earning rules and rewards
   - Manage member directory

8. **Support Ticket Resolution**:
   - Monitor Support dashboard for new tickets
   - Open ticket and review customer query
   - Utilize AI suggestions for responses
   - Reply to customer and update status

## 🔗 Important Links

### Frontend Pages
- Homepage: `/`
- Product Page: `/product`
- Cart: `/cart`
- Checkout: `/checkout`
- Login: `/login`
- Register: `/register`
- Forgot Password: `/forgot-password`
- Account Dashboard: `/account`
- Order History: `/account/orders`
- Order Tracking: `/account/orders/[id]`
- Profile Settings: `/account/profile`
- Loyalty Rewards: `/account/loyalty`
- Affiliate Dashboard: `/account/affiliate`
- Affiliate Landing: `/affiliate`
- Affiliate Register: `/affiliate/register`

### Admin Pages
- Dashboard: `/admin`
- Products: `/admin/products`
- Add Product: `/admin/products/new`
- Orders: `/admin/orders`
- CMS Hub: `/admin/cms`
- Homepage Editor: `/admin/cms/homepage-editor`
- Product Template Editor: `/admin/cms/product-template`
- Hero Management: `/admin/cms/hero`
- Menu Management: `/admin/cms/menu`
- Top Bar: `/admin/cms/topbar`
- Media Library: `/admin/media`
- Reviews Management: `/admin/reviews`
- Email Marketing: `/admin/email-marketing`
- Create Campaign: `/admin/email-marketing/new`
- Email Automations: `/admin/email-marketing/automations`
- Analytics: `/admin/analytics`
- Promotions: `/admin/promotions`
- Create Promotion: `/admin/promotions/new`
- Loyalty Management: `/admin/loyalty`
- Support: `/admin/support`

## 🛡️ Security Features

- **Input Validation**: All forms validate user input
- **CSRF Protection**: Next.js built-in protection
- **Secure Headers**: Configured in next.config
- **XSS Prevention**: React's built-in escaping
- **Authentication**: Secure login with password hashing
- **Protected Routes**: Client-side route protection for account pages
- **Admin Authentication**: Protected admin routes with role verification
- **Session Management**: Secure session handling with timeouts
- **Rate Limiting**: Prevent abuse of endpoints and login attempts
- **Password Reset**: Secure token-based password recovery

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
\`\`\`

## 📈 Performance Optimizations

- **Image Optimization**: Next.js Image component with lazy loading
- **Code Splitting**: Automatic route-based splitting
- **Font Optimization**: next/font for optimal loading
- **CSS Optimization**: Tailwind CSS purging unused styles
- **Caching**: Static page generation where possible
- **Bundle Analysis**: Check bundle sizes regularly

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Next.js Team**: For the amazing framework
- **Vercel**: For hosting and deployment
- **shadcn/ui**: For beautiful UI components
- **Tailwind CSS**: For utility-first styling
- **Shopify**: For design inspiration

## 📞 Support

For support and questions:
- Email: hello@brevibrushes.com
- Phone: (848) 800-4029
- Address: 10685-B Hazelhurst Dr. #34479, Houston, TX 77043, USA

## 🗺️ Roadmap

### Completed Features ✅
- [x] Customer accounts and login
- [x] Order tracking portal
- [x] Product reviews submission
- [x] Advanced analytics dashboard
- [x] Automated email flows
- [x] Loyalty rewards program
- [x] Live chat support (AI chatbot)

### Completed Features ✅ (Recent Additions)
- [x] Admin suppliers hub with detail page (messages, performance, payments, research & sample requests)
- [x] Supplier portal messages (`/supplier/messages`) and Research & updates hub (`/supplier/research-updates`)
- [x] FCM web push + email for admin–supplier chat and sample-request lifecycle notifications
- [x] Supplier management system with portal
- [x] Product-supplier linking with lead times
- [x] Supplier inventory management
- [x] Order fulfillment workflow for suppliers
- [x] Returns management for suppliers
- [x] Supplier performance metrics
- [x] Admin user management (create/edit/delete customers, suppliers, admins)
- [x] Admin inventory management (view all supplier inventory)
- [x] Admin customer management (Shopify-style)
- [x] Admin settings system (General, Email, Push, Payment, Countries, Currencies, Languages)
- [x] Media Library with Supabase Storage
- [x] Profile picture management for users and admins
- [x] Email template system with role-specific welcome emails
- [x] Email testing functionality
- [x] Multiple Stripe webhook secrets support
- [x] Dynamic Stripe payment methods configuration
- [x] Guest checkout functionality

### Upcoming Features
- [ ] Multi-currency support (UI implementation)
- [ ] Multi-language support (UI implementation)
- [ ] Subscription products
- [ ] Gift cards
- [ ] Advanced product filtering
- [ ] Product comparison
- [ ] Social media integration
- [ ] Mobile app (iOS/Android)
- [ ] Purchase orders
- [ ] Gift wrapping options
- [ ] Review helpful voting (customer-facing)
- [ ] Review photo moderation
- [ ] Review response system (admin replies to reviews)

## 🔑 Demo Credentials

### Customer Account
\`\`\`
Email: customer@brevibrushes.com
Password: customer123
\`\`\`

### Admin Account
\`\`\`
Email: admin@brevibrushes.com
Password: admin123
\`\`\`

**Note**: These are demo credentials for testing purposes only. In production, use strong, unique passwords and proper authentication.

---

**Built with ❤️ for sustainable oral care**

**Version**: 2.5.0  
**Last Updated**: March 2026

## 📝 Recent Updates

### v2.5.0 (Latest)

#### Admin & supplier collaboration
- **Routes**: `/admin/suppliers`, `/admin/suppliers/[id]`
- **Supplier detail tabs**: Overview (profile, catalog links), **Messages** (thread with supplier), **Performance** (assignment period log), **Payments** (recent invoices), **Research & updates** (sample requests split into new-product research vs existing-product updates, with links to `/admin/sample-requests/...` and **New sample request** prefilled via `?supplier_id=`).
- **Notifications**: Admin → supplier messages send **email** and **FCM push** (supplier link to `/supplier/messages`). Supplier replies email admins/partners and multicast push to **admin** and **partner** roles. Sample request create/status updates revalidate supplier and admin views and notify as implemented in `app/actions/sample-requests.ts`.
- **Database (Supabase)**: Run `scripts/add-admin-supplier-messages-insert-policy.sql` if suppliers post chat messages with the browser Supabase client—adds an `INSERT` RLS policy on `admin_supplier_messages` scoped to the supplier’s own chats.

#### Supplier portal
- **Routes**: `/supplier/messages`, `/supplier/research-updates`, `/supplier/sample-requests` (redirect to hub), `/supplier/sample-requests/[id]` (detail unchanged for email/push deep links).
- **Navigation**: Sidebar **Research & updates** and **Messages**; active state includes sample-request detail paths under `/supplier/sample-requests/...`.
- **i18n**: English and Chinese strings for research hub and messages (`lib/translations/supplier/en.json`, `zh.json`).

#### Orders, checkout, and subscriptions
- Fixes for **Stripe** checkout failures, **duplicate subscription orders**, and **order creation** edge cases; improved **subscription** sync with Stripe and **webhook** handling.
- **Manual orders (admin)**: **Prepaid** subscriptions—frequency, number of cycles, and totals on create-manual-order UI.
- **Convert order to subscription**: Stripe billing interval aligned to selected frequency; duplicate subscription prevention in webhook; **customer email** on successful conversion (`sendOrderConvertedToSubscriptionEmail`).
- **Order confirmation** and **checkout** logging improvements; **promo** checkout/media upload fix.

#### Email marketing & Mailgun
- **Analytics** and **Mailgun webhook** reliability; campaign **scheduling** and **timezone** handling; **segment** selection, calculation, and list **refresh**; large **customer import** (e.g. 88k) and marketing page load fixes.
- **Batch sending**: Higher per-run limits and cron resume behavior; fix for campaigns stuck at **“0 of N sent”**; **failure reasons** filtering in analytics.
- **Backfill / jobs**: Timeouts and stuck **order backfill** fixes; **orders without customer account** backfill patches.

#### Returns, replacements, and notifications
- **Automatic customer email** when a supplier ships a **replacement**; **customer detail** surfaced in supplier returns where applicable.
- **Notifications** pages for all user types backed by DB notifications; **FCM** registration and delivery (replacing older Pusher-centric flows where migrated).

#### Tax, CMS, and analytics
- **Tax** admin/settings work including **tax-exempt** related behavior.
- **CMS**: **Footer** merge/content fix, **Get In Touch** fix, clearer copy under **purchase-type** buttons on checkout.
- **Admin analytics / reports**: **Trend graphs** improvements, **filter** updates, **overlap** layout fix.

#### Admin payments, loyalty, and settings
- **Paid invoice notes**: Admins can edit **invoice comments/notes** on the payment detail page.
- **Loyalty**: Admin and partner nav link to loyalty management.
- **Settings**: Upsert/`onConflict` fix for `setting_key`; correct use of **`setting_category`**; toggle save fixes.

---

### v2.4.0

#### Email Marketing Analytics & Mailgun Integration
- **Route**: `/admin/email-marketing/analytics`
- **Changes**:
  - Metrics cards updated to use real Mailgun statistics: **Total Sent**, **Delivered**, **Failed**, **Suppressed**, **Open Rate**, **Click Rate**, **Revenue**.
  - Time-series chart enhanced to show delivered, failed, suppressed, opened, and clicked over time.
  - Line/Bar chart toggle added for clearer visualisation.
  - Backend now fetches Mailgun stats (delivered/failed/rejected and suppressions) and falls back to database events when needed.
  - Open/click rates recalculated using delivered counts for more accurate ratios.

#### Incomplete Payments Management
- **Route**: `/admin/payments/incomplete`
- **Features**:
  - Date range filter added to load incomplete payments for a specific period (supports start and end date).
  - Multi-select checkboxes for Stripe and PayPal incomplete payments, with:
    - Select-all-on-page header checkbox (with indeterminate state).
    - "Send Selected" button to trigger recovery emails only for chosen rows.
    - Existing "Send Emails (unsent)" kept for bulk sending to all unsent.

#### Subscription Checkout Reliability
- **Files**: `app/actions/checkout.ts`, `app/checkout/page.tsx`, `app/api/webhooks/stripe/route.ts`
- **Improvements**:
  - Robust resolution of Stripe subscription `payment_intent` using retries, invoice finalisation, and fallback invoice lookups.
  - Zero-amount first-invoice subscriptions correctly treated as "free orders" while still creating subscriptions and orders.
  - Eliminated duplicate orders for subscription checkouts (one order in Brevi plus one subscription order; no extra "normal" order).
  - Fixed webhook `customerEmail` scoping bug and improved logging around subscription payment initialisation.
  - Ensured `/account/orders/[id]` works for subscription-only orders by always returning a real order ID/number.

#### Unsubscribe Functionality for Marketing Emails
- **Public Route**: `/unsubscribe`
- **API**: `/api/unsubscribe`
- **Features**:
  - Customer-facing unsubscribe page where customers can:
    - See current status (subscribed vs unsubscribed).
    - Enter their email to opt-out of marketing emails.
  - API endpoint updates both `email_subscribers` and `newsletter_subscriptions` tables, setting `status='unsubscribed'` and `unsubscribed_at`.
  - `{{unsubscribe_link}}` template variable now resolves to `https://yourdomain.com/unsubscribe?email={{email}}` and is pre-wired in all HTML templates via `lib/email-template-utils.ts`.
  - Email Templates admin page shows a copyable unsubscribe link snippet so admins can easily add it to custom templates.

#### Admin Email Marketing Opt-in/Out Control
- **Route**: `/admin/customers/[id]`
- **Changes**:
  - Added "Marketing Emails" toggle on the customer detail page.
  - Backed by `/api/admin/customers/email-opt`:
    - `optIn=true` → sets subscriber `status='active'`, clears `unsubscribed_at`.
    - `optIn=false` → sets `status='unsubscribed'` and timestamps `unsubscribed_at`.
  - Keeps `email_subscribers` and `newsletter_subscriptions` in sync with admin decisions.

#### Unsubscribe & Newsletter Data Hygiene
- **Files**: `app/actions/email-subscribers.ts`, `app/actions/newsletter.ts`
- **Updates**:
  - Subscriber sync logic now respects existing unsubscribes and uses upsert semantics to avoid duplicates.
  - Added defensive checks and logging for invalid emails and sync errors.

#### Admin & Customer UX Fixes
- **Favicon / SEO**:
  - New `app/admin/metadata.ts` ensures the favicon configured in `/admin/settings/seo` applies to all `/admin` pages.
- **Subscriptions**:
  - `/account/subscriptions` now deduplicates `customer_subscriptions` so each subscription appears once.
  - `/admin/subscriptions`: Added status help note — **Expired** = payment failed (e.g. card declined or past due); prepaid subscriptions that finish all cycles show as **Completed**.
  - When a customer or admin cancels a subscription in Brevi, the linked Stripe subscription is also cancelled (when `stripe_subscription_id` is set). See `cancelSubscription` and `adminCancelSubscription` in `app/actions/customer-subscriptions.ts`.
  - Fixed "Unknown section type: product_hero" warnings by explicitly handling `product_hero` CMS section on product pages without double-rendering the hero.

#### Incomplete Payments & Order Recovery
- **Route**: `/admin/payments/incomplete`
- **Features**:
  - Stripe webhook logs successful payments that don’t match an order into `incomplete_payments` and can notify admins.
  - **Recover by order number or Payment Intent ID**: Create an order from a Stripe payment (search by order number or `pi_xxx`).
  - **Single / bulk recover**: Recover one row or “Recover Selected” / “Auto-Recover All” for batch order creation.
- **API**: `POST /api/admin/incomplete-payments/recover-order`, `POST /api/admin/incomplete-payments/auto-recover`.
- **Docs**: `Dox/updating-recovered-order.md` for updating order number, adding items, and fixing addresses after recovery. Table creation: `scripts/create-incomplete-payments-table.sql`.

#### Email Campaigns (Warmed-Up Sender)
- **Sending model**: One batch per request (no fire-and-forget). Send stores recipients and triggers first batch via `POST /api/admin/email-campaigns/process-batch`; Resume and cron each run one batch per campaign. Progress (Sent X / Y) shown on campaign detail and refreshes every 30s while sending.
- **Per run**: Up to **50,000** recipients per send; excess continues on next cron run or manual Resume.
- **Batching**: **Non-personalized**: **5,000** per batch. **Personalized** (e.g. `{{firstName}}`/`{{name}}`): **1,000** per batch by default so the request completes before serverless timeout (personalized sends in sub-batches of 100). Override with `EMAIL_PERSONALIZED_BATCH_SIZE` (e.g. 2000 or 3000) if your function timeout is long enough.
- **Cron**: `/api/cron/email-campaigns-resume` runs **every 5 minutes** (`*/5 * * * *`); processes **one batch per campaign** per run and updates `sent_count`.
- **API**: `POST /api/admin/email-campaigns/process-batch` (body: `{ campaignId }`). Shared logic: `lib/email-campaigns-process-batch.ts`. Config: `lib/email-campaigns-config.ts` (`MAX_CAMPAIGN_SEND_PER_GO`).
- **Build**: Server action files (`"use server"`) may only export async functions; campaign constant in `lib/email-campaigns-config.ts`.

#### Convert Order to Subscription
- **Stripe interval**: When converting an order to a subscription, the Stripe Price used matches the selected frequency (e.g. 1 month). If the stored `subscription_products.stripe_price_id` has a different interval, a new Stripe Price is created for that frequency so the subscription in Stripe shows the correct billing interval (e.g. "every 1 month"). Logic in `app/actions/orders.ts` (`convertOrderToSubscription`).
- **Duplicate prevention**: The Stripe webhook `customer.subscription.created` skips creating a Brevi subscription when one is already linked to that Stripe subscription ID (e.g. from convert). Prevents duplicate entries in `/admin/subscriptions`. See `app/api/webhooks/stripe/route.ts`.
- **Customer email**: When an order is converted to a subscription, the customer receives an email confirming the conversion (order number, product name, delivery frequency, next billing date, and link to manage subscription). Function: `sendOrderConvertedToSubscriptionEmail` in `lib/email.ts`; invoked from `convertOrderToSubscription` after success. Email failure is logged and does not fail the conversion.

#### Scripts & Documentation
- **scripts/README.md** updated with: all SQL and npm scripts, incomplete payments setup and recovery, email campaign config and cron, full cron list, bulk import, and pointers to Dox docs.
- **Dox/updating-recovered-order.md**: Steps to edit recovered orders (number, items, addresses). **scripts/sync-existing-incomplete-payments.md**: Syncing and testing incomplete payments.

---

### v2.3.0

#### Return/Replacement System
**Routes**: 
- `/admin/returns` - Admin returns management
- `/admin/returns/[id]` - Return detail page
- `/supplier/returns` - Supplier returns (existing, enhanced)
- `/account/returns` - Customer returns (existing, enhanced)

**Features**:
- **Admin/Partner Return Requests**: 
  - Request replacement directly from order detail page (`/admin/orders/[id]`)
  - Select order item, quantity, and reason for replacement
  - All returns are treated as replacements per company policy
  - Requests appear in supplier return system automatically

- **Supplier Replacement Shipping**:
  - Ship replacement with tracking number and carrier
  - Update return status to "completed" when replacement is shipped
  - Replacement tracking information stored in database

- **Email Notifications**:
  - Customer receives email when replacement is shipped (with tracking link)
  - All admin users receive notification
  - All partner users receive notification
  - Email includes return number, order number, product name, and tracking details

- **Customer Return Page Enhancements**:
  - Displays replacement shipping information
  - Clickable tracking links
  - Shows carrier and shipped date
  - Connected to supplier and admin return systems

- **Database Schema**:
  - Added `replacement_tracking_number`, `replacement_carrier`, `replacement_shipped_at` to `returns` table
  - Added `requested_by_admin` and `requested_by_partner` flags
  - All returns connected to order items for tracking

**Files Modified**:
- `app/actions/returns.ts` - Added admin return request and replacement shipping actions
- `app/admin/orders/[id]/page.tsx` - Added "Request Replacement" button and dialog
- `app/admin/returns/page.tsx` - New admin returns list page
- `app/admin/returns/[id]/page.tsx` - New admin return detail page
- `components/supplier/return-actions.tsx` - Added replacement shipping functionality
- `app/account/returns/page.tsx` - Enhanced with replacement tracking display
- `lib/email.ts` - Added replacement shipped email notification
- `scripts/add-replacement-shipping-to-returns.sql` - Database migration

#### CMS Section Height Controls
**Routes**: `/admin/cms/product-template`, `/admin/cms/homepage-editor`

**Features**:
- **Image Height Control**: 
  - Added "Image Height (px)" input to Image + Text, Image + Image, Bristles, Brush, and Confidence sections
  - Min: 200px, Max: 1000px
  - Auto height option (default)

- **Video Height Control**:
  - Added "Video Height (px)" input to Video + Text section
  - Same constraints as image height

- **Technical Implementation**:
  - Height applied via inline styles to image/video containers
  - Uses `self-stretch` CSS class for proper grid alignment
  - Removed `items-start` from grid containers to prevent gaps
  - Images/videos now properly fill their container height

**Files Modified**:
- `app/admin/cms/product-template/section-editors.tsx` - Added height inputs to section editors
- `components/product/image-text-section.tsx` - Applied height styling
- `components/product/video-text-section.tsx` - Applied height styling
- `components/product/bristles-section.tsx` - Applied height styling
- `components/product/brush-section.tsx` - Applied height styling
- `components/product/confidence-section.tsx` - Applied height styling
- `components/product/image-image-section.tsx` - Applied height styling

#### Header Login/Logout Icon
**Route**: Global header component

**Features**:
- **Replaced Notification Bell**: 
  - Removed notification bell icon
  - Added login/logout icon (single icon that toggles)
  - Shows login icon when not authenticated
  - Shows logout icon when authenticated

- **Mobile Support**:
  - Login/logout functionality added to mobile menu drawer
  - Proper button styling and accessibility

- **Registration Policy**:
  - Removed registration link from login page
  - Accounts created automatically upon purchase
  - Affiliate signup remains in footer (separate system)

**Files Modified**:
- `components/header.tsx` - Replaced notification bell with login/logout icon
- `app/login/page.tsx` - Removed registration link, added policy message

#### Product Specifications Section Editor Fix
**Route**: `/admin/cms/product-template`

**Fix**:
- Fixed "Something went wrong" error when editing Product Specifications section
- Removed invalid "Image Height" field (section doesn't have images)
- Section now only includes relevant fields: title, specifications list, and background color

**Files Modified**:
- `app/admin/cms/product-template/section-editors.tsx` - Fixed ProductSpecsEditor component

#### Media Library Client-Side Upload
**Route**: `/admin/media`

**Fix**:
- Fixed 413 "Payload Too Large" error when uploading large images
- Migrated from server-side to client-side uploads
- Direct upload to Supabase Storage bypasses Vercel function size limits
- Supports uploads up to bucket-specific limits (e.g., 200MB for `cms-media`)

**Files Modified**:
- `app/admin/media/page.tsx` - Implemented client-side uploads
- `lib/supabase/client.ts` - Used for direct storage uploads

#### Multiple Section Instances Support
**Route**: `/admin/cms/product-template`

**Features**:
- **Multiple Instances**: 
  - Can now add multiple instances of the same section type (e.g., "Image + Text #1", "Image + Text #2")
  - Each instance maintains its own unique content
  - Visual indicators (#1, #2, etc.) in section list

- **Database Changes**:
  - Removed `UNIQUE(template_id, section_type)` constraint
  - Sections now identified by unique `id` instead of `section_type`

- **Technical Implementation**:
  - Section map uses `section.id` as key instead of `section.section_type`
  - React components receive unique keys based on section ID
  - Section editors re-initialize state when switching between instances

**Files Modified**:
- `app/product/[slug]/page.tsx` - Updated section rendering logic
- `app/admin/cms/product-template/page.tsx` - Updated to allow multiple instances
- `app/admin/cms/product-template/section-editors.tsx` - Added useEffect hooks for state re-initialization
- `scripts/remove-section-type-unique-constraint.sql` - Database migration

### v2.2.0

### Review Management System
**Route**: `/admin/reviews`  
**Component**: `app/admin/reviews/page.tsx`

**Features**:
- **Statistics Dashboard**:
  - Total reviews count
  - Approved reviews count
  - Pending reviews count
  - Hidden reviews count
  - Average rating

- **Advanced Filtering**:
  - Filter by rating (1-5 stars)
  - Filter by status (Approved, Pending, Hidden)
  - Filter by product
  - Search by review title or comment
  - Sort by: Most Recent, Oldest, Highest Rating, Lowest Rating, Most Helpful

- **Review Management Actions**:
  - **Approve**: Approve pending reviews
  - **Hide**: Hide reviews from website (but keep in database)
  - **Show**: Unhide reviews
  - **Delete**: Permanently delete reviews and their images
  - **Add Manually**: Create reviews on behalf of customers

- **Bulk Actions**:
  - Select multiple reviews with checkboxes
  - Select all functionality
  - Bulk approve reviews
  - Bulk hide reviews
  - Bulk show (unhide) reviews
  - Bulk delete reviews
  - Bulk action bar appears when reviews are selected

- **Review Display**:
  - Review cards with customer information
  - Product information and links
  - Star ratings visualization
  - Review images in modal view
  - Verified purchase badges
  - Helpful vote counts
  - Review date and status badges

- **Manual Review Creation**:
  - Product selection dropdown
  - Customer selection (with search)
  - Rating selection
  - Title and comment fields
  - Image upload support
  - Verified purchase toggle

**Email Automation Integration**:
- **Review Request Automation**: Automatically sends review request emails 25 days after purchase
- **Cron Job**: Daily execution at 9 AM UTC (`/api/cron/review-requests`)
- **Smart Logic**: 
  - Skips if customer already reviewed products from that order
  - Skips if review request already sent for that order
  - Tracks requests in `review_requests` table
- **Email Template Variables**:
  - `{{firstName}}` - Customer's first name
  - `{{name}}` - Customer's full name
  - `{{reviewLink}}` - Direct link to product review page
  - `{{productName}}` - Name of the first product in the order
  - `{{orderNumber}}` - Order number

**Database Schema**:
- `reviews` table with `is_hidden` and `helpful_count` columns
- `review_requests` table for tracking sent requests
- `review_images` table for review photo attachments
- Row Level Security (RLS) policies for public and admin access

**Permissions**:
- Admin-only access to review management
- Public can view approved, non-hidden reviews
- Users can create their own reviews
- Admins can manage all reviews

### CMS Visual Editors
- ✅ **Homepage Visual Editor** (`/admin/cms/homepage-editor`):
  - Real-time preview with desktop/mobile toggle
  - Section management (add, edit, delete, reorder, enable/disable)
  - Multiple section types (Hero, Image Banner, Carousel, Product Grid, Reviews, Testimonials, etc.)
  - Section-specific editors with rich content controls
  - Image picker integration
  - Link autocomplete
  - Dynamic layout adjustment based on admin sidebar state
  - Hidden sections remain visible in list (marked as hidden)

- ✅ **Product Template Visual Editor** (`/admin/cms/product-template`):
  - Multiple product templates support
  - Template assignment per product
  - Section management with default content
  - Section types: Product Features, Bristles, Brush, Confidence, Image+Text, Reviews
  - Advanced review section configuration (number, product selection, filters)
  - Background color customization
  - Image upload and management
  - Template creation (copies sections from Default template)
  - Default template selection (for products without assigned template)

### Product Template System
- ✅ Multiple product templates (one per product or shared)
- ✅ Template assignment via `template_id` in product edit page
- ✅ Each product uses its assigned template's sections and content
- ✅ Default template fallback for products without assignment
- ✅ `is_active` flag determines default template (not exclusivity)
- ✅ Multiple templates can be active simultaneously
- ✅ Section content inheritance and customization
- ✅ Review section with product-specific configuration

### Media Library (`/admin/media`)
**Route**: `/admin/media`  
**Component**: `app/admin/media/page.tsx`

**Features**:
- **View Modes**:
  - All files (storage + database)
  - Storage only (direct from Supabase Storage)
  - Database only (tracked in `media_files` table)

- **File Management**:
  - View all media files across all Supabase storage buckets
  - Search and filter files
  - Upload new files
  - Delete files (removes from both storage and database)
  - View file metadata (size, type, bucket, upload date)

- **Bucket Organization**:
  - `cms` - CMS content images
  - `products` - Product images
  - `user-profiles` - User profile pictures
  - `reviews` - Review images

- **File Display**:
  - Grid view with thumbnails
  - File type badges
  - Bucket information badges
  - File size and dimensions
  - Upload date and metadata

- **Integration**:
  - Used by CMS editors for image selection
  - Used by product management for product images
  - Used by user management for profile pictures
  - Shopify-compatible file type support

### Supplier Management
- ✅ Complete supplier portal with dashboard
- ✅ Inventory management with stock tracking
- ✅ Order fulfillment workflow
- ✅ Returns management system
- ✅ Performance metrics tracking
- ✅ Real-time admin-supplier chat

### User Management
- ✅ Admin can create/edit/delete users (customers, suppliers, admins)
- ✅ Automatic welcome emails with login credentials
- ✅ Role-based account setup
