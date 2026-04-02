'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ===========================
// MULTI-TOUCH ATTRIBUTION
// ===========================

export interface AttributionTouchpoint {
  timestamp: string
  source: string
  medium: string
  campaign?: string
  platform?: string
  click_id?: string
  url?: string
}

export interface AttributionData {
  order_id: string
  first_touch: AttributionTouchpoint | null
  last_touch: AttributionTouchpoint | null
  touchpoints: AttributionTouchpoint[]
  conversion_path: AttributionTouchpoint[]
}

/**
 * Track a marketing touchpoint (visit, click, etc.)
 */
export async function trackTouchpoint(input: {
  user_id?: string
  session_id?: string
  source: string
  medium: string
  campaign?: string
  platform?: string
  click_id?: string
  url?: string
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  gclid?: string
  fbclid?: string
  ttclid?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Store touchpoint in user's session/cookie for later attribution
    // In production, you'd store this in a touchpoints table or session storage
    
    // For now, we'll store it in cookies via the client
    // This function is mainly for server-side tracking
    
    return { success: true, error: null }
  } catch (error: any) {
    console.error('Error tracking touchpoint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get attribution data for an order
 */
export async function getOrderAttribution(orderId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: attribution, error } = await supabase
      .from('marketing_attribution')
      .select('*')
      .eq('order_id', orderId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching attribution:', error)
      return { success: false, error: error.message, data: null }
    }

    if (!attribution) {
      return { success: true, data: null, error: null }
    }

    // Parse conversion path
    const conversionPath = (attribution.conversion_path || []) as AttributionTouchpoint[]
    
    const data: AttributionData = {
      order_id: orderId,
      first_touch: conversionPath.length > 0 ? conversionPath[0] : null,
      last_touch: conversionPath.length > 0 ? conversionPath[conversionPath.length - 1] : null,
      touchpoints: conversionPath,
      conversion_path: conversionPath,
    }

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error in getOrderAttribution:', error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * Build conversion path from touchpoints
 */
export async function buildConversionPath(input: {
  order_id: string
  user_id?: string
  session_id?: string
  touchpoints: AttributionTouchpoint[]
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Sort touchpoints by timestamp
    const sortedTouchpoints = [...input.touchpoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const firstTouch = sortedTouchpoints[0]
    const lastTouch = sortedTouchpoints[sortedTouchpoints.length - 1]

    // Get or create attribution record
    const { data: existing } = await supabase
      .from('marketing_attribution')
      .select('id')
      .eq('order_id', input.order_id)
      .single()

    const attributionData = {
      order_id: input.order_id,
      source: lastTouch?.source || 'direct',
      medium: lastTouch?.medium || 'direct',
      campaign: lastTouch?.campaign,
      click_id: lastTouch?.click_id,
      gclid: sortedTouchpoints.find(t => t.platform === 'google')?.click_id,
      fbclid: sortedTouchpoints.find(t => t.platform === 'meta')?.click_id,
      ttclid: sortedTouchpoints.find(t => t.platform === 'tiktok')?.click_id,
      conversion_path: sortedTouchpoints,
      first_touch_at: firstTouch?.timestamp,
      last_touch_at: lastTouch?.timestamp,
      conversion_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('marketing_attribution')
        .update(attributionData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating attribution:', error)
        return { success: false, error: error.message, data: null }
      }

      return { success: true, data, error: null }
    } else {
      // Create new
      const { data, error } = await supabase
        .from('marketing_attribution')
        .insert(attributionData)
        .select()
        .single()

      if (error) {
        console.error('Error creating attribution:', error)
        return { success: false, error: error.message, data: null }
      }

      return { success: true, data, error: null }
    }
  } catch (error: any) {
    console.error('Error in buildConversionPath:', error)
    return { success: false, error: error.message, data: null }
  }
}

/**
 * Get attribution metrics for a date range
 */
export async function getAttributionMetrics(startDate: string, endDate: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: attributions, error } = await supabase
      .from('marketing_attribution')
      .select(`
        *,
        orders!inner (
          id,
          total,
          created_at
        )
      `)
      .gte('conversion_at', startDate)
      .lte('conversion_at', endDate)

    if (error) {
      console.error('Error fetching attribution metrics:', error)
      return { success: false, error: error.message, data: null }
    }

    // Calculate metrics by source
    const metricsBySource: Record<string, {
      orders: number
      revenue: number
      first_touch: number
      last_touch: number
    }> = {}

    attributions?.forEach((attr: any) => {
      const source = attr.source || 'direct'
      if (!metricsBySource[source]) {
        metricsBySource[source] = {
          orders: 0,
          revenue: 0,
          first_touch: 0,
          last_touch: 0,
        }
      }
      
      metricsBySource[source].orders++
      metricsBySource[source].revenue += parseFloat(attr.orders?.total || '0')
      
      // Check if this is first or last touch
      const conversionPath = attr.conversion_path || []
      if (conversionPath.length > 0) {
        const firstSource = conversionPath[0]?.source
        const lastSource = conversionPath[conversionPath.length - 1]?.source
        
        if (firstSource === source) {
          metricsBySource[source].first_touch++
        }
        if (lastSource === source) {
          metricsBySource[source].last_touch++
        }
      }
    })

    return { success: true, data: metricsBySource, error: null }
  } catch (error: any) {
    console.error('Error in getAttributionMetrics:', error)
    return { success: false, error: error.message, data: null }
  }
}

