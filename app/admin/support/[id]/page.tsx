"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Send, Sparkles, Copy, ThumbsUp, ThumbsDown, Loader2, RefreshCw, XCircle, RotateCcw, CheckCircle } from "lucide-react"
import { getTicketById, updateTicket, sendTicketMessage } from "@/app/actions/tickets"
import { getCustomerOrders } from "@/app/actions/tickets"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const ticketId = params.id as string
  
  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("open")
  const [priority, setPriority] = useState("medium")
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])

  useEffect(() => {
    if (ticketId) {
      loadTicket()
    }
  }, [ticketId])

  useEffect(() => {
    if (ticket) {
      // Status and priority are now set in loadTicket, but keep this as backup
      if (ticket.status && ticket.status !== status) {
        setStatus(ticket.status)
      }
      if (ticket.priority && ticket.priority !== priority) {
        setPriority(ticket.priority)
      }
      loadAISuggestions()
      if (ticket.user_id) {
        loadCustomerOrders()
      }
    }
  }, [ticket])

  const loadTicket = async () => {
    setLoading(true)
    try {
      const result = await getTicketById(ticketId)
      if (result.error || !result.data) {
        toast.error(result.error || "Ticket not found")
        router.push("/admin/support")
        return
      }
      setTicket(result.data)
      // Update status and priority state immediately when ticket is loaded
      setStatus(result.data.status || "open")
      setPriority(result.data.priority || "medium")
    } catch (error: any) {
      console.error("Error loading ticket:", error)
      toast.error("Failed to load ticket")
      router.push("/admin/support")
    } finally {
      setLoading(false)
    }
  }

  const loadCustomerOrders = async () => {
    if (!ticket?.user_id) return
    
    try {
      const result = await getCustomerOrders(ticket.user_id)
      if (result.data) {
        setCustomerOrders(result.data)
      }
    } catch (error) {
      console.error("Error loading customer orders:", error)
    }
  }

  const loadAISuggestions = async () => {
    if (!ticket) return
    
    setLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/admin/support/ai-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          category: ticket.category,
          subject: ticket.subject,
          messages: ticket.messages || [],
          customerEmail: ticket.customer_email,
          userId: ticket.user_id,
        }),
      })
      
      const data = await response.json()
      if (data.success && data.suggestions) {
        setAiSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error("Error loading AI suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    const previousStatus = status
    setStatus(newStatus)
    setUpdating(true)
    try {
      const result = await updateTicket(ticketId, { status: newStatus })
      if (result.success) {
        toast.success("Ticket status updated")
        // Status is already set optimistically, reload to get latest data
        await loadTicket()
      } else {
        toast.error(result.error || "Failed to update status")
        setStatus(previousStatus) // Revert on error
      }
    } catch (error) {
      toast.error("Failed to update status")
      setStatus(previousStatus) // Revert on error
    } finally {
      setUpdating(false)
    }
  }

  const handlePriorityChange = async (newPriority: string) => {
    setPriority(newPriority)
    setUpdating(true)
    try {
      const result = await updateTicket(ticketId, { priority: newPriority as any })
      if (result.success) {
        toast.success("Ticket priority updated")
        loadTicket()
      } else {
        toast.error(result.error || "Failed to update priority")
        setPriority(ticket.priority) // Revert on error
      }
    } catch (error) {
      toast.error("Failed to update priority")
      setPriority(ticket.priority) // Revert on error
    } finally {
      setUpdating(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message")
      return
    }

    setSending(true)
    try {
      // Replace {order} tag with actual order details including tracking
      let finalMessage = message
      if (message.includes("{order}")) {
        // Fetch order details with tracking from API
        try {
          const response = await fetch(`/api/admin/support/ai-suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticketId: ticket.id,
              category: ticket.category,
              subject: ticket.subject,
              messages: ticket.messages || [],
              customerEmail: ticket.customer_email,
              userId: ticket.user_id,
            }),
          })
          
          const data = await response.json()
          if (data.success && data.orders && data.orders.length > 0) {
            const orderDetails = data.orders.map((order: any) => {
              let details = `Order ${order.orderNumber}:\n- Status: ${order.status || 'pending'}`
              if (order.tracking) {
                details += `\n- Tracking Number: ${order.tracking.trackingNumber}`
                details += `\n- Carrier: ${order.tracking.carrier}`
                if (order.tracking.trackingUrl) {
                  details += `\n- Track Package: ${order.tracking.trackingUrl}`
                }
              }
              return details
            }).join('\n\n')
            finalMessage = message.replace(/{order}/g, orderDetails)
          } else {
            // Fallback if API fails
            const orderDetails = customerOrders.length > 0
              ? customerOrders.map((order: any) => 
                  `Order ${order.order_number} (${order.fulfillment_status || "pending"})`
                ).join("\n")
              : "No orders found for this customer."
            finalMessage = message.replace(/{order}/g, orderDetails)
          }
        } catch (apiError) {
          console.error("Error fetching order details:", apiError)
          // Fallback to basic order info
          const orderDetails = customerOrders.length > 0
            ? customerOrders.map((order: any) => 
                `Order ${order.order_number} (${order.fulfillment_status || "pending"})`
              ).join("\n")
            : "No orders found for this customer."
          finalMessage = message.replace(/{order}/g, orderDetails)
        }
      }

      const result = await sendTicketMessage(ticketId, finalMessage, false)
      if (result.success) {
        toast.success("Message sent")
        setMessage("")
        loadTicket()
      } else {
        toast.error(result.error || "Failed to send message")
      }
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  const handleUseSuggestion = (suggestion: string) => {
    setMessage(suggestion)
  }

  const handleSuggestionFeedback = async (suggestionId: number, helpful: boolean) => {
    // TODO: Implement feedback tracking
    toast.success(helpful ? "Thank you for your feedback!" : "Feedback recorded")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Ticket not found</p>
        <Link href="/admin/support" className="text-teal-600 hover:underline mt-4 inline-block">
          Back to Support
        </Link>
      </div>
    )
  }

  // Format messages for display
  const formattedMessages = (ticket.messages || []).map((msg: any) => {
    const senderName = msg.profiles 
      ? `${msg.profiles.first_name || ''} ${msg.profiles.last_name || ''}`.trim() || msg.profiles.email || 'Support Team'
      : msg.sender_type === 'customer' 
        ? ticket.customer_name 
        : 'Support Team'
    
    return {
      id: msg.id,
      from: msg.sender_type === 'customer' ? 'customer' : 'support',
      sender: senderName,
      message: msg.message,
      time: new Date(msg.created_at).toLocaleString(),
      isInternal: msg.is_internal_note,
    }
  })

  // Get customer order count
  const orderCount = customerOrders.length

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/support" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Ticket {ticket.ticket_number}</h1>
          <p className="text-gray-600 mt-1">{ticket.subject}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={priority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            disabled={updating}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          {(status === 'open' || status === 'pending') ? (
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to close this ticket?`)) {
                  setUpdating(true)
                  try {
                    const result = await updateTicket(ticketId, { status: 'closed' })
                    if (result.success) {
                      toast.success('Ticket closed')
                      // Update status immediately for instant UI feedback
                      setStatus('closed')
                      await loadTicket()
                    } else {
                      toast.error(result.error || 'Failed to close ticket')
                    }
                  } catch (error) {
                    toast.error('Failed to close ticket')
                  } finally {
                    setUpdating(false)
                  }
                }
              }}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Close Ticket
            </button>
          ) : (
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to reopen this ticket?`)) {
                  setUpdating(true)
                  try {
                    const result = await updateTicket(ticketId, { status: 'open' })
                    if (result.success) {
                      toast.success('Ticket reopened')
                      // Update status immediately for instant UI feedback
                      setStatus('open')
                      await loadTicket()
                    } else {
                      toast.error(result.error || 'Failed to reopen ticket')
                    }
                  } catch (error) {
                    toast.error('Failed to reopen ticket')
                  } finally {
                    setUpdating(false)
                  }
                }
              }}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reopen Ticket
            </button>
          )}
          {status !== 'resolved' && status !== 'closed' && (
            <button
              onClick={async () => {
                if (confirm(`Mark this ticket as resolved?`)) {
                  setUpdating(true)
                  try {
                    const result = await updateTicket(ticketId, { status: 'resolved' })
                    if (result.success) {
                      toast.success('Ticket marked as resolved')
                      // Update status immediately for instant UI feedback
                      setStatus('resolved')
                      await loadTicket()
                    } else {
                      toast.error(result.error || 'Failed to resolve ticket')
                    }
                  } catch (error) {
                    toast.error('Failed to resolve ticket')
                  } finally {
                    setUpdating(false)
                  }
                }
              }}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Resolved
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Messages */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {formattedMessages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No messages yet</p>
              ) : (
                formattedMessages.map((msg: any) => (
                <div key={msg.id} className={`flex gap-3 ${msg.from === "support" ? "flex-row-reverse" : ""}`}>
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {msg.sender[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className={`flex-1 ${msg.from === "support" ? "items-end" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{msg.sender}</span>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                        {msg.isInternal && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Internal Note</span>
                        )}
                    </div>
                    <div
                      className={`p-4 rounded-lg ${
                        msg.from === "support" ? "bg-teal-50 text-gray-900" : "bg-gray-100 text-gray-900"
                      }`}
                    >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reply */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reply</h2>
            <textarea
              id="ticket-reply"
              name="ticketReply"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Type your reply... Use {order} to include order details with tracking information."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mb-2"
            />
            <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => setMessage(prev => (prev ? `${prev}\n\n{order}` : '{order}`'))}
                  className="inline-flex items-center px-2 py-1 rounded border border-dashed border-teal-400 text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  Insert order details ({'{order}'})
                </button>
                {orderCount > 0 && (
                  <span>
                    Detected {orderCount} order{orderCount !== 1 ? 's' : ''} for this customer.
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button 
                onClick={handleSendMessage}
                disabled={sending || !message.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                <Send className="w-4 h-4" />
                Send Reply
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{ticket.customer_name}</p>
                <p className="text-sm text-gray-600">{ticket.customer_email}</p>
                {ticket.customer_phone && (
                  <p className="text-sm text-gray-600">{ticket.customer_phone}</p>
                )}
                {ticket.user_id && (
                  <>
                    <div className="pt-3 border-t border-gray-200 mt-3">
                      <p className="text-sm text-gray-600">{orderCount} {orderCount === 1 ? 'order' : 'orders'}</p>
                    </div>
                    {customerOrders.length > 0 && (
                      <div className="pt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-700">Recent Orders:</p>
                        {customerOrders.slice(0, 3).map((order: any) => (
                          <div key={order.id} className="text-xs text-gray-600">
                            <Link 
                              href={`/admin/orders/${order.id}`}
                              className="text-teal-600 hover:underline"
                            >
                              {order.order_number}
                            </Link> - {order.fulfillment_status || 'pending'}
                          </div>
                        ))}
              </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* AI Suggestions */}
          <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg border border-teal-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <h2 className="text-lg font-semibold text-gray-900">AI Suggestions</h2>
              </div>
              <button
                onClick={loadAISuggestions}
                disabled={loadingSuggestions}
                className="p-1 text-teal-600 hover:bg-teal-100 rounded disabled:opacity-50"
                title="Refresh suggestions"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              </div>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No suggestions available</p>
            ) : (
            <div className="space-y-3">
                {aiSuggestions.map((suggestion: any) => (
                <div key={suggestion.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">{suggestion.title}</p>
                    <button
                      onClick={() => handleUseSuggestion(suggestion.message)}
                      className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                        title="Use this suggestion"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                    <p className="text-xs text-gray-600 mb-3 whitespace-pre-wrap">{suggestion.message}</p>
                  <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSuggestionFeedback(suggestion.id, true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                      >
                      <ThumbsUp className="w-3 h-3" />
                      Helpful
                    </button>
                      <button 
                        onClick={() => handleSuggestionFeedback(suggestion.id, false)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                      >
                      <ThumbsDown className="w-3 h-3" />
                      Not helpful
                    </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
