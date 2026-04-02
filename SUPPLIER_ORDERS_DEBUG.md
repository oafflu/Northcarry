# Supplier Orders Debugging Guide

## Issue: Supplier Orders Not Showing

If suppliers don't see orders even after assignment, follow these debugging steps:

### 1. Check if Orders are Assigned

**From Admin Panel:**
1. Go to `/admin/orders`
2. Click on an order to view details
3. Check the "Supplier Assignments" section in the sidebar
4. If no suppliers are listed, assign the order manually using the "Assign" button

**From Database (if you have access):**
```sql
-- Check if assignments exist
SELECT 
  soa.id,
  soa.order_id,
  soa.supplier_id,
  soa.assignment_status,
  o.order_number,
  p.email as supplier_email
FROM supplier_order_assignments soa
JOIN orders o ON o.id = soa.order_id
JOIN profiles p ON p.id = soa.supplier_id
WHERE soa.supplier_id = 'YOUR_SUPPLIER_ID';
```

### 2. Check Product-Supplier Links

Orders are automatically assigned based on `product_supplier_links`. Verify:

```sql
-- Check if products are linked to suppliers
SELECT 
  psl.id,
  psl.variant_id,
  psl.supplier_id,
  psl.is_primary_supplier,
  pv.sku,
  p.title as product_title,
  pr.email as supplier_email
FROM product_supplier_links psl
JOIN product_variants pv ON pv.id = psl.variant_id
JOIN products p ON p.id = pv.product_id
JOIN profiles pr ON pr.id = psl.supplier_id
WHERE pr.id = 'YOUR_SUPPLIER_ID';
```

### 3. Check RLS Policies

The supplier must be able to read from `supplier_order_assignments`. The policy should be:
- `supplier_id = auth.uid()` OR user is admin

### 4. Browser Console Debugging

When viewing `/supplier/orders`, check the browser console for:
- Error messages from the query
- Debug logs showing assignment counts
- RLS policy errors

### 5. Manual Assignment Steps

**Option 1: Bulk Assign (Auto)**
1. Go to `/admin/orders`
2. Click "Auto-Assign All" button
3. This assigns all unassigned orders based on product links

**Option 2: Manual Bulk Assign**
1. Go to `/admin/orders`
2. Select orders using checkboxes
3. Click "Assign X Orders to Supplier"
4. Select supplier from dropdown
5. Click "Assign Orders"

**Option 3: Single Order Assign**
1. Go to `/admin/orders/[id]`
2. Scroll to "Supplier Assignments" section
3. Click "Assign" button
4. Select supplier
5. Click "Assign Order"

### 6. Verify Assignment Worked

After assigning:
1. Check browser console for success message
2. Refresh supplier orders page
3. Check if order appears in supplier dashboard count
4. Verify order appears in `/supplier/orders` page

### Common Issues

1. **No product-supplier links**: Products must be linked to supplier inventory
2. **RLS blocking access**: Check Supabase RLS policies
3. **Wrong supplier ID**: Verify the supplier ID matches the logged-in user
4. **Assignment exists but not visible**: Check if query is filtering correctly

### Testing Assignment

To test if assignment works:
1. Assign an order manually from admin
2. Check `supplier_order_assignments` table directly
3. Log in as supplier
4. Check `/supplier/orders` page
5. Check browser console for debug logs

