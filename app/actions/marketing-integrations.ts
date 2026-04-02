'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ===========================
// MARKETING INTEGRATIONS
// ===========================

export interface MarketingIntegration {
  id: string
  platform: 'meta' | 'google' | 'tiktok'
  name: string
  config: any
  is_active: boolean
  is_connected: boolean
  connected_at?: string
  last_sync_at?: string
  account_id?: string
  account_name?: string
  created_at: string
  updated_at: string
}

export async function getMarketingIntegrations(platform?: 'meta' | 'google' | 'tiktok') {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase
      .from('marketing_integrations')
      .select('*')
      .order('created_at', { ascending: false })

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching marketing integrations:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: data as MarketingIntegration[], error: null }
  } catch (error: any) {
    console.error('Error in getMarketingIntegrations:', error)
    return { success: false, error: error.message, data: [] }
  }
}

export async function createMarketingIntegration(input: {
  platform: 'meta' | 'google' | 'tiktok'
  name: string
  config: any
  account_id?: string
  account_name?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('marketing_integrations')
      .insert({
        ...input,
        is_active: true,
        is_connected: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating marketing integration:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing')
    return { success: true, data: data as MarketingIntegration, error: null }
  } catch (error: any) {
    console.error('Error in createMarketingIntegration:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function updateMarketingIntegration(id: string, input: Partial<MarketingIntegration>) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('marketing_integrations')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating marketing integration:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing')
    return { success: true, data: data as MarketingIntegration, error: null }
  } catch (error: any) {
    console.error('Error in updateMarketingIntegration:', error)
    return { success: false, error: error.message, data: null }
  }
}

// ===========================
// META INTEGRATION
// ===========================

export async function connectMetaAccount(config: {
  access_token: string
  ad_account_id?: string
  pixel_id?: string
  catalog_id?: string
}) {
  try {
    // In production, validate token with Meta API
    // For now, store the configuration
    
    const supabase = createAdminSupabaseClient()
    
    // Check if integration exists
    const { data: existing } = await supabase
      .from('marketing_integrations')
      .select('id')
      .eq('platform', 'meta')
      .eq('account_id', config.ad_account_id || 'default')
      .single()

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('marketing_integrations')
        .update({
          config,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.ad_account_id,
          account_name: config.ad_account_id ? `Meta Ad Account ${config.ad_account_id}` : 'Meta Account',
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/meta')
      return { success: true, data: data as MarketingIntegration, error: null }
    } else {
      // Create new
      const { data, error } = await supabase
        .from('marketing_integrations')
        .insert({
          platform: 'meta',
          name: 'Meta Business Account',
          config,
          is_active: true,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.ad_account_id,
          account_name: config.ad_account_id ? `Meta Ad Account ${config.ad_account_id}` : 'Meta Account',
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/meta')
      return { success: true, data: data as MarketingIntegration, error: null }
    }
  } catch (error: any) {
    console.error('Error connecting Meta account:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function syncMetaCampaigns(integrationId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get integration config
    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (!integration || !integration.is_connected) {
      return { success: false, error: 'Integration not connected', data: [] }
    }

    // In production, call Meta Marketing API to fetch campaigns
    // For now, return empty array
    // Example API call:
    // const response = await fetch(`https://graph.facebook.com/v18.0/${integration.config.ad_account_id}/campaigns?access_token=${integration.config.access_token}`)
    // const campaigns = await response.json()

    // Update last sync time
    await supabase
      .from('marketing_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integrationId)

    revalidatePath('/admin/marketing/meta')
    return { success: true, data: [], error: null }
  } catch (error: any) {
    console.error('Error syncing Meta campaigns:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// ===========================
// GOOGLE INTEGRATION
// ===========================

export async function connectGoogleAccount(config: {
  access_token: string
  refresh_token?: string
  account_id?: string
  analytics_property_id?: string
  merchant_center_id?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: existing } = await supabase
      .from('marketing_integrations')
      .select('id')
      .eq('platform', 'google')
      .eq('account_id', config.account_id || 'default')
      .single()

    if (existing) {
      const { data, error } = await supabase
        .from('marketing_integrations')
        .update({
          config,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.account_id,
          account_name: config.account_id ? `Google Account ${config.account_id}` : 'Google Account',
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/google')
      return { success: true, data: data as MarketingIntegration, error: null }
    } else {
      const { data, error } = await supabase
        .from('marketing_integrations')
        .insert({
          platform: 'google',
          name: 'Google Account',
          config,
          is_active: true,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.account_id,
          account_name: config.account_id ? `Google Account ${config.account_id}` : 'Google Account',
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/google')
      return { success: true, data: data as MarketingIntegration, error: null }
    }
  } catch (error: any) {
    console.error('Error connecting Google account:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function syncGoogleCampaigns(integrationId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (!integration || !integration.is_connected) {
      return { success: false, error: 'Integration not connected', data: [] }
    }

    // In production, call Google Ads API to fetch campaigns
    // Example: const response = await fetch(`https://googleads.googleapis.com/v14/customers/${integration.config.account_id}/googleAds:search`, ...)

    await supabase
      .from('marketing_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integrationId)

    revalidatePath('/admin/marketing/google')
    return { success: true, data: [], error: null }
  } catch (error: any) {
    console.error('Error syncing Google campaigns:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// ===========================
// TIKTOK INTEGRATION
// ===========================

export async function connectTikTokAccount(config: {
  access_token: string
  advertiser_id?: string
  app_id?: string
  secret?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: existing } = await supabase
      .from('marketing_integrations')
      .select('id')
      .eq('platform', 'tiktok')
      .eq('account_id', config.advertiser_id || 'default')
      .single()

    if (existing) {
      const { data, error } = await supabase
        .from('marketing_integrations')
        .update({
          config,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.advertiser_id,
          account_name: config.advertiser_id ? `TikTok Advertiser ${config.advertiser_id}` : 'TikTok Account',
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/tiktok')
      return { success: true, data: data as MarketingIntegration, error: null }
    } else {
      const { data, error } = await supabase
        .from('marketing_integrations')
        .insert({
          platform: 'tiktok',
          name: 'TikTok Advertiser Account',
          config,
          is_active: true,
          is_connected: true,
          connected_at: new Date().toISOString(),
          account_id: config.advertiser_id,
          account_name: config.advertiser_id ? `TikTok Advertiser ${config.advertiser_id}` : 'TikTok Account',
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message, data: null }
      }

      revalidatePath('/admin/marketing/tiktok')
      return { success: true, data: data as MarketingIntegration, error: null }
    }
  } catch (error: any) {
    console.error('Error connecting TikTok account:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function syncTikTokCampaigns(integrationId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (!integration || !integration.is_connected) {
      return { success: false, error: 'Integration not connected', data: [] }
    }

    // In production, call TikTok Marketing API
    // Example: const response = await fetch(`https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${integration.config.advertiser_id}`, ...)

    await supabase
      .from('marketing_integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integrationId)

    revalidatePath('/admin/marketing/tiktok')
    return { success: true, data: [], error: null }
  } catch (error: any) {
    console.error('Error syncing TikTok campaigns:', error)
    return { success: false, error: error.message, data: [] }
  }
}

// ===========================
// CONVERSION EVENT TRACKING
// ===========================

export async function trackConversionEvent(input: {
  platform: 'meta' | 'google' | 'tiktok'
  event_type: string
  event_name: string
  order_id?: string
  revenue?: number
  user_id?: string
  customer_email?: string
  click_id?: string
  event_data?: any
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get integration for the platform
    const { data: integration } = await supabase
      .from('marketing_integrations')
      .select('id')
      .eq('platform', input.platform)
      .eq('is_connected', true)
      .single()

    const integrationId = integration?.id || null

    // Create marketing event record
    const { data, error } = await supabase
      .from('marketing_events')
      .insert({
        integration_id: integrationId,
        platform: input.platform,
        event_type: input.event_type,
        event_name: input.event_name,
        order_id: input.order_id,
        revenue: input.revenue,
        user_id: input.user_id,
        customer_email: input.customer_email,
        click_id: input.click_id,
        event_data: input.event_data || {},
        conversion_time: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error tracking conversion event:', error)
      return { success: false, error: error.message, data: null }
    }

    // In production, send event to platform API
    // Example for Meta: Send to Conversions API
    // Example for Google: Send to Google Ads API
    // Example for TikTok: Send to TikTok Events API

    return { success: true, data, error: null }
  } catch (error: any) {
    console.error('Error in trackConversionEvent:', error)
    return { success: false, error: error.message, data: null }
  }
}

