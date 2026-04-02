import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get count from email_subscribers table (actual subscribers)
    const { count: subscriberCount, error: subscriberError } = await supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    if (subscriberError) {
      console.error("Error counting subscribers:", subscriberError)
      return NextResponse.json({ error: subscriberError.message }, { status: 500 })
    }

    // Also get count of all customers with valid emails (for "All Customers" option)
    const { count: customersWithValidEmails, error: customersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")

    if (customersError) {
      console.error("Error counting customers with valid emails:", customersError)
    }

    // Return the higher count - this represents the actual subscriber base
    // If customers have been synced, use that count; otherwise use email_subscribers table count
    const actualSubscriberCount = Math.max(subscriberCount || 0, customersWithValidEmails || 0)

    return NextResponse.json({ 
      success: true, 
      count: actualSubscriberCount,
      subscriberTableCount: subscriberCount || 0,
      customersWithValidEmails: customersWithValidEmails || 0,
    })
  } catch (error: any) {
    console.error("Error in count route:", error)
    return NextResponse.json(
      { error: error.message || "Failed to count subscribers" },
      { status: 500 }
    )
  }
}

