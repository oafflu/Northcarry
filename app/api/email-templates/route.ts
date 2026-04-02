import { NextRequest, NextResponse } from "next/server"
import { createEmailTemplate, getEmailTemplates } from "@/app/actions/email-templates"
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

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get("category")
    const isActive = searchParams.get("is_active")
    const search = searchParams.get("search")

    const result = await getEmailTemplates({
      category: category || undefined,
      is_active: isActive ? isActive === "true" : undefined,
      search: search || undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error fetching templates:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch templates" }, { status: 500 })
  }
}

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
    const { name, category, subject, preview_text, project_data, html_content, description, imported_from, original_template_id } = body

    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 })
    }

    const result = await createEmailTemplate(
      {
        name,
        category,
        subject,
        preview_text,
        project_data,
        html_content,
        description,
        imported_from,
        original_template_id,
      },
      user.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error: any) {
    console.error("Error creating template:", error)
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 })
  }
}

