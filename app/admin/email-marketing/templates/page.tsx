"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Plus, FileText, Edit, Trash2, Copy, Search, Upload, X, AlertCircle, Eye } from "lucide-react"
import { toast } from "sonner"
import type { EmailTemplate } from "@/app/actions/email-templates"

interface Template {
  id: string
  name: string
  category: string
  subject: string
  preview: string
  thumbnail?: string
  htmlContent?: string
  createdAt: string
  updatedAt: string
  usageCount: number
}

const categories = ["All", "Transactional", "Marketing", "Promotional", "Newsletter", "Automation"]

// Map database category to display category
const categoryMap: Record<string, string> = {
  transactional: "Transactional",
  marketing: "Marketing",
  promotional: "Promotional",
  newsletter: "Newsletter",
  automation: "Automation",
}

// Map display category to database category
const reverseCategoryMap: Record<string, string> = {
  Transactional: "transactional",
  Marketing: "marketing",
  Promotional: "promotional",
  Newsletter: "newsletter",
  Automation: "automation",
}

// Component to handle image loading with fallback
function TemplateThumbnail({ src, alt }: { src: string; alt: string }) {
  const [imageError, setImageError] = useState(false)

  if (imageError) {
    return (
      <div className="h-48 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
        <FileText className="w-16 h-16 text-teal-300" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string>("")
  const previewKeyRef = useRef<number>(0)

  // Extract first image from HTML
  const extractFirstImage = (html: string): string | null => {
    if (!html) return null
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1]
    }
    return null
  }

  // Extract body content for preview
  const extractBodyContent = (html: string): string => {
    if (!html) return ""
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      return bodyMatch[1]
    }
    // If no body tag, return the HTML as is (might be just body content)
    return html
  }

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const categoryFilter = selectedCategory !== "All" ? reverseCategoryMap[selectedCategory] : undefined
      const params = new URLSearchParams()
      if (categoryFilter) {
        params.append("category", categoryFilter)
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim())
      }

      const response = await fetch(`/api/email-templates?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch templates")
      }

      const result = await response.json()
      if (result.success && result.data) {
        // Map EmailTemplate to Template interface
        const mappedTemplates: Template[] = result.data.map((template: EmailTemplate) => {
          const htmlContent = template.html_content || ""
          const firstImage = extractFirstImage(htmlContent) || template.thumbnail_url
          
          return {
            id: template.id,
            name: template.name,
            category: categoryMap[template.category] || template.category,
            subject: template.subject || "No subject",
            preview: template.preview_text || template.description || "No preview available",
            thumbnail: firstImage,
            htmlContent: htmlContent,
            createdAt: new Date(template.created_at).toLocaleDateString(),
            updatedAt: new Date(template.updated_at).toLocaleDateString(),
            usageCount: template.usage_count || 0,
          }
        })
        setTemplates(mappedTemplates)
      } else {
        setTemplates([])
      }
    } catch (err: any) {
      console.error("Error loading templates:", err)
      setError(err.message || "Failed to load templates")
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates()
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.preview.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return

    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete template")
      }

      toast.success("Template deleted successfully")
      loadTemplates()
    } catch (err: any) {
      console.error("Error deleting template:", err)
      toast.error(err.message || "Failed to delete template")
    }
  }

  const handlePreview = async (template: Template) => {
    try {
      // Reset preview state first to ensure clean preview
      setPreviewHtml("")
      setPreviewTemplate(null)
      
      let htmlContent = template.htmlContent || ""
      
      // If HTML not loaded, fetch it
      if (!htmlContent) {
        const response = await fetch(`/api/email-templates/${template.id}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            htmlContent = result.data.html_content || ""
          }
        }
      }

      // Ensure we have valid HTML content
      if (!htmlContent || htmlContent.trim() === "") {
        toast.error("Template has no HTML content")
        return
      }

      // Check if content looks like React/JSX code (common indicators)
      if (htmlContent.includes("import {") || htmlContent.includes("export default") || htmlContent.includes("from \"@/")) {
        toast.error("Invalid template content detected. Please ensure you're importing an HTML file, not a React component.")
        console.error("Template content appears to be React code:", htmlContent.substring(0, 200))
        return
      }

      // Ensure HTML is properly formatted for preview
      let previewHtml = htmlContent.trim()
      
      // Check for duplicate HTML documents (multiple <!DOCTYPE html> tags)
      const doctypeMatches = previewHtml.match(/<!DOCTYPE\s+html[^>]*>/gi)
      if (doctypeMatches && doctypeMatches.length > 1) {
        console.warn(`Detected ${doctypeMatches.length} HTML documents in template. Removing duplicates.`)
        // Find the first complete HTML document (from first <!DOCTYPE to last </html>)
        const firstDoctypeIndex = previewHtml.indexOf('<!DOCTYPE')
        const lastHtmlCloseIndex = previewHtml.lastIndexOf('</html>')
        
        if (firstDoctypeIndex !== -1 && lastHtmlCloseIndex !== -1 && lastHtmlCloseIndex > firstDoctypeIndex) {
          // Extract only the first complete document
          previewHtml = previewHtml.substring(firstDoctypeIndex, lastHtmlCloseIndex + 7).trim()
          console.log('Removed duplicate HTML documents. New length:', previewHtml.length)
        } else {
          // Fallback: split by <!DOCTYPE and take the first one
          const parts = previewHtml.split(/<!DOCTYPE\s+html[^>]*>/i)
          if (parts.length > 1) {
            // Reconstruct first document
            const firstPart = parts[0].trim()
            const secondPart = parts[1]
            // Find where the first document ends (look for </html>)
            const firstDocEnd = secondPart.indexOf('</html>')
            if (firstDocEnd !== -1) {
              previewHtml = '<!DOCTYPE html>' + secondPart.substring(0, firstDocEnd + 7).trim()
              console.log('Extracted first HTML document using split method. New length:', previewHtml.length)
            }
          }
        }
      }
      
      // Extract head styles if they exist (for email client compatibility) - do this first so it's available everywhere
      let headContent = ''
      if (previewHtml.includes("<!DOCTYPE") || previewHtml.includes("<html")) {
        const headMatch = previewHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
        if (headMatch && headMatch[1]) {
          // Extract style tags from head
          const styleMatch = headMatch[1].match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
          if (styleMatch) {
            headContent = styleMatch.join('\n')
          }
        }
      }
      
      // If it's a full HTML document, extract just the body content to avoid duplication
      if (previewHtml.includes("<!DOCTYPE") || previewHtml.includes("<html")) {
        
        // Extract body content using precise method - find FIRST body tag and LAST closing tag
        const bodyTagRegex = /<body[^>]*>/i
        const bodyStartMatch = previewHtml.match(bodyTagRegex)
        const bodyEndIndex = previewHtml.lastIndexOf('</body>')
        
        if (bodyStartMatch && bodyStartMatch.index !== undefined && bodyEndIndex !== -1 && bodyEndIndex > bodyStartMatch.index) {
          const bodyStartIndex = bodyStartMatch.index
          const bodyStartTagEnd = bodyStartIndex + bodyStartMatch[0].length
          
          // Extract ONLY the inner content of the body tag
          let bodyContent = previewHtml.substring(bodyStartTagEnd, bodyEndIndex).trim()
          
          // Debug: log extraction details
          console.log('Body extraction:', {
            startIndex: bodyStartTagEnd,
            endIndex: bodyEndIndex,
            contentLength: bodyContent.length,
            previewHtmlLength: previewHtml.length
          })
          
          // Ensure we have content - if empty, try regex fallback
          if (!bodyContent || bodyContent.length === 0) {
            console.warn('Extracted body content is empty, using regex fallback')
            // Fallback: try regex extraction (greedy to get all content)
            const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
            if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim().length > 0) {
              bodyContent = bodyMatch[1].trim()
              console.log('Regex fallback extracted content length:', bodyContent.length)
            } else {
              // Try without the closing body tag (in case of malformed HTML)
              const bodyMatch2 = previewHtml.match(/<body[^>]*>([\s\S]*)/i)
              if (bodyMatch2 && bodyMatch2[1]) {
                bodyContent = bodyMatch2[1].replace(/<\/body>[\s\S]*$/i, '').trim()
                console.log('Alternative extraction content length:', bodyContent.length)
              }
            }
          }
          
          // Clean up: remove any nested body tags (shouldn't exist, but just in case)
          bodyContent = bodyContent.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '')
          
          // Final validation: ensure we have valid content
          if (!bodyContent || bodyContent.length === 0) {
            console.error('Body content is empty after all extraction attempts. Original HTML length:', previewHtml.length)
            // Last resort: use the raw substring again
            const rawContent = previewHtml.substring(bodyStartTagEnd, bodyEndIndex)
            if (rawContent && rawContent.trim().length > 0) {
              bodyContent = rawContent.trim()
              console.log('Using raw substring, content length:', bodyContent.length)
            } else {
              console.error('All extraction methods failed. Body content is empty.')
            }
          }
          
          // Build clean preview HTML with extracted body content
          previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headContent}
