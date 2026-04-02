"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Editor from "@monaco-editor/react"
import {
  Monitor,
  Smartphone,
  Code,
  Eye,
  Search,
  Zap,
  FileCode,
  Copy,
  Scissors,
  RotateCcw,
  RotateCw,
  Type,
  Layout,
  Image as ImageIcon,
  Link as LinkIcon,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
} from "lucide-react"

interface CodeEditorProps {
  templateId: string | null
  initialHtml?: string
  onHtmlChange: (html: string) => void
  onEditorReady?: (editor: any) => void
}

// Email component snippets
const emailSnippets = [
  {
    name: "Button",
    code: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td align="center" style="padding: 12px 24px; background-color: #14b8a6; border-radius: 5px;">
      <a href="#" style="color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px;">Button Text</a>
    </td>
  </tr>
</table>`,
  },
  {
    name: "Image",
    code: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td align="center">
      <img src="https://via.placeholder.com/600x300" alt="Image" style="max-width: 100%; height: auto; display: block;" />
    </td>
  </tr>
</table>`,
  },
  {
    name: "Text Block",
    code: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td style="padding: 20px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333333;">
      <p>Your text content here</p>
    </td>
  </tr>
</table>`,
  },
  {
    name: "Two Column Layout",
    code: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td width="50%" style="padding: 20px; vertical-align: top;">
      <p>Left column content</p>
    </td>
    <td width="50%" style="padding: 20px; vertical-align: top;">
      <p>Right column content</p>
    </td>
  </tr>
</table>`,
  },
  {
    name: "Divider",
    code: `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td style="border-top: 1px solid #e5e7eb; padding: 20px 0;"></td>
  </tr>
</table>`,
  },
  {
    name: "Social Links",
    code: `<table border="0" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
  <tr>
    <td align="center" style="padding: 10px;">
      <a href="#" style="margin: 0 10px; text-decoration: none;">
        <img src="https://via.placeholder.com/32" alt="Facebook" style="width: 32px; height: 32px;" />
      </a>
      <a href="#" style="margin: 0 10px; text-decoration: none;">
        <img src="https://via.placeholder.com/32" alt="Instagram" style="width: 32px; height: 32px;" />
      </a>
      <a href="#" style="margin: 0 10px; text-decoration: none;">
        <img src="https://via.placeholder.com/32" alt="Twitter" style="width: 32px; height: 32px;" />
      </a>
    </td>
  </tr>
</table>`,
  },
]

// Template variables
const templateVariables = [
  { name: "Customer Name", code: "{{customer_name}}" },
  { name: "Customer Email", code: "{{customer_email}}" },
  { name: "Order Number", code: "{{order_number}}" },
  { name: "Order Total", code: "{{order_total}}" },
  { name: "Order Date", code: "{{order_date}}" },
  { name: "Company Name", code: "{{company_name}}" },
  { name: "Unsubscribe Link", code: "{{unsubscribe_link}}" },
]

