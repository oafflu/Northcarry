# Database Setup & Project Scripts

This document covers database setup scripts, npm runnable scripts, and project updates (including changes from multiple agents).

---

## NPM Scripts (package.json)

| Command | Description |
|--------|-------------|
| `npm run seed:users` | Create demo users (customer + admin). |
| `npm run update:admin` | Set admin role for admin user (run after adding `role` column). |
| `npm run populate:reviews` | Populate reviews from `scripts/populate-reviews.ts`. |
| `npm run build` | Next.js production build (Turbopack by default in Next 16; use `next build --webpack` if needed). |

---

## User Seeding

### Create Demo Users

```bash
npm run seed:users
```

Creates:
- **Customer**: customer@brevibrushes.com / customer123
- **Admin**: admin@brevibrushes.com / admin123

### Add Role Column (Required for Admin Access)

After creating users, add the `role` column to the `profiles` table.

**Option 1: Run SQL in Supabase Dashboard**

1. Go to your Supabase project dashboard → SQL Editor.
2. Run the SQL below (or use `scripts/add-role-column.sql`):

```sql
-- Add role column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));

-- Update admin user role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@brevibrushes.com';
```

**Option 2: Use the SQL file**

Copy and paste from `scripts/add-role-column.sql` into Supabase SQL Editor.

### Update Admin Role (After Adding Column)

```bash
npm run update:admin
```

Sets the admin role for the admin user.

---

## Demo Credentials

| Account | Email | Password |
|---------|--------|----------|
| Customer | customer@brevibrushes.com | customer123 |
| Admin | admin@brevibrushes.com | admin123 |

Admin access requires the `role` column on `profiles` (see above).

---

## Fix Cart Items RLS

If you see: *"new row violates row-level security policy for table cart_items"*:

```bash
psql $DATABASE_URL -f scripts/fix-cart-items-rls.sql
```

Or run the contents of `scripts/fix-cart-items-rls.sql` in Supabase SQL Editor.

---

## Incomplete Payments & Order Recovery

Stripe payments that succeed but don’t create an order are logged and can be recovered.

### Setup

1. **Create the table** (once): run `scripts/create-incomplete-payments-table.sql` in Supabase SQL Editor (or use the migration referenced in the file).
2. **Stripe webhook**: Ensure the Stripe webhook sends events to `/api/webhooks/stripe`. The handler logs successful payments without matching orders to `incomplete_payments` and can notify admins.

### Admin UI: `/admin/payments/incomplete`

- **Recover by order number or Payment Intent ID**: Use “Recover Order by Order Number” (order number or `pi_xxx`).
- **Single recover**: “Recover” on a row.
- **Bulk**: “Recover Selected” or “Auto-Recover All”.

### API Endpoints (admin)

- `POST /api/admin/incomplete-payments/recover-order` – Create order from a payment (by order number or Payment Intent ID).
- `POST /api/admin/incomplete-payments/auto-recover` – Process a batch of unrecovered payments and create orders.
- Sync from Stripe: `scripts/sync-existing-incomplete-payments.md` describes syncing and testing.

### After Recovering an Order

See **Dox/updating-recovered-order.md** for:

- Updating the order number (e.g. to match original).
- Adding order items (cart not in payment metadata).
- Updating addresses if placeholders were used.

---

## Email Campaigns (Warmed-Up Sender)

### Config

- **Per run**: Up to **50,000** recipients per send; the rest continue on the next run (cron or manual resume).
- **Batching**: **5,000** per batch (or **3,000** if the template uses `{{firstName}}` / `{{name}}`).
- **Constants**: `lib/email-campaigns-config.ts` exports `MAX_CAMPAIGN_SEND_PER_GO = 50000`. This lives outside `"use server"` so server action files only export async functions (required for Next.js build).

### Cron

- **Email campaigns resume**: `/api/cron/email-campaigns-resume` runs every 5 minutes (`*/5 * * * *` in `vercel.json`) to continue partially sent campaigns.
- Cron selects `recipient_type` and `segment_id` so recipient lists can be rebuilt when stored recipients are missing.

### Related Scripts / Tables

- `scripts/create-email-marketing-tables.sql` – Email campaigns tables.
- `scripts/create-email-templates-tables.sql` – Templates tables.

---

## Cron Jobs (Vercel)

Defined in **vercel.json**:

