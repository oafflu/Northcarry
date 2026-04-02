'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getAccountOrders } from '@/app/actions/account'
import {
  getMySupportTickets,
  createCustomerSupportTicket,
} from '@/app/actions/customer-support'
import { MessageSquare, Plus, Loader2, Ticket, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

function SupportPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const orderHint = searchParams.get('order') || ''
  const orderIdHint = searchParams.get('orderId') || ''

  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<'order' | 'product' | 'shipping' | 'technical' | 'other'>('order')
  const [message, setMessage] = useState('')
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')

  const load = async () => {
    if (!user?.id) return
    setLoading(true)
    const res = await getMySupportTickets()
    if (res.error) {
      toast.error(res.error)
      setTickets([])
    } else {
      setTickets(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (user?.id) load()
  }, [user?.id])

  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) return
      setOrdersLoading(true)
      const res = await getAccountOrders(user.id, 100, 0)
      if (res.error) {
        toast.error('Could not load your orders')
        setCustomerOrders([])
      } else {
        setCustomerOrders(res.data || [])
      }
      setOrdersLoading(false)
    }

    if (user?.id) {
      loadOrders()
    }
  }, [user?.id])

  useEffect(() => {
    if (orderHint || orderIdHint) {
      setShowNew(true)
      setCategory('order')
      if (orderIdHint) {
        setSelectedOrderId(orderIdHint)
      }
      if (orderHint && !subject) {
        setSubject(`Question about order ${orderHint}`)
      }
      const lines: string[] = []
      if (orderHint) lines.push(`Order: ${orderHint}`)
      if (orderIdHint) lines.push(`(Reference ID: ${orderIdHint})`)
      if (lines.length && !message) {
        setMessage((prev) => (prev.trim() ? prev : `${lines.join('\n')}\n\nPlease describe how we can help.`))
      }
    }
  }, [orderHint, orderIdHint])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      toast.error('Please add a subject and message')
      return
    }
    setSubmitting(true)
    const res = await createCustomerSupportTicket({
      subject: subject.trim(),
      category,
      initialMessage: message.trim(),
      relatedOrderId: selectedOrderId || orderIdHint || undefined,
    })
    setSubmitting(false)
    if (!res.success) {
      toast.error(res.error || 'Could not create ticket')
      return
    }
    toast.success('Ticket created', { description: res.ticketNumber })
    setSubject('')
    setMessage('')
    setCategory('order')
    setShowNew(false)
    await load()
    if (res.ticketId) {
      window.location.href = `/account/support/${res.ticketId}`
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-gray-700" />
              Support
            </h2>
            <p className="mt-2 text-sm text-gray-600 max-w-xl">
              Open and manage support tickets connected to our team. Messages here are the same tickets we use in our
              admin support system—you can reply here instead of email when you prefer.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="shrink-0 bg-black hover:bg-gray-800"
          >
            {showNew ? (
              'Close form'
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                New ticket
              </>
            )}
          </Button>
        </div>

        {showNew && (
          <form onSubmit={handleCreate} className="mt-8 border-t border-gray-100 pt-8 space-y-4">
            {orderHint ? (
              <p className="text-sm text-gray-600 rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
                This ticket will reference order <strong>{orderHint}</strong>
                {orderIdHint ? ' (verified with your account).' : '.'}
              </p>
            ) : null}
            <div>
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What do you need help with?"
                className="mt-1"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Order</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Related order (optional)</Label>
              <Select
                value={selectedOrderId || '__none__'}
                onValueChange={(value) => setSelectedOrderId(value === '__none__' ? '' : value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={ordersLoading ? 'Loading your orders…' : 'Select an order'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific order</SelectItem>
                  {customerOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} · {new Date(order.created_at).toLocaleDateString('en-US')} · $
                      {parseFloat(order.total || '0').toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue in detail."
                rows={6}
                className="mt-1 resize-y min-h-[120px]"
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-black hover:bg-gray-800">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                'Submit ticket'
              )}
            </Button>
          </form>
        )}
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Your tickets
        </h3>
        {loading ? (
          <div className="flex justify-center py-12 text-gray-500">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <p className="text-gray-600 text-sm py-6 text-center">
            No tickets yet. Use <strong>New ticket</strong> if you need help.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/account/support/${t.id}`}
                  className="flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.ticket_number} · {new Date(t.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(t.status)}`}>
                    {t.status}
                  </span>
                  <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function AccountSupportPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg bg-white p-12 shadow-sm flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <SupportPageContent />
    </Suspense>
  )
}
