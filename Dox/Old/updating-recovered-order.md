# Updating a Recovered Order

After successfully recovering an order, you may need to:

1. **Update the Order Number** (if it got a new number)
2. **Add Order Items** (cart items aren't stored in payment metadata)
3. **Update Addresses** (if placeholders were used)

## 1. Update Order Number

If the recovered order has a different order number (e.g., `BREVI-20260121-Q68I` instead of `BREVI-20260120-G0CD`):

### Option A: Update via Database (Quick)
```sql
UPDATE orders 
SET order_number = 'BREVI-20260120-G0CD' 
WHERE id = '<order-id>';
```

### Option B: Update via Admin Panel
- Go to `/admin/orders/[id]`
- The order number field may be editable, or you can update it directly in the database

## 2. Add Order Items

Since cart items aren't stored in payment intent metadata, you'll need to add them manually:

1. Go to `/admin/orders/[id]` (the recovered order)
2. Click **"Add Item"** button
3. Select the product and variant
4. Enter quantity and price
5. Repeat for all items in the order

**To find what items were ordered:**
- Check the customer's order history (if they have an account)
- Check Stripe payment metadata for any item hints
- Contact the customer if needed
- Check the order total ($7.52) to estimate what was purchased

## 3. Update Addresses

If addresses are placeholders (`[Address not available - please update]`):

1. Go to `/admin/orders/[id]`
2. Click **"Edit Address"** 
3. Either:
   - Select from customer's saved addresses (if they have an account)
   - Enter new address manually
4. Update phone number if needed

## 4. Verify Order Totals

After adding items, verify the totals match:
- **Subtotal**: $6.96 (from metadata)
- **Tax**: $0.56 (from metadata)
- **Shipping**: $0.00 (from metadata)
- **Total**: $7.52 (matches Stripe payment)

## Quick Reference

**Recovered Order Details:**
- Order Number: `BREVI-20260121-Q68I` (may need to update to `BREVI-20260120-G0CD`)
- Customer: Janine Marano (`brooklynjj241@gmail.com`)
- Payment Intent: `pi_3SrgQqGcTncGVTkL1A9a5UAq`
- Amount: $7.52
- Status: Paid ✅

**Next Steps:**
1. ✅ Order created and linked to payment
2. ⚠️ Add order items
3. ⚠️ Verify/update addresses
4. ⚠️ Update order number if needed
