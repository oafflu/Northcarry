"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Send, Mail, FileText, Eye, EyeOff, Calendar, Clock, Edit } from "lucide-react"
import { getEmailSegments, type EmailSegment } from "@/app/actions/email-segments"
import { getEmailCampaignById, updateEmailCampaign, sendCampaignTestEmail, sendEmailCampaign, unscheduleEmailCampaign } from "@/app/actions/email-campaigns"
import { getAllCustomersCount } from "@/app/actions/email-subscribers"
import { getEmailTemplates, getEmailTemplateById, incrementTemplateUsage, type EmailTemplate } from "@/app/actions/email-templates"
import { getDefaultScheduleTimezone } from "@/app/actions/settings"
import {
  CAMPAIGN_SCHEDULE_TIMEZONES,
  localDateTimeInTimezoneToISO,
  getMinDateTimeInTimezone,
  isoToLocalDateTimeInTimezone,
} from "@/lib/campaign-schedule-timezone"
import { toast } from "sonner"

export default function EditCampaignPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params?.id as string
  
  const [campaignName, setCampaignName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [content, setContent] = useState("")
  const [recipientType, setRecipientType] = useState<"all" | "all_customers" | "segment" | "custom">("all")
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [segments, setSegments] = useState<EmailSegment[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customersCount, setCustomersCount] = useState<number>(0)
  const [subscribersCount, setSubscribersCount] = useState<number>(0)
  const [showPreview, setShowPreview] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [sendingTest, setSendingTest] = useState(false)
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [scheduleTimezone, setScheduleTimezone] = useState<string>("America/New_York")
  const [customRecipients, setCustomRecipients] = useState("")
  const [campaignStatus, setCampaignStatus] = useState<string>("draft")
  const [sentCount, setSentCount] = useState<number>(0)
  const [totalRecipients, setTotalRecipients] = useState<number>(0)

  useEffect(() => {
    if (campaignId) {
      loadCampaign()
    }
    loadData()
  }, [campaignId])

  // Auto-refresh sent count when campaign is sending so progress is visible without manual refresh
  useEffect(() => {
    if (!campaignId || campaignStatus !== 'sending') return
    const interval = setInterval(() => loadCampaign(), 30 * 1000) // every 30 seconds
    return () => clearInterval(interval)
  }, [campaignId, campaignStatus])

  const loadCampaign = async () => {
    if (!campaignId) return
    
    setLoading(true)
    try {
      const [result, defaultTz] = await Promise.all([
        getEmailCampaignById(campaignId),
        getDefaultScheduleTimezone(),
      ])
      if (defaultTz) setScheduleTimezone(defaultTz)
      if (result.success && result.data) {
        const campaign = result.data
        setCampaignName(campaign.name)
        setSubject(campaign.subject)
        setPreheader(campaign.preview_text || "")
        setContent(campaign.html_content || "")
        setRecipientType(campaign.recipient_type as "all" | "all_customers" | "segment" | "custom")
        setSelectedSegmentId(campaign.segment_id || "")
        setSelectedTemplateId(campaign.template_id || "")
        setCampaignStatus(campaign.status)
        setSentCount(campaign.sent_count || 0)
        setTotalRecipients(campaign.total_recipients || 0)

        const campaignTz =
          (campaign.content && typeof campaign.content === "object" && (campaign.content as any).schedule_timezone) ||
          defaultTz ||
          "America/New_York"
        setScheduleTimezone(campaignTz)
        
        if (campaign.recipient_list && Array.isArray(campaign.recipient_list)) {
          setCustomRecipients(campaign.recipient_list.join("\n"))
        }
        
        if (campaign.scheduled_at) {
          setScheduleType("later")
          const { date, time } = isoToLocalDateTimeInTimezone(campaign.scheduled_at, campaignTz)
          setScheduledDate(date)
          setScheduledTime(time)
        }
      } else {
        toast.error("Failed to load campaign")
        router.push("/admin/email-marketing")
      }
    } catch (error: any) {
      console.error("Error loading campaign:", error)
      toast.error("Failed to load campaign")
      router.push("/admin/email-marketing")
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    const [segmentsResult, customersResult, templatesResult] = await Promise.all([
      getEmailSegments(undefined, true),
      getAllCustomersCount(),
      getEmailTemplates({ is_active: true }),
    ])
    
    if (segmentsResult.success && segmentsResult.data) {
      setSegments(segmentsResult.data)
    }
    
    if (customersResult.success) {
      setCustomersCount(customersResult.count)
    }
    
    if (templatesResult.success && templatesResult.data) {
      setTemplates(templatesResult.data)
    }
    
    // Get subscribers count
    try {
      const response = await fetch("/api/admin/email-subscribers/count")
      const data = await response.json()
      if (data.success) {
        setSubscribersCount(data.count || 0)
      }
    } catch (error) {
      console.error("Error fetching subscribers count:", error)
    }
  }

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    
    if (!templateId) {
      return
    }

    const result = await getEmailTemplateById(templateId)
    if (result.success && result.data) {
      const template = result.data
      setContent(template.html_content || "")
      if (template.subject) {
        setSubject(template.subject)
      }
      if (template.preview_text) {
        setPreheader(template.preview_text)
      }
    } else {
      toast.error("Failed to load template")
    }
  }

  const handleSaveDraft = async () => {
    if (!campaignName.trim() || !subject.trim()) {
      toast.error("Please fill in campaign name and subject")
      return
    }

    if (recipientType === "segment" && !selectedSegmentId) {
      toast.error("Please select a segment")
      return
    }

    if (recipientType === "custom" && !customRecipients.trim()) {
      toast.error("Please enter at least one email address")
      return
    }

    setSaving(true)
    try {
      const recipientList = recipientType === "custom" 
        ? customRecipients.split("\n").map(e => e.trim()).filter(Boolean)
        : undefined

      const result = await updateEmailCampaign(campaignId, {
        name: campaignName,
        subject: subject,
        preview_text: preheader || undefined,
        html_content: content,
        recipient_type: recipientType,
        segment_id: recipientType === "segment" ? selectedSegmentId : undefined,
        recipient_list: recipientList,
        template_id: selectedTemplateId || undefined,
      })

      if (result.success) {
        toast.success("Campaign updated successfully")
        router.push("/admin/email-marketing")
      } else {
        toast.error(result.error || "Failed to update campaign")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update campaign")
    } finally {
      setSaving(false)
    }
  }

  const handleSendCampaign = async () => {
    if (!campaignName.trim() || !subject.trim()) {
      toast.error("Please fill in campaign name and subject")
      return
    }

    if (recipientType === "segment" && !selectedSegmentId) {
      toast.error("Please select a segment")
      return
    }

    if (recipientType === "custom" && !customRecipients.trim()) {
      toast.error("Please enter at least one email address")
      return
    }

    if (!content.trim()) {
      toast.error("Please add email content or select a template")
      return
    }

    if (scheduleType === "later") {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Please select a date and time for scheduling")
        return
      }
    }

    // Get recipient count for confirmation message
    let recipientCount = 0
    if (recipientType === "all" || recipientType === "all_customers") {
      recipientCount = subscribersCount || customersCount || 0
    } else if (recipientType === "segment" && selectedSegmentId) {
      // Get subscriber count from selected segment
      const selectedSegment = segments.find(s => s.id === selectedSegmentId)
      recipientCount = selectedSegment?.subscriber_count || 0
    } else if (recipientType === "custom") {
      recipientCount = customRecipients.split("\n").filter(e => e.trim()).length
    }
    
    const confirmMessage = recipientCount > 50000
      ? `This campaign has ${recipientCount.toLocaleString()} recipients. We send up to 50,000 per run; the rest will continue automatically. Continue?`
      : `Are you sure you want to send this campaign to ${recipientCount.toLocaleString()} recipients?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setSaving(true)
    try {
      const recipientList = recipientType === "custom" 
        ? customRecipients.split("\n").map(e => e.trim()).filter(Boolean)
        : undefined

      const scheduledAt = scheduleType === "later" && scheduledDate && scheduledTime
        ? localDateTimeInTimezoneToISO(scheduledDate, scheduledTime, scheduleTimezone)
        : scheduleType === "now"
        ? new Date().toISOString()
        : undefined

      // First update the campaign with latest data
      const updateResult = await updateEmailCampaign(campaignId, {
        name: campaignName,
        subject: subject,
        preview_text: preheader || undefined,
        html_content: content,
        recipient_type: recipientType,
        segment_id: recipientType === "segment" ? selectedSegmentId : undefined,
        recipient_list: recipientList,
        template_id: selectedTemplateId || undefined,
        scheduled_at: scheduledAt,
        scheduled_timezone: scheduleType === "later" && scheduledAt ? scheduleTimezone : undefined,
        status: scheduledAt ? "scheduled" : "draft", // Will be set to "sending" by sendEmailCampaign
      })

      if (!updateResult.success) {
        toast.error(updateResult.error || "Failed to update campaign")
        return
      }

      if (selectedTemplateId) {
        await incrementTemplateUsage(selectedTemplateId)
      }

      // If scheduled for later, just save and return
      if (scheduleType === "later" && scheduledAt) {
        toast.success("Campaign scheduled successfully")
        router.push("/admin/email-marketing")
        return
      }

      // Send the campaign now (stores recipients; first batch runs via process-batch API)
      const sendResult = await sendEmailCampaign(campaignId)
      
      if (sendResult.success) {
        toast.success("Campaign started. Sending first batch...")
        await loadCampaign()
        // Run first batch in this tab so sent_count updates (reliable on serverless)
        if ((sendResult as any).triggerProcessBatch) {
          try {
            const batchRes = await fetch("/api/admin/email-campaigns/process-batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ campaignId }),
            })
            const batchData = await batchRes.json()
            if (batchData.success) {
              await loadCampaign()
              const sent = batchData.sent ?? sendResult.sent
              const total = batchData.total ?? sendResult.total
              if (batchData.done) {
                toast.success(`Campaign completed. Sent ${(sent || 0).toLocaleString()} emails.`)
              } else {
                toast.success(`First batch sent: ${(sent || 0).toLocaleString()} / ${(total || 0).toLocaleString()}. More batches run automatically via cron or Resume.`, { duration: 8000 })
              }
            } else {
              toast.warning(batchData.error || "First batch could not run. Use Resume or wait for cron.")
              await loadCampaign()
            }
          } catch (e) {
            toast.warning("First batch request failed. Use Resume or wait for cron to continue.")
            await loadCampaign()
          }
        }
        router.push("/admin/email-marketing")
      } else {
        toast.error(sendResult.error || "Failed to send campaign")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to send campaign")
    } finally {
      setSaving(false)
    }
  }

  const handleResumeSending = async () => {
    if (!campaignId) return

    const remaining = totalRecipients - sentCount
    if (remaining === 0) {
      toast.error("All emails have already been sent")
      return
    }

    if (!confirm(`Send the next batch to ${Math.min(remaining, 5000).toLocaleString()} recipients? (Cron can also send batches automatically.)`)) {
      return
    }

    setSaving(true)
    try {
      // Run one batch via API so sent_count updates reliably (no fire-and-forget on serverless)
      const res = await fetch("/api/admin/email-campaigns/process-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      })
      const data = await res.json()
      if (data.success) {
        await loadCampaign()
        if (data.done) {
          toast.success(`Campaign completed! Sent ${(data.sent || 0).toLocaleString()} emails.`)
        } else {
          toast.success(`Batch sent: ${(data.sent || 0).toLocaleString()} / ${(data.total || 0).toLocaleString()}. Click Resume again or wait for cron for more.`, { duration: 6000 })
        }
      } else {
        toast.error(data.error || "Failed to send batch")
        await loadCampaign()
      }
    } catch (error: any) {
      console.error("Error resuming campaign:", error)
      toast.error(error.message || "Failed to send batch")
      await loadCampaign()
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!campaignName.trim() || !subject.trim()) {
      toast.error("Please fill in campaign name and subject")
      return
    }

    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }

    if (!content.trim()) {
      toast.error("Please add email content or select a template")
      return
    }

    setSendingTest(true)
    try {
      const result = await sendCampaignTestEmail(testEmail, subject, content)
      
      if (result.success) {
        toast.success(result.message || "Test email sent successfully!")
        setTestEmail("")
      } else {
        toast.error(result.error || "Failed to send test email")
      }
    } catch (error: any) {
      console.error("Error sending test email:", error)
      toast.error(error.message || "Failed to send test email")
    } finally {
      setSendingTest(false)
    }
  }

  const minDateTime = getMinDateTimeInTimezone(scheduleTimezone)

  const handleCancelSchedule = async () => {
    if (!campaignId || campaignStatus !== "scheduled") return
    if (!confirm("Cancel this scheduled send? The campaign will return to draft.")) return
    const result = await unscheduleEmailCampaign(campaignId)
    if (result.success) {
      toast.success("Schedule cancelled")
      setCampaignStatus("draft")
      setScheduleType("now")
      setScheduledDate("")
      setScheduledTime("")
    } else {
      toast.error(result.error || "Failed to cancel schedule")
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/email-marketing" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Edit Campaign</h1>
          <p className="text-gray-600 mt-1">Update and send email campaigns</p>
        </div>
        {/* Sent progress: visible when campaign has recipients and is sending or sent */}
        {totalRecipients > 0 && (campaignStatus === 'sending' || campaignStatus === 'sent') && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm">
            <span className="font-medium text-gray-700">Sent </span>
            <span className="font-semibold text-teal-700">{sentCount.toLocaleString()}</span>
            <span className="text-gray-600"> / {totalRecipients.toLocaleString()}</span>
            {campaignStatus === 'sending' && (
              <span className="ml-2 text-gray-500">(updates every 30s)</span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g., Summer Sale 2025"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="The email subject line"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preheader Text</label>
                <input
                  type="text"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  placeholder="Preview text that appears after subject"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Start from scratch</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.category ? `(${template.category})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Email content */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Email Content</h2>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Show Preview
                  </>
                )}
              </button>
            </div>
            {showPreview ? (
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 overflow-auto max-h-[600px]">
                <div 
                  className="email-preview"
                  style={{ 
                    maxWidth: '100%',
                    margin: '0 auto',
                  }}
                  dangerouslySetInnerHTML={{ __html: content || "<p style='color: #6b7280; padding: 20px; text-align: center;'>No content to preview</p>" }}
                />
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                placeholder="Write your email content here (HTML supported)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-sm"
              />
            )}
            <p className="mt-2 text-xs text-gray-500">
              {showPreview ? "Preview mode" : "HTML editor mode - You can paste HTML code here"}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Recipients */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Type</label>
                <select
                  value={recipientType}
                  onChange={(e) => {
                    setRecipientType(e.target.value as "all" | "all_customers" | "segment" | "custom")
                    if (e.target.value !== "segment") {
                      setSelectedSegmentId("")
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="all">All Subscribers ({subscribersCount.toLocaleString()})</option>
                  <option value="all_customers">All Customers ({customersCount.toLocaleString()})</option>
                  <option value="segment">Segment</option>
                  <option value="custom">Custom List</option>
                </select>
              </div>

              {recipientType === "segment" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Segment</label>
                  {segments.length === 0 ? (
                    <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-500">
                      No segments available.{" "}
                      <Link href="/admin/email-marketing/segments" className="text-teal-600 hover:text-teal-700 underline">
                        Create a segment
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={selectedSegmentId}
                      onChange={(e) => setSelectedSegmentId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select a segment...</option>
                      {segments.map((segment) => (
                        <option key={segment.id} value={segment.id}>
                          {segment.name} ({(segment.subscriber_count ?? 0).toLocaleString()} subscribers)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {recipientType === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Custom Recipients</label>
                  <textarea
                    value={customRecipients}
                    onChange={(e) => setCustomRecipients(e.target.value)}
                    placeholder="Enter email addresses, one per line..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter email addresses separated by new lines</p>
                </div>
              )}
            </div>
          </div>

          {/* Scheduling - Show for draft and scheduled campaigns */}
          {(campaignStatus === "draft" || campaignStatus === "scheduled") && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Send Time</label>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value as "now" | "later")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="now">Send Now</option>
                    <option value="later">Schedule for Later</option>
                  </select>
                </div>

                {scheduleType === "later" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select
                        value={scheduleTimezone}
                        onChange={(e) => setScheduleTimezone(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      >
                        {CAMPAIGN_SCHEDULE_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Date and time below are in this timezone</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={minDateTime.date}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        min={scheduledDate === minDateTime.date ? minDateTime.time : undefined}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Test Email */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Email</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Test Email Address</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail.trim() || !subject.trim() || !content.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                {sendingTest ? "Sending..." : "Send Test Email"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <button
              onClick={handleSaveDraft}
              disabled={saving || !campaignName.trim() || !subject.trim()}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            
            {/* Show send/schedule options for draft and scheduled campaigns */}
            {campaignStatus === "scheduled" && (
              <button
                type="button"
                onClick={handleCancelSchedule}
                className="w-full px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 font-medium"
              >
                Cancel schedule
              </button>
            )}
            {(campaignStatus === "draft" || campaignStatus === "scheduled") && (
              <button
                onClick={handleSendCampaign}
                disabled={
                  saving || 
                  !campaignName.trim() || 
                  !subject.trim() || 
                  !content.trim() ||
                  (recipientType === "segment" && !selectedSegmentId) ||
                  (recipientType === "custom" && !customRecipients.trim()) ||
                  (scheduleType === "later" && (!scheduledDate || !scheduledTime))
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {scheduleType === "later" ? "Schedule Campaign" : "Send Campaign Now"}
              </button>
            )}
            
            {/* Show resume button for partially sent campaigns (status: sending or sent but incomplete) */}
            {(campaignStatus === "sending" || (campaignStatus === "sent" && sentCount < totalRecipients)) && sentCount < totalRecipients && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Campaign partially sent:</strong> {sentCount.toLocaleString()} of {totalRecipients.toLocaleString()} emails sent.
                    <br />
                    <span className="text-xs">Remaining: {(totalRecipients - sentCount).toLocaleString()} emails</span>
                  </p>
                </div>
                <button
                  onClick={handleResumeSending}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {saving ? "Resuming..." : `Resume Sending (${(totalRecipients - sentCount).toLocaleString()} remaining)`}
                </button>
              </div>
            )}
            
            {/* Show status for fully sent campaigns */}
            {campaignStatus === "sent" && sentCount >= totalRecipients && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Campaign sent successfully!</strong>
                  <br />
                  <span className="text-xs">Sent {sentCount.toLocaleString()} of {totalRecipients.toLocaleString()} emails</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

