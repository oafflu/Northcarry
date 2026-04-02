import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (allow images and PDFs)
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images (JPEG, PNG, GIF, WEBP) and PDFs are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Generate file path
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `receipts/${timestamp}-${sanitizedFileName}`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Use admin client for storage operations
    const adminSupabase = createAdminSupabaseClient()

    // Upload to storage (using cms-media bucket or create a receipts bucket)
    // For now, we'll use cms-media bucket with a receipts folder
    const { data: uploadData, error: uploadError } = await adminSupabase.storage
      .from('cms-media')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = adminSupabase.storage
      .from('cms-media')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: filePath,
    })
  } catch (error: any) {
    console.error('Error uploading receipt:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload receipt' },
      { status: 500 }
    )
  }
}

