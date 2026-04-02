# Cron Jobs Setup Guide

This guide explains how to set up cron jobs for automatic subscription order creation.

## Option 1: Vercel Cron Jobs (Recommended)

Vercel provides built-in cron job functionality for Next.js applications. This is the recommended approach.

### Step 1: Create the Cron Endpoint

The cron endpoint is already created at:
- **File**: `app/api/cron/subscription-orders/route.ts`
- **Path**: `/api/cron/subscription-orders`

### Step 2: Configure Vercel Cron

1. **Create `vercel.json`** (already created in project root):
```json
{
  "crons": [
    {
      "path": "/api/cron/subscription-orders",
      "schedule": "0 2 * * *"
    }
  ]
}
```

2. **Schedule Format**: Uses cron syntax
   - `0 2 * * *` = Daily at 2:00 AM UTC
   - `0 */6 * * *` = Every 6 hours
   - `0 0 * * 0` = Every Sunday at midnight
   - `*/30 * * * *` = Every 30 minutes

### Step 3: Set Environment Variable

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `CRON_SECRET`
   - **Value**: Generate a secure random string (e.g., `openssl rand -hex 32`)
   - **Environment**: Production (and Preview if needed)

### Step 4: Deploy to Vercel

```bash
# Push to your repository
git add vercel.json app/api/cron/subscription-orders/route.ts
git commit -m "Add subscription orders cron job"
git push

# Or deploy directly
vercel --prod
```

### Step 5: Verify Cron Job

1. Go to **Vercel Dashboard** → Your Project → **Crons**
2. You should see your cron job listed
3. Check the logs after the first run

### Security

The cron endpoint is protected by:
- **Authorization header**: Must include `Bearer {CRON_SECRET}`
- **Vercel automatically adds this header** when calling cron jobs
- External requests without the secret will be rejected

---

## Option 2: Supabase pg_cron (Alternative)

If you prefer to run cron jobs directly in Supabase, you can use PostgreSQL's `pg_cron` extension.

### Step 1: Enable pg_cron Extension

Run in Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to your database role
GRANT USAGE ON SCHEMA cron TO postgres;
```

### Step 2: Create a Function to Create Subscription Orders

```sql
CREATE OR REPLACE FUNCTION process_subscription_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
  next_cycle_number INTEGER;
  next_shipment_date DATE;
  next_billing_date DATE;
BEGIN
  -- Find subscriptions that need orders
  FOR subscription_record IN
    SELECT 
      cs.*,
      sp.shipping_days
    FROM customer_subscriptions cs
    JOIN subscription_products sp ON cs.subscription_product_id = sp.id
    WHERE cs.status = 'active'
      AND cs.next_shipment_date <= CURRENT_DATE
      AND (
        cs.purchase_type = 'ongoing' 
        OR (cs.purchase_type = 'prepaid' AND cs.prepaid_cycles_remaining > 0)
      )
    ORDER BY cs.next_shipment_date ASC
  LOOP
    -- Get next cycle number
    SELECT COALESCE(MAX(cycle_number), 0) + 1
    INTO next_cycle_number
    FROM subscription_orders
    WHERE subscription_id = subscription_record.id;

    -- Calculate next dates
    next_shipment_date := subscription_record.next_shipment_date + 
      (subscription_record.frequency_months || ' months')::INTERVAL;
    
    next_billing_date := next_shipment_date - 
      (subscription_record.shipping_days || ' days')::INTERVAL;

    -- Create order (simplified - you'll need to implement full order creation)
    -- This is a basic example - you may want to call your Next.js API instead
    INSERT INTO orders (
      order_number,
      user_id,
      customer_email,
      subtotal,
      shipping_cost,
      tax_amount,
      total,
      payment_status,
      fulfillment_status
    )
    SELECT
      'SUB-' || SUBSTRING(subscription_record.id::TEXT, 1, 8) || '-' || next_cycle_number,
      subscription_record.user_id,
      p.email,
      subscription_record.price_per_cycle,
      0,
      0,
      subscription_record.price_per_cycle,
      CASE WHEN subscription_record.purchase_type = 'prepaid' THEN 'paid' ELSE 'pending' END,
      'unfulfilled'
    FROM profiles p
    WHERE p.id = subscription_record.user_id;

    -- Update subscription dates
    UPDATE customer_subscriptions
    SET 
      next_shipment_date = next_shipment_date,
      next_billing_date = next_billing_date,
      prepaid_cycles_remaining = CASE 
        WHEN purchase_type = 'prepaid' THEN GREATEST(0, prepaid_cycles_remaining - 1)
        ELSE prepaid_cycles_remaining
      END,
      status = CASE
        WHEN purchase_type = 'prepaid' AND prepaid_cycles_remaining <= 1 THEN 'completed'
        ELSE status
      END
    WHERE id = subscription_record.id;
  END LOOP;
END;
$$;
```

### Step 3: Schedule the Cron Job

```sql
-- Schedule to run daily at 2 AM UTC
SELECT cron.schedule(
  'process-subscription-orders',
  '0 2 * * *',
  $$SELECT process_subscription_orders()$$
);
```

### Step 4: View Scheduled Jobs

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- View job run history
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Step 5: Unschedule (if needed)

```sql
-- Remove a cron job
SELECT cron.unschedule('process-subscription-orders');
```

---

## Recommendation: Use Vercel Cron Jobs

**Why Vercel is better:**
- ✅ Integrated with your Next.js app
- ✅ Can use your existing server actions and functions
- ✅ Better error handling and logging
- ✅ No database extension setup needed
- ✅ Easier to test and debug
- ✅ Can trigger multiple endpoints
- ✅ Built-in monitoring in Vercel dashboard

**When to use Supabase pg_cron:**
- If you need very frequent runs (< 1 minute)
- If you want database-level processing
- If you're not using Vercel

---

## Testing Your Cron Job

### Manual Test (Vercel)

```bash
# Test locally (won't work with Vercel auth, but you can test the logic)
curl http://localhost:3000/api/cron/subscription-orders \
  -H "Authorization: Bearer your-cron-secret"
```

### Manual Test (Supabase)

```sql
-- Run the function manually
SELECT process_subscription_orders();
```

---

## Monitoring

### Vercel
- **Dashboard**: Vercel → Your Project → **Crons** tab
- **Logs**: View execution logs and errors
- **Metrics**: Success/failure rates

### Supabase
- **Query**: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`
- **Errors**: Check Supabase logs in dashboard

---

## Troubleshooting

### Vercel Cron Not Running
1. Check `vercel.json` is in project root
2. Verify cron path matches your API route
3. Check environment variable `CRON_SECRET` is set
4. Verify deployment includes the cron endpoint

### Supabase Cron Not Running
1. Verify `pg_cron` extension is enabled
2. Check function exists: `SELECT * FROM cron.job;`
3. Verify function has proper permissions
4. Check Supabase logs for errors

---

## Schedule Recommendations

- **Daily at 2 AM UTC**: `0 2 * * *` (Recommended)
- **Twice daily**: `0 2,14 * * *` (2 AM and 2 PM)
- **Every 6 hours**: `0 */6 * * *`
- **Every hour**: `0 * * * *` (Not recommended - too frequent)

For subscription orders, **daily is sufficient** since you're checking `next_shipment_date <= today`.

