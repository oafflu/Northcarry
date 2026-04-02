# PayPal Subscription Integration

## Overview

PayPal integration has been updated to support subscriptions alongside regular one-time purchases. The system handles both **prepaid subscriptions** (pay upfront for multiple cycles) and **ongoing subscriptions** (recurring billing).

## How It Works

### 1. Cart Detection
- The cart context (`lib/cart-context.tsx`) now includes subscription metadata when loading cart items:
  - `purchaseType`: 'one-time' | 'subscription' | 'prepaid'
  - `subscriptionId`: Subscription product ID
  - `frequency`: Frequency in months
  - `shippingDays`: Shipping days

### 2. PayPal Order Creation
- The PayPal button (`components/paypal-button.tsx`) detects subscriptions in the cart
- Subscription metadata is passed to the PayPal API (`/api/paypal/create-order`)
- The API stores subscription information in the order metadata

### 3. Order Creation After Payment
- After PayPal payment succeeds, `createOrder` is called (same as Stripe)
- `createOrder` automatically:
  - Detects subscription items from cart
  - Creates subscriptions using `createCustomerSubscription`
  - Links subscriptions to the order

### 4. Subscription Types

#### Prepaid Subscriptions
- Customer pays upfront for multiple cycles (e.g., 3 months)
- Full amount charged via PayPal
- Subscription created with `purchase_type: 'prepaid'`
- Cycles tracked via `prepaid_cycles_remaining`
- No recurring billing needed

#### Ongoing Subscriptions
- Customer pays for first cycle only
- Subscription created with `purchase_type: 'ongoing'`
- **Important**: PayPal doesn't support automatic recurring billing like Stripe
- Future cycles will need to be billed manually or via a different payment method
- The cron job can still create orders for these subscriptions, but payment collection must be handled separately

## Current Limitations

### Ongoing Subscriptions with PayPal
Unlike Stripe, PayPal doesn't automatically handle recurring billing for ongoing subscriptions. Options:

1. **Manual Billing**: Admin manually processes payments for each cycle
2. **Hybrid Approach**: Customer can switch to Stripe for recurring billing
3. **PayPal Billing Agreements**: Requires PayPal Business account and additional setup (not currently implemented)

### Recommendation
For ongoing subscriptions, consider:
- Encouraging customers to use Stripe for automatic recurring billing
- Using prepaid subscriptions when possible (simpler, no recurring billing needed)
- Implementing PayPal Billing Agreements for full recurring support (requires additional development)

## Testing

To test PayPal subscriptions:

1. Add a subscription product to cart (subscription or prepaid)
2. Go to checkout
3. Select PayPal as payment method
4. Complete PayPal payment
5. Verify:
   - Order is created successfully
   - Subscription is created in `/admin/subscriptions`
   - For prepaid: All cycles are prepaid
   - For ongoing: First cycle is paid, future cycles need manual billing

## Admin Panel

Subscriptions created via PayPal will appear in:
- `/admin/subscriptions` - All subscriptions
- `/admin/orders` - Order details
- Customer account - Subscription management

## Stripe Link Deactivation

You've deactivated Stripe Link and PayPal in Stripe payment methods. This means:
- ✅ Stripe Cards still work
- ✅ Stripe Apple Pay/Google Pay still work
- ✅ PayPal via our integration still works
- ❌ Stripe Link is disabled
- ❌ Stripe PayPal is disabled (use our PayPal integration instead)

## Next Steps (Optional)

If you want full recurring billing support for PayPal:

1. **PayPal Billing Agreements** (Recommended for ongoing subscriptions)
   - Requires PayPal Business account
   - Customer authorizes recurring payments
   - Automatic billing for future cycles
   - More complex implementation

2. **Hybrid Payment Method**
   - Allow customers to choose payment method per cycle
   - Store multiple payment methods
   - More flexible but more complex

3. **Prepaid-Only Model**
   - Only offer prepaid subscriptions
   - Simpler, no recurring billing needed
   - Customer pays upfront for all cycles

