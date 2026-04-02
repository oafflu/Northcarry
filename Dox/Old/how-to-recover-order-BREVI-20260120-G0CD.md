# How to Recover Order BREVI-20260120-G0CD

## The Problem

The payment for order **BREVI-20260120-G0CD** was successful in Stripe, but the order was never created in the Brevi system. This happened because:

1. **The payment occurred before the webhook fix** - The enhanced webhook handler that logs successful payments without orders was added after this payment happened
2. **Successful payments don't show in incomplete_payments** - The `/admin/payments/incomplete` page only shows failed payments by default, not successful payments that are missing orders

## Solution: Recover the Order

### Method 1: Recover by Order Number (Easiest)

1. Go to `/admin/payments/incomplete`
2. Click the **"Show"** button in the "Recover Order by Order Number" section
3. Enter the order number: `BREVI-20260120-G0CD`
4. Click **"Recover Order"**
5. The system will:
   - Search Stripe for a payment with this order number in metadata
   - Create the order in Brevi system
   - Link the payment to the order

### Method 2: Recover by Payment Intent ID (If Method 1 doesn't work)

If the order number search doesn't work, you can recover using the Payment Intent ID directly:

1. **Find the Payment Intent ID in Stripe:**
   - Go to Stripe Dashboard → Payments
   - Search for "BREVI-20260120-G0CD" or the customer email
   - Copy the Payment Intent ID (starts with `pi_`)

2. **Use the Recovery API:**
   - Make a POST request to `/api/admin/incomplete-payments/recover-order`
   - Body: `{ "paymentIntentId": "pi_xxxxx" }`

### Method 3: Manual Recovery via API

You can also use curl or any HTTP client:

```bash
curl -X POST https://yourdomain.com/api/admin/incomplete-payments/recover-order \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "orderNumber": "BREVI-20260120-G0CD"
  }'
```

## What Happens During Recovery

When you recover an order:

1. **Searches Stripe** for the payment intent with the order number
2. **Checks if order already exists** - If it does, returns the existing order
3. **Creates the order** with:
   - Customer information from payment metadata
   - Payment amount from Stripe
   - Shipping/billing addresses (from customer profile or placeholders)
   - Payment status set to "paid"
4. **Links the payment** to the order via `stripe_payment_intent_id`
5. **Awards loyalty points** if the customer has an account
6. **Marks as recovered** in incomplete_payments (if it exists there)

## Important Notes

- **Order Items**: The recovered order may not have order items because cart data isn't stored in payment metadata. You may need to manually add order items.
- **Addresses**: If customer addresses aren't in their profile, placeholder addresses will be used. You should update these manually.
- **Future Payments**: New successful payments without orders will automatically be logged to `incomplete_payments` and can be recovered from there.

## Prevention

The webhook handler now automatically:
- Logs successful payments without orders to `incomplete_payments`
- Notifies admins when this happens
- Allows easy recovery from the admin panel

This means future cases will be easier to catch and recover!
