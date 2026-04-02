"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, FileText, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export default function ImportTemplatePage() {
  const router = useRouter()
  const [htmlContent, setHtmlContent] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("marketing")
  const [importedFrom, setImportedFrom] = useState("klaviyo")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPreview, setShowPreview] = useState(false)


  const detectSource = (html: string): string => {
    if (html.includes("klaviyo") || html.includes("d3k81ch9hvuctc.cloudfront.net")) {
      return "klaviyo"
    }
    if (html.includes("mailchimp") || html.includes("mcusercontent.com")) {
      return "mailchimp"
    }
    // Removed SendGrid detection - no longer supported
    return "other"
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text")
    if (pastedText.includes("<html") || pastedText.includes("<!DOCTYPE") || pastedText.includes("<body")) {
      setHtmlContent(pastedText)
      // Auto-detect source
      const detectedSource = detectSource(pastedText)
      if (detectedSource !== "other") {
        setImportedFrom(detectedSource)
        toast.success(`Detected ${detectedSource} template`)
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setError("Please upload an HTML file")
      toast.error("Please upload an HTML file")
      return
    }

    const text = await file.text()
    setHtmlContent(text)
    
    // Auto-detect source
    const detectedSource = detectSource(text)
    if (detectedSource !== "other") {
      setImportedFrom(detectedSource)
    }

    // Try to extract template name from filename
    if (!templateName) {
      const name = file.name.replace(/\.(html|htm)$/i, "").replace(/[_-]/g, " ")
      setTemplateName(name)
    }
  }

  const handleImport = async () => {
    if (!htmlContent.trim()) {
      setError("Please provide HTML content")
      toast.error("Please provide HTML content")
      return
    }

    if (!templateName.trim()) {
      setError("Please enter a template name")
      toast.error("Please enter a template name")
      return
    }

    // Basic HTML validation
    if (!htmlContent.includes("<html") && !htmlContent.includes("<!DOCTYPE")) {
      if (!htmlContent.includes("<body") && !htmlContent.includes("<div")) {
        setError("The HTML content doesn't appear to be valid email HTML")
        toast.error("Invalid HTML content")
        return
      }
    }

    setLoading(true)
    setError("")

    try {
      toast.loading("Importing template...", { id: "import-template" })
      
      const response = await fetch("/api/email-templates/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: htmlContent,
          metadata: {
            name: templateName,
            category: templateCategory,
            imported_from: importedFrom,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to import template")
      }

      const result = await response.json()
      
      toast.success("Template imported successfully! You can edit it from the templates list.", { id: "import-template", duration: 3000 })

      // Redirect to templates list instead of editor (editor is slow to load)
      setTimeout(() => {
        router.push(`/admin/email-marketing/templates`)
      }, 1500)
    } catch (err: any) {
      const errorMessage = err.message || "Failed to import template"
      setError(errorMessage)
      toast.error(errorMessage, { id: "import-template" })
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/email-marketing/templates"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Import HTML Template</h1>
          <p className="text-gray-600 mt-1">Import templates from Klaviyo or other email platforms</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Template Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Template Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Black Friday Campaign"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={templateCategory}
              onChange={(e) => setTemplateCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
              <option value="promotional">Promotional</option>
              <option value="newsletter">Newsletter</option>
              <option value="automation">Automation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Imported From</label>
            <select
              value={importedFrom}
              onChange={(e) => setImportedFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="klaviyo">Klaviyo</option>
              <option value="mailchimp">Mailchimp</option>
              <option value="mailgun">Mailgun</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* HTML Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">HTML Content</h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <label className="cursor-pointer">
            <span className="text-teal-600 hover:text-teal-700 font-medium">Click to upload</span> or drag and drop
            <input
              type="file"
              accept=".html,.htm"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-sm text-gray-500 mt-2">HTML files only</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Or paste HTML content below
            </label>
            {htmlContent && (
              <button
                type="button"
                onClick={() => {
                  setHtmlContent("")
                  setError("")
                  setShowPreview(false)
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            value={htmlContent}
            onChange={(e) => {
              setHtmlContent(e.target.value)
              setError("")
              // Auto-detect source on change
              if (e.target.value.length > 100) {
                const detectedSource = detectSource(e.target.value)
                if (detectedSource !== "other" && importedFrom === "other") {
                  setImportedFrom(detectedSource)
                }
              }
            }}
            onPaste={handlePaste}
            placeholder="Paste your HTML template here... (e.g., from Klaviyo, Mailchimp, etc.)"
            rows={20}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
          />
        </div>

        {htmlContent && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">HTML Info</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>{htmlContent.length.toLocaleString()} characters loaded</div>
                <div>{htmlContent.split("\n").length} lines</div>
                {htmlContent.includes("klaviyo") && (
                  <div className="flex items-center gap-1 text-teal-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>Klaviyo template detected</span>
                  </div>
                )}
              </div>
            </div>

            {showPreview && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">HTML Preview</div>
                <div className="max-h-96 overflow-auto bg-gray-900 text-gray-100 p-4 rounded font-mono text-xs">
                  <pre className="whitespace-pre-wrap break-words">{htmlContent.substring(0, 2000)}{htmlContent.length > 2000 ? "\n\n... (truncated)" : ""}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/email-marketing/templates"
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleImport}
          disabled={loading || !htmlContent.trim() || !templateName.trim()}
          className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <Upload className="w-4 h-4" />
          {loading ? "Importing..." : "Import Template"}
        </button>
      </div>
    </div>
  )
}

