"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Loader2, Plus, Trash2, Mail, Clock, Send, Eye } from "lucide-react"
import { getEmailAutomationById, updateEmailAutomation, deleteEmailAutomation } from "@/app/actions/email-automations"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export default function EditAutomationPage() {
  const params = useParams()
  const router = useRouter()
  const automationId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [automation, setAutomation] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])

  useEffect(() => {
    if (automationId) {
      loadAutomation()
    }
  }, [automationId])

  const loadAutomation = async () => {
    setLoading(true)
    try {
      const result = await getEmailAutomationById(automationId)
      if (result.success && result.data) {
        setAutomation(result.data)
        setSteps(result.data.steps || [])
      } else {
        toast.error(result.error || "Failed to load automation")
        router.push("/admin/email-marketing/automations")
      }
    } catch (error: any) {
      console.error("Error loading automation:", error)
      toast.error("Failed to load automation")
      router.push("/admin/email-marketing/automations")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!automation) return

    setSaving(true)
    try {
      const result = await updateEmailAutomation(automationId, {
        name: automation.name,
        description: automation.description,
        trigger_type: automation.trigger_type,
        is_active: automation.is_active,
      })

      if (result.success) {
        toast.success("Automation updated successfully")
        router.push("/admin/email-marketing/automations")
      } else {
        toast.error(result.error || "Failed to update automation")
      }
    } catch (error: any) {
      console.error("Error updating automation:", error)
      toast.error(error.message || "Failed to update automation")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this automation? This action cannot be undone.")) {
      return
    }

    try {
      const result = await deleteEmailAutomation(automationId)
      if (result.success) {
        toast.success("Automation deleted successfully")
        router.push("/admin/email-marketing/automations")
      } else {
        toast.error(result.error || "Failed to delete automation")
      }
    } catch (error: any) {
      console.error("Error deleting automation:", error)
      toast.error(error.message || "Failed to delete automation")
    }
  }

  const handleTestEmail = async (stepId: string) => {
    const testEmail = prompt("Enter email address to send test:")
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }

    try {
      const { executeAutomationStep } = await import("@/app/actions/email-automations")
      const result = await executeAutomationStep(
        automationId,
        stepId,
        testEmail,
        "Test User"
      )

      if (result.success) {
        toast.success("Test email sent successfully!")
      } else {
        toast.error(result.error || "Failed to send test email")
      }
    } catch (error: any) {
      console.error("Error sending test email:", error)
      toast.error(error.message || "Failed to send test email")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!automation) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Automation not found</p>
          <Link href="/admin/email-marketing/automations">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Automations
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/email-marketing/automations">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Automations
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{automation.name}</h1>
            <p className="text-gray-600 mt-1">{automation.description || "Edit automation details"}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Automation Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4">Automation Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <Input
                  value={automation.name || ""}
                  onChange={(e) => setAutomation({ ...automation, name: e.target.value })}
                  placeholder="Automation name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <Textarea
                  value={automation.description || ""}
                  onChange={(e) => setAutomation({ ...automation, description: e.target.value })}
                  placeholder="Automation description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
                <Input
                  value={automation.trigger_type || ""}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={automation.is_active || false}
                  onChange={(e) => setAutomation({ ...automation, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Email Steps</h2>
            </div>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-teal-600" />
                      <span className="font-medium">Step {step.step_order || index + 1}</span>
                      {step.delay_hours > 0 && (
                        <span className="text-sm text-gray-500">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {step.delay_hours}h delay
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={() => handleTestEmail(step.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Test Email
                    </Button>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Subject: {step.subject || "No subject"}</p>
                    {step.html_content && (
                      <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-600 max-h-32 overflow-y-auto">
                        {step.html_content.substring(0, 200)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {steps.length === 0 && (
                <p className="text-gray-500 text-center py-8">No steps configured for this automation</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-4">Statistics</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Sent</p>
                <p className="text-2xl font-bold">{automation.total_sent || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Open Rate</p>
                <p className="text-2xl font-bold">{automation.open_rate ? `${automation.open_rate}%` : "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Steps</p>
                <p className="text-2xl font-bold">{steps.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

