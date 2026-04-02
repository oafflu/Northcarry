import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

/**
 * Manually recalculate open_count and click_count for all campaigns
 * based on existing email_campaign_events data
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get all campaigns that have been sent
    const { data: campaigns, error: campaignsError } = await supabase
      .from("email_campaigns")
      .select("id")
      .in("status", ["sent", "sending"])
    
    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError)
      return NextResponse.json({ error: campaignsError.message }, { status: 500 })
    }
    
    const results = []
    
    for (const campaign of campaigns || []) {
      try {
        // Get all events for this campaign
        const { data: events, error: eventsError } = await supabase
          .from("email_campaign_events")
          .select("email, event_type")
          .eq("campaign_id", campaign.id)
        
        if (eventsError) {
          console.error(`Error fetching events for campaign ${campaign.id}:`, eventsError)
          continue
        }
        
        // Count unique emails that opened/clicked
        const openedEmails = new Set<string>()
        const clickedEmails = new Set<string>()
        
        for (const ev of events || []) {
          const evEmail = (ev.email || "").toString().toLowerCase()
          if (!evEmail) continue
          
          if (ev.event_type === "opened") {
            openedEmails.add(evEmail)
          } else if (ev.event_type === "clicked") {
            clickedEmails.add(evEmail)
          }
        }
        
        const openCount = openedEmails.size
        const clickCount = clickedEmails.size
        
        // Update campaign
        const { error: updateError } = await supabase
          .from("email_campaigns")
          .update({
            open_count: openCount,
            click_count: clickCount,
          })
          .eq("id", campaign.id)
        
        if (updateError) {
          console.error(`Error updating campaign ${campaign.id}:`, updateError)
          results.push({ campaignId: campaign.id, success: false, error: updateError.message })
        } else {
          results.push({ 
            campaignId: campaign.id, 
            success: true, 
            openCount, 
            clickCount,
            totalEvents: events?.length || 0
          })
        }
      } catch (e: any) {
        console.error(`Error processing campaign ${campaign.id}:`, e)
        results.push({ campaignId: campaign.id, success: false, error: e.message })
      }
    }
    
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    return NextResponse.json({
      success: true,
      message: `Recalculated metrics for ${successful} campaigns${failed > 0 ? `, ${failed} failed` : ''}`,
      results,
      summary: {
        total: campaigns?.length || 0,
        successful,
        failed,
      }
    })
  } catch (error: any) {
    console.error("Error in recalculate metrics:", error)
    return NextResponse.json({ error: error.message || "Failed to recalculate metrics" }, { status: 500 })
  }
}

