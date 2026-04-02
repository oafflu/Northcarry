import { NextRequest, NextResponse } from "next/server"
import { createEmailTemplate } from "@/app/actions/email-templates"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { readFileSync } from "fs"
import { join } from "path"

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

    // Read the HTML template file
    const templatePath = join(process.cwd(), "black-friday-email-template.html")
    let htmlContent: string
    
    try {
      htmlContent = readFileSync(templatePath, "utf-8")
    } catch (error) {
      return NextResponse.json(
        { error: "Template file not found. Please ensure black-friday-email-template.html exists in the project root." },
        { status: 404 }
      )
    }

    // Check if template already exists
    const { data: existing } = await supabase
      .from("email_templates")
      .select("id, name")
      .eq("name", "Black Friday Sale - Up To 65% OFF")
      .single()

    if (existing) {
      return NextResponse.json(
        { 
          error: "Template already exists",
          data: existing,
          message: "A template with this name already exists. Please update it manually or use a different name."
        },
        { status: 409 }
      )
    }

    // Create the template
    const result = await createEmailTemplate(
      {
        name: "Black Friday Sale - Up To 65% OFF",
        category: "promotional",
        subject: "Black Friday Sale - Up To 65% OFF!",
        preview_text: "Don't miss out on our biggest sale of the year! Save up to 65% on all products.",
        description: "Sleek Black Friday email template with prominent discount display and modern design",
        html_content: htmlContent,
        project_data: {},
        imported_from: "manual",
      },
      user.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      message: "Black Friday template created successfully!"
    })
  } catch (error: any) {
    console.error("Error creating Black Friday template:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create template" },
      { status: 500 }
    )
  }
}

