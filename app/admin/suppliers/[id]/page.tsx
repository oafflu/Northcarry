'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  Mail,
  MessageSquare,
  LineChart,
  CreditCard,
  FlaskConical,
  Send,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getAdminSupplierDetail,
  getAdminSupplierSampleRequests,
  getAdminSupplierMessages,
  sendAdminSupplierMessage,
} from '@/app/actions/admin-suppliers'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export default function AdminSupplierDetailPage() {
  const params = useParams()
  const supplierId = params.id as string

  const [detail, setDetail] = useState<any>(null)
  const [samples, setSamples] = useState<any>(null)
  const [messages, setMessages] = useState<{ chatId: string | null; list: any[] }>({
    chatId: null,
    list: [],
  })
  const [loading, setLoading] = useState(true)
  const [msgDraft, setMsgDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState('overview')

  const loadAll = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    try {
      const [d, s, m] = await Promise.all([
        getAdminSupplierDetail(supplierId),
        getAdminSupplierSampleRequests(supplierId),
        getAdminSupplierMessages(supplierId),
      ])
      if (d.error) {
        toast.error(d.error)
        setDetail(null)
      } else {
        setDetail(d.data)
      }
      if (s.error) toast.error(s.error)
      else setSamples(s.data)
      if (m.error) {
        toast.error(m.error)
        setMessages({ chatId: null, list: [] })
      } else {
        setMessages({ chatId: m.chatId, list: m.messages || [] })
      }
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSend = async () => {
    const text = msgDraft.trim()
    if (!text) return
    setSending(true)
    const res = await sendAdminSupplierMessage(supplierId, text)
    setSending(false)
    if (!res.success) {
      toast.error(res.error || 'Failed to send')
      return
    }
    toast.success('Message sent')
    setMsgDraft('')
    const m = await getAdminSupplierMessages(supplierId)
    if (!m.error) setMessages({ chatId: m.chatId, list: m.messages || [] })
  }

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading supplier…
      </div>
    )
  }

  if (!detail?.profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/suppliers" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to suppliers
          </Link>
        </Button>
        <p className="text-gray-600">Supplier not found.</p>
      </div>
    )
  }

  const p = detail.profile
  const perf = detail.performanceComputed
  const addr = p.business_address

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2 -ml-2">
            <Link href="/admin/suppliers" className="gap-2 text-gray-600">
              <ArrowLeft className="w-4 h-4" />
              All suppliers
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-teal-600 shrink-0" />
            {p.displayName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {p.email && (
              <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-teal-700">
                <Mail className="w-4 h-4" />
                {p.email}
              </a>
            )}
            {p.phone && <span>{p.phone}</span>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>90-day assignments</CardDescription>
            <CardTitle className="text-2xl">{perf.totalAssignments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Shipped / delivered</CardDescription>
            <CardTitle className="text-2xl">{perf.shippedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fulfillment rate</CardDescription>
            <CardTitle className="text-2xl">
              {perf.fulfillmentRatePct != null ? `${perf.fulfillmentRatePct}%` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. time to ship</CardDescription>
            <CardTitle className="text-2xl">
              {perf.avgFulfillmentHours != null ? `${perf.avgFulfillmentHours}h` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-1 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger value="overview" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <LineChart className="w-3.5 h-3.5 shrink-0" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-1.5 col-span-2 sm:col-span-1 lg:col-span-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            Research
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4 min-h-[200px] focus-visible:outline-none">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2 text-gray-700">
                {p.company_name && (
                  <p>
                    <span className="text-gray-500">Company:</span> {p.company_name}
                  </p>
                )}
                {p.contact_person && (
                  <p>
                    <span className="text-gray-500">Contact:</span> {p.contact_person}
                  </p>
                )}
                {p.tax_id && (
                  <p>
                    <span className="text-gray-500">Tax ID:</span> {p.tax_id}
                  </p>
                )}
                {addr && (
                  <p>
                    <span className="text-gray-500">Business address:</span>{' '}
                    {typeof addr === 'string' ? addr : JSON.stringify(addr)}
                  </p>
                )}
                <p className="text-xs text-gray-400 pt-2">
                  Supplier since {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Catalog links</CardTitle>
                <CardDescription>Active SKUs and storefront variant links</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>
                  <span className="font-medium text-gray-900">{perf.inventorySkuCount}</span>{' '}
                  active inventory SKUs
                </p>
                <p>
                  <span className="font-medium text-gray-900">{perf.linkedVariantsCount}</span>{' '}
                  linked product variants
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/admin/products">Manage products & links</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent assignments</CardTitle>
              <CardDescription>Last 90 days — newest first</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!detail.assignmentsRecent?.length ? (
                <p className="p-6 text-sm text-gray-500">No assignments in this window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Shipped</TableHead>
                      <TableHead className="text-right">Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.assignmentsRecent.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Badge variant="secondary">{a.assignment_status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {a.created_at
                            ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {a.shipped_at
                            ? formatDistanceToNow(new Date(a.shipped_at), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="link" className="h-auto p-0" asChild>
                            <Link href={`/admin/orders/${a.order_id}`}>
                              View order
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4 space-y-4 min-h-[200px] focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Direct messages</CardTitle>
              <CardDescription>
                The supplier receives an <strong>email</strong> and a <strong>push notification</strong> (when enabled in
                settings). They can reply from <strong>Supplier portal → Messages</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-gray-50 max-h-[360px] overflow-y-auto p-4 space-y-3">
                {messages.list.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No messages yet. Send the first note below.
                  </p>
                ) : (
                  messages.list.map((m: any) => {
                    const mine = m.senderType === 'admin'
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            mine
                              ? 'bg-teal-600 text-white'
                              : 'bg-white border text-gray-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <p
                            className={`text-[10px] mt-1 ${mine ? 'text-teal-100' : 'text-gray-400'}`}
                          >
                            {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  placeholder="Write a message to the supplier…"
                  value={msgDraft}
                  onChange={(e) => setMsgDraft(e.target.value)}
                  rows={3}
                  className="flex-1 min-h-[80px]"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !msgDraft.trim()}
                  className="shrink-0 bg-teal-600 hover:bg-teal-700"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-4 min-h-[200px] focus-visible:outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Computed (last {perf.periodDays} days)</CardTitle>
              <CardDescription>Based on order assignments tied to this supplier</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Returns recorded (same window)</p>
                <p className="text-xl font-semibold">{perf.returnsCount}</p>
              </div>
              <div>
                <p className="text-gray-500">Cancelled assignments</p>
                <p className="text-xl font-semibold">{perf.cancelledCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment log ({perf.periodDays} days)</CardTitle>
              <CardDescription>Up to 500 rows — use for SLA and fulfillment review</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!detail.assignmentsPeriod?.length ? (
                <p className="p-6 text-sm text-gray-500">No assignments in this period.</p>
              ) : (
                <div className="max-h-[420px] overflow-auto border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Shipped</TableHead>
                        <TableHead className="text-right">Order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.assignmentsPeriod.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Badge variant="outline">{a.assignment_status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                            {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                            {a.shipped_at ? new Date(a.shipped_at).toLocaleString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="link" className="h-auto p-0 text-sm" asChild>
                              <Link href={`/admin/orders/${a.order_id}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {detail.performanceRows?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stored scorecards</CardTitle>
                <CardDescription>Rows in supplier_performance (if your ops team maintains them)</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>On-time %</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.performanceRows.map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">
                          {row.period_start} → {row.period_end}
                        </TableCell>
                        <TableCell>{row.on_time_delivery_rate ?? '—'}</TableCell>
                        <TableCell>{row.quality_score ?? '—'}</TableCell>
                        <TableCell>{row.overall_score ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4 min-h-[200px] focus-visible:outline-none">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Invoices</CardTitle>
                <CardDescription>Recent supplier invoices (up to 100)</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/payments">All payments</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 max-h-[480px] overflow-auto">
              {!detail.invoicesRecent?.length ? (
                <p className="p-6 text-sm text-gray-500">No invoices yet for this supplier.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.invoicesRecent.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inv.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">${inv.totalAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="link" className="h-auto p-0" asChild>
                            <Link href={`/admin/payments/${inv.id}`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="mt-4 space-y-6 min-h-[200px] focus-visible:outline-none">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => loadAll()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh lists'}
            </Button>
            <Button type="button" variant="default" size="sm" className="bg-teal-600 hover:bg-teal-700" asChild>
              <Link href={`/admin/sample-requests/new?supplier_id=${supplierId}`}>New sample request</Link>
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Creating or updating sample requests emails and pushes the supplier (new request). Suppliers manage
            these in their portal under Research & updates (<span className="font-mono">/supplier/research-updates</span>
            ). When the supplier changes status, admins and partners get email and push.
          </p>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-violet-600" />
              New product research
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Custom / new SKU sample requests (request type: custom_product)
            </p>
            <SampleTable
              rows={samples?.newProductResearch || []}
              empty="No custom product sample requests."
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Existing product — rebrand & version updates
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Samples tied to catalog products or supplier inventory (existing_product)
            </p>
            <SampleTable
              rows={samples?.existingProductUpdates || []}
              empty="No existing-product sample requests."
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SampleTable({ rows, empty }: { rows: any[]; empty: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-gray-500 text-center">{empty}</div>
    )
  }
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / topic</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.request_type === 'custom_product'
                  ? r.custom_product_name || 'Custom product'
                  : 'Existing product sample'}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{r.status}</Badge>
              </TableCell>
              <TableCell className="text-sm text-gray-600">
                {r.created_at
                  ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true })
                  : '—'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={`/admin/sample-requests/${r.id}`}>Details</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
