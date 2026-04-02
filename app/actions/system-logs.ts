'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface SystemLog {
  id: string
  user_id: string | null
  user_email: string | null
  user_role: string | null
  user_name: string | null
  action_type: string
  action_category: string
  action_description: string
  action_details: any
  resource_type: string | null
  resource_id: string | null
  resource_name: string | null
  ip_address: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  request_method: string | null
  request_path: string | null
  request_query: any
  status: string
  error_message: string | null
  error_stack: string | null
  created_at: string
}

export interface SystemLogFilters {
  userRole?: string
  actionCategory?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  userId?: string
}

export interface SystemLogsResponse {
  success: boolean
  data?: SystemLog[]
  count?: number
  error?: string
}

/**
 * Get system logs with filtering and pagination
 */
export async function getSystemLogs(
  filters: SystemLogFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<SystemLogsResponse> {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user is admin
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const adminSupabase = createAdminSupabaseClient()
    let query = adminSupabase
      .from('system_logs')
      .select('*', { count: 'exact' })

    // Apply filters
    if (filters.userRole) {
      query = query.eq('user_role', filters.userRole)
    }

    if (filters.actionCategory) {
      query = query.eq('action_category', filters.actionCategory)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    if (filters.search) {
      query = query.or(`action_description.ilike.%${filters.search}%,action_type.ilike.%${filters.search}%,resource_name.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`)
    }

    // Order by created_at descending (newest first)
    query = query.order('created_at', { ascending: false })

    // Apply pagination
    const offset = (page - 1) * pageSize
    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching system logs:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: data || [],
      count: count || 0,
    }
  } catch (error: any) {
    console.error('Error in getSystemLogs:', error)
    return { success: false, error: error.message || 'Failed to fetch system logs' }
  }
}

/**
 * Get log statistics
 */
export async function getSystemLogStats(filters: SystemLogFilters = {}) {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const adminSupabase = createAdminSupabaseClient()
    
    // Build base query with filters
    let baseQuery = adminSupabase.from('system_logs').select('*')

    if (filters.userRole) {
      baseQuery = baseQuery.eq('user_role', filters.userRole)
    }
    if (filters.actionCategory) {
      baseQuery = baseQuery.eq('action_category', filters.actionCategory)
    }
    if (filters.status) {
      baseQuery = baseQuery.eq('status', filters.status)
    }
    if (filters.dateFrom) {
      baseQuery = baseQuery.gte('created_at', filters.dateFrom)
    }
    if (filters.dateTo) {
      baseQuery = baseQuery.lte('created_at', filters.dateTo)
    }

    // Get total count
    const { count: total } = await baseQuery.select('*', { count: 'exact', head: true })

    // Get counts by category
    const { data: categoryData } = await baseQuery.select('action_category')
    const categoryCounts: Record<string, number> = {}
    categoryData?.forEach((log: any) => {
      categoryCounts[log.action_category] = (categoryCounts[log.action_category] || 0) + 1
    })

    // Get counts by role
    const { data: roleData } = await baseQuery.select('user_role')
    const roleCounts: Record<string, number> = {}
    roleData?.forEach((log: any) => {
      if (log.user_role) {
        roleCounts[log.user_role] = (roleCounts[log.user_role] || 0) + 1
      }
    })

    // Get counts by status
    const { data: statusData } = await baseQuery.select('status')
    const statusCounts: Record<string, number> = {}
    statusData?.forEach((log: any) => {
      statusCounts[log.status] = (statusCounts[log.status] || 0) + 1
    })

    return {
      success: true,
      data: {
        total: total || 0,
        byCategory: categoryCounts,
        byRole: roleCounts,
        byStatus: statusCounts,
      },
    }
  } catch (error: any) {
    console.error('Error in getSystemLogStats:', error)
    return { success: false, error: error.message || 'Failed to fetch log statistics' }
  }
}

/**
 * Delete old logs (older than specified days)
 */
export async function deleteOldLogs(daysToKeep: number = 90) {
  try {
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Unauthorized' }
    }

    const adminSupabase = createAdminSupabaseClient()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { error, count } = await adminSupabase
      .from('system_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('*', { count: 'exact', head: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      deleted: count || 0,
    }
  } catch (error: any) {
    console.error('Error in deleteOldLogs:', error)
    return { success: false, error: error.message || 'Failed to delete old logs' }
  }
}
