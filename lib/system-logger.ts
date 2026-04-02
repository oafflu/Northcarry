'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export interface LogActionParams {
  actionType: string
  actionCategory: 'order_management' | 'customer_management' | 'product_management' | 'inventory_management' | 'cms' | 'support' | 'media_library' | 'settings' | 'subscriptions' | 'email_marketing' | 'authentication' | 'other'
  actionDescription: string
  actionDetails?: Record<string, any>
  resourceType?: string
  resourceId?: string
  resourceName?: string
  status?: 'success' | 'error' | 'warning'
  errorMessage?: string
  errorStack?: string
  requestMethod?: string
  requestPath?: string
  requestQuery?: Record<string, any>
}

/**
 * Get client IP address from headers
 */
async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIP = headersList.get('x-real-ip')
    const cfConnectingIP = headersList.get('cf-connecting-ip') // Cloudflare
    
    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim()
    }
    
    return realIP || cfConnectingIP || null
  } catch {
    return null
  }
}

/**
 * Get user agent from headers
 */
async function getUserAgent(): Promise<string | null> {
  try {
    const headersList = await headers()
    return headersList.get('user-agent') || null
  } catch {
    return null
  }
}

/**
 * Get geographic location from IP address
 * Note: This is a basic implementation. For production, consider using a service like:
 * - MaxMind GeoIP2
 * - ipapi.co
 * - ip-api.com
 * - Cloudflare's geolocation headers
 */
async function getLocationFromIP(ip: string | null): Promise<{
  country?: string
  city?: string
  region?: string
  latitude?: number
  longitude?: number
} | null> {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null
  }

  try {
    // Try Cloudflare headers first (if using Cloudflare)
    const headersList = await headers()
    const cfCountry = headersList.get('cf-ipcountry')
    const cfCity = headersList.get('cf-ipcity')
    
    if (cfCountry) {
      return {
        country: cfCountry,
        city: cfCity || undefined,
      }
    }

    // Fallback: Use a free IP geolocation API (rate-limited)
    // In production, use a paid service or MaxMind GeoIP2
    // For now, we'll just store the IP and let you add geolocation later
    return null
  } catch {
    return null
  }
}

/**
 * Log a system action
 * This function should be called from server actions to record user activities
 */
export async function logSystemAction(params: LogActionParams): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get user profile if authenticated
    let userProfile: { id: string; email: string; role: string; first_name?: string; last_name?: string; company_name?: string } | null = null
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, role, first_name, last_name, company_name')
        .eq('id', user.id)
        .single()
      
      userProfile = profile
    }

    // Get request information
    const ipAddress = await getClientIP()
    const userAgent = await getUserAgent()
    const location = await getLocationFromIP(ipAddress)

    // Build user name
    let userName: string | null = null
    if (userProfile) {
      if (userProfile.company_name) {
        userName = userProfile.company_name
      } else if (userProfile.first_name || userProfile.last_name) {
        userName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
      } else {
        userName = userProfile.email
      }
    }

    // Insert log entry
    const adminSupabase = createAdminSupabaseClient()
    const { error } = await adminSupabase
      .from('system_logs')
      .insert({
        user_id: userProfile?.id || null,
        user_email: userProfile?.email || null,
        user_role: (userProfile?.role as any) || null,
        user_name: userName,
        action_type: params.actionType,
        action_category: params.actionCategory,
        action_description: params.actionDescription,
        action_details: params.actionDetails || null,
        resource_type: params.resourceType || null,
        resource_id: params.resourceId || null,
        resource_name: params.resourceName || null,
        ip_address: ipAddress || null,
        user_agent: userAgent,
        country: location?.country || null,
        city: location?.city || null,
        region: location?.region || null,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        request_method: params.requestMethod || null,
        request_path: params.requestPath || null,
        request_query: params.requestQuery || null,
        status: params.status || 'success',
        error_message: params.errorMessage || null,
        error_stack: params.errorStack || null,
      })

    if (error) {
      // Don't throw - logging failures shouldn't break the application
      console.error('Failed to log system action:', error)
    }
  } catch (error) {
    // Silently fail - logging should never break the application
    console.error('Error in logSystemAction:', error)
  }
}

/**
 * Helper function to log order management actions
 */
export async function logOrderAction(
  action: string,
  description: string,
  orderId?: string,
  orderNumber?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `order_${action}`,
    actionCategory: 'order_management',
    actionDescription: description,
    resourceType: 'order',
    resourceId: orderId,
    resourceName: orderNumber,
    actionDetails: details,
  })
}

/**
 * Helper function to log customer management actions
 */
export async function logCustomerAction(
  action: string,
  description: string,
  customerId?: string,
  customerEmail?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `customer_${action}`,
    actionCategory: 'customer_management',
    actionDescription: description,
    resourceType: 'customer',
    resourceId: customerId,
    resourceName: customerEmail,
    actionDetails: details,
  })
}

/**
 * Helper function to log product management actions
 */
export async function logProductAction(
  action: string,
  description: string,
  productId?: string,
  productName?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `product_${action}`,
    actionCategory: 'product_management',
    actionDescription: description,
    resourceType: 'product',
    resourceId: productId,
    resourceName: productName,
    actionDetails: details,
  })
}

/**
 * Helper function to log inventory management actions
 */
export async function logInventoryAction(
  action: string,
  description: string,
  resourceId?: string,
  resourceName?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `inventory_${action}`,
    actionCategory: 'inventory_management',
    actionDescription: description,
    resourceType: 'inventory',
    resourceId: resourceId,
    resourceName: resourceName,
    actionDetails: details,
  })
}

/**
 * Helper function to log CMS actions
 */
export async function logCMSAction(
  action: string,
  description: string,
  section?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `cms_${action}`,
    actionCategory: 'cms',
    actionDescription: description,
    resourceType: 'cms_content',
    resourceName: section,
    actionDetails: details,
  })
}

/**
 * Helper function to log support/ticket actions
 */
export async function logSupportAction(
  action: string,
  description: string,
  ticketId?: string,
  ticketNumber?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `support_${action}`,
    actionCategory: 'support',
    actionDescription: description,
    resourceType: 'ticket',
    resourceId: ticketId,
    resourceName: ticketNumber,
    actionDetails: details,
  })
}

/**
 * Helper function to log media library actions
 */
export async function logMediaAction(
  action: string,
  description: string,
  fileId?: string,
  fileName?: string,
  details?: Record<string, any>
) {
  await logSystemAction({
    actionType: `media_${action}`,
    actionCategory: 'media_library',
    actionDescription: description,
    resourceType: 'media_file',
    resourceId: fileId,
    resourceName: fileName,
    actionDetails: details,
  })
}
