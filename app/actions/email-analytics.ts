"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { getSetting } from "./settings"

export interface EmailAnalytics {
  totalEmailsSent: number
  totalDelivered: number
  totalFailed: number
  totalSuppressed: number
  totalSubscribers: number
  averageOpenRate: number
  averageClickRate: number
  totalRevenue: number
  campaignsCount: number
  automationsCount: number
  activeAutomationsCount: number
  segmentsCount: number
  templatesCount: number
  // Previous period data for comparison
  previousTotalSubscribers?: number
  previousTotalEmailsSent?: number
  previousTotalDelivered?: number
  previousTotalFailed?: number
  previousTotalSuppressed?: number
  previousAverageOpenRate?: number
  previousAverageClickRate?: number
  previousCampaignsCount?: number
  previousTotalRevenue?: number
}

export interface CampaignPerformance {
  id: string
  name: string
  sent: number
  opened: number
  clicked: number
  revenue?: number
  openRate: number
  clickRate: number
}

/**
 * Fetch Mailgun statistics for a date range
 */
async function getMailgunStatistics(startDate: Date, endDate: Date) {
  try {
    // Get Mailgun configuration
    const { data: emailProvider } = await getSetting('email_provider')
    let parsedConfig: any = null
    if (emailProvider) {
      if (typeof emailProvider === 'string') {
        try {
          parsedConfig = JSON.parse(emailProvider)
        } catch (e) {
          parsedConfig = null
        }
      } else if (typeof emailProvider === 'object') {
        parsedConfig = emailProvider
      }
    }

    const apiKey = parsedConfig?.mailgun_api_key || process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY
    const domain = parsedConfig?.mailgun_domain || process.env.MAILGUN_DOMAIN || process.env.EMAIL_MAILGUN_DOMAIN
    const baseUrl = parsedConfig?.mailgun_base_url || process.env.MAILGUN_BASE_URL || process.env.EMAIL_MAILGUN_BASE_URL || 'https://api.mailgun.net'

    if (!apiKey || !domain) {
      console.warn('[Mailgun Stats] API key or domain not configured, skipping Mailgun statistics fetch')
      return { delivered: 0, failed: 0, suppressed: 0 }
    }

    // Format dates for Mailgun API (YYYY-MM-DD format)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Fetch statistics from Mailgun Stats API
    let delivered = 0
    let failed = 0
    let suppressed = 0

    try {
      // Use Mailgun Stats API to get totals for each event type.
      // Docs: https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/stats
      const statsUrl = `${baseUrl}/v3/${domain}/stats/total`
      
      // Fetch delivered count
      try {
        const deliveredParams = new URLSearchParams({
          start: startDateStr,
          end: endDateStr,
          event: 'delivered',
        })
        const deliveredResponse = await fetch(`${statsUrl}?${deliveredParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
        })

        if (deliveredResponse.ok) {
          const deliveredData = await deliveredResponse.json()
          // Mailgun Stats API returns an array of stats; each item has a "delivered" object with "total"
          if (deliveredData.stats && Array.isArray(deliveredData.stats) && deliveredData.stats.length > 0) {
            delivered = deliveredData.stats.reduce(
              (sum: number, stat: any) => sum + (stat.delivered?.total || 0),
              0
            )
          } else {
            console.warn("[Mailgun Stats] Delivered stats response had no stats array", deliveredData)
          }
        }
      } catch (deliveredError) {
        console.warn('[Mailgun Stats] Could not fetch delivered stats:', deliveredError)
      }

      // Fetch failed count
      try {
        const failedParams = new URLSearchParams({
          start: startDateStr,
          end: endDateStr,
          event: 'failed',
        })
        const failedResponse = await fetch(`${statsUrl}?${failedParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
        })

        if (failedResponse.ok) {
          const failedData = await failedResponse.json()
          if (failedData.stats && Array.isArray(failedData.stats) && failedData.stats.length > 0) {
            failed = failedData.stats.reduce(
              (sum: number, stat: any) => sum + (stat.failed?.total || 0),
              0
            )
          } else {
            console.warn("[Mailgun Stats] Failed stats response had no stats array", failedData)
          }
        }
      } catch (failedError) {
        console.warn('[Mailgun Stats] Could not fetch failed stats:', failedError)
      }

      // Fetch rejected count (these are suppressed)
      try {
        const rejectedParams = new URLSearchParams({
          start: startDateStr,
          end: endDateStr,
          event: 'rejected',
        })
        const rejectedResponse = await fetch(`${statsUrl}?${rejectedParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
        })

        if (rejectedResponse.ok) {
          const rejectedData = await rejectedResponse.json()
          if (rejectedData.stats && Array.isArray(rejectedData.stats) && rejectedData.stats.length > 0) {
            suppressed = rejectedData.stats.reduce((sum: number, stat: any) => sum + (stat.count || 0), 0)
          }
        }
      } catch (rejectedError) {
        console.warn('[Mailgun Stats] Could not fetch rejected stats:', rejectedError)
      }

      // Also get suppressions (bounces + unsubscribes) - these are addresses that are suppressed
      // Note: This is a count of suppressed addresses, not events in the date range
      try {
        const bouncesUrl = `${baseUrl}/v3/${domain}/bounces`
        const bouncesResponse = await fetch(bouncesUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
        })

        if (bouncesResponse.ok) {
          const bouncesData = await bouncesResponse.json()
          // Count bounces that occurred in the date range
          if (bouncesData.items && Array.isArray(bouncesData.items)) {
            const bouncesInRange = bouncesData.items.filter((item: any) => {
              if (!item.created_at) return false
              const bounceDate = new Date(item.created_at)
              return bounceDate >= startDate && bounceDate <= endDate
            })
            suppressed += bouncesInRange.length
          }
        }

        const unsubscribesUrl = `${baseUrl}/v3/${domain}/unsubscribes`
        const unsubscribesResponse = await fetch(unsubscribesUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
        })

        if (unsubscribesResponse.ok) {
          const unsubscribesData = await unsubscribesResponse.json()
          if (unsubscribesData.items && Array.isArray(unsubscribesData.items)) {
            const unsubscribesInRange = unsubscribesData.items.filter((item: any) => {
              if (!item.created_at) return false
              const unsubscribeDate = new Date(item.created_at)
              return unsubscribeDate >= startDate && unsubscribeDate <= endDate
            })
            suppressed += unsubscribesInRange.length
          }
        }
      } catch (suppressionError) {
        console.warn('[Mailgun Stats] Could not fetch suppressions:', suppressionError)
      }
    } catch (error: any) {
      console.error('[Mailgun Stats] Error fetching statistics:', error)
    }

    return { delivered, failed, suppressed }
  } catch (error: any) {
    console.error('[Mailgun Stats] Error fetching Mailgun statistics:', error)
    return { delivered: 0, failed: 0, suppressed: 0 }
  }
}

/**
 * Get overall email marketing analytics
 * Supports either a preset dateRange or an explicit custom range.
 */
export async function getEmailAnalytics(
  dateRange?: "7d" | "30d" | "90d" | "1y" | "custom",
  customStart?: string,
  customEnd?: string
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    if (dateRange === "custom" && customStart && customEnd) {
      // Use explicit custom range (inclusive)
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
    } else {
      switch (dateRange) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          break
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
    }

    // Get total subscribers from email_subscribers table
    const { count: subscriberTableCount } = await supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    // Also get count of all customers with valid emails (this is the actual subscriber base)
    const { count: customersWithValidEmails } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")

    // Use the higher count - either from subscribers table or customers with valid emails
    // This ensures we show the actual potential subscriber base
    const totalSubscribers = Math.max(subscriberTableCount || 0, customersWithValidEmails || 0)

    // Get campaigns sent in date range (include both "sent" and "sending" status)
    const { data: campaigns, count: campaignsCount } = await supabase
      .from("email_campaigns")
      .select("*", { count: "exact" })
      .in("status", ["sent", "sending"])
      .gte("sent_at", startDate.toISOString())
      .lte("sent_at", endDate.toISOString())

    // Calculate total emails sent
    const totalEmailsSent = campaigns?.reduce((sum, campaign) => sum + (campaign.sent_count || 0), 0) || 0

    // Get campaign IDs for event queries
    const campaignIds = campaigns?.map(c => c.id) || []

    // Fetch Mailgun statistics for delivered, failed, suppressed
    const mailgunStats = await getMailgunStatistics(startDate, now)
    
    // Calculate from email_campaign_events as fallback if Mailgun stats are not available
    let deliveredFromEvents = 0
    let failedFromEvents = 0
    let suppressedFromEvents = 0
    let totalOpened = 0
    let totalClicked = 0
    
    if (campaignIds.length > 0) {
      const { data: allEvents } = await supabase
        .from("email_campaign_events")
        .select("event_type, email")
        .in("campaign_id", campaignIds)
      
      // Count unique emails for each event type
      const deliveredEmails = new Set<string>()
      const failedEmails = new Set<string>()
      const suppressedEmails = new Set<string>()
      const openedEmails = new Set<string>()
      const clickedEmails = new Set<string>()
      
      allEvents?.forEach((event) => {
        const email = (event.email || "").toString().toLowerCase()
        if (!email) return
        
        if (event.event_type === "delivered") {
          deliveredEmails.add(email)
        } else if (event.event_type === "failed" || event.event_type === "bounced") {
          failedEmails.add(email)
        } else if (event.event_type === "unsubscribed" || event.event_type === "rejected") {
          suppressedEmails.add(email)
        } else if (event.event_type === "opened") {
          openedEmails.add(email)
        } else if (event.event_type === "clicked") {
          clickedEmails.add(email)
        }
      })
      
      deliveredFromEvents = deliveredEmails.size
      failedFromEvents = failedEmails.size
      suppressedFromEvents = suppressedEmails.size
      totalOpened = openedEmails.size
      totalClicked = clickedEmails.size
    }
    
    // Use Mailgun delivered count if available, otherwise use events or campaign counts
    const totalDelivered = mailgunStats.delivered > 0 
      ? mailgunStats.delivered 
      : (deliveredFromEvents > 0 
          ? deliveredFromEvents 
          : campaigns?.reduce((sum, campaign) => sum + (campaign.delivered_count || 0), 0) || 0)
    
    // Use Mailgun failed count, fallback to events
    const totalFailed = mailgunStats.failed > 0 
      ? mailgunStats.failed 
      : failedFromEvents
    
    // Use Mailgun suppressed count, fallback to events
    const totalSuppressed = mailgunStats.suppressed > 0 
      ? mailgunStats.suppressed 
      : suppressedFromEvents

    // If no events found for opens/clicks, fall back to campaign counts
    if (totalOpened === 0) {
      totalOpened = campaigns?.reduce((sum, campaign) => sum + (campaign.open_count || 0), 0) || 0
    }
    if (totalClicked === 0) {
      totalClicked = campaigns?.reduce((sum, campaign) => sum + (campaign.click_count || 0), 0) || 0
    }

    // Calculate average rates based on delivered emails (not sent)
    // This is more accurate as it only counts emails that were actually delivered
    const averageOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0
    const averageClickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0

    // Get automations count
    const { count: automationsCount } = await supabase
      .from("email_automations")
      .select("*", { count: "exact", head: true })

    const { count: activeAutomationsCount } = await supabase
      .from("email_automations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Get segments count
    const { count: segmentsCount } = await supabase
      .from("email_segments")
      .select("*", { count: "exact", head: true })

    // Get templates count
    const { count: templatesCount } = await supabase
      .from("email_templates")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // Calculate previous period for comparison (same duration before startDate)
    const periodDuration = endDate.getTime() - startDate.getTime()
    const previousStartDate = new Date(startDate.getTime() - periodDuration)
    const previousEndDate = startDate
    
    // Previous period subscribers (at the end of previous period)
    // Get previous period subscribers (using same logic as current period)
    const { count: previousSubscriberTableCount } = await supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .lt("created_at", previousEndDate.toISOString())

    // For previous period, we'll use a simpler approach - just use the subscriber table count
    // since we can't easily calculate customers with valid emails at a past date
    const previousTotalSubscribers = previousSubscriberTableCount || 0

    // Previous period campaigns
    const { data: previousCampaigns, count: previousCampaignsCount } = await supabase
      .from("email_campaigns")
      .select("*", { count: "exact" })
      .eq("status", "sent")
      .gte("sent_at", previousStartDate.toISOString())
      .lt("sent_at", previousEndDate.toISOString())

    const previousTotalEmailsSent = previousCampaigns?.reduce((sum, campaign) => sum + (campaign.sent_count || 0), 0) || 0
    
    // Fetch previous period Mailgun statistics
    const previousMailgunStats = await getMailgunStatistics(previousStartDate, previousEndDate)
    
    // Get previous period campaign IDs for event queries
    const previousCampaignIds = previousCampaigns?.map(c => c.id) || []
    let previousDeliveredFromEvents = 0
    let previousFailedFromEvents = 0
    let previousSuppressedFromEvents = 0
    let previousTotalOpened = 0
    let previousTotalClicked = 0
    
    if (previousCampaignIds.length > 0) {
      const { data: previousAllEvents } = await supabase
        .from("email_campaign_events")
        .select("event_type, email")
        .in("campaign_id", previousCampaignIds)
      
      // Count unique emails for each event type
      const previousDeliveredEmails = new Set<string>()
      const previousFailedEmails = new Set<string>()
      const previousSuppressedEmails = new Set<string>()
      const previousOpenedEmails = new Set<string>()
      const previousClickedEmails = new Set<string>()
      
      previousAllEvents?.forEach((event) => {
        const email = (event.email || "").toString().toLowerCase()
        if (!email) return
        
        if (event.event_type === "delivered") {
          previousDeliveredEmails.add(email)
        } else if (event.event_type === "failed" || event.event_type === "bounced") {
          previousFailedEmails.add(email)
        } else if (event.event_type === "unsubscribed" || event.event_type === "rejected") {
          previousSuppressedEmails.add(email)
        } else if (event.event_type === "opened") {
          previousOpenedEmails.add(email)
        } else if (event.event_type === "clicked") {
          previousClickedEmails.add(email)
        }
      })
      
      previousDeliveredFromEvents = previousDeliveredEmails.size
      previousFailedFromEvents = previousFailedEmails.size
      previousSuppressedFromEvents = previousSuppressedEmails.size
      previousTotalOpened = previousOpenedEmails.size
      previousTotalClicked = previousClickedEmails.size
    }
    
    // Use Mailgun delivered count if available, otherwise use events or campaign counts
    const previousTotalDelivered = previousMailgunStats.delivered > 0 
      ? previousMailgunStats.delivered 
      : (previousDeliveredFromEvents > 0 
          ? previousDeliveredFromEvents 
          : previousCampaigns?.reduce((sum, campaign) => sum + (campaign.delivered_count || 0), 0) || 0)
    
    // Use Mailgun failed count, fallback to events
    const previousTotalFailed = previousMailgunStats.failed > 0 
      ? previousMailgunStats.failed 
      : previousFailedFromEvents
    
    // Use Mailgun suppressed count, fallback to events
    const previousTotalSuppressed = previousMailgunStats.suppressed > 0 
      ? previousMailgunStats.suppressed 
      : previousSuppressedFromEvents
    
    // If no events found for opens/clicks, fall back to campaign counts
    if (previousTotalOpened === 0) {
      previousTotalOpened = previousCampaigns?.reduce((sum, campaign) => sum + (campaign.open_count || 0), 0) || 0
    }
    if (previousTotalClicked === 0) {
      previousTotalClicked = previousCampaigns?.reduce((sum, campaign) => sum + (campaign.click_count || 0), 0) || 0
    }
    
    // Calculate previous period rates based on delivered emails
    const previousAverageOpenRate = previousTotalDelivered > 0 ? (previousTotalOpened / previousTotalDelivered) * 100 : 0
    const previousAverageClickRate = previousTotalDelivered > 0 ? (previousTotalClicked / previousTotalDelivered) * 100 : 0

    // TODO: Calculate revenue from campaign events
    // This would require joining with orders table
    const totalRevenue = 0

    return {
      success: true,
      data: {
        totalEmailsSent,
        totalDelivered,
        totalFailed,
        totalSuppressed,
        totalSubscribers: totalSubscribers || 0,
        averageOpenRate: Number(averageOpenRate.toFixed(2)),
        averageClickRate: Number(averageClickRate.toFixed(2)),
        totalRevenue,
        campaignsCount: campaignsCount || 0,
        automationsCount: automationsCount || 0,
        activeAutomationsCount: activeAutomationsCount || 0,
        segmentsCount: segmentsCount || 0,
        templatesCount: templatesCount || 0,
        previousTotalSubscribers: previousTotalSubscribers || 0,
        previousTotalEmailsSent: previousTotalEmailsSent || 0,
        previousTotalDelivered: previousTotalDelivered || 0,
        previousTotalFailed: previousTotalFailed || 0,
        previousTotalSuppressed: previousTotalSuppressed || 0,
        previousAverageOpenRate: Number(previousAverageOpenRate.toFixed(2)),
        previousAverageClickRate: Number(previousAverageClickRate.toFixed(2)),
        previousCampaignsCount: previousCampaignsCount || 0,
        previousTotalRevenue: 0, // TODO: Calculate from previous period orders
      } as EmailAnalytics,
      error: null,
    }
  } catch (error: any) {
    console.error("Error in getEmailAnalytics:", error)
    return { success: false, error: error.message || "Failed to fetch analytics", data: null }
  }
}

/**
 * Get top performing campaigns
 */
export async function getTopPerformingCampaigns(limit: number = 10) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data: campaigns, error } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("status", "sent")
      .order("open_count", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching top campaigns:", error)
      return { success: false, error: error.message, data: null }
    }

    const performance: CampaignPerformance[] = (campaigns || []).map((campaign) => {
      const sent = campaign.sent_count || 0
      const opened = campaign.open_count || 0
      const clicked = campaign.click_count || 0
      const openRate = sent > 0 ? (opened / sent) * 100 : 0
      const clickRate = sent > 0 ? (clicked / sent) * 100 : 0

      return {
        id: campaign.id,
        name: campaign.name,
        sent,
        opened,
        clicked,
        revenue: 0, // TODO: Calculate from events
        openRate: Number(openRate.toFixed(2)),
        clickRate: Number(clickRate.toFixed(2)),
      }
    })

    return { success: true, data: performance, error: null }
  } catch (error: any) {
    console.error("Error in getTopPerformingCampaigns:", error)
    return { success: false, error: error.message || "Failed to fetch campaigns", data: null }
  }
}

/**
 * Get time series data for email performance
 * Supports either a preset dateRange or an explicit custom range.
 */
export async function getEmailPerformanceTimeSeries(
  dateRange: "7d" | "30d" | "90d" | "1y" | "custom" = "30d",
  customStart?: string,
  customEnd?: string
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Calculate date range
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    let intervalDays: number

    if (dateRange === "custom" && customStart && customEnd) {
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
      // Choose a reasonable interval based on span
      const diffDays = Math.max(
        1,
        Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      )
      if (diffDays <= 31) intervalDays = 1
      else if (diffDays <= 120) intervalDays = 7
      else intervalDays = 30
    } else {
      switch (dateRange) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          intervalDays = 1
          break
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          intervalDays = 1
          break
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          intervalDays = 7
          break
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          intervalDays = 30
          break
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          intervalDays = 1
      }
    }

    // Get campaigns in date range
    const { data: campaigns } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("status", "sent")
      .gte("sent_at", startDate.toISOString())
      .lte("sent_at", endDate.toISOString())
      .order("sent_at", { ascending: true })

    // Group by date intervals
    const timeSeries: Record<string, { sent: number; delivered: number; failed: number; suppressed: number; opened: number; clicked: number }> = {}
    
    campaigns?.forEach((campaign) => {
      if (!campaign.sent_at) return
      
      const sentDate = new Date(campaign.sent_at)
      const dateKey = sentDate.toISOString().split("T")[0]
      
      if (!timeSeries[dateKey]) {
        timeSeries[dateKey] = { sent: 0, delivered: 0, failed: 0, suppressed: 0, opened: 0, clicked: 0 }
      }
      
      timeSeries[dateKey].sent += campaign.sent_count || 0
      timeSeries[dateKey].delivered += campaign.delivered_count || 0
      timeSeries[dateKey].opened += campaign.open_count || 0
      timeSeries[dateKey].clicked += campaign.click_count || 0
    })

    // Get events for more accurate delivered/failed/suppressed counts
    const campaignIds = campaigns?.map(c => c.id) || []
    if (campaignIds.length > 0) {
      const { data: events } = await supabase
        .from("email_campaign_events")
        .select("event_type, email, created_at, campaign_id")
        .in("campaign_id", campaignIds)
      
      events?.forEach((event) => {
        if (!event.created_at) return
        const eventDate = new Date(event.created_at)
        const dateKey = eventDate.toISOString().split("T")[0]
        
        if (!timeSeries[dateKey]) {
          timeSeries[dateKey] = { sent: 0, delivered: 0, failed: 0, suppressed: 0, opened: 0, clicked: 0 }
        }
        
        if (event.event_type === "delivered") {
          timeSeries[dateKey].delivered += 1
        } else if (event.event_type === "failed" || event.event_type === "bounced") {
          timeSeries[dateKey].failed += 1
        } else if (event.event_type === "unsubscribed" || event.event_type === "rejected") {
          timeSeries[dateKey].suppressed += 1
        } else if (event.event_type === "opened") {
          timeSeries[dateKey].opened += 1
        } else if (event.event_type === "clicked") {
          timeSeries[dateKey].clicked += 1
        }
      })
    }

    // Convert to array format
    const result = Object.entries(timeSeries)
      .map(([date, data]) => ({
        date,
        sent: data.sent,
        delivered: data.delivered,
        failed: data.failed,
        suppressed: data.suppressed,
        opened: data.opened,
        clicked: data.clicked,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return { success: true, data: result, error: null }
  } catch (error: any) {
    console.error("Error in getEmailPerformanceTimeSeries:", error)
    return { success: false, error: error.message || "Failed to fetch time series", data: null }
  }
}

