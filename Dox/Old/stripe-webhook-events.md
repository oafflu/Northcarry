# Stripe Webhook Events Configuration for Brevi

## Required Webhook Events

### 🔴 Critical Events (Must Have)

#### 1. **Payment Success Events**
- **`payment_intent.succeeded`**
  - **Purpose**: Confirm payment and update order status
  - **Actions**:
    - Update order `payment_status` to `'paid'`
    - Award loyalty points for purchase
    - Send order confirmation email
    - Trigger order assignment to suppliers
    - Update inventory (reserve items)
    - Update analytics (revenue, conversion)

- **`payment_intent.payment_failed`**
  - **Purpose**: Handle failed payments
  - **Actions**:
    - Update order `payment_status` to `'failed'`
    - Release reserved inventory
    - Send payment failure email to customer
    - Log failure reason for analytics

#### 2. **Refund Events**
- **`charge.refunded`** (Full or Partial)
  - **Purpose**: Process refunds
  - **Actions**:
    - Update order `payment_status` to `'refunded'` (if full refund)
    - Create refund record in database
    - Reverse loyalty points (if applicable)
    - Update inventory (restock items if returned)
    - Send refund confirmation email
    - Update supplier performance metrics

- **`charge.refund.updated`**
  - **Purpose**: Track refund status changes
  - **Actions**:
    - Update refund record status
    - Handle partial refunds

#### 3. **Dispute/Chargeback Events**
- **`charge.dispute.created`**
  - **Purpose**: Handle chargebacks/disputes
  - **Actions**:
    - Create dispute record
    - Notify admin team
    - Freeze order fulfillment if not shipped
    - Update order status
    - Send notification to customer

- **`charge.dispute.updated`**
  - **Purpose**: Track dispute resolution
  - **Actions**:
    - Update dispute status
    - Handle dispute won/lost scenarios
    - Update order accordingly

- **`charge.dispute.closed`**
  - **Purpose**: Finalize dispute resolution
  - **Actions**:
    - Update final dispute status
    - Process refund if dispute won by customer
    - Update analytics

### 🟡 Important Events (Should Have)

#### 4. **Payment Method Events**
- **`payment_method.attached`**
  - **Purpose**: Save customer payment methods
  - **Actions**:
    - Store payment method for future use
    - Enable one-click checkout

- **`payment_method.detached`**
  - **Purpose**: Handle removed payment methods
  - **Actions**:
    - Remove saved payment method
    - Update customer payment preferences

#### 5. **Customer Events**
- **`customer.created`**
  - **Purpose**: Sync customer data
  - **Actions**:
    - Link Stripe customer ID to user profile
    - Update customer metadata

- **`customer.updated`**
  - **Purpose**: Keep customer data in sync
  - **Actions**:
    - Update customer information
    - Sync email, name, address changes

#### 6. **Subscription Events** (If you add subscriptions later)
- **`customer.subscription.created`**
- **`customer.subscription.updated`**
- **`customer.subscription.deleted`**
- **`invoice.payment_succeeded`**
- **`invoice.payment_failed`**

### 🟢 Optional Events (Nice to Have)

#### 7. **Payment Intent Events**
- **`payment_intent.created`**
  - **Purpose**: Track payment initiation
  - **Actions**:
    - Log payment attempt
    - Update analytics (abandoned checkout tracking)

- **`payment_intent.canceled`**
  - **Purpose**: Handle canceled payments
  - **Actions**:
    - Release reserved inventory
    - Update order status
    - Track cancellation reasons

- **`payment_intent.requires_action`**
  - **Purpose**: Handle 3D Secure and other authentication
  - **Actions**:
    - Notify customer of required action
    - Update payment status

#### 8. **Invoice Events** (For future subscription features)
- **`invoice.created`**
- **`invoice.finalized`**
- **`invoice.paid`**
- **`invoice.payment_failed`**
- **`invoice.voided`**

#### 9. **Payout Events** (For admin reconciliation)
- **`payout.paid`**
  - **Purpose**: Track when funds are transferred to bank
  - **Actions**:
    - Update financial records
    - Reconcile accounts

- **`payout.failed`**
  - **Purpose**: Handle payout failures
  - **Actions**:
    - Alert admin
    - Update financial records

#### 10. **Account Events** (For Connect accounts if using marketplace model)
- **`account.updated`**
- **`account.application.deauthorized`**

## Webhook Endpoint Configuration

### Recommended Webhook URL
```
https://yourdomain.com/api/webhooks/stripe
```

### Webhook Secret
Store in environment variable:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Implementation Priority

### Phase 1: Core Payment Flow (Launch)
1. ✅ `payment_intent.succeeded` - **CRITICAL**
2. ✅ `payment_intent.payment_failed` - **CRITICAL**
3. ✅ `charge.refunded` - **CRITICAL**

### Phase 2: Customer Protection (Post-Launch)
4. ✅ `charge.dispute.created` - **IMPORTANT**
5. ✅ `charge.dispute.updated` - **IMPORTANT**
6. ✅ `charge.dispute.closed` - **IMPORTANT**

### Phase 3: Enhanced Features
7. ⚪ `payment_method.attached` - **OPTIONAL**
8. ⚪ `customer.created` - **OPTIONAL**
9. ⚪ `customer.updated` - **OPTIONAL**

### Phase 4: Advanced Features (Future)
10. ⚪ Subscription events (if adding subscriptions)
11. ⚪ Payout events (for financial reconciliation)

## Event Handling Logic

### payment_intent.succeeded
```typescript
// Update order payment status
// Award loyalty points
// Send confirmation email
// Assign order to supplier
// Reserve inventory
// Update analytics
```

### charge.refunded
```typescript
// Update order payment status
// Create refund record
// Reverse loyalty points
// Restock inventory (if applicable)
// Send refund email
// Update supplier metrics
```

### charge.dispute.created
```typescript
// Create dispute record
// Notify admin
// Freeze fulfillment if needed
// Update order status
// Send customer notification
```

## Security Considerations

1. **Verify Webhook Signatures**: Always verify Stripe webhook signatures
2. **Idempotency**: Handle duplicate webhook deliveries
3. **Error Handling**: Implement retry logic for failed webhook processing
4. **Logging**: Log all webhook events for debugging and audit

## Testing

Use Stripe CLI to test webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

## Summary

**Minimum Required Events (3):**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

**Recommended Events (6):**
- Above 3 +
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

**Complete Setup (10+):**
- All recommended +
- Payment method events
- Customer events
- Additional payment intent events

