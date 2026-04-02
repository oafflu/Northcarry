import { NextRequest, NextResponse } from "next/server"
import { getEmailTemplateById } from "@/app/actions/email-templates"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const result = await getEmailTemplateById(id)

    if (!result.success || !result.data) {
      return NextResponse.json({ error: result.error || "Template not found" }, { status: 404 })
    }

    // Return template data (for backward compatibility, return empty project if no project_data exists)
    return NextResponse.json({
      project: result.data.project_data || {},
      html_content: result.data.html_content || "",
    })
  } catch (error: any) {
    console.error("Error loading template:", error)
    return NextResponse.json({ error: error.message || "Failed to load template" }, { status: 500 })
  }
}

