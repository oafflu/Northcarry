# System Logging Guide

## Overview

A comprehensive system logging infrastructure has been created to record all user actions across the platform. The system logs actions for Admin, Supplier, Marketer, Partner, and Customer roles.

## Database Setup

Run the SQL migration to create the `system_logs` table:

```sql
-- Run this in your Supabase SQL Editor
\i scripts/create-system-logs-table.sql
```

Or copy and paste the contents of `scripts/create-system-logs-table.sql` into the Supabase SQL Editor.

## Features

### Logged Information

Each log entry includes:
- **User Information**: User ID, email, role, name
- **Action Details**: Type, category, description, before/after values
- **Resource Information**: Type, ID, name of affected resource
- **Request Information**: IP address, user agent, geographic location
- **Status**: Success, error, or warning
- **Timestamps**: Created at date/time

### Action Categories

- Order Management
- Customer Management
- Product Management
- Inventory Management
- CMS
- Support (Tickets)
- Media Library
- Settings
- Subscriptions
- Email Marketing
- Authentication
- Other

## Usage

### Basic Logging

```typescript
import { logSystemAction } from '@/lib/system-logger'

await logSystemAction({
  actionType: 'order_created',
  actionCategory: 'order_management',
  actionDescription: 'Order #12345 created for customer@example.com',
  resourceType: 'order',
  resourceId: orderId,
  resourceName: 'Order #12345',
  actionDetails: {
    order_total: 99.99,
    items_count: 3,
  },
})
```

### Helper Functions

Use the helper functions for common actions:

```typescript
import {
  logOrderAction,
  logCustomerAction,
  logProductAction,
  logInventoryAction,
  logCMSAction,
  logSupportAction,
  logMediaAction,
} from '@/lib/system-logger'

// Order actions
await logOrderAction('created', 'Order #12345 created', orderId, 'Order #12345', { total: 99.99 })

// Customer actions
await logCustomerAction('updated', 'Customer profile updated', customerId, customerEmail, { changes: {...} })

// Product actions
await logProductAction('created', 'New product created', productId, productName, { price: 29.99 })

// Inventory actions
await logInventoryAction('updated', 'Inventory quantity updated', variantId, 'SKU-123', { old_qty: 10, new_qty: 50 })

// CMS actions
await logCMSAction('updated', 'Hero banner updated', 'hero', { enabled: true })

// Support actions
await logSupportAction('created', 'New support ticket created', ticketId, 'TICKET-123', { priority: 'high' })

// Media actions
await logMediaAction('uploaded', 'New image uploaded', fileId, 'image.jpg', { size: 1024000 })
```

### Error Logging

```typescript
try {
  // ... your code
} catch (error: any) {
  await logSystemAction({
    actionType: 'order_creation_failed',
    actionCategory: 'order_management',
    actionDescription: 'Failed to create order',
    status: 'error',
    errorMessage: error.message,
    errorStack: error.stack,
    actionDetails: { attempt_data: {...} },
  })
  throw error
}
```

## Integration Points

To fully integrate logging, add logging calls to:

### Order Management
- `app/actions/orders.ts` - All order CRUD operations
- Order fulfillment updates
- Order status changes
- Payment processing

### Customer Management
- `app/actions/customers.ts` - Customer CRUD operations
- Customer import/export
- Customer status changes

### Product Management
- `app/actions/products.ts` - Product CRUD operations
- Variant updates
- Price changes
- Inventory updates

### Inventory Management
- `app/actions/inventory.ts` - Stock updates
- Supplier inventory sync
- Inventory adjustments

### CMS
- `app/actions/cms.ts` - All CMS content updates
- Template changes
- Page content updates

### Support
- `app/actions/tickets.ts` - Ticket CRUD operations
- Ticket status changes
- Ticket replies
- Ticket assignments

### Media Library
- `app/actions/media.ts` - File uploads
- File deletions
- File metadata updates

## Viewing Logs

Access the System Logs page at `/admin/settings/system-logs`

### Features:
- Filter by category, role, status, date range
- Search across descriptions, types, and resource names
- View detailed action information
- See IP addresses and geographic locations
- Pagination for large log sets
- Statistics dashboard

## Geographic Location

The system attempts to get geographic location from:
1. Cloudflare headers (if using Cloudflare)
2. IP geolocation services (can be configured)

For production, consider integrating:
- MaxMind GeoIP2
- ipapi.co
- ip-api.com

## Performance Considerations

- Logs are inserted asynchronously and won't block operations
- Logging failures are silently caught to prevent breaking the application
- Indexes are created for common query patterns
- Consider archiving old logs periodically (90+ days)

## Maintenance

### Delete Old Logs

```typescript
import { deleteOldLogs } from '@/app/actions/system-logs'

// Delete logs older than 90 days
await deleteOldLogs(90)
```

## Security

- Only admin users can view system logs
- Logs include sensitive information - ensure proper access control
- IP addresses and user agents are logged for security auditing
- Consider data retention policies based on compliance requirements
