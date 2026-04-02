import { NextRequest, NextResponse } from "next/server"
import { updateEmailTemplate, deleteEmailTemplate, getEmailTemplateById } from "@/app/actions/email-templates"
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

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error fetching template:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch template" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { name, category, subject, preview_text, project_data, html_content, thumbnail_url, description, is_active, is_public } = body

    const result = await updateEmailTemplate(id, {
      name,
      category,
      subject,
      preview_text,
      project_data,
      html_content,
      thumbnail_url,
      description,
      is_active,
      is_public,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error updating template:", error)
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const result = await deleteEmailTemplate(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting template:", error)
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 })
  }
}

