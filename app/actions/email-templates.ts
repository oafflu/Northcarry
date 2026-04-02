"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface EmailTemplate {
  id: string
  name: string
  category: string
  subject?: string
  preview_text?: string
  project_data: any
  html_content?: string
  thumbnail_url?: string
  description?: string
  usage_count: number
  last_used_at?: string
  imported_from?: string
  original_template_id?: string
  is_active: boolean
  is_public: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateTemplateInput {
  name: string
  category?: string
  subject?: string
  preview_text?: string
  project_data?: any
  html_content?: string
  description?: string
  imported_from?: string
  original_template_id?: string
}

export interface UpdateTemplateInput {
  name?: string
  category?: string
  subject?: string
  preview_text?: string
  project_data?: any
  html_content?: string
  thumbnail_url?: string
  description?: string
  is_active?: boolean
  is_public?: boolean
}

/**
 * Get all email templates
 */
export async function getEmailTemplates(filters?: {
  category?: string
  is_active?: boolean
  search?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase.from("email_templates").select("*").order("created_at", { ascending: false })

    if (filters?.category) {
      query = query.eq("category", filters.category)
    }

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active)
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching email templates:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as EmailTemplate[], error: null }
  } catch (error: any) {
    console.error("Error in getEmailTemplates:", error)
    return { success: false, error: error.message || "Failed to fetch templates", data: null }
  }
}

/**
 * Get a single email template by ID
 */
export async function getEmailTemplateById(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase.from("email_templates").select("*").eq("id", id).single()

    if (error) {
      console.error("Error fetching email template:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as EmailTemplate, error: null }
  } catch (error: any) {
    console.error("Error in getEmailTemplateById:", error)
    return { success: false, error: error.message || "Failed to fetch template", data: null }
  }
}

/**
 * Create a new email template
 */
export async function createEmailTemplate(input: CreateTemplateInput, userId?: string) {
  try {
    const supabase = createAdminSupabaseClient()

    const templateData = {
      name: input.name,
      category: input.category || "marketing",
      subject: input.subject || null,
      preview_text: input.preview_text || null,
      project_data: input.project_data || {},
      html_content: input.html_content || null,
      description: input.description || null,
      imported_from: input.imported_from || null,
      original_template_id: input.original_template_id || null,
      created_by: userId || null,
    }

    const { data, error } = await supabase.from("email_templates").insert(templateData).select().single()

    if (error) {
      console.error("Error creating email template:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing/templates")
    return { success: true, data: data as EmailTemplate, error: null }
  } catch (error: any) {
    console.error("Error in createEmailTemplate:", error)
    return { success: false, error: error.message || "Failed to create template", data: null }
  }
}

/**
 * Update an email template
 */
export async function updateEmailTemplate(id: string, input: UpdateTemplateInput) {
  try {
    const supabase = createAdminSupabaseClient()

    const updateData: any = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.category !== undefined) updateData.category = input.category
    if (input.subject !== undefined) updateData.subject = input.subject
    if (input.preview_text !== undefined) updateData.preview_text = input.preview_text
    if (input.project_data !== undefined) updateData.project_data = input.project_data
    if (input.html_content !== undefined) updateData.html_content = input.html_content
    if (input.thumbnail_url !== undefined) updateData.thumbnail_url = input.thumbnail_url
    if (input.description !== undefined) updateData.description = input.description
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.is_public !== undefined) updateData.is_public = input.is_public

    const { data, error } = await supabase.from("email_templates").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating email template:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing/templates")
    revalidatePath(`/admin/email-marketing/templates/${id}`)
    return { success: true, data: data as EmailTemplate, error: null }
  } catch (error: any) {
    console.error("Error in updateEmailTemplate:", error)
    return { success: false, error: error.message || "Failed to update template", data: null }
  }
}

/**
 * Delete an email template
 */
export async function deleteEmailTemplate(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("email_templates").delete().eq("id", id)

    if (error) {
      console.error("Error deleting email template:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/email-marketing/templates")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in deleteEmailTemplate:", error)
    return { success: false, error: error.message || "Failed to delete template" }
  }
}

/**
 * Increment usage count for a template
 */
