# Role-Based Access Control (RBAC) System

## Overview

BREVI now supports multiple user roles with granular permissions. This document outlines the role system, permissions, and how to use it.

## User Roles

### 1. Admin
**Full access to all features**
- Complete system access
- User management
- Settings configuration
- All CRUD operations

### 2. Marketer
**Access to email marketing and customer data**
- ✅ Dashboard (view only)
- ✅ Products (view only)
- ✅ Customers (view only)
- ✅ Email Marketing (full access)
  - Campaigns
  - Segments
  - Automations
  - Templates
  - Analytics
- ✅ Analytics (view only)
- ❌ Orders
- ❌ Support
- ❌ Settings
- ❌ Users
- ❌ Suppliers
- ❌ Payments
- ❌ Inventory
- ❌ CMS

### 3. Support
**Access to customer support and order management**
- ✅ Dashboard (view only)
- ✅ Orders (view and update)
- ✅ Customers (view and update)
- ✅ Support System (full access)
- ✅ Contact Messages (view and update)
- ✅ Analytics (view only)
- ❌ Products
- ❌ Email Marketing
- ❌ Settings
- ❌ Users
- ❌ Suppliers
- ❌ Payments
- ❌ Inventory
- ❌ CMS

### 4. Supplier
**Access to supplier portal** (separate from admin panel)
- Supplier-specific features
- Inventory management
- Order fulfillment

### 5. Customer
**Standard customer access**
- Customer account features
- Order history
- Profile management

## Database Schema

The `profiles` table includes a `role` column with the following constraint:

```sql
CHECK (role IN ('customer', 'admin', 'supplier', 'marketer', 'support'))
```

To update the database, run:
```sql
-- scripts/add-marketer-support-roles.sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_role;
ALTER TABLE profiles ADD CONSTRAINT check_role 
  CHECK (role IN ('customer', 'admin', 'supplier', 'marketer', 'support'));
```

## Implementation

### 1. Permissions System

Located in `lib/permissions.ts`:
- `getRolePermissions(role)` - Get all permissions for a role
- `canAccessRoute(role, route)` - Check if role can access a route
- `canPerformAction(role, resource, action)` - Check specific permissions
- `getAllowedNavigationItems(role)` - Get navigation items for a role

### 2. Role Guard Component

Located in `lib/role-guard.tsx`:
- Protects routes based on role
- Automatically redirects unauthorized users
- Can be used to wrap page components

Example usage:
```tsx
import { RoleGuard } from '@/lib/role-guard'

export default function EmailMarketingPage() {
  return (
    <RoleGuard requiredRole={['admin', 'marketer']} requiredRoute="/admin/email-marketing">
      {/* Page content */}
    </RoleGuard>
  )
}
```

### 3. Admin Layout

The admin layout (`app/admin/layout.tsx`) automatically:
- Filters navigation items based on user role
- Shows/hides menu items based on permissions
- Allows access to admin panel for admin, marketer, and support roles

### 4. User Management

Admins can create users with different roles:
- Go to `/admin/users`
- Click "Create User"
- Select role: Admin, Supplier, Marketer, or Support
- Fill in user details
- User receives welcome email with credentials

## Creating Users with New Roles

### Via Admin Panel

1. Navigate to `/admin/users`
2. Click "Create User"
3. Select role from dropdown:
   - **Marketer**: For email marketing team
   - **Support**: For customer support team
4. Fill in required information
5. User will receive welcome email with login credentials

### Role Descriptions in UI

When creating a user, role descriptions are shown:
- **Marketer**: "Access to email marketing, customers, products, dashboard, and analytics"
- **Support**: "Access to orders, customers, support system, analytics, and contact messages"

## Navigation Filtering

The admin sidebar automatically filters menu items based on role:

- **Admin**: Sees all menu items
- **Marketer**: Sees Dashboard, Products, Customers, Email Marketing, Analytics
- **Support**: Sees Dashboard, Orders, Customers, Support, Contact Messages, Analytics

## Permission Checks

### In Components

```tsx
import { canPerformAction } from '@/lib/permissions'
import { useAuth } from '@/lib/auth-context'

function MyComponent() {
  const { user } = useAuth()
  const canEdit = canPerformAction(user.role, 'orders', 'update')
  
  return (
    <div>
      {canEdit && <button>Edit Order</button>}
    </div>
  )
}
```

### In Server Actions

```tsx
'use server'
import { canPerformAction } from '@/lib/permissions'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updateOrder(orderId: string, data: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!canPerformAction(profile.role, 'orders', 'update')) {
    return { success: false, error: 'Insufficient permissions' }
  }
  
  // Proceed with update
}
```

## Testing

1. **Create a Marketer user:**
   - Go to `/admin/users`
   - Create user with role "Marketer"
   - Log in as marketer
   - Verify only allowed menu items are visible
   - Verify email marketing features are accessible

2. **Create a Support user:**
   - Go to `/admin/users`
   - Create user with role "Support"
   - Log in as support
   - Verify only allowed menu items are visible
   - Verify support and order features are accessible

## Security Notes

- All role checks are performed both client-side (for UX) and server-side (for security)
- Server actions should always verify permissions before executing
- The admin layout checks role on mount and redirects unauthorized users
- Individual pages can use `RoleGuard` for additional protection

## Future Enhancements

Potential improvements:
- Granular permissions within roles (e.g., "can delete campaigns" vs "can create campaigns")
- Custom role creation
- Permission inheritance
- Audit logging for permission checks

