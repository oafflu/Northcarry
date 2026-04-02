"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Save, Clock, ShoppingCart, Package, Gift, Zap, UserPlus, Calendar } from "lucide-react"
import { createEmailAutomation, type CreateAutomationInput, type AutomationStep } from "@/app/actions/email-automations"
import { getEmailTemplates, type EmailTemplate } from "@/app/actions/email-templates"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

const triggerTypes = [
  { value: "new_subscriber", label: "New Subscriber", icon: UserPlus, description: "Triggered when a new subscriber joins your list" },
  { value: "abandoned_cart", label: "Abandoned Cart", icon: ShoppingCart, description: "Triggered when a customer abandons their cart" },
  { value: "post_purchase", label: "Post Purchase", icon: Package, description: "Triggered after a customer completes a purchase" },
  { value: "win_back", label: "Win Back", icon: Gift, description: "Triggered to re-engage inactive customers" },
  { value: "birthday", label: "Birthday", icon: Calendar, description: "Triggered on a customer's birthday" },
  { value: "custom", label: "Custom", icon: Zap, description: "Custom trigger with specific conditions" },
]

export default function NewAutomationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<string>("new_subscriber")
  const [triggerConfig, setTriggerConfig] = useState<any>({})
  const [steps, setSteps] = useState<Omit<AutomationStep, "id" | "automation_id" | "created_at">[]>([
    {
      step_order: 1,
      delay_hours: 0,
      subject: "",
      content: {},
      html_content: "",
    },
  ])

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoadingTemplates(true)
    const result = await getEmailTemplates({ is_active: true })
    if (result.success && result.data) {
      setTemplates(result.data)
    }
    setLoadingTemplates(false)
  }

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_order: steps.length + 1,
        delay_hours: 0,
        subject: "",
        content: {},
        html_content: "",
      },
    ])
  }

  const removeStep = (index: number) => {
    if (steps.length === 1) {
      toast.error("At least one step is required")
      return
    }
    const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      step_order: i + 1,
    }))
    setSteps(newSteps)
  }

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  const updateTriggerConfig = (field: string, value: any) => {
    setTriggerConfig({ ...triggerConfig, [field]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Please enter an automation name")
      return
    }

    if (steps.some((step) => !step.subject.trim())) {
      toast.error("All steps must have a subject")
      return
    }

    setLoading(true)
    try {
      const input: CreateAutomationInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        steps: steps.map((step, index) => ({
          step_order: index + 1,
          delay_hours: step.delay_hours || 0,
          template_id: step.template_id || undefined,
          subject: step.subject,
          content: step.content || {},
          html_content: step.html_content || undefined,
        })),
      }

      const result = await createEmailAutomation(input, user?.id)
      if (result.success) {
        toast.success("Automation created successfully")
        router.push("/admin/email-marketing/automations")
      } else {
        toast.error(result.error || "Failed to create automation")
      }
    } catch (error: any) {
      console.error("Error creating automation:", error)
      toast.error(error.message || "Failed to create automation")
    } finally {
      setLoading(false)
    }
  }

  const selectedTrigger = triggerTypes.find((t) => t.value === triggerType)

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/email-marketing/automations"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Automation</h1>
            <p className="text-gray-600 mt-1">Set up an automated email flow for your customers</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Automation Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome Series, Abandoned Cart Recovery"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this automation does..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Trigger</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {triggerTypes.map((trigger) => {
                  const Icon = trigger.icon
                  return (
                    <button
                      key={trigger.value}
                      type="button"
                      onClick={() => setTriggerType(trigger.value)}
                      className={`p-4 border-2 rounded-lg text-left transition-all ${
                        triggerType === trigger.value
                          ? "border-teal-600 bg-teal-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className={`w-5 h-5 ${triggerType === trigger.value ? "text-teal-600" : "text-gray-400"}`} />
                        <span className={`font-medium ${triggerType === trigger.value ? "text-teal-900" : "text-gray-900"}`}>
                          {trigger.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{trigger.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Trigger-specific configuration */}
            {triggerType === "abandoned_cart" && (
              <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delay (hours) before first email
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={triggerConfig.delay_hours || 0}
                    onChange={(e) => updateTriggerConfig("delay_hours", parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum cart value ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={triggerConfig.min_cart_value || ""}
                    onChange={(e) => updateTriggerConfig("min_cart_value", parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {triggerType === "post_purchase" && (
              <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delay (hours) after purchase
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={triggerConfig.delay_hours || 0}
                    onChange={(e) => updateTriggerConfig("delay_hours", parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {triggerType === "win_back" && (
              <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days of inactivity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={triggerConfig.days_inactive || 30}
                    onChange={(e) => updateTriggerConfig("days_inactive", parseInt(e.target.value) || 30)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {triggerType === "custom" && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Trigger Configuration (JSON)
                </label>
                <textarea
                  value={JSON.stringify(triggerConfig, null, 2)}
                  onChange={(e) => {
                    try {
                      setTriggerConfig(JSON.parse(e.target.value))
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-teal-500"
                  placeholder='{"condition": "value"}'
                />
              </div>
            )}
          </div>
        </div>

        {/* Automation Steps */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Email Steps</h2>
            <button
              type="button"
              onClick={addStep}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-semibold">
                      {index + 1}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Step {index + 1}</h3>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delay (hours) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          min="0"
                          value={step.delay_hours || 0}
                          onChange={(e) => updateStep(index, "delay_hours", parseInt(e.target.value) || 0)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {step.delay_hours === 0
                          ? "Sends immediately"
                          : step.delay_hours === 1
                            ? "Sends 1 hour after trigger"
                            : `Sends ${step.delay_hours} hours after trigger`}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Template (optional)
                      </label>
                      {loadingTemplates ? (
                        <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                          <span className="text-sm text-gray-500">Loading templates...</span>
                        </div>
                      ) : (
                        <select
                          value={step.template_id || ""}
                          onChange={(e) => updateStep(index, "template_id", e.target.value || undefined)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">None - Use custom content</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name} {template.subject ? `- ${template.subject}` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={step.subject || ""}
                      onChange={(e) => updateStep(index, "subject", e.target.value)}
                      placeholder="e.g., Welcome to BREVI!"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Content (HTML)
                    </label>
                    <textarea
                      value={step.html_content || ""}
                      onChange={(e) => updateStep(index, "html_content", e.target.value)}
                      placeholder="Enter HTML content for the email..."
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If a template is selected, this will override the template content. Leave empty to use template content.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/email-marketing/automations"
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
          >
            <Save className="w-4 h-4" />
            {loading ? "Creating..." : "Create Automation"}
          </button>
        </div>
      </form>
    </div>
  )
}

