/**
 * Role-based permissions system for BREVI admin panel
 * Defines what each role can access and do
 */

export type UserRole = 'admin' | 'marketer' | 'support' | 'supplier' | 'customer' | 'partner'

export interface Permission {
  view: boolean
  create: boolean
  update: boolean
  delete: boolean
}

export interface RolePermissions {
  dashboard: Permission
  products: Permission
  orders: Permission
  customers: Permission
  emailMarketing: Permission
  marketing: Permission
  analytics: Permission
  support: Permission
  contactMessages: Permission
  users: Permission
  suppliers: Permission
  payments: Permission
  inventory: Permission
  cms: Permission
  settings: Permission
  loyalty: Permission
}

/**
 * Check if a role has access to a specific route
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  const permissions = getRolePermissions(role)
  
  // Normalize route
  const normalizedRoute = route.replace(/\/$/, '')
  
  // Dashboard - all roles can access
  if (normalizedRoute === '/admin' || normalizedRoute === '/admin/') {
    return true
  }
  
  // Products
  if (normalizedRoute.startsWith('/admin/products')) {
    return permissions.products.view
  }
  
  // Orders
  if (normalizedRoute.startsWith('/admin/orders')) {
    return permissions.orders.view
  }
  
  // Customers
  if (normalizedRoute.startsWith('/admin/customers')) {
    return permissions.customers.view
  }
  
  // Email Marketing
  if (normalizedRoute.startsWith('/admin/email-marketing')) {
    return permissions.emailMarketing.view
  }
  
  // Marketing - special handling for partner role
  if (normalizedRoute.startsWith('/admin/marketing')) {
    // Partner can access /admin/marketing/affiliate but not other marketing pages
    if (role === 'partner') {
      return normalizedRoute === '/admin/marketing/affiliate'
    }
    return permissions.marketing.view
  }
  
  // Analytics
  if (normalizedRoute.startsWith('/admin/analytics')) {
    return permissions.analytics.view
  }
  
  // Support
  if (normalizedRoute.startsWith('/admin/support')) {
    return permissions.support.view
  }
  
  // Contact Messages
  if (normalizedRoute === '/admin/contact' || normalizedRoute.startsWith('/admin/contact/')) {
    return permissions.contactMessages.view
  }
  
  // Users (only admin)
  if (normalizedRoute.startsWith('/admin/users')) {
    return permissions.users.view
  }
  
  // Suppliers (only admin)
  if (normalizedRoute.startsWith('/admin/suppliers')) {
    return permissions.suppliers.view
  }
  
  // Payments
  if (normalizedRoute.startsWith('/admin/payments')) {
    return permissions.payments.view
  }
  
  // Promos & Upsells / Promotions - special handling for partner role
  if (normalizedRoute.startsWith('/admin/promos-upsells') || normalizedRoute.startsWith('/admin/promotions')) {
    if (role === 'partner') {
      if (normalizedRoute.startsWith('/admin/promos-upsells')) return true
      return normalizedRoute === '/admin/promotions'
    }
    return permissions.products.view
  }
  
  // Inventory (only admin)
  if (normalizedRoute.startsWith('/admin/inventory')) {
    return permissions.inventory.view
  }
  
  // CMS (admin and partner)
  if (normalizedRoute.startsWith('/admin/cms')) {
    if (role === 'partner') return true // Partner can access CMS
    return permissions.cms.view
  }
  
  // Media Library (admin, marketer, and partner)
  if (normalizedRoute.startsWith('/admin/media')) {
    if (role === 'partner') return true // Partner can access media library
    return permissions.cms.view // Use CMS permission since media is related to content management
  }
  
  // Sample Requests (admin and partner)
  if (normalizedRoute.startsWith('/admin/sample-requests')) {
    return role === 'admin' || role === 'partner' // Admin and partner can access sample requests
  }
  
  // Returns (admin and partner)
  if (normalizedRoute.startsWith('/admin/returns')) {
    return role === 'admin' || role === 'partner' // Admin and partner can access returns
  }
  
  // Reviews (admin and partner)
  if (normalizedRoute.startsWith('/admin/reviews')) {
    return role === 'admin' || role === 'partner' // Admin and partner can manage reviews
  }
  
  // Loyalty (admin and partner)
  if (normalizedRoute.startsWith('/admin/loyalty')) {
    return role === 'admin' || role === 'partner' // Admin and partner can manage loyalty program
  }
  
  // Newsletter (admin, marketer, and partner)
  if (normalizedRoute.startsWith('/admin/newsletter')) {
    if (role === 'partner') return true // Partner can access newsletter
    return permissions.emailMarketing.view || permissions.cms.view
  }
  
  // Settings (only admin)
  if (normalizedRoute.startsWith('/admin/settings')) {
    return permissions.settings.view
  }
  
  // Subscriptions - special handling for partner role
  if (normalizedRoute.startsWith('/admin/subscriptions')) {
    // Partner can access /admin/subscriptions/analytics and /admin/subscriptions
    if (role === 'partner') {
      return normalizedRoute === '/admin/subscriptions/analytics' || normalizedRoute === '/admin/subscriptions'
    }
    return role === 'admin' // Only admin can access all subscription pages
  }
  
  // Default: deny access
  return false
}

/**
 * Get permissions for a specific role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'admin':
      return {
        dashboard: { view: true, create: true, update: true, delete: true },
        products: { view: true, create: true, update: true, delete: true },
        orders: { view: true, create: true, update: true, delete: true },
        customers: { view: true, create: true, update: true, delete: true },
        emailMarketing: { view: true, create: true, update: true, delete: true },
        marketing: { view: true, create: true, update: true, delete: true },
        analytics: { view: true, create: true, update: true, delete: true },
        support: { view: true, create: true, update: true, delete: true },
        contactMessages: { view: true, create: true, update: true, delete: true },
        users: { view: true, create: true, update: true, delete: true },
        suppliers: { view: true, create: true, update: true, delete: true },
        payments: { view: true, create: true, update: true, delete: true },
        inventory: { view: true, create: true, update: true, delete: true },
        cms: { view: true, create: true, update: true, delete: true },
        settings: { view: true, create: true, update: true, delete: true },
        loyalty: { view: true, create: true, update: true, delete: true },
      }
    
    case 'marketer':
      return {
        dashboard: { view: true, create: false, update: false, delete: false },
        products: { view: true, create: false, update: false, delete: false },
        orders: { view: false, create: false, update: false, delete: false },
        customers: { view: true, create: false, update: false, delete: false },
        emailMarketing: { view: true, create: true, update: true, delete: true },
        marketing: { view: true, create: true, update: true, delete: true },
        analytics: { view: true, create: false, update: false, delete: false },
        support: { view: false, create: false, update: false, delete: false },
        contactMessages: { view: false, create: false, update: false, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: false, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: false, create: false, update: false, delete: false },
      }
    
    case 'support':
      return {
        dashboard: { view: true, create: false, update: false, delete: false },
        products: { view: false, create: false, update: false, delete: false },
        orders: { view: true, create: false, update: true, delete: false },
        customers: { view: true, create: false, update: true, delete: false },
        emailMarketing: { view: false, create: false, update: false, delete: false },
        marketing: { view: false, create: false, update: false, delete: false },
        analytics: { view: true, create: false, update: false, delete: false },
        support: { view: true, create: true, update: true, delete: false },
        contactMessages: { view: true, create: false, update: true, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: false, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: false, create: false, update: false, delete: false },
      }
    
    case 'supplier':
      return {
        dashboard: { view: false, create: false, update: false, delete: false },
        products: { view: false, create: false, update: false, delete: false },
        orders: { view: false, create: false, update: false, delete: false },
        customers: { view: false, create: false, update: false, delete: false },
        emailMarketing: { view: false, create: false, update: false, delete: false },
        marketing: { view: false, create: false, update: false, delete: false },
        analytics: { view: false, create: false, update: false, delete: false },
        support: { view: false, create: false, update: false, delete: false },
        contactMessages: { view: false, create: false, update: false, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: false, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: false, create: false, update: false, delete: false },
      }
    
    case 'customer':
      return {
        dashboard: { view: false, create: false, update: false, delete: false },
        products: { view: false, create: false, update: false, delete: false },
        orders: { view: false, create: false, update: false, delete: false },
        customers: { view: false, create: false, update: false, delete: false },
        emailMarketing: { view: false, create: false, update: false, delete: false },
        marketing: { view: false, create: false, update: false, delete: false },
        analytics: { view: false, create: false, update: false, delete: false },
        support: { view: false, create: false, update: false, delete: false },
        contactMessages: { view: false, create: false, update: false, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: false, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: false, create: false, update: false, delete: false },
      }
    
    case 'partner':
      return {
        dashboard: { view: true, create: false, update: false, delete: false },
        products: { view: true, create: true, update: true, delete: false },
        orders: { view: true, create: false, update: true, delete: false },
        customers: { view: true, create: false, update: true, delete: false },
        emailMarketing: { view: false, create: false, update: false, delete: false },
        marketing: { view: false, create: false, update: false, delete: false }, // Special handling in canAccessRoute
        analytics: { view: true, create: false, update: false, delete: false },
        support: { view: true, create: true, update: true, delete: false },
        contactMessages: { view: true, create: false, update: true, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: true, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: true, create: true, update: true, delete: false }, // Partner can access CMS
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: true, create: true, update: true, delete: true }, // Partner can manage loyalty program
      }
    
    default:
      // Default to no permissions
      return {
        dashboard: { view: false, create: false, update: false, delete: false },
        products: { view: false, create: false, update: false, delete: false },
        orders: { view: false, create: false, update: false, delete: false },
        customers: { view: false, create: false, update: false, delete: false },
        emailMarketing: { view: false, create: false, update: false, delete: false },
        marketing: { view: false, create: false, update: false, delete: false },
        analytics: { view: false, create: false, update: false, delete: false },
        support: { view: false, create: false, update: false, delete: false },
        contactMessages: { view: false, create: false, update: false, delete: false },
        users: { view: false, create: false, update: false, delete: false },
        suppliers: { view: false, create: false, update: false, delete: false },
        payments: { view: false, create: false, update: false, delete: false },
        inventory: { view: false, create: false, update: false, delete: false },
        cms: { view: false, create: false, update: false, delete: false },
        settings: { view: false, create: false, update: false, delete: false },
        loyalty: { view: false, create: false, update: false, delete: false },
      }
  }
}

/**
 * Check if a role can perform an action on a resource
 */
