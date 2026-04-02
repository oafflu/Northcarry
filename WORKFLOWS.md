# BREVI Complete Workflow Documentation

## Table of Contents
1. [Customer Journey](#customer-journey)
2. [Guest Checkout Flow](#guest-checkout-flow)
3. [Supplier Journey](#supplier-journey)
4. [Admin Journey](#admin-journey)
5. [Order Fulfillment Workflow](#order-fulfillment-workflow)
6. [Returns/Replacements Workflow](#returnsreplacements-workflow)

---

## Customer Journey

### 1. Registration & Authentication

#### Registration (`/register`)
- **Actions Available:**
  - Create new account with email/password (optional - accounts are auto-created at checkout)
  - First name, last name, email, password required
  - Password confirmation validation
  - Automatic login after successful registration
  - Welcome email sent (if enabled in admin settings)

- **Important Notes:**
  - ✅ **Accounts are automatically created during checkout** - registration is optional
  - ✅ **Register page is still available** for customers who prefer to create account before shopping
  - ✅ **Handles existing accounts gracefully:**
    - If email already exists (from auto-creation), attempts to sign in with provided password
    - If password matches → logs in successfully
    - If password doesn't match → shows helpful error message suggesting to use magic link from email or "Forgot Password"
  - ✅ **Use cases for register page:**
    - Customers who want to browse with account access
    - Customers who prefer to set password before shopping
    - Customers who want to save payment methods before checkout

#### Login (`/login`)
- **Actions Available:**
  - Email/password authentication
  - "Remember me" functionality
  - Forgot password link
  - Redirect to account dashboard on success
  - Role-based redirection:
    - Customer → `/account`
    - Admin → `/admin`
    - Supplier → `/supplier`

#### Password Reset (`/forgot-password`)
- **Actions Available:**
  - Request password reset via email
  - Receive reset link
  - Set new password
  - Auto-login after password reset

### 2. Shopping Experience

#### Browse Products
- **Actions Available:**
  - View product catalog
  - Search products
  - Filter by category, price, color
  - View product details
  - See product reviews and ratings
  - View product images and variants

#### Product Page (`/product/[slug]`)
- **Actions Available:**
  - Select product variant (color, size)
  - View variant images (if enabled in CMS)
  - Add to cart
  - View product features
  - Read reviews
  - See pricing and discounts
  - View "Save %" for subscription options

#### Cart Management (`/cart`)
- **Actions Available:**
  - View cart items
  - Update quantities (+/-)
  - Remove items
  - Apply discount codes
  - View order summary
  - Proceed to checkout
  - Continue shopping
  - See real-time price calculations
  - View multi-buy discounts

### 3. Checkout Process

#### Checkout Page (`/checkout`)
- **Actions Available:**
  - **For Logged-in Users:**
    - Pre-filled email and name
    - Access to saved addresses
    - Access to saved payment methods
    - Faster checkout experience
  
  - **For Guest Users:**
    - Enter email address
    - Enter shipping information
    - Enter payment information
    - Option to create account after checkout
  
  - **Common Actions:**
    - Select shipping method (Standard/Express)
    - Enter shipping address
    - Enter billing address (or use same as shipping)
    - Select payment method (Card, PayPal, AfterPay, etc.)
    - Apply discount codes
    - Review order summary
    - Complete payment
    - Receive order confirmation

### 4. Customer Account Dashboard (`/account`)

#### Overview
- **Actions Available:**
  - View account summary
  - See order statistics:
    - Total orders
    - Pending orders
    - Completed orders
    - Total spent
  - View recent orders (last 5)
  - Quick access to all account features
  - View loyalty points summary

#### Navigation Menu
- Dashboard (`/account`)
- Orders (`/account/orders`)
- Addresses (`/account/addresses`)
- Payment Methods (`/account/payment-methods`)
- Subscriptions (`/account/subscriptions`)
- Returns (`/account/returns`)
- Rewards (`/account/loyalty`)
- Profile Settings (`/account/profile`)

### 5. Order Management (`/account/orders`)

#### Order History
- **Actions Available:**
  - View all orders
  - Search orders by order number or product
  - Filter by status:
    - All Orders
    - Processing
    - Shipped
    - Delivered
    - Cancelled
  - View order details
  - Track orders
  - Reorder items
  - Request replacement (for defective items)

#### Order Details (`/account/orders/[id]`)
- **Actions Available:**
  - View complete order information
  - See order status and timeline
  - View tracking information
  - See order items with images
  - View shipping address
  - View billing information
  - Download invoice
  - Contact support
  - Request replacement (within 5 days of delivery)
  - Leave product review (for delivered orders)

### 6. Address Management (`/account/addresses`)

#### Actions Available:
- View all saved addresses
- Add new address
- Edit existing address
- Delete address
- Set default shipping address
- Set default billing address
- Validate address format

### 7. Payment Methods (`/account/payment-methods`)

#### Actions Available:
- View saved payment methods
- Add new payment method (Stripe integration)
- Set default payment method
- Remove payment method
- Update payment method details
- View payment method type (Card, PayPal, etc.)

### 8. Subscriptions (`/account/subscriptions`)

#### Actions Available:
- View active subscriptions
- View subscription details:
  - Product name
  - Frequency (1 month, 2 months, 3 months, etc.)
  - Next billing date
  - Shipping schedule
  - Subscription status
- Cancel subscription
- Update subscription frequency
- Update shipping address for subscription
- View subscription history
- View upcoming orders

### 9. Returns/Replacements (`/account/returns`)

#### Actions Available:
- View all replacement requests
- Request new replacement (from order history)
- Search returns by return number or order number
- View return status:
  - Requested
  - Approved
  - Rejected
  - Return Shipped
  - Received
  - Inspected
  - Refunded
  - Completed
- View return details
- Upload photos of defective/damaged items
- Track replacement shipment
- **Note:** 5-day replacement policy applies (not 30-day money-back)

### 10. Loyalty Rewards (`/account/loyalty`)

#### Actions Available:
- View current points balance
- View membership tier (Bronze, Silver, Gold, Platinum)
- See tier benefits
- View progress to next tier
- View points history
- Redeem rewards:
  - $5 off coupon (500 points)
  - $10 off coupon (900 points)
  - Free shipping (300 points)
  - Free product (2000 points)
- View referral program
- Share referral link
- View referral stats

### 11. Profile Settings (`/account/profile`)

#### Actions Available:
- Update personal information:
  - First name
  - Last name
  - Email (with verification)
  - Phone number
- Upload/update profile picture
- Change password
- Update email preferences:
  - Marketing emails
  - Order updates
  - Product announcements
  - Special offers
- Delete account (with confirmation)


## Guest Checkout Flow

### How Guest Checkout Works

#### 1. Shopping as Guest
- **No account required** to browse and add items to cart
- Cart is stored using `session_id` cookie (30-day expiration)
- Cart persists across browser sessions

#### 2. Checkout Process
- Guest enters:
  - Email address
  - Shipping information
  - Payment information
- Order is created with:
  - `user_id`: `null` (no authenticated user)
  - `email`: Guest's email address
  - `session_id`: Browser session ID
- Stripe customer is created (if email provided)
- Order is saved to database

#### 3. Post-Checkout Experience

**Current Implementation:**
- ✅ **Automatic account creation** for ALL customers (subscribers, one-time buyers, guests)
- ✅ Account is created automatically using checkout details (email, name, address)
- ✅ Magic link sent in order confirmation email for passwordless login
- ✅ Guest is redirected to order confirmation page (`/account/orders/[id]`)
- ✅ Order is automatically linked to account

**How Auto-Account Creation Works:**

#### ✅ IMPLEMENTED: Automatic Account Creation

**For ALL Customers (Subscribers, One-Time Buyers, Guests):**

1. **During Checkout:**
   - Customer enters email, name, and address
   - No account creation checkbox needed
   - Checkout proceeds normally

2. **After Successful Payment:**
   - System automatically checks if account exists with email
   - **If account exists (Return Buyer):**
     - Order is linked to existing account
     - Profile information is updated if needed
     - Magic link sent for easy account access
   - **If account doesn't exist (New Customer):**
     - New account is created automatically
     - Profile is created with checkout information
     - Order is linked to new account
     - Magic link sent for passwordless login

3. **Order Confirmation Email:**
   - **New Customers:** Email includes "Your Account Has Been Created!" section with magic link
   - **Return Buyers:** Email includes "Quick Access to Your Account" section with magic link
   - Magic link expires in 24 hours
   - Customer can set password after logging in (optional)

4. **Account Access:**
   - Customer clicks magic link in email
   - Automatically logged in (no password needed)
   - Can access full account features:
     - View all orders
     - Track shipments
     - Manage subscriptions
     - Update addresses
     - Save payment methods
     - View loyalty points

**Recommended Implementation:**

#### Option A: Add to Checkout Page (Recommended)
Add a checkbox on the checkout page (in the Contact section):
```html
<label>
  <input type="checkbox" name="create_account" />
  Create an account to track your order and save your information
</label>
```
- If checked, create account after successful checkout
- Send password setup email
- Link order to new account

#### Option B: Add to Order Confirmation Email (Recommended)
Include in order confirmation email:
```html
<p>Don't have an account? <a href="/register?email={guest_email}&order={order_id}">Create one now</a> to track your order and manage your account.</p>
```
- Pre-fills registration form with email
- Links order to account after registration

#### Option C: Add to Order Confirmation Page (Recommended)
Show prompt on order confirmation page if user is not logged in:
```html
<div>
  <h3>Create an Account</h3>
  <p>Create an account to track your order, view order history, and save your information for faster checkout.</p>
  <a href="/register?email={guest_email}&order={order_id}">Create Account</a>
</div>
```

#### Option D: Password Reset Flow (Alternative)
- Guest uses "Forgot Password" with their email
- If email exists in system (from guest order):
  - System sends password reset link
  - Guest sets password
  - Account is created/activated
  - Orders are linked to account

### Auto-Account Creation Logic

**✅ IMPLEMENTED:**
```typescript
// After successful checkout:
1. Check if account exists with email (return buyer check)
2. If exists: Link order to existing account, send magic link
3. If not exists: Create new account, link order, send magic link
4. All customers have accounts automatically
5. Magic link provides passwordless login
```

**How Return Buyers Are Handled:**

When a customer uses an email that already has an account:

1. **System Detects Existing Account:**
   - Checks `profiles` table for matching email
   - Retrieves existing user ID

2. **Order Linking:**
   - Order is automatically linked to existing account
   - Order appears in customer's order history
   - Customer can track order in their account

3. **Profile Updates:**
   - If checkout information is newer/missing, profile is updated:
     - First name (if missing)
     - Last name (if missing)
     - Phone number (if missing)
   - Existing information is preserved

4. **Email Sent:**
   - Order confirmation email with magic link
   - Different message for return buyers: "Quick Access to Your Account"
   - Magic link allows instant login without password

5. **Benefits:**
   - ✅ All orders linked to one account
   - ✅ Complete order history
   - ✅ Subscription management
   - ✅ Loyalty points tracking
   - ✅ Easy account access via magic link

---

## Supplier Journey

### 1. Supplier Account Creation

#### Account Setup
- **Created by Admin** (`/admin/users`)
- Admin provides:
  - Email address
  - Password (sent via email)
  - First name, last name
  - Company name
  - Tax ID (optional)
  - Contact person
- Supplier receives welcome email with:
  - Login credentials
  - Login URL
  - Account access instructions

### 2. Supplier Dashboard (`/supplier`)

#### Overview
- **Actions Available:**
  - View key metrics:
    - Pending orders count
    - Processing orders count
    - Low stock items alert
    - Total inventory value
  - View recent orders
  - Quick access to all features

#### Navigation Menu
- Dashboard (`/supplier`)
- Inventory (`/supplier/inventory`)
- Orders (`/supplier/orders`)
- Returns (`/supplier/returns`)
- Performance (`/supplier/performance`)
- Chat (`/supplier/chat`)

### 3. Inventory Management (`/supplier/inventory`)

#### Actions Available:
- **Add New Inventory Item:**
  - SKU (unique identifier)
  - Product name
  - Description
  - Category
  - Quantity available
  - Cost price (supplier-only visibility)
  - Reorder point
  - Reorder quantity
  - Status (active, inactive, discontinued)

- **Edit Inventory:**
  - Update quantities
  - Adjust cost prices
  - Modify reorder points
  - Change status

- **View Inventory:**
  - Search and filter items
  - View available quantity
  - View reserved quantity (for pending orders)
  - View committed quantity (for confirmed orders)
  - See low stock alerts
  - See out-of-stock items

- **Inventory Tracking:**
  - Real-time quantity updates
  - Automatic reservation on order assignment
  - Automatic commitment on order confirmation
  - Automatic deduction on shipment

### 4. Order Fulfillment (`/supplier/orders`)

#### Order Assignment
- Orders are automatically assigned to suppliers based on:
  - Product-supplier linking (from admin)
  - Inventory availability
  - Supplier capacity

#### Order Status Workflow:
1. **Pending** → Newly assigned order
2. **Acknowledged** → Supplier confirms receipt
3. **Processing** → Supplier preparing order
4. **Ready** → Order ready for shipment
5. **Shipped** → Order shipped with tracking
6. **Delivered** → Order delivered to customer

#### Actions Available:
- **View Orders:**
  - Filter by status
  - Search by order number
  - View customer information
  - See order items and quantities

- **Order Actions:**
  - Acknowledge order
  - Update order status
  - Add shipping information:
    - Carrier name
    - Tracking number
    - Estimated delivery date
  - Add supplier notes
  - Mark as shipped
  - Mark as delivered

#### Order Details (`/supplier/orders/[id]`)
- **Actions Available:**
  - View complete order information
  - See customer shipping address
  - View order items with product details
  - See fulfillment timeline
  - Update fulfillment status
  - Add tracking information
  - Add internal notes
  - View order history

### 5. Returns Management (`/supplier/returns`)

#### Actions Available:
- **View Returns:**
  - Filter by status (requested, approved, received, inspected, refunded)
  - Search by return number
  - View customer information
  - See return reason

- **Process Returns:**
  - Approve return request
  - Reject return request (with reason)
  - Mark return as received
  - Inspect returned item:
    - Condition (excellent, good, fair, poor, damaged)
    - Restockable (yes/no)
    - Inspection notes
  - Process refund (if restockable)
  - Restock inventory (if applicable)

#### Return Status Workflow:
1. **Requested** → Customer requested replacement
2. **Approved** → Supplier approved return
3. **Rejected** → Return rejected (with reason)
4. **Return Shipped** → Customer shipped item back
5. **Received** → Supplier received returned item
6. **Inspected** → Item inspected and condition noted
7. **Refunded** → Refund processed (if applicable)
8. **Completed** → Return process complete

**Note:** 5-day replacement policy applies. Customers have 5 days from delivery to request replacement for defective or damaged items.

### 6. Performance Metrics (`/supplier/performance`)

#### Actions Available:
- View performance metrics:
  - On-time delivery rate
  - Total orders fulfilled
  - Return rate
  - Overall performance score
- Filter by time period:
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - Last month
  - Custom date range
- View detailed breakdowns
- See trends and improvements

### 7. Admin-Supplier Chat (`/supplier/chat`)

#### Actions Available:
- Real-time chat with admin team
- Send messages
- Receive messages
- Tag system:
  - `#ORDER-{order_number}` → Links to order
  - `@SKU-{sku}` → Links to inventory item
  - `#RET-{return_number}` → Links to return
- File attachments
- View chat history
- Receive notifications for new messages

---

## Admin Journey

### 1. Admin Account Creation

#### Account Setup
- **Created by Existing Admin** (`/admin/users`)
- Admin provides:
  - Email address
  - Password (sent via email)
  - First name, last name
  - Role: Admin
- Admin receives welcome email with credentials

### 2. Admin Dashboard (`/admin`)

#### Overview
- **Actions Available:**
  - View key metrics:
    - Total Revenue
    - Total Orders
    - Total Products
    - Total Customers
  - View recent orders
  - Quick actions:
    - Add New Product
    - Create Campaign
    - View Orders
    - Manage Support

### 3. Product Management (`/admin/products`)

#### Product Listing
- **Actions Available:**
  - View all products
  - Search products
  - Filter by status (All, Active, Draft)
  - Sort by newest, oldest, price
  - View product details
  - Edit product
  - Delete product
  - Preview product
  - View product variants

#### Create/Edit Product (`/admin/products/new` or `/admin/products/[id]`)
- **Actions Available:**
  - **Basic Information:**
    - Product title
    - Description
    - Product status (Active/Draft)
    - Vendor (Supplier company name)
  
  - **Pricing:**
    - Regular price
    - Compare at price (for discounts)
  
  - **Product Images:**
    - Upload multiple images
    - Drag and drop reordering
    - Set primary image
    - Browse from media library
    - Upload from computer
  
  - **Variants:**
    - Add/edit color variants
    - Set SKU per variant
    - Set price per variant
    - Set inventory per variant
    - Upload variant images
    - Set color selection image (for variant display)
  
  - **Product-Supplier Linking:**
    - Link variants to supplier inventory
    - Set lead times
    - Mark primary suppliers
    - View existing links
    - Unlink products
  
  - **Multi-Buy Pricing:**
    - Set quantity tiers
    - Set discount percentages
    - Example: Buy 2 (10% off), Buy 3 (15% off)
  
  - **Inventory:**
    - Track inventory checkbox
    - Stock quantity
    - Low stock threshold
  
  - **Actions:**
    - Save product
    - Save as draft
    - Preview product
    - Delete product
    - Cancel

### 4. Order Management (`/admin/orders`)

#### Order Listing
- **Actions Available:**
  - View all orders
  - Search orders
  - Filter by status
  - Filter by date range
  - View order details
  - Process refunds
  - Cancel orders
  - Export orders

#### Order Details (`/admin/orders/[id]`)
- **Actions Available:**
  - View complete order information
  - See customer details
  - View order items
  - See payment information
  - View shipping information
  - Process refund
  - Cancel order
  - Add admin notes
  - Assign to supplier (if not auto-assigned)
  - View fulfillment status
  - View tracking information

### 5. Customer Management (`/admin/customers`)

#### Customer Listing
- **Actions Available:**
  - View all customers
  - Search customers
  - Filter by status
  - View customer details
  - Edit customer information
  - Create new customer
  - View customer orders
  - View customer loyalty points
  - View customer lifetime value

#### Customer Details (`/admin/customers/[id]`)
- **Actions Available:**
  - View customer profile
  - Edit customer information
  - View order history
  - View loyalty points
  - View addresses
  - View payment methods
  - View subscriptions
  - View returns
  - Add notes
  - Send email to customer

### 6. User Management (`/admin/users`)

#### User Listing
- **Actions Available:**
  - View all users (customers, suppliers, admins)
  - Search users
  - Filter by role
  - Create new user
  - Edit user
  - Delete user
  - View user details

#### Create/Edit User
- **Actions Available:**
  - Create customer account
  - Create supplier account
  - Create admin account
  - Set email and password
  - Set role
  - Add company information (for suppliers)
  - Send welcome email

### 7. Supplier Management (`/admin/suppliers`)

#### Actions Available:
- View all suppliers
- View supplier performance metrics
- View supplier inventory
- Chat with suppliers
- Create/edit suppliers
- View supplier orders
- View supplier returns

### 8. Inventory Management (`/admin/inventory`)

#### Actions Available:
- View all supplier inventory
- See inventory across all suppliers
- View product-supplier links
- See inventory levels
- View reserved/committed quantities
- Monitor low stock alerts
- View supplier information

### 9. CMS Management (`/admin/cms`)

#### Available CMS Sections:
- **Hero Section** (`/admin/cms/hero`)
  - Edit hero banner
  - Set heading and subheading
  - Upload desktop and mobile images
  - Set CTA buttons

- **Navigation Menu** (`/admin/cms/menu`)
  - Add/edit menu items
  - Drag and drop reordering
  - Set links (products, collections, pages)
  - Enable/disable items

- **Top Bar** (`/admin/cms/topbar`)
  - Edit promotional banner
  - Set text and colors
  - Enable/disable

- **Footer** (`/admin/cms/footer`)
  - Edit footer content
  - Set links
  - Edit copyright text

- **Branding** (`/admin/cms/branding`)
  - Upload logo
  - Upload favicon
  - Set SEO metadata
  - Set website title and description

- **Product Page Settings** (`/admin/cms/product-page`)
  - Edit sale banner text
  - Set sale banner colors
  - Enable/disable rating display
  - Set default review count and rating
  - Toggle variant image display
  - Manage payment icons

- **Other Pages:**
  - Contact (`/admin/cms/contact`)
  - FAQ (`/admin/cms/faq`)
  - Privacy Policy (`/admin/cms/privacy`)
  - Terms of Service (`/admin/cms/terms`)
  - Refund Policy (`/admin/cms/refund`)

### 10. Media Library (`/admin/media`)

#### Actions Available:
- Upload media files
- Browse media by bucket:
  - CMS Media
  - Product Media
  - User Media
- Search media
- Filter by file type
- Delete media
- View media details
- Copy media URL
- Use media in CMS and products

### 11. Email Marketing (`/admin/email-marketing`)

#### Campaigns
- **Actions Available:**
  - Create email campaigns
  - Select recipients
  - Choose templates
  - Write content
  - Schedule or send immediately
  - View campaign performance
  - Edit campaigns
  - Delete campaigns

#### Automations
- **Actions Available:**
  - Create automated email flows
  - Set triggers:
    - Welcome email
    - Abandoned cart
    - Order confirmation
    - Shipping notification
    - Delivery confirmation
    - 30 days inactive
  - Configure email sequences
  - View automation performance

### 12. Promotions (`/admin/promotions`)

#### Actions Available:
- Create discount codes
- Set discount type (percentage/fixed)
- Set discount value
- Set usage limits
- Set active dates
- Enable/disable promotions
- View promotion performance
- Edit promotions
- Delete promotions

### 13. Loyalty Program (`/admin/loyalty`)

#### Actions Available:
- Configure membership tiers
- Set tier requirements and benefits
- Configure points earning rules
- Manage rewards catalog
- View member directory
- Manually adjust points
- Export member data
- Send tier-specific campaigns

### 14. Analytics (`/admin/analytics`)

#### Actions Available:
- View sales metrics
- View revenue trends
- View top products
- View sales by channel
- View customer insights
- View traffic sources
- Export reports
- Filter by date range
- View custom metrics

### 15. Support (`/admin/support`)

#### Actions Available:
- View all support tickets
- Filter by status
- View customer chat history
- Reply to customers
- Use AI suggestions for responses
- Convert chat to ticket
- Update ticket status
- Assign tickets
- View ticket history

### 16. Settings (`/admin/settings`)

#### General Settings
- **Actions Available:**
  - Set site name
  - Set site URL
  - Configure timezone
  - Set currency
  - Configure tax settings

#### Email Settings (`/admin/settings/email`)
- **Actions Available:**
  - Configure SMTP settings
  - Set sender email
  - Test email configuration
  - Configure email templates
  - Test email templates
  - Enable/disable email types

#### Payment Settings (`/admin/settings/payment`)
- **Actions Available:**
  - Configure Stripe settings
  - Set Stripe API keys
  - Configure webhook secrets (multiple)
  - Enable/disable payment methods:
    - Card
    - PayPal
    - AfterPay
    - Apple Pay
    - Google Pay
    - etc.
  - Set payment method display names
  - Test payment configuration

#### Push Notification Settings (`/admin/settings/push`)
- **Actions Available:**
  - Configure Pusher settings
  - Set Pusher credentials
  - Test push notifications
  - Configure notification types

#### Shipping Settings (`/admin/settings/shipping`)
- **Actions Available:**
  - Configure shipping methods
  - Set shipping prices
  - Set estimated delivery days
  - Enable/disable shipping methods
  - Show/hide estimated days on checkout

#### Countries & Currencies (`/admin/settings/countries`, `/admin/settings/currencies`)
- **Actions Available:**
  - Add/edit countries
  - Add/edit currencies
  - Set default currency
  - Enable/disable countries/currencies

#### Languages (`/admin/settings/languages`)
- **Actions Available:**
  - Add/edit languages
  - Set default language
  - Enable/disable languages

### 17. Subscriptions (`/admin/subscriptions`)

#### Create Subscription (`/admin/subscriptions/create`)
- **Actions Available:**
  - Select product and variant
  - Set subscription type:
    - One-time Purchase
    - Ongoing Subscription
    - Prepaid Subscription
  - Set prices for each type
  - Set available frequencies (1 month, 2 months, 3 months, etc.)
  - Set shipping days
  - Calculate billing intervals
  - Enable/disable subscription

#### All Subscriptions (`/admin/subscriptions`)
- **Actions Available:**
  - View all subscription products
  - Filter by status
  - Edit subscriptions
  - View subscription analytics
  - Enable/disable subscriptions

#### Subscription Analytics (`/admin/subscriptions/analytics`)
- **Actions Available:**
  - View subscription metrics
  - View active subscriptions
  - View revenue from subscriptions
  - View subscription trends

---

## Order Fulfillment Workflow

### 1. Order Placement

#### Customer Places Order
1. Customer adds items to cart
2. Customer proceeds to checkout
3. Customer enters shipping and payment information
4. Payment is processed (Stripe)
5. Order is created in database with status: `pending`

### 2. Order Processing

#### Automatic Actions:
1. **Order Assignment:**
   - System checks product-supplier links
   - Assigns order to appropriate supplier(s)
   - Creates `supplier_order_assignments` records
   - Reserves inventory (quantity_reserved increases)

2. **Inventory Update:**
   - Reserved quantity increases
   - Available quantity decreases
   - Supplier receives notification (if enabled)

3. **Order Confirmation:**
   - Payment confirmed via Stripe webhook
   - Order status changes to `processing`
   - Reserved quantity becomes committed
   - Committed quantity increases
   - Customer receives order confirmation email

### 3. Supplier Fulfillment

#### Supplier Actions:
1. **Acknowledge Order:**
   - Supplier views order in `/supplier/orders`
   - Supplier acknowledges order
   - Order status: `acknowledged`

2. **Process Order:**
   - Supplier prepares items
   - Order status: `processing`
   - Inventory is prepared

3. **Mark Ready:**
   - Order is ready for shipment
   - Order status: `ready`

4. **Ship Order:**
   - Supplier adds shipping information:
     - Carrier name
     - Tracking number
     - Estimated delivery date
   - Order status: `shipped`
   - Inventory is deducted:
     - Committed quantity decreases
     - Available quantity decreases
   - Customer receives shipping notification email

### 4. Delivery

#### Automatic Actions:
1. **Delivery Confirmation:**
   - Order status: `delivered` (can be manual or automatic)
   - Customer receives delivery confirmation email
   - Loyalty points are awarded (if applicable)

### 5. Post-Delivery

#### Customer Actions:
- View order in account
- Track shipment
- Leave product review
- Request replacement (within 5 days for defective items)
- Reorder items

---

## Returns/Replacements Workflow

### 1. Customer Requests Replacement

#### Customer Actions:
1. Customer goes to `/account/returns`
2. Clicks "Request Replacement" (from order history)
3. Selects order and items
4. Provides reason (defective, damaged, etc.)
5. Uploads photos (if applicable)
6. Submits request

#### System Actions:
1. Return request created with status: `requested`
2. Return is assigned to supplier (based on order assignment)
3. Supplier receives notification
4. Customer receives confirmation

### 2. Supplier Processing

#### Supplier Actions:
1. **View Return Request:**
   - Supplier sees return in `/supplier/returns`
   - Views customer reason and photos

2. **Approve or Reject:**
   - **Approve:**
     - Return status: `approved`
     - Customer receives approval notification
     - Return shipping label provided (if needed)
   - **Reject:**
     - Return status: `rejected`
     - Supplier provides rejection reason
     - Customer receives rejection notification

3. **Receive Return:**
   - Customer ships item back
   - Supplier marks as received
   - Return status: `return_shipped` → `received`

4. **Inspect Item:**
   - Supplier inspects returned item
   - Records condition (excellent, good, fair, poor, damaged)
   - Marks as restockable (yes/no)
   - Adds inspection notes
   - Return status: `inspected`

5. **Process Replacement/Refund:**
   - If restockable and approved:
     - Process refund (if applicable)
     - Restock inventory
     - Send replacement item
   - Return status: `refunded` → `completed`

### 3. Replacement Shipment

#### System Actions:
1. Replacement order created (if applicable)
2. Replacement shipped to customer
3. Customer receives replacement
4. Return process complete

**Note:** 5-day replacement policy applies. Customers must request replacement within 5 days of delivery for defective or damaged Brevi brushes.

---

## Key System Features

### Authentication & Authorization
- Role-based access control (Customer, Supplier, Admin)
- Protected routes with middleware
- Session management
- Password reset functionality
- Email verification (optional)

### Payment Processing
- Stripe integration
- Multiple payment methods (Card, PayPal, AfterPay, etc.)
- Payment intents for secure processing
- Webhook handling for payment confirmation
- Refund processing

### Inventory Management
- Real-time inventory tracking
- Reserved quantity (pending orders)
- Committed quantity (confirmed orders)
- Available quantity (in stock)
- Low stock alerts
- Automatic inventory deduction on shipment

### Order Management
- Automatic order assignment to suppliers
- Order status workflow
- Tracking information
- Email notifications
- Order history

### Customer Experience
- Guest checkout
- Account creation
- Order tracking
- Returns/replacements
- Loyalty program
- Live chat support

### Admin Tools
- Complete CMS system
- Product management
- Order management
- Customer management
- Supplier management
- Analytics and reporting
- Email marketing
- Settings configuration

---

## Important Notes

### Guest Checkout
- **Current State:** Guests can checkout without account, but must manually register to access full account features
- **Recommended:** Implement automatic account creation email after guest checkout
- **Alternative:** Use password reset flow to create account from guest email

### 5-Day Replacement Policy
- Applies to defective or damaged Brevi brushes only
- Customers have 5 days from delivery to request replacement
- Not a 30-day money-back guarantee
- Replacement, not refund (unless item cannot be replaced)

### Inventory Management
- Suppliers manage their own inventory
- Admin can view all supplier inventory
- Products are linked to supplier inventory
- Automatic reservation and commitment on orders

### Order Assignment
- Automatic based on product-supplier links
- Can be manually assigned by admin
- Multiple suppliers can fulfill different items in same order

---

## Support & Contact

For questions or issues:
- Email: hello@brevibrushes.com
- Live Chat: Available on website (bottom right)
- Support Hours: 24/7 (AI chat), Business hours (Human support)

---

*Last Updated: January 2025*

