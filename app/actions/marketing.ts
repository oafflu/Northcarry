'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ===========================
// MARKETING DASHBOARD METRICS
// ===========================

export interface MarketingMetrics {
  // Overall metrics
  totalRevenue: number
  totalSpend: number
  totalOrders: number
  totalConversions: number
  
  // Calculated metrics
  roas: number // Return on Ad Spend
  mer: number // Marketing Efficiency Ratio
  cpa: number // Cost Per Acquisition
  cpc: number // Cost Per Click
  ctr: number // Click-Through Rate
  
  // Platform breakdown
  platformMetrics: {
    meta: {
      revenue: number
      spend: number
      orders: number
      roas: number
    }
    google: {
      revenue: number
      spend: number
      orders: number
      roas: number
    }
    tiktok: {
      revenue: number
      spend: number
      orders: number
      roas: number
    }
    affiliate: {
      revenue: number
      commission: number
      orders: number
      affiliates: number
    }
  }
  
  // Traffic sources
  trafficSources: {
    organic: number
    direct: number
    paid: number
    social: number
    email: number
    referral: number
  }
}

export async function getMarketingMetrics(dateRange?: {
  startDate: string
  endDate: string
}): Promise<MarketingMetrics> {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Default to last 30 days if no range provided
    const endDate = dateRange?.endDate || new Date().toISOString()
    const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    // Get all marketing events in date range
    const { data: events } = await supabase
      .from('marketing_events')
      .select('platform, revenue, event_type')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    
    // Get all campaigns
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('platform, spend, revenue, conversions')
      .gte('start_date', startDate)
      .or(`end_date.gte.${endDate},end_date.is.null`)
    
    // Get affiliate data
    const { data: affiliateOrders } = await supabase
      .from('affiliate_orders')
      .select('order_total, commission_amount, status')
      .eq('status', 'approved')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
    
    // Get attribution data for traffic sources
    const { data: attribution } = await supabase
      .from('marketing_attribution')
      .select('source, order_id, orders(total)')
      .gte('conversion_at', startDate)
      .lte('conversion_at', endDate)
    
    // Calculate totals
    const totalRevenue = (events || []).reduce((sum, e) => sum + parseFloat(e.revenue?.toString() || '0'), 0) +
      (affiliateOrders || []).reduce((sum, o) => sum + parseFloat(o.order_total?.toString() || '0'), 0)
    
    const totalSpend = (campaigns || []).reduce((sum, c) => sum + parseFloat(c.spend?.toString() || '0'), 0)
    
    const totalOrders = new Set([
      ...(events || []).map(e => e.order_id).filter(Boolean),
      ...(affiliateOrders || []).map(o => o.order_id).filter(Boolean)
    ]).size
    
    const totalConversions = (events || []).filter(e => e.event_type === 'purchase').length +
      (affiliateOrders || []).length
    
    // Calculate ROAS
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0
    
    // Calculate MER (Marketing Efficiency Ratio) - Revenue / Marketing Spend
    const mer = totalSpend > 0 ? totalRevenue / totalSpend : 0
    
    // Calculate CPA
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0
    
    // Calculate platform metrics
    const platformMetrics = {
      meta: {
        revenue: (events || []).filter(e => e.platform === 'meta').reduce((sum, e) => sum + parseFloat(e.revenue?.toString() || '0'), 0),
        spend: (campaigns || []).filter(c => c.platform === 'meta').reduce((sum, c) => sum + parseFloat(c.spend?.toString() || '0'), 0),
        orders: new Set((events || []).filter(e => e.platform === 'meta' && e.order_id).map(e => e.order_id)).size,
        roas: 0,
      },
      google: {
        revenue: (events || []).filter(e => e.platform === 'google').reduce((sum, e) => sum + parseFloat(e.revenue?.toString() || '0'), 0),
        spend: (campaigns || []).filter(c => c.platform === 'google').reduce((sum, c) => sum + parseFloat(c.spend?.toString() || '0'), 0),
        orders: new Set((events || []).filter(e => e.platform === 'google' && e.order_id).map(e => e.order_id)).size,
        roas: 0,
      },
      tiktok: {
        revenue: (events || []).filter(e => e.platform === 'tiktok').reduce((sum, e) => sum + parseFloat(e.revenue?.toString() || '0'), 0),
        spend: (campaigns || []).filter(c => c.platform === 'tiktok').reduce((sum, c) => sum + parseFloat(c.spend?.toString() || '0'), 0),
        orders: new Set((events || []).filter(e => e.platform === 'tiktok' && e.order_id).map(e => e.order_id)).size,
        roas: 0,
      },
      affiliate: {
        revenue: (affiliateOrders || []).reduce((sum, o) => sum + parseFloat(o.order_total?.toString() || '0'), 0),
        commission: (affiliateOrders || []).reduce((sum, o) => sum + parseFloat(o.commission_amount?.toString() || '0'), 0),
        orders: affiliateOrders?.length || 0,
        affiliates: 0,
      },
    }
    
    // Calculate ROAS for each platform
    platformMetrics.meta.roas = platformMetrics.meta.spend > 0 ? platformMetrics.meta.revenue / platformMetrics.meta.spend : 0
    platformMetrics.google.roas = platformMetrics.google.spend > 0 ? platformMetrics.google.revenue / platformMetrics.google.spend : 0
    platformMetrics.tiktok.roas = platformMetrics.tiktok.spend > 0 ? platformMetrics.tiktok.revenue / platformMetrics.tiktok.spend : 0
    
    // Get active affiliates count
    const { count: affiliatesCount } = await supabase
      .from('affiliates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
    
    platformMetrics.affiliate.affiliates = affiliatesCount || 0
    
    // Calculate traffic sources from attribution
    const trafficSources = {
      organic: 0,
      direct: 0,
      paid: 0,
      social: 0,
      email: 0,
      referral: 0,
    }
    
    attribution?.forEach(attr => {
      const source = attr.source?.toLowerCase() || ''
      if (source.includes('organic') || source === 'organic') {
        trafficSources.organic++
      } else if (source === 'direct') {
        trafficSources.direct++
      } else if (source.includes('meta') || source.includes('facebook') || source.includes('instagram') || source.includes('tiktok')) {
        trafficSources.social++
      } else if (source.includes('google') || source.includes('ad')) {
        trafficSources.paid++
      } else if (source.includes('email')) {
        trafficSources.email++
      } else {
        trafficSources.referral++
      }
    })
    
    // Get campaign metrics for CPC and CTR
    const totalClicks = (campaigns || []).reduce((sum, c) => sum + (c.clicks || 0), 0)
    const totalImpressions = (campaigns || []).reduce((sum, c) => sum + (c.impressions || 0), 0)
    
    const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    
    return {
      totalRevenue,
      totalSpend,
      totalOrders,
      totalConversions,
      roas,
      mer,
      cpa,
      cpc,
      ctr,
      platformMetrics,
      trafficSources,
    }
  } catch (error: any) {
    console.error('Error getting marketing metrics:', error)
    return {
      totalRevenue: 0,
      totalSpend: 0,
      totalOrders: 0,
      totalConversions: 0,
      roas: 0,
      mer: 0,
      cpa: 0,
      cpc: 0,
      ctr: 0,
      platformMetrics: {
        meta: { revenue: 0, spend: 0, orders: 0, roas: 0 },
        google: { revenue: 0, spend: 0, orders: 0, roas: 0 },
        tiktok: { revenue: 0, spend: 0, orders: 0, roas: 0 },
        affiliate: { revenue: 0, commission: 0, orders: 0, affiliates: 0 },
      },
      trafficSources: {
        organic: 0,
        direct: 0,
        paid: 0,
        social: 0,
        email: 0,
        referral: 0,
      },
    }
  }
}