export function canPerformAction(
  role: UserRole,
  resource: keyof RolePermissions,
  action: 'view' | 'create' | 'update' | 'delete'
): boolean {
  const permissions = getRolePermissions(role)
  return permissions[resource][action]
}

/**
 * Get allowed navigation items for a role
 */
export function getAllowedNavigationItems(role: UserRole) {
  const permissions = getRolePermissions(role)
  
  const allItems = [
    { name: "Dashboard", href: "/admin", icon: "LayoutDashboard", permission: permissions.dashboard },
    { name: "Products", href: "/admin/products", icon: "Package", permission: permissions.products },
    { name: "Orders", href: "/admin/orders", icon: "ShoppingCart", permission: permissions.orders },
    { name: "Customers", href: "/admin/customers", icon: "Users", permission: permissions.customers },
    { name: "Email Marketing", href: "/admin/email-marketing", icon: "Mail", permission: permissions.emailMarketing, isMenu: true },
    { name: "Analytics", href: "/admin/analytics", icon: "TrendingUp", permission: permissions.analytics, isMenu: true },
    { name: "Support", href: "/admin/support", icon: "MessageSquare", permission: permissions.support },
    { name: "Contact Messages", href: "/admin/contact", icon: "MessageSquare", permission: permissions.contactMessages },
    { name: "Users", href: "/admin/users", icon: "Users", permission: permissions.users },
    { name: "Suppliers", href: "/admin/suppliers", icon: "Building2", permission: permissions.suppliers },
    { name: "Payments", href: "/admin/payments", icon: "DollarSign", permission: permissions.payments },
    { name: "Inventory", href: "/admin/inventory", icon: "Warehouse", permission: permissions.inventory },
    { name: "CMS", href: "/admin/cms", icon: "FileText", permission: permissions.cms },
    { name: "Settings", href: "/admin/settings", icon: "Settings", permission: permissions.settings, isMenu: true },
  ]
  
  return allItems.filter(item => item.permission.view)
}

