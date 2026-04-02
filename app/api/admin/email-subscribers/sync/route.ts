import { NextRequest, NextResponse } from "next/server"
import { syncAllCustomersToSubscribers } from "@/app/actions/email-subscribers"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await syncAllCustomersToSubscribers()

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      synced: result.synced,
      message: result.message,
    })
  } catch (error: any) {
    console.error("Error syncing customers to subscribers:", error)
    return NextResponse.json(
      { error: error.message || "Failed to sync customers" },
      { status: 500 }
    )
  }
}

