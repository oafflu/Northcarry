# Syncing Existing Incomplete Payments from Stripe

If you have incomplete payments in Stripe that aren't showing in `/admin/payments/incomplete`, you can manually sync them.

## Option 1: Use Stripe Dashboard

1. Go to Stripe Dashboard → Payments
2. Filter by "Failed" or "Requires Payment Method"
3. For each failed payment:
   - Note the Payment Intent ID
   - Check if it exists in your `incomplete_payments` table
   - If not, the webhook should create it automatically on the next failure

## Option 2: Manual Sync Script (if needed)

If you need to backfill historical incomplete payments, you would need to:
1. Use Stripe API to fetch failed payment intents
2. Insert them into `incomplete_payments` table
3. This is typically not necessary as webhooks handle new failures automatically

## Testing

To test the incomplete payments tracking:

1. **Create a test failed payment:**
   - Use Stripe test mode
   - Create a payment intent with a card that will fail (e.g., `4000000000000002`)
   - The webhook should automatically create a record in `incomplete_payments`

2. **Check the admin panel:**
   - Go to `/admin/payments/incomplete`
   - You should see the failed payment listed

3. **Verify webhook is working:**
   - Check your server logs for webhook events
   - Look for `payment_intent.payment_failed` events
   - Check for log messages like: `📝 Created incomplete payment record for pi_...`

## Webhook Configuration

Ensure your Stripe webhook is configured to send:
- `payment_intent.payment_failed` events
- Webhook endpoint: `https://brevibrushes.com/api/webhooks/stripe`

## Next Steps

1. ✅ Table is created
2. ✅ Policies are set up
3. ✅ Webhook handler is ready
4. ⏳ Wait for new failed payments (webhooks will create records automatically)
5. ⏳ Or manually test with a failed payment in Stripe test mode

