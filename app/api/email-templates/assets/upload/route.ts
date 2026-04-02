import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

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

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const adminSupabase = createAdminSupabaseClient()
    const uploadedAssets = []

    for (const file of files) {
      // Validate file type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
      if (!allowedTypes.includes(file.type)) {
        continue // Skip invalid file types
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `email-templates/${fileName}`

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await adminSupabase.storage
        .from("cms-media")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error("Error uploading file:", uploadError)
        continue
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = adminSupabase.storage.from("cms-media").getPublicUrl(filePath)

      uploadedAssets.push({
        src: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      })
    }

    return NextResponse.json(uploadedAssets)
  } catch (error: any) {
    console.error("Error uploading assets:", error)
    return NextResponse.json({ error: error.message || "Failed to upload assets" }, { status: 500 })
  }
}

