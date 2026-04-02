"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Mail, Clock, Users, ChevronRight, Play, Pause, Edit, Trash2, Bolt, ShoppingCart, Package, Gift, Eye, Send } from "lucide-react"
import { getEmailAutomations, toggleAutomationStatus, deleteEmailAutomation, type EmailAutomation } from "@/app/actions/email-automations"
import { toast } from "sonner"

const triggerIcons: Record<string, typeof Mail> = {
  new_subscriber: Mail,
  abandoned_cart: ShoppingCart,
  post_purchase: Package,
  win_back: Gift,
  birthday: Gift,
  custom: Bolt,
}

export default function AutomationsPage() {
  const [allAutomations, setAllAutomations] = useState<(EmailAutomation & { steps: any[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all")

  useEffect(() => {
    loadAutomations()
  }, [])

  const loadAutomations = async () => {
    setLoading(true)
    // Always load all automations to get accurate counts
    const result = await getEmailAutomations()
    if (result.success && result.data) {
      setAllAutomations(result.data as any)
    } else {
      toast.error(result.error || "Failed to load automations")
    }
    setLoading(false)
  }

  // Filter automations based on selected filter
  const filteredAutomations = filter === "all" 
    ? allAutomations 
    : filter === "active" 
    ? allAutomations.filter(a => a.is_active)
    : allAutomations.filter(a => !a.is_active)

  // Extract promotion codes from automation steps
  const getPromotionCodes = (automation: EmailAutomation & { steps: any[] }) => {
    const codes: string[] = []
    automation.steps?.forEach(step => {
      const htmlContent = step.html_content || ""
      // Match common discount code patterns
      const codeMatches = htmlContent.match(/code:\s*([A-Z0-9]+)/gi) || 
                         htmlContent.match(/code\s+([A-Z0-9]+)/gi) ||
                         htmlContent.match(/Use code:\s*([A-Z0-9]+)/gi)
      if (codeMatches) {
        codeMatches.forEach(match => {
          const code = match.replace(/code:?\s*/i, '').trim()
          if (code && !codes.includes(code)) {
            codes.push(code)
          }
        })
      }
    })
    return codes
  }

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const result = await toggleAutomationStatus(id, !currentStatus)
    if (result.success) {
      toast.success(`Automation ${!currentStatus ? "activated" : "paused"}`)
      loadAutomations()
    } else {
      toast.error(result.error || "Failed to update automation")
    }
  }

  const handleCreateTemplates = async () => {
    if (!confirm("This will create 6 pre-built automation templates. Continue?")) {
      return
    }
    
    try {
      const response = await fetch("/api/admin/automations/create-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: null }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to create templates" }))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        let message = `Created ${result.automations.length} automation templates!`
        
        // Show promotion code status
        if (result.promotionCodes) {
          const { created, alreadyExisted } = result.promotionCodes
          if (created.length > 0) {
            message += ` Created ${created.length} promotion code(s): ${created.join(', ')}.`
          }
          if (alreadyExisted.length > 0) {
            message += ` ${alreadyExisted.length} promotion code(s) already existed: ${alreadyExisted.join(', ')}.`
          }
        }
        
        if (result.errors && result.errors.length > 0) {
          message += ` (${result.errors.length} errors)`
          console.error("Template creation errors:", result.errors)
        }
        
        toast.success(message)
        loadAutomations()
      } else {
        toast.error(result.error || "Failed to create templates")
      }
    } catch (error: any) {
      console.error("Error creating templates:", error)
      toast.error(error.message || "Failed to create templates")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return

    const result = await deleteEmailAutomation(id)
    if (result.success) {
      toast.success("Automation deleted successfully")
      loadAutomations()
    } else {
      toast.error(result.error || "Failed to delete automation")
    }
  }

  const handleDeleteOldAutomations = async () => {
    if (!confirm("This will delete automations with hardcoded discount codes (CART10, COMEBACK15, FINAL20, BIRTHDAY20) that were created before the promotion code system. Continue?")) {
      return
    }

    try {
      // Find automations with hardcoded codes
      const oldAutomations = allAutomations.filter(automation => {
        const codes = getPromotionCodes(automation)
        const hardcodedCodes = ['CART10', 'COMEBACK15', 'FINAL20', 'BIRTHDAY20']
        return codes.some(code => hardcodedCodes.includes(code))
      })

      if (oldAutomations.length === 0) {
        toast.info("No old automations with hardcoded codes found")
        return
      }

      // Delete each old automation
      let deleted = 0
      for (const automation of oldAutomations) {
        const result = await deleteEmailAutomation(automation.id)
        if (result.success) {
          deleted++
        }
      }

      toast.success(`Deleted ${deleted} old automation(s)`)
      loadAutomations()
    } catch (error: any) {
      console.error("Error deleting old automations:", error)
      toast.error("Failed to delete old automations")
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Automations</h1>
          <p className="text-gray-600 mt-1">Set up automated email flows for your customers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteOldAutomations}
            className="flex items-center gap-2 px-4 py-2.5 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium"
          >
            <Trash2 className="w-5 h-5" />
            Delete Old Automations
          </button>
          <button
            onClick={handleCreateTemplates}
            className="flex items-center gap-2 px-4 py-2.5 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 font-medium"
          >
            <Bolt className="w-5 h-5" />
            Create All Templates
          </button>
          <Link
            href="/admin/email-marketing/automations/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Automation
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          All ({allAutomations.length})
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "active" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Active ({allAutomations.filter((a) => a.is_active).length})
        </button>
        <button
          onClick={() => setFilter("paused")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "paused" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Paused ({allAutomations.filter((a) => !a.is_active).length})
        </button>
      </div>

      {/* Automations List */}
      <div className="rounded-lg bg-white border border-gray-200 shadow-sm">
        <div className="grid grid-cols-12 gap-4 border-b border-gray-200 px-6 py-4 text-sm font-medium text-gray-600">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Trigger</div>
          <div className="col-span-2">Promotion Codes</div>
          <div className="col-span-1 text-center">Emails</div>
          <div className="col-span-1 text-center">Open Rate</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Loading automations...
            </div>
          ) : filteredAutomations.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {filter === "all" 
                ? "No automations found. Click 'Create All Templates' to get started."
                : filter === "active"
                ? "No active automations found."
                : "No paused automations found."}
            </div>
          ) : (
            filteredAutomations.map((automation) => {
            const TriggerIcon = triggerIcons[automation.trigger_type] || Mail
            const stepCount = automation.steps?.length || 0
            const isActive = automation.is_active
            
            return (
              <div key={automation.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-50">
                <div className="col-span-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
                    <TriggerIcon className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{automation.name}</p>
                    <p className="text-sm text-gray-600">{stepCount} step{stepCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {isActive ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="col-span-2 flex items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <TriggerIcon className="h-4 w-4 text-gray-400" />
                    {automation.trigger_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                </div>

                <div className="col-span-2 flex items-center">
                  {(() => {
                    const codes = getPromotionCodes(automation)
                    if (codes.length === 0) {
                      return <span className="text-sm text-gray-400">No codes</span>
                    }
                    return (
                      <div className="flex flex-wrap gap-1">
                        {codes.map((code, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            title="Promotion code used in this automation"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-900">{automation.total_sent || 0}</span>
                </div>

                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-900">{automation.open_rate ? `${automation.open_rate}%` : "-"}</span>
                </div>

                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button
                    onClick={async () => {
                      const testEmail = prompt("Enter email address to send test:")
                      if (!testEmail || !testEmail.includes("@")) {
                        toast.error("Please enter a valid email address")
                        return
                      }
                      
                      // Get first step
                      const firstStep = automation.steps?.[0]
                      if (!firstStep) {
                        toast.error("No steps found in this automation")
                        return
                      }
                      
                      try {
                        // First, check email configuration for debugging
                        try {
                          const debugResponse = await fetch("/api/admin/email-config/debug")
                          const debugData = await debugResponse.json()
                          console.log("[Test Email] Email Configuration:", debugData)
                          
                          if (debugData.config && !debugData.config.hasMailgunApiKey && !debugData.config.smtpConfigured) {
                            toast.error("Neither Mailgun nor SMTP is properly configured. Please check /admin/settings/email", { duration: 8000 })
                            return
                          }
                        } catch (debugError) {
                          console.warn("Could not fetch email config debug info:", debugError)
                        }
                        
                        const { executeAutomationStep } = await import("@/app/actions/email-automations")
                        const result = await executeAutomationStep(
                          automation.id,
                          firstStep.id,
                          testEmail,
                          "Test User"
                        )
                        
                        if (result.success) {
                          toast.success("Test email sent successfully!")
                        } else {
                          toast.error(result.error || "Failed to send test email", { duration: 8000 })
                        }
                      } catch (error: any) {
                        console.error("Test email error:", error)
                        toast.error(error.message || "Failed to send test email", { duration: 8000 })
                      }
                    }}
                    className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                    title="Send test email"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      const firstStep = automation.steps?.[0]
                      if (!firstStep) {
                        toast.error("No steps found in this automation")
                        return
                      }
                      
                      // Get template content
                      let htmlContent = firstStep.html_content || ""
                      if (firstStep.template_id) {
                        try {
                          const { getEmailTemplateById } = await import("@/app/actions/email-templates")
                          const templateResult = await getEmailTemplateById(firstStep.template_id)
                          if (templateResult.success && templateResult.data) {
                            htmlContent = templateResult.data.html_content || htmlContent
                          }
                        } catch (error) {
                          console.error("Error loading template:", error)
                        }
                      }
                      
                      // Personalize
                      htmlContent = htmlContent.replace(/\{\{name\}\}/g, "Test User")
                      htmlContent = htmlContent.replace(/\{\{firstName\}\}/g, "Test")
                      
                      // Open preview in new window
                      const previewWindow = window.open("", "_blank")
                      if (previewWindow) {
                        previewWindow.document.write(htmlContent)
                        previewWindow.document.close()
                      }
                    }}
                    className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                    title="Preview email"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleStatus(automation.id, isActive)}
                    className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                    title={isActive ? "Pause" : "Resume"}
                  >
                    {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <Link
                    href={`/admin/email-marketing/automations/${automation.id}`}
                    className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(automation.id)}
                    className="rounded-md p-2 text-gray-600 hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          }))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{allAutomations.filter((a) => a.is_active).length}</p>
              <p className="text-sm text-gray-600">Active Automations</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {allAutomations.reduce((sum, a) => sum + (a.total_sent || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">Total Emails Sent</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <ChevronRight className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {allAutomations.length > 0
                  ? (
                      allAutomations.reduce((sum, a) => sum + (a.open_rate || 0), 0) / allAutomations.length
                    ).toFixed(1)
                  : "0"}
                %
              </p>
              <p className="text-sm text-gray-600">Average Open Rate</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