</head>
<body>
${bodyContent}
</body>
</html>`
        } else {
          // Fallback: use regex to extract body content
          const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
          if (bodyMatch && bodyMatch[1]) {
            let bodyContent = bodyMatch[1].trim()
            bodyContent = bodyContent.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '')
            
            previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${headContent}
</head>
<body>
${bodyContent}
</body>
</html>`
          } else {
            console.warn('Template HTML missing body tag, using full document')
          }
        }
      } else {
        // Wrap body content in a complete HTML document
        previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${previewHtml}
</body>
</html>`
      }
      
      // Final validation: ensure no duplicate body tags in preview HTML
      const bodyTagCount = (previewHtml.match(/<body[^>]*>/gi) || []).length
      const closingBodyTagCount = (previewHtml.match(/<\/body>/gi) || []).length
      if (bodyTagCount !== 1 || closingBodyTagCount !== 1) {
        console.warn(`Warning: Preview HTML has ${bodyTagCount} opening and ${closingBodyTagCount} closing body tags. This may cause duplication.`)
        // Fix: remove extra body tags
        previewHtml = previewHtml.replace(/<body[^>]*>/gi, (match, offset) => {
          return offset === previewHtml.indexOf('<body') ? match : ''
        })
        previewHtml = previewHtml.replace(/<\/body>/gi, (match, offset) => {
          return offset === previewHtml.lastIndexOf('</body>') ? match : ''
        })
      }
      
      // Final check: ensure preview HTML has actual content (only if we're in the main extraction path)
      if (previewHtml.includes("<!DOCTYPE") || previewHtml.includes("<html")) {
        const bodyMatch = previewHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        if (bodyMatch && bodyMatch[1]) {
          const bodyInnerContent = bodyMatch[1].trim()
          if (bodyInnerContent.length === 0) {
            console.error('Preview HTML body is empty after all processing. This will result in a blank preview.')
            // Last resort: use the original HTML content
            const originalBodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
            if (originalBodyMatch && originalBodyMatch[1]) {
              const originalBodyContent = originalBodyMatch[1].trim()
              // Extract head content from original if not already extracted
              let finalHeadContent = headContent || ''
              if (!finalHeadContent) {
                const originalHeadMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
                if (originalHeadMatch && originalHeadMatch[1]) {
                  const styleMatch = originalHeadMatch[1].match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
                  if (styleMatch) {
                    finalHeadContent = styleMatch.join('\n')
                  }
                }
              }
              previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${finalHeadContent}
</head>
<body>
${originalBodyContent}
</body>
</html>`
              console.log('Using original body content as fallback, length:', originalBodyContent.length)
            }
          }
        }
      }
      
      // Increment preview key to force iframe reload
      previewKeyRef.current += 1
      
      setPreviewHtml(previewHtml)
      setPreviewTemplate(template)
    } catch (err) {
      console.error("Error loading template for preview:", err)
      toast.error("Failed to load template preview")
    }
  }

  const handleDuplicate = async (template: Template) => {
    try {
      // Fetch the original template data
      const response = await fetch(`/api/email-templates/${template.id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch template")
      }

      const result = await response.json()
      if (!result.success || !result.data) {
        throw new Error("Template not found")
      }

      const originalTemplate = result.data

      // Create a duplicate
      const duplicateResponse = await fetch("/api/email-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${originalTemplate.name} (Copy)`,
          category: originalTemplate.category,
          subject: originalTemplate.subject,
          preview_text: originalTemplate.preview_text,
          project_data: originalTemplate.project_data,
          html_content: originalTemplate.html_content,
          description: originalTemplate.description,
        }),
      })

      if (!duplicateResponse.ok) {
        const errorData = await duplicateResponse.json()
        throw new Error(errorData.error || "Failed to duplicate template")
      }

      toast.success("Template duplicated successfully")
      loadTemplates()
    } catch (err: any) {
      console.error("Error duplicating template:", err)
      toast.error(err.message || "Failed to duplicate template")
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Templates</h1>
          <p className="text-gray-600 mt-1">Create and manage reusable email templates</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/email-marketing/templates/import"
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            <Upload className="w-5 h-5" />
            Import HTML
          </Link>
          <Link
            href="/admin/email-marketing/templates/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Template
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900">Unsubscribe Link</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add this link to your templates or use <code className="bg-gray-100 px-1 rounded">{'{'}{'{'}unsubscribe_link{'}'}{'}'}</code>.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              className="w-full px-3 py-2 border rounded-md text-sm text-gray-700"
              value={`${typeof window !== "undefined" ? window.location.origin : "https://brevibrushes.com"}/unsubscribe?email={{email}}`}
            />
            <button
              className="px-3 py-2 bg-teal-600 text-white rounded-md text-sm"
              onClick={() => {
                const link = `${window.location.origin}/unsubscribe?email={{email}}`
                navigator.clipboard.writeText(link)
                toast.success("Unsubscribe link copied")
              }}
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "bg-teal-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded ${viewMode === "grid" ? "bg-gray-200" : ""}`}
          >
            <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
              <div className="bg-gray-600"></div>
              <div className="bg-gray-600"></div>
              <div className="bg-gray-600"></div>
              <div className="bg-gray-600"></div>
            </div>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded ${viewMode === "list" ? "bg-gray-200" : ""}`}
          >
            <div className="w-4 h-4 flex flex-col gap-0.5">
              <div className="h-0.5 bg-gray-600"></div>
              <div className="h-0.5 bg-gray-600"></div>
              <div className="h-0.5 bg-gray-600"></div>
            </div>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading templates...</p>
        </div>
      )}

      {/* Templates Grid/List */}
      {!loading && viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {template.thumbnail ? (
                <div className="h-48 bg-gray-100 relative overflow-hidden">
                  <TemplateThumbnail src={template.thumbnail} alt={template.name} />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-teal-50 to-teal-100 flex items-center justify-center">
                  <FileText className="w-16 h-16 text-teal-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                      {template.category}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">{template.subject}</p>
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{template.preview}</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Used {template.usageCount} times</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreview(template)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="Preview template"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/admin/email-marketing/templates/new?id=${template.id}`}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="Edit template"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(template)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{template.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{template.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{template.subject}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{template.usageCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{template.updatedAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Preview template"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/email-marketing/templates/new?id=${template.id}`}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit template"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || selectedCategory !== "All"
              ? "Try adjusting your filters"
              : "Get started by creating your first template"}
          </p>
          {!searchQuery && selectedCategory === "All" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Template
            </button>
          )}
        </div>
      )}

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create New Template</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g., Welcome Email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                  <option>Transactional</option>
                  <option>Marketing</option>
                  <option>Promotional</option>
                  <option>Newsletter</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <Link
                  href="/admin/email-marketing/templates/new"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  Open Builder
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{previewTemplate.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{previewTemplate.subject}</p>
              </div>
              <button
                onClick={() => {
                  setPreviewTemplate(null)
                  setPreviewHtml("")
                }}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {previewHtml ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="bg-white rounded shadow-sm overflow-hidden">
                    <iframe
                      key={`preview-${previewTemplate?.id || 'default'}-${previewKeyRef.current}`}
                      srcDoc={previewHtml}
                      className="w-full border-0"
                      style={{ minHeight: "600px", height: "100%" }}
                      title="Email Preview"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading preview...</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setPreviewTemplate(null)
                  setPreviewHtml("")
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              <Link
                href={`/admin/email-marketing/templates/new?id=${previewTemplate.id}`}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Edit Template
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

