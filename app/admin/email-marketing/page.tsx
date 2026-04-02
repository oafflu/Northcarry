"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Mail, Users, Send, TrendingUp, FileText, Search, Filter, Edit, Trash2, Copy, Eye, RefreshCw, XCircle } from "lucide-react"
import { getEmailCampaigns, deleteEmailCampaign, unscheduleEmailCampaign, type EmailCampaign } from "@/app/actions/email-campaigns"
import { getEmailAnalytics } from "@/app/actions/email-analytics"
import { syncAllCustomersToSubscribers, getCustomerSubscriberDiagnostics } from "@/app/actions/email-subscribers"
import { getDefaultScheduleTimezone } from "@/app/actions/settings"
import { formatScheduledAtInTimezone } from "@/lib/campaign-schedule-timezone"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function EmailMarketingPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "custom">("30d")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [allCampaigns, setAllCampaigns] = useState<EmailCampaign[]>([])
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [scheduleTimezone, setScheduleTimezone] = useState<string>("America/New_York")

  useEffect(() => {
    if (dateRange === "custom") return
    loadData()
  }, [dateRange])

  const loadData = async () => {
    if (dateRange === "custom" && (!customStart || !customEnd)) {
      toast.error("Choose start and end dates, then Apply.")
      return
    }
    setLoading(true)
    try {
      let start: string | undefined
      let end: string | undefined
      if (dateRange === "custom") {
        start = new Date(`${customStart}T00:00:00.000Z`).toISOString()
        end = new Date(`${customEnd}T23:59:59.999Z`).toISOString()
      }
      const [campaignsSettled, analyticsSettled, timezoneSettled] = await Promise.allSettled([
        getEmailCampaigns(),
        getEmailAnalytics(dateRange, start, end),
        getDefaultScheduleTimezone(),
      ])

      if (timezoneSettled.status === "fulfilled" && timezoneSettled.value) {
        setScheduleTimezone(timezoneSettled.value)
      }

      const campaignsResult = campaignsSettled.status === "fulfilled" ? campaignsSettled.value : { success: false, data: null, error: "Request failed" }
      if (campaignsResult.success && campaignsResult.data) {
        setAllCampaigns(campaignsResult.data)
        setCampaigns(campaignsResult.data)
      } else if (!campaignsResult.success && campaignsResult.error) {
        toast.error(campaignsResult.error || "Failed to load campaigns")
      }

      const analyticsResult = analyticsSettled.status === "fulfilled" ? analyticsSettled.value : { success: false, data: null, error: "Request failed" }
      if (analyticsResult.success && analyticsResult.data) {
        const a = analyticsResult.data
        const totalSubscribers = a.totalSubscribers ?? 0
        const totalEmailsSent = a.totalEmailsSent ?? 0
        const averageOpenRate = a.averageOpenRate ?? 0
        const averageClickRate = a.averageClickRate ?? 0
        const campaignsCount = a.campaignsCount ?? 0
        const activeAutomationsCount = a.activeAutomationsCount ?? 0
        const segmentsCount = a.segmentsCount ?? 0
        const templatesCount = a.templatesCount ?? 0
        const subscriberChange = a.previousTotalSubscribers && a.previousTotalSubscribers > 0
          ? (((totalSubscribers - a.previousTotalSubscribers) / a.previousTotalSubscribers) * 100).toFixed(1)
          : "0"
        const campaignsChange = a.previousCampaignsCount && a.previousCampaignsCount > 0
          ? (((campaignsCount - a.previousCampaignsCount) / a.previousCampaignsCount) * 100).toFixed(1)
          : "0"
        const openRateChange = a.previousAverageOpenRate !== undefined && a.previousAverageOpenRate > 0
          ? ((averageOpenRate - a.previousAverageOpenRate) / a.previousAverageOpenRate * 100).toFixed(1)
          : "0"
        const clickRateChange = a.previousAverageClickRate !== undefined && a.previousAverageClickRate > 0
          ? ((averageClickRate - a.previousAverageClickRate) / a.previousAverageClickRate * 100).toFixed(1)
          : "0"

        setStats([
          { name: "Total Subscribers", value: String(totalSubscribers).toLocaleString(), icon: Users, change: parseFloat(subscriberChange) >= 0 ? `+${subscriberChange}%` : `${subscriberChange}%`, changeType: parseFloat(subscriberChange) >= 0 ? "positive" : "negative" },
          { name: "Total Emails Sent", value: String(totalEmailsSent).toLocaleString(), icon: Send, change: "", changeType: "neutral" },
          { name: "Avg Open Rate", value: `${averageOpenRate}%`, icon: Mail, change: parseFloat(openRateChange) >= 0 ? `+${openRateChange}%` : `${openRateChange}%`, changeType: parseFloat(openRateChange) >= 0 ? "positive" : "negative" },
          { name: "Avg Click Rate", value: `${averageClickRate}%`, icon: TrendingUp, change: parseFloat(clickRateChange) >= 0 ? `+${clickRateChange}%` : `${clickRateChange}%`, changeType: parseFloat(clickRateChange) >= 0 ? "positive" : "negative" },
          { name: "Campaigns Sent", value: String(campaignsCount), icon: Send, change: parseFloat(campaignsChange) >= 0 ? `+${campaignsChange}%` : `${campaignsChange}%`, changeType: parseFloat(campaignsChange) >= 0 ? "positive" : "negative" },
          { name: "Active Automations", value: String(activeAutomationsCount), icon: TrendingUp, change: "", changeType: "neutral" },
          { name: "Segments", value: String(segmentsCount), icon: Users, change: "", changeType: "neutral" },
          { name: "Templates", value: String(templatesCount), icon: FileText, change: "", changeType: "neutral" },
        ])
      } else if (!analyticsResult.success && analyticsResult.error) {
        toast.error(analyticsResult.error || "Failed to load analytics")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load email marketing data")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return

    const result = await deleteEmailCampaign(id)
    if (result.success) {
      toast.success("Campaign deleted successfully")
      loadData()
    } else {
      toast.error(result.error || "Failed to delete campaign")
    }
  }

  const handleDuplicate = async (campaign: EmailCampaign) => {
    // Navigate to new campaign page with pre-filled data
    router.push(`/admin/email-marketing/new?duplicate=${campaign.id}`)
  }

  const loadDiagnostics = async () => {
    const result = await getCustomerSubscriberDiagnostics()
    if (result.success && result.diagnostics) {
      setDiagnostics(result.diagnostics)
    }
  }

  useEffect(() => {
    if (showDiagnostics) {
      loadDiagnostics()
    }
  }, [showDiagnostics])

  const handleSyncCustomers = async () => {
    // Show diagnostics first
    const diagnosticsResult = await getCustomerSubscriberDiagnostics()
    if (diagnosticsResult.success && diagnosticsResult.diagnostics) {
      const diag = diagnosticsResult.diagnostics
      const message = `Diagnostics:\n` +
        `- Total Customers: ${diag.totalCustomers.toLocaleString()}\n` +
        `- Customers with Emails: ${diag.customersWithEmails.toLocaleString()}\n` +
        `- Customers with Valid Emails: ${diag.customersWithValidEmails.toLocaleString()}\n` +
        `- Current Subscribers: ${diag.totalSubscribers.toLocaleString()}\n` +
        `- Customers Needing Sync: ${diag.customersNeedingSync.toLocaleString()}\n\n` +
        `This will sync ${diag.customersNeedingSync.toLocaleString()} customers to email subscribers. Continue?`
      
      if (!confirm(message)) return
    } else {
      if (!confirm("This will sync all customers to email subscribers. Continue?")) return
    }

    toast.info("Syncing customers to subscribers...")
    const result = await syncAllCustomersToSubscribers()
    
    if (result.success) {
      toast.success(result.message || `Successfully synced ${result.synced.toLocaleString()} customers`)
      if (result.error) {
        toast.warning(`Some errors occurred: ${result.error}`)
      }
      loadData()
      if (showDiagnostics) {
        loadDiagnostics()
      }
    } else {
      toast.error(result.error || "Failed to sync customers")
    }
  }

  // Apply filters to campaigns
  const filteredCampaigns = (statusFilter === "all" ? campaigns : campaigns.filter(c => c.status === statusFilter))
    .filter((campaign) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          campaign.name.toLowerCase().includes(query) ||
          campaign.subject.toLowerCase().includes(query)
        )
      }
      return true
    })

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Email Marketing</h1>
          <p className="text-gray-600 mt-1">Manage campaigns, segments, automations, and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            title="Show customer/subscriber diagnostics"
          >
            <Eye className="w-5 h-5" />
            {showDiagnostics ? "Hide" : "Show"} Diagnostics
          </button>
          <button
            onClick={handleSyncCustomers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
            title="Sync all customers to email subscribers"
          >
            <Users className="w-5 h-5" />
            Sync Customers
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={async () => {
              if (!confirm("Recalculate metrics for all campaigns? This will update open/click counts from event data.")) {
                return
              }
              try {
                const response = await fetch("/api/admin/email-campaigns/recalculate-metrics", {
                  method: "POST",
                })
                const result = await response.json()
                if (result.success) {
                  toast.success(result.message || "Metrics recalculated successfully")
                  loadData()
                } else {
                  toast.error(result.error || "Failed to recalculate metrics")
                }
              } catch (error: any) {
                toast.error(error.message || "Failed to recalculate metrics")
              }
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 font-medium disabled:opacity-50"
            title="Recalculate open/click metrics from event data"
          >
            <TrendingUp className="w-5 h-5" />
            Recalculate Metrics
          </button>
        <Link
          href="/admin/email-marketing/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
      </div>
      </div>

      {/* Diagnostics Panel */}
      {showDiagnostics && diagnostics && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer/Subscriber Diagnostics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{diagnostics.totalCustomers.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Customers with Emails</p>
              <p className="text-2xl font-bold text-gray-900">{diagnostics.customersWithEmails.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {diagnostics.totalCustomers > 0 
                  ? `${((diagnostics.customersWithEmails / diagnostics.totalCustomers) * 100).toFixed(1)}% of total`
                  : "0%"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Customers with Valid Emails</p>
              <p className="text-2xl font-bold text-gray-900">{diagnostics.customersWithValidEmails.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {diagnostics.customersWithEmails > 0
                  ? `${((diagnostics.customersWithValidEmails / diagnostics.customersWithEmails) * 100).toFixed(1)}% of those with emails`
                  : "0%"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Current Subscribers</p>
              <p className="text-2xl font-bold text-gray-900">{diagnostics.totalSubscribers.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Customers Needing Sync</p>
              <p className="text-2xl font-bold text-teal-600">{diagnostics.customersNeedingSync.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                {diagnostics.customersWithValidEmails > 0
                  ? `${((diagnostics.customersNeedingSync / diagnostics.customersWithValidEmails) * 100).toFixed(1)}% of valid emails`
                  : "0%"}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Already Subscribed</p>
              <p className="text-2xl font-bold text-green-600">
                {(diagnostics.customersWithValidEmails - diagnostics.customersNeedingSync).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Note:</strong> Only customers with valid email addresses (containing @) can be synced to email subscribers.</p>
            <p className="mt-1">
              {diagnostics.totalCustomers - diagnostics.customersWithEmails > 0 && (
                <span className="text-orange-600">
                  {diagnostics.totalCustomers - diagnostics.customersWithEmails} customers don't have email addresses and cannot be synced.
                </span>
              )}
            </p>
            {diagnostics.invalidEmailSamples && diagnostics.invalidEmailSamples.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="font-semibold text-yellow-800 mb-2">Sample Invalid Emails (for debugging):</p>
                <ul className="list-disc list-inside space-y-1 text-yellow-700">
                  {diagnostics.invalidEmailSamples.map((email, idx) => (
                    <li key={idx} className="font-mono text-xs">{email}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-yellow-600">
                  {diagnostics.customersWithEmails - diagnostics.customersWithValidEmails} customers have emails but they don't contain "@" symbol.
                  These emails need to be fixed before they can be synced.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/admin/email-marketing/segments"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Segments</h3>
          </div>
          <p className="text-sm text-gray-600">Create customer segments for targeted campaigns</p>
        </Link>
        <Link
          href="/admin/email-marketing/automations"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <Send className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Automations</h3>
          </div>
          <p className="text-sm text-gray-600">Set up automated email workflows</p>
        </Link>
        <Link
          href="/admin/email-marketing/templates"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Templates</h3>
          </div>
          <p className="text-sm text-gray-600">Manage reusable email templates</p>
        </Link>
        <Link
          href="/admin/email-marketing/analytics"
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Analytics</h3>
          </div>
          <p className="text-sm text-gray-600">View performance metrics and reports</p>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      )}

      {/* Date Range Selector */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="custom">Custom range</option>
          </select>
          {dateRange === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
              >
                Apply
              </button>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      {!loading && stats.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-teal-600" />
              </div>
              {stat.change && (
                <span className={`text-sm font-medium ${
                  stat.changeType === "positive" ? "text-green-600" : 
                  stat.changeType === "negative" ? "text-red-600" : 
                  "text-gray-600"
                }`}>
                  {stat.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-600 mt-1">{stat.name}</p>
          </div>
        ))}
      </div>
      )}

      {/* Campaigns */}
      {!loading && (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Campaigns</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="sending">Sending</option>
                <option value="sent">Sent</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipients</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Open Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Click Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    {searchQuery || statusFilter !== "all" 
                      ? "No campaigns match your filters. Try adjusting your search or filters."
                      : "No campaigns found. Create your first campaign to get started."}
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const sent = campaign.sent_count || 0
                  const opened = campaign.open_count || 0
                  const clicked = campaign.click_count || 0
                  const recipients = campaign.total_recipients || 0
                  const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0"
                  const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : "0"
                  const campaignTz =
                    ((campaign as any)?.content?.schedule_timezone as string) ||
                    scheduleTimezone ||
                    "America/New_York"

                  const date = campaign.status === "scheduled" && campaign.scheduled_at
                    ? formatScheduledAtInTimezone(campaign.scheduled_at, campaignTz)
                    : campaign.sent_at
                    ? new Date(campaign.sent_at).toLocaleDateString()
                    : campaign.created_at
                      ? new Date(campaign.created_at).toLocaleDateString()
                      : "-"

                  return (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/email-marketing/${campaign.id}`}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700"
                    >
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{campaign.subject}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{recipients.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sent.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{openRate}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{clickRate}%</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            campaign.status === "sent"
                              ? "bg-green-50 text-green-700"
                              : campaign.status === "sending"
                                ? "bg-blue-50 text-blue-700"
                                : campaign.status === "scheduled"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{date}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/email-marketing/${campaign.id}`}
                            className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {campaign.status === "scheduled" && (
                            <button
                              onClick={async () => {
                                if (!confirm("Cancel this scheduled send? The campaign will return to draft.")) return
                                const result = await unscheduleEmailCampaign(campaign.id)
                                if (result.success) {
                                  toast.success("Schedule cancelled")
                                  loadData()
                                } else {
                                  toast.error(result.error || "Failed to cancel schedule")
                                }
                              }}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                              title="Cancel schedule"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicate(campaign)}
                            className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(campaign.id, campaign.name)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  )
}
