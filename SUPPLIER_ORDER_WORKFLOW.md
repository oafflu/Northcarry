# Supplier Order Workflow

## Overview
This document explains how suppliers receive, acknowledge, and process orders assigned by admins.

## Workflow Steps

### 1. Admin Assigns Orders
- Admin goes to `/admin/orders`
- Selects one or more orders using checkboxes
- Clicks "Assign X Orders to Supplier"
- Selects a supplier from the dropdown
- Clicks "Assign Orders"

**Result:** Orders are assigned to the supplier with status `pending`

### 2. Supplier Views Assigned Orders
- Supplier logs into their account
- Navigates to `/supplier/orders` (or clicks "Orders" in the sidebar)
- Orders appear in the **"Pending"** tab by default

**What they see:**
- Order number
- Customer information
- Order total
- Order date
- Status badge (yellow for "Pending")
- Action buttons:
  - **Eye icon** - View order details
  - **"Acknowledge" button** - For pending orders

### 3. Supplier Acknowledges Order
- Supplier clicks the **"Acknowledge"** button next to a pending order
- System updates the order status to `acknowledged`
- Success toast notification appears
- Order moves from "Pending" tab to "Acknowledged" tab

**What happens:**
- Status changes: `pending` → `acknowledged`
- `acknowledged_at` timestamp is recorded
- Admin receives a notification

### 4. Supplier Updates Order Status
After acknowledging, suppliers can update order status through the order detail page:

**Access order details:**
- Click the **eye icon** next to any order
- Or navigate to `/supplier/orders/[order-id]`

**Available status updates:**
1. **Processing** - Order is being prepared
2. **Ready** - Order is ready to ship
3. **Shipped** - Order has been shipped (requires carrier and tracking number)

**Status flow:**
```
pending → acknowledged → processing → ready → shipped → delivered
```

### 5. Shipping an Order
When status is "ready", supplier can:
- Click "Ship Order" button in the orders list
- Or update status to "shipped" from the order detail page
- Enter:
  - Carrier name (e.g., "UPS", "FedEx", "USPS")
  - Tracking number

**Result:**
- Status changes to `shipped`
- Tracking information is saved
- Customer can see tracking info in their order details

## Page Locations

### Supplier Orders List
**URL:** `/supplier/orders`

**Features:**
- Tabbed view: Pending, Acknowledged, Processing, Ready, Shipped, All
- Filter orders by status
- Quick actions: Acknowledge, Ship
- View order details (eye icon)
- Refresh button to reload orders

### Supplier Order Detail
**URL:** `/supplier/orders/[order-id]`

**Features:**
- Full order information
- Order items with product details
- Customer information
- Shipping address
- Fulfillment timeline
- Status update actions
- Shipping information (if shipped)

## Troubleshooting

### Orders Not Showing
If assigned orders don't appear:

1. **Check browser console** for errors
   - Open Developer Tools (F12)
   - Check Console tab for error messages
   - Look for RLS policy errors or query failures

2. **Verify assignment**
   - Admin should check `/admin/orders/[order-id]`
   - Look for "Supplier Assignments" section
   - Verify supplier is listed

3. **Check supplier account**
   - Ensure supplier is logged in with correct account
   - Verify supplier ID matches assignment
   - Try clicking "Refresh" button

4. **Check RLS policies**
   - Supplier must have SELECT permission on `supplier_order_assignments`
   - Policy should allow: `supplier_id = auth.uid()`

### Common Issues

**Issue:** "No orders found" message
- **Solution:** Check if orders are actually assigned (admin panel)
- **Solution:** Try switching to "All" tab
- **Solution:** Click "Refresh" button

**Issue:** "Acknowledge" button doesn't work
- **Solution:** Check browser console for errors
- **Solution:** Verify supplier has UPDATE permission
- **Solution:** Try refreshing the page

**Issue:** Can't see order details
- **Solution:** Verify order exists and is assigned to this supplier
- **Solution:** Check RLS policies allow reading orders table
- **Solution:** Try navigating directly to `/supplier/orders/[order-id]`

## Status Meanings

| Status | Description | Actions Available |
|--------|-------------|-------------------|
| `pending` | Newly assigned, not yet acknowledged | Acknowledge |
| `acknowledged` | Supplier has confirmed receipt | Update to Processing/Ready |
| `processing` | Order is being prepared | Update to Ready |
| `ready` | Ready to ship | Ship Order |
| `shipped` | Order has been shipped | View tracking |
| `delivered` | Delivered to customer | View details |
| `cancelled` | Order cancelled | View details |

## Best Practices

1. **Acknowledge promptly** - Acknowledge orders as soon as you receive the assignment
2. **Update status regularly** - Keep status updated as order progresses
3. **Add tracking info** - Always add tracking number when shipping
4. **Check details** - Review order details before processing
5. **Use refresh** - Click refresh if orders don't appear immediately

## Notifications

- **Admin notifications:** Sent when supplier acknowledges order
- **Customer notifications:** Sent when order is shipped (with tracking)
- **Supplier notifications:** Can be configured for new assignments

## API Endpoints

- `GET /supplier/orders` - List assigned orders
- `GET /supplier/orders/[id]` - Get order details
- `POST /api/suppliers/acknowledge` - Acknowledge order
- `POST /api/suppliers/update-status` - Update order status

## Database Tables

- `supplier_order_assignments` - Stores order assignments
- `orders` - Order information
- `order_items` - Order line items
- `profiles` - Supplier information

