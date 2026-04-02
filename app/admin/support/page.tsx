"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, MessageSquare, Clock, CheckCircle, AlertCircle, Ticket, Plus, Loader2, X, Eye, XCircle, RotateCcw, Mail } from "lucide-react"
import { createTicket, searchCustomers, getCustomerOrders, getTickets, updateTicket } from "@/app/actions/tickets"
import { getContactMessages, updateContactMessage } from "@/app/actions/contact"
import { createTicketFromContact } from "@/app/actions/tickets"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

export default function SupportPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [activeTab, setActiveTab] = useState<"tickets" | "contact">("tickets")
  const [contactMessages, setContactMessages] = useState<any[]>([])
  const [loadingContactMessages, setLoadingContactMessages] = useState(false)
  const [convertingMessageId, setConvertingMessageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Create ticket dialog state
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [creatingTicket, setCreatingTicket] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [tickets, setTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticTestAddress, setDiagnosticTestAddress] = useState("")
  const [diagnosticTestResult, setDiagnosticTestResult] = useState<any>(null)
  const [sendingWebhookTest, setSendingWebhookTest] = useState(false)
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null)
  const [ticketForm, setTicketForm] = useState({
    customerName: "",
    customerEmail: "",
    userId: "",
    subject: "",
    category: "other" as "order" | "product" | "shipping" | "technical" | "other",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    initialMessage: "",
  })

  useEffect(() => {
    // Load tickets when switching to tickets tab or on mount if tickets tab is active
    if (activeTab === "tickets") {
      loadTickets()
    }
    // Load contact messages when switching to contact tab
    if (activeTab === "contact") {
      loadContactMessages()
    }
  }, [activeTab, user?.id, filterStatus])

  const loadContactMessages = async () => {
    setLoadingContactMessages(true)
    try {
      const result = await getContactMessages()
      if (result.data) {
        setContactMessages(result.data)
      } else if (result.error) {
        toast.error('Failed to load contact messages')
      }
    } catch (error) {
      console.error('Error loading contact messages:', error)
      toast.error('Failed to load contact messages')
    } finally {
      setLoadingContactMessages(false)
    }
  }

  const loadReplyDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true)
    try {
      const response = await fetch("/api/admin/support/reply-diagnostics", { cache: "no-store" })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to load diagnostics")
      }
      setDiagnostics(result.data)
      setDiagnosticTestAddress(result.data?.sampleReplyAddress || "")
    } catch (error: any) {
      console.error("Error loading reply diagnostics:", error)
      toast.error("Failed to load reply diagnostics", {
        description: error.message,
      })
    } finally {
      setDiagnosticsLoading(false)
    }
  }, [])

  const runReplyParserTest = async () => {
    if (!diagnosticTestAddress.trim()) {
      toast.error("Enter a reply address to test")
      return
    }
    try {
      const response = await fetch("/api/admin/support/reply-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toAddress: diagnosticTestAddress.trim() }),
      })
      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Parser test failed")
      }
      setDiagnosticTestResult(result.data)
      if (result.data?.matched) {
        toast.success("Reply parser matched ticket ID")
      } else {
        toast.error("Reply parser did not match this address")
      }
    } catch (error: any) {
      console.error("Error running parser test:", error)
      toast.error("Reply parser test failed", { description: error.message })
    }
  }

  const sendTestWebhookPayload = async () => {
    if (!diagnosticTestAddress.trim()) {
      toast.error("Enter a reply address to test")
      return
    }

    setSendingWebhookTest(true)
    try {
      const response = await fetch("/api/tickets/email-reply?dryRun=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: diagnosticTestAddress.trim(),
          from: "customer@example.com",
          subject: "Re: Support ticket test",
          text: "This is a dry-run webhook payload from admin diagnostics.",
          dryRun: true,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Test webhook failed")
      }

      setWebhookTestResult(result.data || result)
      toast.success("Test webhook payload accepted (dry run)")
    } catch (error: any) {
      console.error("Error sending test webhook payload:", error)
      toast.error("Test webhook failed", { description: error.message })
    } finally {
      setSendingWebhookTest(false)
    }
  }

  useEffect(() => {
    if (user?.id && activeTab === "tickets") {
      loadReplyDiagnostics()
    }
  }, [user?.id, activeTab, loadReplyDiagnostics])

  const handleConvertToTicket = async (message: any) => {
    if (message.ticket_id) {
      toast.info('This message has already been converted to a ticket')
      return
    }

    setConvertingMessageId(message.id)
    try {
      // Check if customer exists by email
      let linkedUserId: string | undefined
      try {
        const customerResult = await searchCustomers(message.email)
        if (customerResult.data && customerResult.data.length > 0) {
          linkedUserId = customerResult.data[0].id
        }
      } catch (error) {
        // Customer search failed, continue without user ID
        console.error('Error searching for customer:', error)
      }

      const result = await createTicketFromContact({
        contactMessageId: message.id,
        customerName: message.name,
        customerEmail: message.email,
        userId: linkedUserId,
        subject: message.subject,
        message: message.message,
      })

      if (result.success) {
        toast.success(`Ticket ${result.ticketNumber} created successfully`, {
          description: 'You can now reply to the customer via the ticket.',
        })
        // Reload contact messages to show the ticket link
        await loadContactMessages()
      } else {
        toast.error('Failed to create ticket', {
          description: result.error || 'An unexpected error occurred',
        })
      }
    } catch (error: any) {
      console.error('Error converting contact message to ticket:', error)
      toast.error('Failed to create ticket', {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setConvertingMessageId(null)
    }
  }

  const loadTickets = async () => {
    setLoadingTickets(true)
    try {
      const result = await getTickets({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: searchQuery || undefined,
      })
      if (result.data) {
        setTickets(result.data)
      } else if (result.error) {
        console.error('Error loading tickets:', result.error)
        toast.error('Failed to load tickets', {
          description: result.error,
        })
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
      toast.error('Failed to load tickets')
    } finally {
      setLoadingTickets(false)
    }
  }


  // Calculate stats from real tickets
  const openTickets = tickets.filter(t => t.status === 'open').length
  const pendingTickets = tickets.filter(t => t.status === 'pending').length
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
  const highPriorityTickets = tickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length
  
  const stats = [
    { name: "Open Tickets", value: openTickets.toString(), icon: MessageSquare, color: "blue" },
    { name: "Pending", value: pendingTickets.toString(), icon: Clock, color: "yellow" },
    { name: "Resolved", value: resolvedTickets.toString(), icon: CheckCircle, color: "green" },
    { name: "High Priority", value: highPriorityTickets.toString(), icon: AlertCircle, color: "red" },
  ]

  const contactStats = [
    { name: "New Messages", value: contactMessages.filter(m => m.status === 'new').length.toString(), icon: Mail, color: "blue" },
    { name: "Read", value: contactMessages.filter(m => m.status === 'read').length.toString(), icon: Eye, color: "gray" },
    { name: "Replied", value: contactMessages.filter(m => m.status === 'replied').length.toString(), icon: CheckCircle, color: "green" },
    { name: "Total", value: contactMessages.length.toString(), icon: Mail, color: "teal" },
  ]

  // Search customers
  useEffect(() => {
    if (customerSearch.length >= 2) {
      const timeoutId = setTimeout(async () => {
        const result = await searchCustomers(customerSearch)
        if (result.data) {
          setCustomerResults(result.data)
        }
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setCustomerResults([])
    }
  }, [customerSearch])

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer)
    setTicketForm({
      ...ticketForm,
      customerName: customer.name,
      customerEmail: customer.email,
      userId: customer.id,
    })
    setCustomerSearch("")
    setCustomerResults([])
    
    // Load customer orders if they have a user ID
    if (customer.id) {
      setLoadingOrders(true)
      try {
        const result = await getCustomerOrders(customer.id)
        if (result.data) {
          setCustomerOrders(result.data)
        }
      } catch (error) {
        console.error('Error loading customer orders:', error)
        setCustomerOrders([])
      } finally {
        setLoadingOrders(false)
      }
    } else {
      setCustomerOrders([])
    }
  }
  
  const handleInsertOrderReference = (order: any) => {
    const orderRef = `Order #${order.order_number}`
    const currentMessage = ticketForm.initialMessage
    const newMessage = currentMessage 
      ? `${currentMessage}\n\n${orderRef}`
      : orderRef
    setTicketForm({
      ...ticketForm,
      initialMessage: newMessage,
    })
  }

  const handleCreateTicket = async () => {
    if (!ticketForm.customerName || !ticketForm.customerEmail || !ticketForm.subject || !ticketForm.initialMessage) {
      toast.error("Please fill in all required fields")
      return
    }

    setCreatingTicket(true)
    try {
      const result = await createTicket({
        customerName: ticketForm.customerName,
        customerEmail: ticketForm.customerEmail,
        userId: ticketForm.userId || undefined,
        subject: ticketForm.subject,
        category: ticketForm.category,
        priority: ticketForm.priority,
        initialMessage: ticketForm.initialMessage,
      })

      if (result.success) {
        toast.success("Ticket created successfully", {
          description: `Ticket ${result.ticketNumber} has been created`,
        })
        setShowCreateTicket(false)
        setTicketForm({
          customerName: "",
          customerEmail: "",
          userId: "",
          subject: "",
          category: "other",
          priority: "medium",
          initialMessage: "",
        })
        setSelectedCustomer(null)
        setCustomerOrders([])
        setCustomerSearch("")
        // Reload tickets
        if (activeTab === "tickets") {
          loadTickets()
        }
      } else {
        toast.error("Failed to create ticket", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error("Error creating ticket:", error)
      toast.error("Failed to create ticket", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setCreatingTicket(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Support Center</h1>
          <p className="text-gray-600 mt-1">Manage tickets and contact messages</p>
        </div>
        {activeTab === "tickets" && (
          <button
            onClick={() => setShowCreateTicket(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Ticket
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("tickets")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "tickets"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Ticket className="w-5 h-5 inline mr-2" />
            Support Tickets
          </button>
          <button
            onClick={() => setActiveTab("contact")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "contact"
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Mail className="w-5 h-5 inline mr-2" />
            Contact Messages ({contactMessages.filter(m => m.status === 'new').length})
          </button>
        </nav>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(activeTab === "tickets" ? stats : contactStats).map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  stat.color === "blue"
                    ? "bg-blue-50"
                    : stat.color === "yellow"
                      ? "bg-yellow-50"
                      : stat.color === "green"
                        ? "bg-green-50"
                        : "bg-red-50"
                }`}
              >
                <stat.icon
                  className={`w-6 h-6 ${
                    stat.color === "blue"
                      ? "text-blue-600"
                      : stat.color === "yellow"
                        ? "text-yellow-600"
                        : stat.color === "green"
                          ? "text-green-600"
                          : "text-red-600"
                  }`}
                />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-600 mt-1">{stat.name}</p>
          </div>
        ))}
      </div>

      {activeTab === "tickets" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Email Reply Diagnostics</h3>
              <p className="text-sm text-gray-600 mt-1">
                Verify reply address format and inbound webhook setup for ticket email replies.
              </p>
            </div>
            <button
              onClick={loadReplyDiagnostics}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          {diagnosticsLoading ? (
            <div className="py-4 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading diagnostics...
            </div>
          ) : diagnostics ? (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-md border border-gray-200 p-3 text-sm">
                <p><strong>Webhook:</strong> <span className="break-all">{diagnostics.webhookEndpoint}</span></p>
                <p className="mt-1"><strong>Reply local part:</strong> {diagnostics.replyConfig?.localPart}</p>
                <p className="mt-1"><strong>Reply domain:</strong> {diagnostics.replyConfig?.domain}</p>
                <p className="mt-1">
                  <strong>TICKET_REPLY_DOMAIN set:</strong>{" "}
                  {diagnostics.replyConfig?.usesExplicitReplyDomain ? "Yes" : "No (fallback in use)"}
                </p>
                <p className="mt-2 text-xs text-gray-500">{diagnostics.note}</p>
              </div>

              <div className="rounded-md border border-gray-200 p-3 text-sm">
                <label className="block text-xs font-medium text-gray-600 mb-1">Reply address parser test</label>
                <input
                  type="text"
                  value={diagnosticTestAddress}
                  onChange={(e) => setDiagnosticTestAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="hello+<ticket-id>@your-reply-domain.com"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={runReplyParserTest}
                    className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Test parser
                  </button>
                  <button
                    onClick={sendTestWebhookPayload}
                    disabled={sendingWebhookTest}
                    className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-60"
                  >
                    {sendingWebhookTest ? "Sending..." : "Send test webhook payload"}
                  </button>
                  {diagnosticTestResult && (
                    <span
                      className={`text-xs font-medium ${diagnosticTestResult.matched ? "text-green-700" : "text-red-700"}`}
                    >
                      {diagnosticTestResult.matched
                        ? `Matched: ${diagnosticTestResult.extractedTicketId}`
                        : "No ticket ID match"}
                    </span>
                  )}
                </div>
                {webhookTestResult && (
                  <p className="mt-2 text-xs text-gray-700">
                    Dry run parsed ticket: <strong>{webhookTestResult.ticketId || "n/a"}</strong>
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadTickets()
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              // loadTickets will be called by useEffect when filterStatus changes
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={loadTickets}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === "tickets" ? (
        /* Tickets table */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AI Suggestion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Update
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingTickets ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500 mt-2">Loading tickets...</p>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket: any) => {
                  const lastUpdate = ticket.updated_at 
                    ? new Date(ticket.updated_at).toLocaleString()
                    : new Date(ticket.created_at).toLocaleString()
                  
                  return (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/support/${ticket.id}`}
                          className="text-sm font-medium text-teal-600 hover:text-teal-700"
                        >
                          {ticket.ticket_number}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{ticket.customer_name}</div>
                        <div className="text-sm text-gray-500">{ticket.customer_email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{ticket.subject}</div>
                        <div className="text-xs text-gray-500 mt-1">{ticket.message_count || 0} messages</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            ticket.priority === "high" || ticket.priority === "urgent"
                              ? "bg-red-50 text-red-700"
                              : ticket.priority === "medium"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {ticket.priority?.charAt(0).toUpperCase() + ticket.priority?.slice(1) || 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            ticket.status === "open"
                              ? "bg-blue-50 text-blue-700"
                              : ticket.status === "pending"
                                ? "bg-yellow-50 text-yellow-700"
                                : ticket.status === "resolved" || ticket.status === "closed"
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {ticket.status?.charAt(0).toUpperCase() + ticket.status?.slice(1) || 'Open'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {/* AI Suggestion placeholder - can be implemented later */}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lastUpdate}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/support/${ticket.id}`}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition-colors"
                            title="View ticket"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {ticket.status === 'open' || ticket.status === 'pending' ? (
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to close ticket ${ticket.ticket_number}?`)) {
                                  const result = await updateTicket(ticket.id, { status: 'closed' })
                                  if (result.success) {
                                    toast.success('Ticket closed')
                                    loadTickets()
                                  } else {
                                    toast.error(result.error || 'Failed to close ticket')
                                  }
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Close ticket"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to reopen ticket ${ticket.ticket_number}?`)) {
                                  const result = await updateTicket(ticket.id, { status: 'open' })
                                  if (result.success) {
                                    toast.success('Ticket reopened')
                                    loadTickets()
                                  } else {
                                    toast.error(result.error || 'Failed to reopen ticket')
                                  }
                                }
                              }}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Reopen ticket"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
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
      ) : (
        /* Contact Messages */
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loadingContactMessages ? (
            <div className="p-8 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading contact messages...
            </div>
          ) : contactMessages.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No contact messages</p>
              <p className="text-sm text-gray-400">
                Contact form submissions will appear here and automatically create support tickets.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {contactMessages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold">
                          {message.name[0]?.toUpperCase() || 'C'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{message.name}</p>
                            <a
                              href={`mailto:${message.email}`}
                              className="text-sm text-teal-600 hover:text-teal-700"
                            >
                              {message.email}
                            </a>
                          </div>
                          <p className="text-sm font-semibold text-gray-700 mt-1">{message.subject}</p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            message.status === 'new'
                              ? 'bg-blue-100 text-blue-700'
                              : message.status === 'read'
                                ? 'bg-gray-100 text-gray-700'
                                : message.status === 'replied'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {message.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 ml-13 whitespace-pre-wrap">{message.message}</p>
                      <div className="flex items-center gap-4 mt-3 ml-13">
                        <p className="text-xs text-gray-500">
                          {new Date(message.created_at).toLocaleString()}
                        </p>
                        {message.ticket_id && (
                          <Link
                            href={`/admin/support/${message.ticket_id}`}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                          >
                            View Ticket →
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!message.ticket_id ? (
                        <button
                          onClick={() => handleConvertToTicket(message)}
                          disabled={convertingMessageId === message.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {convertingMessageId === message.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Converting...
                            </>
                          ) : (
                            <>
                              <Ticket className="w-3 h-3" />
                              Convert to Ticket
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href={`/admin/support/${message.ticket_id}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                        >
                          <Ticket className="w-3 h-3" />
                          View Ticket
                        </Link>
                      )}
                      <select
                        value={message.status}
                        onChange={async (e) => {
                          const result = await updateContactMessage(message.id, {
                            status: e.target.value as any,
                          })
                          if (result.success) {
                            toast.success('Message status updated')
                            loadContactMessages()
                          } else {
                            toast.error(result.error || 'Failed to update message')
                          }
                        }}
                        className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="replied">Replied</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Ticket Dialog */}
      {showCreateTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Create New Ticket</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateTicket(false)
                  setSelectedCustomer(null)
                  setCustomerOrders([])
                  setCustomerSearch("")
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer *
                </label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 bg-teal-50 border border-teal-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setCustomerOrders([])
                        setTicketForm({
                          ...ticketForm,
                          customerName: "",
                          customerEmail: "",
                          userId: "",
                        })
                      }}
                      className="text-teal-600 hover:text-teal-700 text-sm"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    {customerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {customerResults.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            <p className="text-sm text-gray-600">{customer.email}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Customer Entry */}
              {!selectedCustomer && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={ticketForm.customerName}
                      onChange={(e) => setTicketForm({ ...ticketForm, customerName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Email *
                    </label>
                    <input
                      type="email"
                      value={ticketForm.customerEmail}
                      onChange={(e) => setTicketForm({ ...ticketForm, customerEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Brief description of the issue"
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="order">Order</option>
                    <option value="product">Product</option>
                    <option value="shipping">Shipping</option>
                    <option value="technical">Technical</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority *
                  </label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Customer Orders */}
              {selectedCustomer && selectedCustomer.id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Orders
                  </label>
                  {loadingOrders ? (
                    <div className="p-4 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading orders...
                    </div>
                  ) : customerOrders.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {customerOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => handleInsertOrderReference(order)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between group"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {order.order_number}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                order.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {order.payment_status}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                order.fulfillment_status === 'fulfilled'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {order.fulfillment_status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              ${parseFloat(order.total || '0').toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                            </div>
                            {order.order_items && order.order_items.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {order.order_items.length} item{order.order_items.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-5 h-5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm border border-gray-200 rounded-lg">
                      No orders found for this customer
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Click on an order to insert a reference into your message
                  </p>
                </div>
              )}

              {/* Initial Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Message *
                </label>
                <textarea
                  value={ticketForm.initialMessage}
                  onChange={(e) => setTicketForm({ ...ticketForm, initialMessage: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter the initial message for this ticket..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateTicket(false)
                  setSelectedCustomer(null)
                  setCustomerOrders([])
                  setCustomerSearch("")
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={creatingTicket}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creatingTicket || !ticketForm.customerName || !ticketForm.customerEmail || !ticketForm.subject || !ticketForm.initialMessage}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingTicket ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Ticket
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
