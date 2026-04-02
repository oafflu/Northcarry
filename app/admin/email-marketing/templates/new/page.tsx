"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Upload } from "lucide-react"
import CodeEditor from "./CodeEditor"
import { toast } from "sonner"

export default function NewTemplatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get("id")
  const [saving, setSaving] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("marketing")
  const [htmlContent, setHtmlContent] = useState("")
  const [initialHtml, setInitialHtml] = useState<string | undefined>(undefined)

  // Load template name and category if editing
  useEffect(() => {
    if (templateId) {
      fetch(`/api/email-templates/${templateId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setTemplateName(data.data.name || "")
            setTemplateCategory(data.data.category || "marketing")
            if (data.data.html_content) {
              setInitialHtml(data.data.html_content)
              setHtmlContent(data.data.html_content)
            }
          }
        })
        .catch((error) => {
          console.error("Error loading template info:", error)
        })
    }
  }, [templateId])

  const handleHtmlChange = (html: string) => {
    setHtmlContent(html)
  }

  const handleEditorReady = (editor: any) => {
    // Editor is ready, can be used for advanced features if needed
    console.log("Code editor ready")
  }

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name")
      return
    }

    if (!htmlContent.trim()) {
      toast.error("Template content cannot be empty")
      return
    }

    setSaving(true)
    try {
      // Create or update template
      const url = templateId
        ? `/api/email-templates/${templateId}`
        : "/api/email-templates"
      const method = templateId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: templateName,
          category: templateCategory,
          html_content: htmlContent,
          project_data: {}, // Empty project data since we're using HTML directly
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save template")
      }

      const result = await response.json()
      toast.success("Template saved successfully")
      router.push(`/admin/email-marketing/templates`)
    } catch (error: any) {
      console.error("Error saving template:", error)
      toast.error(error.message || "Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  const handleImportHtml = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".html,.htm"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        setHtmlContent(text)
        setInitialHtml(text)
        toast.success("HTML imported successfully")
      } catch (error) {
        console.error("Error importing HTML:", error)
        toast.error("Failed to import HTML file")
      }
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/email-marketing/templates"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {templateId ? "Edit Template" : "Create New Template"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
            <select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
              <option value="promotional">Promotional</option>
              <option value="newsletter">Newsletter</option>
              <option value="automation">Automation</option>
            </select>
          </div>
          <button
            onClick={handleImportHtml}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Import HTML
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      {/* Code Editor with Live Preview */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor
          templateId={templateId}
          initialHtml={initialHtml}
          onHtmlChange={handleHtmlChange}
          onEditorReady={handleEditorReady}
        />
      </div>
    </div>
  )
}