| Path | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/subscription-orders` | Daily 02:00 UTC | Subscription order creation |
| `/api/cron/abandoned-carts` | Hourly | Abandoned cart handling |
| `/api/cron/win-back` | Daily 03:00 UTC | Win-back flows |
| `/api/cron/birthday` | Daily 04:00 UTC | Birthday emails |
| `/api/cron/review-requests` | Daily 09:00 UTC | Review request emails |
| `/api/cron/email-campaigns-resume` | Every 5 minutes | Resume paused email campaigns (one batch per campaign) |

Set `CRON_SECRET` in Vercel (and use it in the `Authorization: Bearer <CRON_SECRET>` header when calling these routes). Full setup: **CRON_JOBS_SETUP.md**.

---

## SQL Scripts Overview

Run in Supabase SQL Editor (or via `psql $DATABASE_URL -f script.sql`) as needed.

### Create tables

- `create-addresses-table.sql`
- `create-cms-content-table.sql` / `create-cms-tables.sql`
- `create-email-marketing-tables.sql`
- `create-email-templates-tables.sql`
- `create-fcm-tables.sql`
- `create-incomplete-payments-table.sql`
- `create-linked-subscriptions-table.sql`
- `create-loyalty-tables.sql`
- `create-marketing-tables.sql`
- `create-media-storage.sql`
- `create-newsletter-table.sql`
- `create-payments-table.sql`
- `create-promotions-table.sql`
- `create-review-requests-table.sql`
- `create-reviews-rls-policies.sql`
- `create-sample-requests-system.sql`
- `create-settings-tables.sql`
- `create-subscriptions-tables.sql`
- `create-supplier-payment-tables.sql`
- `create-supplier-tables.sql`
- `create-system-logs-table.sql`
- `create-upsell-system-tables.sql`

### Add columns / migrations

- `add-role-column.sql`
- `add-avatar-url-column.sql`
- `add-dates-to-upsell-campaigns.sql`
- `add-linked-subscription-delay-columns.sql`
- `add-marketer-support-roles.sql`
- `add-payment-methods-fields.sql`
- `add-paypal-fields-to-incomplete-payments.sql`
- `add-phone-to-addresses.sql`
- `add-product-category-column.sql`
- `add-product-inventory-shipping-fields.sql`
- `add-product-template-assignment.sql`
- `add-purchase-type-to-order-items.sql`
- `add-receipt-field-to-invoices.sql`
- `add-replacement-shipping-to-returns.sql`
- `add-returns-update-policy.sql`
- `add-review-management-columns.sql`
- `add-shipping-enabled-to-countries.sql`
- `add-stripe-fields.sql`
- `add-stripe-price-id-to-subscription-products.sql`
- `add-subscription-metadata-to-cart-items.sql`
- `add-subscription-product-id-to-order-items.sql`
- `add-ticket-id-to-contact-messages.sql`
- `add-variant-color-image.sql`
- (and other `add-*.sql` in `scripts/`)

### Fixes & policies

- `fix-cart-items-rls.sql`
- `fix-email-provider-setting.sql`
- `fix-orders-rls.sql` / `fix-orders-rls-for-suppliers.sql`
- `fix-products-rls.sql`
- `fix-role-constraint.sql`

### Verification / inspection

- `customer-count-summary.sql`
- `export-all-customers.sql`
- `inspect-admin-settings.sql`
- `verify-cms-content.sql`
- `verify-customer-counts.sql`
- `verify-incomplete-payments-table.sql`

---

## Bulk Import & Email / Config

- **Bulk import customers**: See **scripts/bulk-import-customers.md**. Use `/admin/customers` → Import; CSVs in `Dox/customer imports/`; import API saves addresses correctly.
- **Email config check**: `scripts/check-email-config.ts` (run with `tsx` if needed).
- **Compare email config**: `scripts/compare-email-config.sh`.

---

## Other Documentation

- **Dox/updating-recovered-order.md** – Edit recovered orders (number, items, addresses).
- **Dox/how-to-recover-order-BREVI-20260120-G0CD.md** – Example recovery flow.
- **scripts/sync-existing-incomplete-payments.md** – Syncing and testing incomplete payments.
- **CRON_JOBS_SETUP.md** – Full cron setup (Vercel + optional pg_cron).
- **email-templates/README.md** – Email template usage and structure.
