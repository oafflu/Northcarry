import { NextRequest, NextResponse } from "next/server"
import { updateEmailTemplate } from "@/app/actions/email-templates"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json()
    const { project } = body

    if (!project) {
      return NextResponse.json({ error: "Project data is required" }, { status: 400 })
    }

    // Extract HTML from project if available
    let htmlContent: string | undefined
    if (project.html) {
      htmlContent = project.html
    }

    const result = await updateEmailTemplate(id, {
      project_data: project,
      html_content: htmlContent,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error saving template:", error)
    return NextResponse.json({ error: error.message || "Failed to save template" }, { status: 500 })
  }
}

