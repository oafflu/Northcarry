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

    // Get sample of customers with emails that don't contain @
    const { data: invalidEmails, error: invalidError } = await adminSupabase
      .from("profiles")
      .select("id, email, first_name, last_name, created_at")
      .eq("role", "customer")
      .not("email", "is", null)
      .not("email", "like", "%@%")
      .limit(20)

    // Get sample of customers with valid emails
    const { data: validEmails, error: validError } = await adminSupabase
      .from("profiles")
      .select("id, email, first_name, last_name, created_at")
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")
      .limit(20)

    // Get statistics
    const { count: totalWithEmails } = await adminSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)

    const { count: totalWithValidEmails } = await adminSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")

    // Get email patterns (first 10 characters) to see common issues
    const { data: emailPatterns } = await adminSupabase
      .from("profiles")
      .select("email")
      .eq("role", "customer")
      .not("email", "is", null)
      .not("email", "like", "%@%")
      .limit(100)

    const patterns = emailPatterns?.map((p) => p.email?.substring(0, 20) || "").filter(Boolean) || []
    const uniquePatterns = Array.from(new Set(patterns)).slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        totalWithEmails: totalWithEmails || 0,
        totalWithValidEmails: totalWithValidEmails || 0,
        invalidEmailSamples: invalidEmails || [],
        validEmailSamples: validEmails || [],
        commonInvalidPatterns: uniquePatterns,
      },
    })
  } catch (error: any) {
    console.error("Error getting email diagnostics:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get email diagnostics" },
      { status: 500 }
    )
  }
}

