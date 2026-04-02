import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
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

    const adminSupabase = createAdminSupabaseClient()

    // Get all customers with emails
    const { data: allCustomers, error: fetchError } = await adminSupabase
      .from("profiles")
      .select("id, email")
      .eq("role", "customer")
      .not("email", "is", null)
      .limit(100) // Sample first 100

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Count using SQL (more accurate)
    const { count: totalWithEmails } = await adminSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)

    const { count: totalWithAtSymbol } = await adminSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")

    // Check JavaScript validation
    const jsValidCount = allCustomers?.filter((c) => {
      const email = c.email?.toLowerCase().trim()
      return email && email.includes("@")
    }).length || 0

    // Get samples
    const samples = allCustomers?.slice(0, 10).map((c) => ({
      id: c.id,
      email: c.email,
      hasAtInSQL: c.email?.includes("@") || false,
      trimmed: c.email?.toLowerCase().trim(),
      hasAtAfterTrim: c.email?.toLowerCase().trim().includes("@") || false,
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        totalWithEmails: totalWithEmails || 0,
        totalWithAtSymbol_SQL: totalWithAtSymbol || 0,
        jsValidCount_sample: jsValidCount,
        samples,
        note: "This checks the first 100 customers as a sample",
      },
    })
  } catch (error: any) {
    console.error("Error verifying emails:", error)
    return NextResponse.json(
      { error: error.message || "Failed to verify emails" },
      { status: 500 }
    )
  }
}

