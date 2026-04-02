import { NextRequest, NextResponse } from "next/server"
import { importHtmlTemplate } from "@/app/actions/email-templates"
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

    const body = await request.json()
    const { html, metadata } = body

    if (!html || !metadata?.name) {
      return NextResponse.json({ error: "HTML content and template name are required" }, { status: 400 })
    }

    const result = await importHtmlTemplate(html, metadata, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error importing template:", error)
    return NextResponse.json({ error: error.message || "Failed to import template" }, { status: 500 })
  }
}

