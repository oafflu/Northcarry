'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  getMySupportTicketById,
  addCustomerSupportMessage,
} from '@/app/actions/customer-support'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

function statusStyle(status: string) {
  switch (status) {
    case 'open':
      return 'bg-emerald-100 text-emerald-800'
    case 'pending':
      return 'bg-amber-100 text-amber-800'
    case 'resolved':
      return 'bg-blue-100 text-blue-800'
    case 'closed':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function AccountSupportTicketPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const ticketId = params.id as string
  const bottomRef = useRef<HTMLDivElement>(null)

  const [ticket, setTicket] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    if (!ticketId) return
    setLoading(true)
    const res = await getMySupportTicketById(ticketId)
    if (res.error || !res.data) {
      toast.error(res.error || 'Ticket not found')
      router.push('/account/support')
      return
    }
    setTicket(res.data)
    setLoading(false)
  }

  useEffect(() => {
    if (user?.id && ticketId) load()
  }, [user?.id, ticketId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages?.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = reply.trim()
    if (!text) {
      toast.error('Enter a message')
      return
    }
    setSending(true)
    const res = await addCustomerSupportMessage(ticketId, text)
    setSending(false)
    if (!res.success) {
      toast.error(res.error || 'Failed to send')
      return
    }
    toast.success('Message sent')
    setReply('')
    await load()
  }

  if (loading || !ticket) {
    return (
      <div className="rounded-lg bg-white p-12 shadow-sm flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/account/support"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to support
        </Link>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{ticket.ticket_number}</p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">{ticket.subject}</h2>
              <p className="text-sm text-gray-600 mt-2">
                Category: <span className="font-medium capitalize">{ticket.category}</span>
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>
          {(ticket.status === 'closed' || ticket.status === 'resolved') && (
            <p className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
              This ticket is marked {ticket.status}. You can still send a message below if you need more help—we will
              reopen it for our team.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversation</h3>
        <div className="space-y-4">
          {(ticket.messages || []).map((m: any) => {
            const isStaff = m.sender_type === 'admin'
            return (
              <div
                key={m.id}
                className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[min(100%,36rem)] rounded-2xl px-4 py-3 text-sm ${
                    isStaff
                      ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                      : 'bg-black text-white rounded-tr-sm'
                  }`}
                >
                  <p className="text-xs font-medium opacity-80 mb-1">
                    {isStaff ? 'BREVI support' : 'You'} ·{' '}
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="mt-8 border-t border-gray-100 pt-6 space-y-3">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply…"
            rows={4}
            className="resize-y min-h-[100px]"
          />
          <Button type="submit" disabled={sending} className="bg-black hover:bg-gray-800">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send message
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
