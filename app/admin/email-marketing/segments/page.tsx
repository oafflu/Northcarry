"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Plus, Users, Filter, Edit, Trash2, Copy, Search, X, Check } from "lucide-react"
import { getEmailSegments, deleteEmailSegment, createEmailSegment, updateEmailSegment, type EmailSegment } from "@/app/actions/email-segments"
import { toast } from "sonner"

interface SegmentCondition {
  field: string
  operator: string
  value: string | number
}

const FIELD_OPTIONS = [
  { value: "is_customer", label: "Is a customer" },
  { value: "total_spent", label: "Total Spent" },
  { value: "total_orders", label: "Total Orders" },
  { value: "last_purchase_date", label: "Last Purchase Date" },
  { value: "product_purchased", label: "Product Purchased" },
  { value: "newsletter_status", label: "Marketing emails (subscribed / unsubscribed)" },
  { value: "country", label: "Country" },
  { value: "has_abandoned_cart", label: "Has Abandoned Cart" },
  { value: "has_subscription", label: "Has Subscription" },
]

const OPERATOR_OPTIONS = [
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "within_days", label: "Within days" },
]

export default function SegmentsPage() {
  const [segments, setSegments] = useState<EmailSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedSegment, setSelectedSegment] = useState<EmailSegment | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [segmentName, setSegmentName] = useState("")
  const [segmentDescription, setSegmentDescription] = useState("")
  const [conditions, setConditions] = useState<SegmentCondition[]>([
    { field: "total_spent", operator: "greater_than", value: "" }
  ])
  
  const nameInputRef = useRef<HTMLInputElement>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    setLoading(true)
    const result = await getEmailSegments(searchQuery || undefined, true)
    if (result.success && result.data) {
      setSegments(result.data)
    } else {
      toast.error(result.error || "Failed to load segments")
    }
    setLoading(false)
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadSegments()
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this segment?")) return

    const result = await deleteEmailSegment(id)
    if (result.success) {
      toast.success("Segment deleted successfully")
      loadSegments()
    } else {
      toast.error(result.error || "Failed to delete segment")
    }
  }

  const handleDuplicate = async (segment: EmailSegment) => {
    try {
      const result = await createEmailSegment({
        name: `${segment.name} (Copy)`,
        description: segment.description,
        conditions: segment.conditions || [],
      })
      
      if (result.success) {
        toast.success("Segment duplicated successfully")
        loadSegments()
      } else {
        toast.error(result.error || "Failed to duplicate segment")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to duplicate segment")
    }
  }

  const handleEdit = (segment: EmailSegment) => {
    setSelectedSegment(segment)
    setSegmentName(segment.name)
    setSegmentDescription(segment.description || "")
    setConditions(Array.isArray(segment.conditions) && segment.conditions.length > 0 
      ? segment.conditions as SegmentCondition[]
      : [{ field: "total_spent", operator: "greater_than", value: "" }]
    )
    setShowCreateModal(true)
  }

  const handleAddCondition = () => {
    setConditions([...conditions, { field: "total_spent", operator: "greater_than", value: "" }])
  }

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const handleConditionChange = (index: number, field: keyof SegmentCondition, value: string | number) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-set operator for boolean fields
    if (field === "field" && (value === "is_customer" || value === "has_abandoned_cart" || value === "has_subscription")) {
      updated[index].operator = "equals"
      updated[index].value = true
    }
    if (field === "field" && value === "newsletter_status") {
      updated[index].operator = "equals"
      updated[index].value = "unsubscribed"
    }
    
    setConditions(updated)
  }

  const handleSave = async () => {
    if (!segmentName.trim()) {
      toast.error("Please enter a segment name")
      return
    }

    // Validate conditions
    const validConditions = conditions.filter(c => {
      if (c.field === "has_abandoned_cart" || c.field === "is_customer" || c.field === "has_subscription") {
        return true // Boolean fields don't need a value
      }
      if (c.field === "newsletter_status") {
        const v = String(c.value ?? "").toLowerCase()
        return v === "active" || v === "unsubscribed" || v === "subscribed" || v === "opted_out" || v === "true" || v === "false"
      }
      return c.value !== "" && c.value !== null && c.value !== undefined
    })

    if (validConditions.length === 0) {
      toast.error("Please add at least one valid condition")
      return
    }

    setSaving(true)
    try {
      if (selectedSegment) {
        // Update existing segment
        const result = await updateEmailSegment(selectedSegment.id, {
          name: segmentName,
          description: segmentDescription || undefined,
          conditions: validConditions,
        })

        if (result.success) {
          toast.success("Segment updated successfully")
          setShowCreateModal(false)
          setSelectedSegment(null)
          resetForm()
          loadSegments()
        } else {
          toast.error(result.error || "Failed to update segment")
        }
      } else {
        // Create new segment
        const result = await createEmailSegment({
          name: segmentName,
          description: segmentDescription || undefined,
          conditions: validConditions,
        })

        if (result.success) {
          toast.success("Segment created successfully")
          setShowCreateModal(false)
          resetForm()
          loadSegments()
        } else {
          toast.error(result.error || "Failed to create segment")
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save segment")
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSegmentName("")
    setSegmentDescription("")
    setConditions([{ field: "total_spent", operator: "greater_than", value: "" }])
    setSelectedSegment(null)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setSelectedSegment(null)
    resetForm()
  }

  const filteredSegments = segments.filter((segment) =>
    segment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    segment.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Segments</h1>
          <p className="text-gray-600 mt-1">Create and manage customer segments for targeted campaigns</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Segment
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search segments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading segments...</p>
        </div>
      )}

      {/* Segments Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSegments.map((segment) => (
          <div
            key={segment.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/admin/email-marketing/segments/${segment.id}`}
                    className="font-semibold text-gray-900 hover:text-teal-600 block truncate"
                  >
                    {segment.name}
                  </Link>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{segment.description}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Subscribers</span>
                <span className="text-lg font-semibold text-gray-900">{(segment.subscriber_count ?? 0).toLocaleString()}</span>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Filter className="w-4 h-4" />
                  <span className="font-medium">Conditions:</span>
                </div>
                {Array.isArray(segment.conditions) && segment.conditions.length > 0 ? (
                  segment.conditions.map((condition: SegmentCondition, idx: number) => (
                    <div key={idx} className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 mb-1">
                      {condition.field === "newsletter_status"
                        ? `Marketing: ${String(condition.value).toLowerCase() === "unsubscribed" || String(condition.value).toLowerCase() === "opted_out" ? "unsubscribed" : "subscribed"}`
                        : `${condition.field} ${condition.operator} ${String(condition.value)}`}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400 italic">No conditions set</div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                <Link
                  href={`/admin/email-marketing/segments/${segment.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  View list
                </Link>
                <button
                  onClick={() => handleEdit(segment)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDuplicate(segment)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(segment.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Empty State */}
      {filteredSegments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No segments found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ? "Try adjusting your search query" : "Get started by creating your first segment"}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Segment
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedSegment ? "Edit Segment" : "Create New Segment"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Segment Name *</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  placeholder="e.g., High Value Customers"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  ref={descriptionInputRef}
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                  placeholder="Describe this segment..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conditions *</label>
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg">
                      <select
                        value={condition.field}
                        onChange={(e) => handleConditionChange(index, "field", e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                      >
                        {FIELD_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => handleConditionChange(index, "operator", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        disabled={
                          condition.field === "is_customer" ||
                          condition.field === "has_abandoned_cart" ||
                          condition.field === "has_subscription" ||
                          condition.field === "newsletter_status"
                        }
                      >
                        {OPERATOR_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {condition.field !== "has_abandoned_cart" &&
                        condition.field !== "is_customer" &&
                        condition.field !== "has_subscription" &&
                        condition.field !== "newsletter_status" && (
                        <input
                          type={condition.field === "last_purchase_date" || condition.operator === "within_days" ? "number" : "text"}
                          value={condition.value}
                          onChange={(e) => {
                            const val = condition.field === "last_purchase_date" || condition.operator === "within_days"
                              ? parseFloat(e.target.value) || 0
                              : e.target.value
                            handleConditionChange(index, "value", val)
                          }}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        />
                      )}
                      {condition.field === "is_customer" && (
                        <div className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                          All customers with valid email addresses
                        </div>
                      )}
                      {condition.field === "has_subscription" && (
                        <div className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                          All customers with active subscriptions
                        </div>
                      )}
                      {condition.field === "newsletter_status" && (
                        <select
                          value={String(condition.value || "unsubscribed")}
                          onChange={(e) => handleConditionChange(index, "value", e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="unsubscribed">Unsubscribed (opted out of marketing)</option>
                          <option value="active">Subscribed (marketing on)</option>
                        </select>
                      )}
                      {conditions.length > 1 && (
                        <button
                          onClick={() => handleRemoveCondition(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                          type="button"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handleAddCondition}
                    type="button"
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    + Add Condition
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : selectedSegment ? "Update Segment" : "Create Segment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