export default function CodeEditor({ templateId, initialHtml, onHtmlChange, onEditorReady }: CodeEditorProps) {
  const [htmlContent, setHtmlContent] = useState(initialHtml || "")
  const [viewMode, setViewMode] = useState<"source" | "preview">("source")
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [loading, setLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showSnippets, setShowSnippets] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const editorRef = useRef<any>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isWritingRef = useRef(false)

  useEffect(() => {
    if (templateId && !initialHtml) {
      loadTemplate()
    } else if (initialHtml) {
      setHtmlContent(initialHtml)
      setLoading(false)
      // Immediately set preview HTML
      const html = initialHtml.includes("<html") || initialHtml.includes("<!DOCTYPE")
        ? initialHtml
        : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${initialHtml}</body></html>`
      setPreviewHtml(html)
    } else {
      const defaultTemplate = getDefaultTemplate()
      setHtmlContent(defaultTemplate)
      setPreviewHtml(defaultTemplate)
      setLoading(false)
    }
  }, [templateId, initialHtml])

  const loadTemplate = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/email-templates/${templateId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          const html = result.data.html_content || ""
          setHtmlContent(html)
          onHtmlChange(html)
          // Immediately set preview HTML
          const previewHtml = html.includes("<html") || html.includes("<!DOCTYPE")
            ? html
            : `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${html}</body></html>`
          setPreviewHtml(previewHtml)
        }
      }
    } catch (error) {
      console.error("Error loading template:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    const html = value || ""
    setHtmlContent(html)
    onHtmlChange(html)
  }

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    if (onEditorReady) {
      onEditorReady(editor)
    }
  }

  // Insert snippet at cursor position
  const insertSnippet = (snippet: string) => {
    if (editorRef.current) {
      const editor = editorRef.current
      const selection = editor.getSelection()
      const range = new (window as any).monaco.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      )
      editor.executeEdits("insert-snippet", [
        {
          range: range,
          text: snippet,
        },
      ])
      setShowSnippets(false)
    }
  }

  // Insert variable at cursor position
  const insertVariable = (variable: string) => {
    if (editorRef.current) {
      const editor = editorRef.current
      const selection = editor.getSelection()
      const range = new (window as any).monaco.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      )
      editor.executeEdits("insert-variable", [
        {
          range: range,
          text: variable,
        },
      ])
      setShowVariables(false)
    }
  }

  // Editor actions
  const formatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run()
    }
  }

  const findAndReplace = () => {
    if (editorRef.current) {
      editorRef.current.getAction("actions.find")?.run()
    }
  }

  const undo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "undo", null)
    }
  }

  const redo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "redo", null)
    }
  }

  // Ensure HTML is complete for preview
  const getPreviewHtml = useCallback(() => {
    if (!htmlContent || htmlContent.trim() === "") {
      return "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'></head><body style='padding: 20px; font-family: Arial, sans-serif;'><p style='color: #999;'>No content to preview</p></body></html>"
    }

    // If HTML doesn't have html/body tags, wrap it
    if (!htmlContent.includes("<html") && !htmlContent.includes("<!DOCTYPE")) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${htmlContent}
</body>
</html>`
    }

    return htmlContent
  }, [htmlContent])

  // Generate preview HTML content
  const [previewHtml, setPreviewHtml] = useState<string>("")

  // Update preview HTML when content changes
  useEffect(() => {
    if (viewMode !== "preview") {
      setPreviewHtml("")
      return
    }

    if (!loading) {
      try {
        const html = getPreviewHtml()
        setPreviewHtml(html)
        setPreviewError(null)
      } catch (error) {
        console.error("Error generating preview HTML:", error)
        setPreviewError("Failed to generate preview")
      }
    }
  }, [htmlContent, viewMode, loading, getPreviewHtml])

  // Update iframe when previewHtml changes (debounced to prevent loops)
  useEffect(() => {
    if (viewMode !== "preview" || !previewHtml || loading || isWritingRef.current) return

    const timer = setTimeout(() => {
      if (iframeRef.current && !isWritingRef.current) {
        try {
          const iframe = iframeRef.current
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
          
          if (iframeDoc && iframeDoc.readyState === 'complete') {
            // Check if content already matches
            const currentHtml = iframeDoc.documentElement.outerHTML || ""
            if (!currentHtml.includes(previewHtml.substring(0, 200))) {
              isWritingRef.current = true
              iframeDoc.open()
              iframeDoc.write(previewHtml)
              iframeDoc.close()
              
              setTimeout(() => {
                try {
                  const body = iframeDoc.body
                  if (body) {
                    // Force reflow
                    body.offsetHeight
                    const height = Math.max(body.scrollHeight || 600, body.offsetHeight || 600)
                    iframe.style.height = `${height}px`
                  }
                } catch (e) {
                  console.error("Error resizing:", e)
                } finally {
                  isWritingRef.current = false
                }
              }, 200)
            } else {
              // Content matches, just resize
              setTimeout(() => {
                try {
                  const body = iframeDoc.body
                  if (body) {
                    body.offsetHeight
                    const height = Math.max(body.scrollHeight || 600, body.offsetHeight || 600)
                    iframe.style.height = `${height}px`
                  }
                } catch (e) {
                  console.error("Error resizing:", e)
                }
              }, 100)
            }
          }
        } catch (error) {
          console.error("Error updating iframe:", error)
          isWritingRef.current = false
        }
      }
    }, 300) // Debounce to prevent rapid updates

    return () => clearTimeout(timer)
  }, [previewHtml, viewMode, loading])

  const getDefaultTemplate = () => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #14b8a6; margin-top: 0;">Welcome!</h1>
              <p>Start editing your email template here.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading template...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Enhanced Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source/Preview Tabs */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1 bg-gray-50">
            <button
              onClick={() => setViewMode("source")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "source" 
                  ? "bg-white text-teal-700 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Source
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "preview" 
                  ? "bg-white text-teal-700 shadow-sm" 
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Preview
            </button>
          </div>

          {/* Preview Mode Toggle - Only show in Preview mode */}
          {viewMode === "preview" && (
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={`p-1.5 rounded transition-colors ${
                  previewMode === "desktop" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`p-1.5 rounded transition-colors ${
                  previewMode === "mobile" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Editor Actions - Only show in Source mode */}
          {viewMode === "source" && (
            <>
              <div className="h-6 w-px bg-gray-300"></div>

              {/* Editor Actions */}
              <button
                onClick={formatCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                title="Format Code"
              >
                <Type className="w-4 h-4" />
                Format
              </button>
              <button
                onClick={findAndReplace}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                title="Find & Replace"
              >
                <Search className="w-4 h-4" />
                Find
              </button>
              <button
                onClick={undo}
                className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100"
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100"
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-gray-300"></div>

              {/* Snippets Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSnippets(!showSnippets)
                    setShowVariables(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Layout className="w-4 h-4" />
                  Snippets
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showSnippets && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-96 overflow-auto">
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        placeholder="Search snippets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="p-1">
                      {emailSnippets
                        .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((snippet, idx) => (
                          <button
                            key={idx}
                            onClick={() => insertSnippet(snippet.code)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded"
                          >
                            <div className="font-medium">{snippet.name}</div>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Variables Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowVariables(!showVariables)
                    setShowSnippets(false)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Zap className="w-4 h-4" />
                  Variables
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showVariables && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-96 overflow-auto">
                    <div className="p-2 border-b border-gray-200 text-xs text-gray-500">
                      Click to insert at cursor
                    </div>
                    <div className="p-1">
                      {templateVariables.map((variable, idx) => (
                        <button
                          key={idx}
                          onClick={() => insertVariable(variable.code)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center justify-between"
                        >
                          <span>{variable.name}</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{variable.code}</code>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Code className="w-4 h-4" />
          <span>HTML Editor</span>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(showSnippets || showVariables) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowSnippets(false)
            setShowVariables(false)
            setSearchQuery("")
          }}
        />
      )}

      {/* Editor and Preview - Tab-based view */}
      <div className="flex-1 overflow-hidden">
        {/* Source View - Code Editor */}
        {viewMode === "source" && (
          <div className="h-full w-full overflow-x-auto">
            <Editor
              height="100%"
              defaultLanguage="html"
              value={htmlContent}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "off", // Disable word wrap to allow horizontal scrolling
                automaticLayout: true,
                tabSize: 2,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                acceptSuggestionOnEnter: "on",
                snippetSuggestions: "top",
                scrollBeyondLastLine: false,
                horizontalScrollbarSize: 12,
              }}
            />
          </div>
        )}

        {/* Preview View */}
        {viewMode === "preview" && (
          <div className="h-full w-full bg-gray-50 overflow-auto p-4">
            <div
              className={`bg-white rounded-lg shadow-sm mx-auto overflow-hidden relative ${
                previewMode === "mobile" ? "max-w-sm" : "max-w-full"
              }`}
            >
              {previewError ? (
                <div className="p-8 text-center">
                  <p className="text-red-600 mb-2">Preview Error</p>
                  <p className="text-sm text-gray-600">{previewError}</p>
                  <button
                    onClick={() => {
                      setPreviewError(null)
                      const html = getPreviewHtml()
                      setPreviewHtml(html)
                    }}
                    className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                  >
                    Retry Preview
                  </button>
                </div>
              ) : previewHtml ? (
                <iframe
                  key={`preview-${previewMode}`}
                  ref={iframeRef}
                  src="about:blank"
                  className="w-full border-0 rounded"
                  style={{
                    minHeight: "600px",
                    height: "600px",
                    display: "block",
                    width: "100%",
                    backgroundColor: "#ffffff",
                  }}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                  onError={(e) => {
                    console.error("Iframe load error:", e)
                    setPreviewError("Failed to load preview")
                  }}
                  onLoad={(e) => {
                    // Prevent infinite loop - only write if not already writing and content has changed
                    if (isWritingRef.current || !previewHtml) return
                    
                    setPreviewError(null)
                    
                    // Write directly to iframe document
                    const writeContent = () => {
                      try {
                        const iframe = e.target as HTMLIFrameElement
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                        
                        if (iframeDoc && previewHtml) {
                          // Check if content is already the same
                          const currentHtml = iframeDoc.documentElement.outerHTML || ""
                          if (currentHtml.includes(previewHtml.substring(0, 200))) {
                            // Content already matches, just resize
                            setTimeout(() => {
                              try {
                                const body = iframeDoc.body
                                if (body) {
                                  const height = Math.max(body.scrollHeight || 600, body.offsetHeight || 600)
                                  iframe.style.height = `${height}px`
                                }
                              } catch (err) {
                                console.error("Error resizing:", err)
                              }
                            }, 100)
                            return
                          }
                          
                          isWritingRef.current = true
                          iframeDoc.open()
                          iframeDoc.write(previewHtml)
                          iframeDoc.close()
                          
                          // Wait for content to render, then resize
                          setTimeout(() => {
                            try {
                              const body = iframeDoc.body
                              const html = iframeDoc.documentElement
                              if (body) {
                                // Force a reflow to ensure content is measured correctly
                                body.offsetHeight
                                
                                // Get actual content height
                                const bodyHeight = body.scrollHeight || body.offsetHeight || 0
                                const htmlHeight = html.scrollHeight || html.offsetHeight || 0
                                const contentHeight = Math.max(bodyHeight, htmlHeight, 600)
                                
                                iframe.style.height = `${contentHeight}px`
                              }
                            } catch (error) {
                              console.error("Could not auto-resize iframe:", error)
                            } finally {
                              isWritingRef.current = false
                            }
                          }, 300)
                        } else {
                          setPreviewError("Cannot access iframe document")
                          isWritingRef.current = false
                        }
                      } catch (error) {
                        console.error("Error writing to iframe:", error)
                        setPreviewError("Failed to render preview content")
                        isWritingRef.current = false
                      }
                    }
                    
                    // Small delay to ensure iframe is fully ready
                    setTimeout(writeContent, 50)
                  }}
                />
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
                  <p className="text-sm">Generating preview...</p>
                  <p className="text-xs mt-2 text-gray-400">HTML length: {htmlContent.length}</p>
                </div>
              )}
            </div>
            {!htmlContent && !previewError && (
              <div className="text-center py-12 text-gray-500">
                <p>No content to preview</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