export async function incrementTemplateUsage(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.rpc("increment_template_usage", { template_id: id })

    if (error) {
      // If RPC doesn't exist, do it manually
      const { data: template } = await supabase.from("email_templates").select("usage_count").eq("id", id).single()
      if (template) {
        await supabase
          .from("email_templates")
          .update({
            usage_count: (template.usage_count || 0) + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", id)
      }
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in incrementTemplateUsage:", error)
    return { success: false, error: error.message || "Failed to increment usage" }
  }
}

/**
 * Clean and process HTML from Klaviyo or other email platforms
 */
function processImportedHtml(html: string, source: string = "html_import"): string {
  let processedHtml = html

  // If it's a Klaviyo template, clean it up
  if (source === "klaviyo" || html.includes("klaviyo") || html.includes("d3k81ch9hvuctc.cloudfront.net")) {
    // Remove Klaviyo tracking pixels
    processedHtml = processedHtml.replace(/<!--\s*TRACKING_PIXEL_(TOP|BOTTOM)\s*-->/gi, "")
    
    // Remove Klaviyo branding section (Powered by Klaviyo) - be more specific
    processedHtml = processedHtml.replace(
      /<div[^>]*class="[^"]*klBranding[^"]*"[^>]*>[\s\S]*?<img[^>]*alt="Powered by Klaviyo"[^>]*>[\s\S]*?<\/div>/gi,
      ""
    )
    // Also try without img tag
    processedHtml = processedHtml.replace(
      /<div[^>]*class="[^"]*klBranding[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      ""
    )
    
    // Remove Klaviyo unsubscribe link placeholder (we'll handle this separately)
    processedHtml = processedHtml.replace(/\{%\s*unsubscribe\s*%\}/gi, "[UNSUBSCRIBE_LINK]")
    
    // Convert Klaviyo template variables to a more generic format
    processedHtml = processedHtml.replace(/\{\{\s*organization\.name\s*\}\}/gi, "[ORGANIZATION_NAME]")
    processedHtml = processedHtml.replace(/\{\{\s*organization\.full_address\s*\}\}/gi, "[ORGANIZATION_ADDRESS]")
    
    // Handle MSO conditional comments more carefully
    // First pass: remove simple conditionals that wrap nothing important
    processedHtml = processedHtml.replace(/<!--\[if[^\]]*\]>\s*<!\[endif\]-->/gi, "")
    
    // Second pass: extract content from conditionals but preserve structure
    processedHtml = processedHtml.replace(/<!--\[if[^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi, "$1")
    
    // Clean up any remaining empty conditionals
    processedHtml = processedHtml.replace(/<!--\[if[^\]]*\]>/gi, "")
    processedHtml = processedHtml.replace(/<!\[endif\]-->/gi, "")
  }

  // Extract body content if full HTML document
  if (processedHtml.includes("<body")) {
    const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      // Keep the body tag and its content, but we'll use the full HTML for email templates
      // This ensures all styles are preserved
    }
  }

  // Clean up excessive whitespace but preserve structure
  processedHtml = processedHtml.replace(/\n\s*\n\s*\n/g, "\n\n")

  return processedHtml
}

/**
 * Extract subject from HTML content
 */
function extractSubjectFromHtml(html: string): string | undefined {
  // Try to find subject in title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  // Try to find subject in meta tag
  const metaSubjectMatch = html.match(/<meta[^>]*name=["']subject["'][^>]*content=["']([^"']+)["']/i)
  if (metaSubjectMatch) {
    return metaSubjectMatch[1].trim()
  }

  // Try to find first h1 or h2 as subject
  const headingMatch = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i)
  if (headingMatch) {
    return headingMatch[1].trim()
  }

  return undefined
}

/**
 * Extract preview text from HTML
 */
function extractPreviewText(html: string): string | undefined {
  // Try meta preview tag
  const previewMatch = html.match(/<meta[^>]*name=["']preview["'][^>]*content=["']([^"']+)["']/i)
  if (previewMatch) {
    return previewMatch[1]
  }

  // Try to extract first paragraph text as preview
  const firstPMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i)
  if (firstPMatch) {
    const text = firstPMatch[1].trim().replace(/\s+/g, " ")
    if (text.length > 0 && text.length < 150) {
      return text
    }
  }

  return undefined
}

/**
 * Import HTML template (from Klaviyo or other sources)
 */
export async function importHtmlTemplate(
  html: string,
  metadata: {
    name: string
    category?: string
    subject?: string
    imported_from?: string
    original_template_id?: string
  },
  userId?: string
) {
  try {
    if (!html || !html.trim()) {
      return { success: false, error: "HTML content is required", data: null }
    }

    // Validate that this is actually HTML, not React/JSX code
    const reactIndicators = [
      /import\s+.*from\s+["']@\//,  // import from "@/..."
      /import\s+.*from\s+["']\./,     // import from "./..."
      /export\s+default\s+function/, // export default function
      /export\s+default\s+async\s+function/, // export default async function
      /useState|useEffect|useCallback/, // React hooks
      /<[A-Z][a-zA-Z]*\s+/,           // JSX component tags
    ]

    const isReactCode = reactIndicators.some(pattern => pattern.test(html))
    
    if (isReactCode) {
      return { 
        success: false, 
        error: "Invalid content detected. Please import an HTML email template file, not a React component file. The file should contain HTML markup, not JavaScript/TypeScript code.", 
        data: null 
      }
    }

    // Validate that it contains HTML tags
    if (!html.includes('<') || !html.includes('>')) {
      return { 
        success: false, 
        error: "Invalid HTML content. The file does not appear to contain valid HTML markup.", 
        data: null 
      }
    }

    // Process and clean the HTML
    const processedHtml = processImportedHtml(html, metadata.imported_from)

    // Extract subject from HTML if not provided
    let subject = metadata.subject
    if (!subject) {
      subject = extractSubjectFromHtml(html) || extractSubjectFromHtml(processedHtml)
    }

    // Extract preview text if available
    let previewText = extractPreviewText(html) || extractPreviewText(processedHtml)

    // Create template with processed HTML content
    const result = await createEmailTemplate(
      {
        name: metadata.name,
        category: metadata.category || "marketing",
        subject: subject,
        preview_text: previewText,
        html_content: processedHtml,
        imported_from: metadata.imported_from || "html_import",
        original_template_id: metadata.original_template_id,
      },
      userId
    )

    return result
  } catch (error: any) {
    console.error("Error in importHtmlTemplate:", error)
    return { success: false, error: error.message || "Failed to import template", data: null }
  }
}

