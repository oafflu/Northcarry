# Order Creation Failure Investigation

## Problem
Successful Stripe payments (e.g., "BREVI-20260120-G0CD") are not creating corresponding orders in the Brevi system.

## Root Causes Identified

### 1. **Race Condition Between Webhook and Client-Side Order Creation**
- **Issue**: The Stripe webhook (`payment_intent.succeeded`) can fire before the client-side `handlePaymentSuccess` completes order creation
- **Scenario**: 
  - Payment succeeds in Stripe
  - Webhook fires immediately
  - Client-side order creation is still in progress or fails
  - Webhook finds no order and logs to `incomplete_payments`
- **Impact**: Orders are not created even though payment succeeded

### 2. **Client-Side Order Creation Failures**
Common failure points in `app/checkout/page.tsx` → `handlePaymentSuccess`:

#### a. **Cart Empty or Session Expired**
- Cart items may be cleared before order creation
- Session ID may expire between payment and order creation
- **Location**: `app/actions/checkout.ts:891-893`
```typescript
if (!userId && !sessionId) {
  return { success: false, error: 'Cart is empty' }
}
```

#### b. **Database Constraints**
- Missing required fields (addresses, customer info)
- Foreign key violations
- Unique constraint violations (duplicate order numbers)
- **Location**: `app/actions/checkout.ts:1305-1366`

#### c. **Network/Timeout Issues**
- Client loses connection during order creation
- Request times out
- Server errors during processing

#### d. **Post-Processing Errors**
- Order creation succeeds but post-processing fails (loyalty points, emails, etc.)
- Error is returned even though order exists
- **Mitigation**: Idempotency check exists but may not catch all cases

### 3. **Webhook Handler Limitations**
- **Previous Behavior**: Webhook only updated existing orders, didn't create them
- **Current Behavior**: Webhook now logs to `incomplete_payments` but doesn't create orders
- **Location**: `app/api/webhooks/stripe/route.ts:142-216`

### 4. **Missing Error Recovery**
- No automatic retry mechanism for failed order creation
- No background job to process incomplete payments
- Manual intervention required

## Solutions Implemented

### 1. **Enhanced Webhook Handler**
- ✅ Logs successful payments without orders to `incomplete_payments`
- ✅ Notifies admins when this occurs
- ✅ Marks payments with `failure_reason: 'order_not_created'`

### 2. **Recovery Endpoint**
- ✅ Created `/api/admin/incomplete-payments/recover-order`
- ✅ Creates orders from payment intent metadata
- ✅ Handles missing addresses (uses customer defaults or placeholders)
- ✅ Awards loyalty points
- ✅ Marks incomplete payment as recovered

### 3. **UI Recovery Buttons**
- ✅ Individual recovery button per payment row
- ✅ Bulk recovery for selected payments
- ✅ Auto-recover all unrecovered payments button

### 4. **Auto-Recovery Endpoint**
- ✅ Created `/api/admin/incomplete-payments/auto-recover`
- ✅ Processes multiple payments in batch
- ✅ Skips payments that already have orders
- ✅ Returns detailed success/failure statistics

## Prevention Strategies

### 1. **Improve Order Creation Reliability**
- **Add retry logic** in `handlePaymentSuccess` for transient failures
- **Store cart items in payment intent metadata** for recovery
- **Implement idempotency keys** for order creation

### 2. **Webhook-Initiated Order Creation**
- **Enhance webhook handler** to create orders if they don't exist
- **Store cart data** in payment intent metadata during payment creation
- **Use webhook as primary order creation mechanism** (more reliable than client-side)

### 3. **Better Error Handling**
- **Log all order creation attempts** with full context
- **Alert on repeated failures** from same customer/payment
- **Monitor incomplete_payments table** for patterns

### 4. **Cart Persistence**
- **Save cart to database** before payment (not just in session)
- **Link cart to payment intent** via metadata
- **Recover cart items** during order recovery

## Recommended Next Steps

1. **Short-term** (Immediate):
   - ✅ Use recovery tools to fix existing missing orders
   - Monitor `incomplete_payments` table for new cases
   - Review logs for order creation failures

2. **Medium-term** (Next Sprint):
   - Store cart items in payment intent metadata
   - Add retry logic to client-side order creation
   - Implement background job to auto-recover recent payments

3. **Long-term** (Future):
   - Move order creation to webhook handler (server-side)
   - Implement cart persistence before payment
   - Add comprehensive monitoring and alerting

## Monitoring

### Key Metrics to Track:
- Number of `incomplete_payments` with `failure_reason: 'order_not_created'`
- Time between payment success and order creation
- Order creation failure rate
- Recovery success rate

### Alerts to Set Up:
- Alert when payment succeeds but order not created within 5 minutes
- Alert when recovery fails for multiple payments
- Alert on unusual patterns (e.g., same customer, multiple failures)

## Files Modified

1. `app/api/webhooks/stripe/route.ts` - Enhanced to log missing orders
2. `app/api/admin/incomplete-payments/recover-order/route.ts` - New recovery endpoint
3. `app/api/admin/incomplete-payments/auto-recover/route.ts` - New auto-recovery endpoint
4. `app/admin/payments/incomplete/page.tsx` - Added recovery UI buttons
