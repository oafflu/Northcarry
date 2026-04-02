'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdminOrPartner() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null as any, profile: null as any, error: 'Not authenticated' as const }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name, email')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { user: null as any, profile: null as any, error: 'Unauthorized' as const }
  }
  return { user, profile, error: null as const }
}

function supplierDisplayName(p: {
  company_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}) {
  if (p.company_name?.trim()) return p.company_name.trim()
  const n = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  if (n) return n
  return p.email || 'Supplier'
}

export type AdminSupplierListRow = {
  id: string
  email: string | null
  displayName: string
  companyName: string | null
  createdAt: string | null
  activeAssignments: number
  shippedLast90Days: number
  openSampleRequests: number
  pendingInvoiceCount: number
  pendingInvoiceTotal: number
}

/** Dashboard table: all suppliers with operational counts */
export async function getAdminSuppliersList() {
  const gate = await requireAdminOrPartner()
  if (gate.error) return { data: [] as AdminSupplierListRow[], error: gate.error }

  const admin = createAdminSupabaseClient()
  const { data: suppliers, error: supErr } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name, created_at')
    .eq('role', 'supplier')
    .order('company_name', { ascending: true, nullsFirst: false })

  if (supErr) {
    console.error('getAdminSuppliersList suppliers:', supErr)
    return { data: [], error: supErr.message }
  }

  const ids = (suppliers || []).map((s) => s.id)
  if (ids.length === 0) return { data: [], error: null }

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const [assignRes, sampleRes, invRes] = await Promise.all([
    admin
      .from('supplier_order_assignments')
      .select('id, supplier_id, assignment_status, created_at, shipped_at')
      .in('supplier_id', ids),
    admin
      .from('sample_requests')
      .select('id, supplier_id, status, request_type')
      .in('supplier_id', ids),
    admin
      .from('supplier_invoices')
      .select('id, supplier_id, status, total_amount, amount')
      .in('supplier_id', ids),
  ])

  const assignments = assignRes.data || []
  const samples = sampleRes.data || []
  const invoices = invRes.data || []

  const activeStatuses = new Set(['pending', 'acknowledged', 'processing', 'ready'])

  const bySupplier = (rows: { supplier_id: string }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      m.set(r.supplier_id, (m.get(r.supplier_id) || 0) + 1)
    }
    return m
  }

  const activeAssignmentCounts = new Map<string, number>()
  const shipped90Counts = new Map<string, number>()

  for (const a of assignments) {
    if (!a.supplier_id) continue
    if (a.assignment_status && activeStatuses.has(a.assignment_status)) {
      activeAssignmentCounts.set(
        a.supplier_id,
        (activeAssignmentCounts.get(a.supplier_id) || 0) + 1
      )
    }
    if (
      (a.assignment_status === 'shipped' || a.assignment_status === 'delivered') &&
      a.shipped_at &&
      new Date(a.shipped_at) >= since
    ) {
      shipped90Counts.set(a.supplier_id, (shipped90Counts.get(a.supplier_id) || 0) + 1)
    }
  }

  const openSampleStatuses = new Set(['pending', 'approved', 'shipped'])
  const openSampleBySupplier = new Map<string, number>()
  for (const s of samples) {
    if (!s.supplier_id || !openSampleStatuses.has(s.status || '')) continue
    openSampleBySupplier.set(
      s.supplier_id,
      (openSampleBySupplier.get(s.supplier_id) || 0) + 1
    )
  }

  const pendingInvCount = new Map<string, number>()
  const pendingInvTotal = new Map<string, number>()
  for (const inv of invoices) {
    if (!inv.supplier_id) continue
    const st = (inv.status || '').toLowerCase()
    if (st === 'paid' || st === 'cancelled') continue
    pendingInvCount.set(inv.supplier_id, (pendingInvCount.get(inv.supplier_id) || 0) + 1)
    const amt = parseFloat(String(inv.total_amount ?? inv.amount ?? 0))
    pendingInvTotal.set(inv.supplier_id, (pendingInvTotal.get(inv.supplier_id) || 0) + (Number.isFinite(amt) ? amt : 0))
  }

  const rows: AdminSupplierListRow[] = (suppliers || []).map((s) => ({
    id: s.id,
    email: s.email,
    displayName: supplierDisplayName(s),
    companyName: s.company_name,
    createdAt: s.created_at,
    activeAssignments: activeAssignmentCounts.get(s.id) || 0,
    shippedLast90Days: shipped90Counts.get(s.id) || 0,
    openSampleRequests: openSampleBySupplier.get(s.id) || 0,
    pendingInvoiceCount: pendingInvCount.get(s.id) || 0,
    pendingInvoiceTotal: Math.round((pendingInvTotal.get(s.id) || 0) * 100) / 100,
  }))

  return { data: rows, error: null }
}

export type SupplierPerformanceComputed = {
  periodDays: number
  totalAssignments: number
  shippedCount: number
  cancelledCount: number
  fulfillmentRatePct: number | null
  avgFulfillmentHours: number | null
  returnsCount: number
  inventorySkuCount: number
  linkedVariantsCount: number
}

function computePerformanceForSupplier(
  assignments: Array<{
    assignment_status: string | null
    created_at: string | null
    shipped_at: string | null
  }>,
  returnsCount: number,
  skuCount: number,
  linksCount: number,
  periodDays: number
): SupplierPerformanceComputed {
  const total = assignments.length
  const shipped = assignments.filter(
    (a) => a.assignment_status === 'shipped' || a.assignment_status === 'delivered'
  ).length
  const cancelled = assignments.filter((a) => a.assignment_status === 'cancelled').length
  const denom = total - cancelled
  const fulfillmentRatePct =
    denom > 0 ? Math.round((shipped / denom) * 1000) / 10 : null

  const hours: number[] = []
  for (const a of assignments) {
    if (!a.shipped_at || !a.created_at) continue
    if (a.assignment_status !== 'shipped' && a.assignment_status !== 'delivered') continue
    const ms = new Date(a.shipped_at).getTime() - new Date(a.created_at).getTime()
    if (ms >= 0) hours.push(ms / 3600000)
  }
  const avgFulfillmentHours =
    hours.length > 0
      ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
      : null

  return {
    periodDays,
    totalAssignments: total,
    shippedCount: shipped,
    cancelledCount: cancelled,
    fulfillmentRatePct,
    avgFulfillmentHours,
    returnsCount,
    inventorySkuCount: skuCount,
    linkedVariantsCount: linksCount,
  }
}

export async function getAdminSupplierDetail(supplierId: string) {
  const gate = await requireAdminOrPartner()
  if (gate.error) return { data: null, error: gate.error }

  const admin = createAdminSupabaseClient()
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name, phone, created_at, business_address, tax_id, contact_person')
    .eq('id', supplierId)
    .eq('role', 'supplier')
    .maybeSingle()

  if (pErr || !profile) {
    return { data: null, error: pErr?.message || 'Supplier not found' }
  }

  const since = new Date()
  since.setDate(since.getDate() - 90)

  const [
    assignRes,
    returnsRes,
    invRes,
    invCountRes,
    linksRes,
    perfRes,
  ] = await Promise.all([
    admin
      .from('supplier_order_assignments')
      .select('id, order_id, assignment_status, created_at, shipped_at, acknowledged_at')
      .eq('supplier_id', supplierId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('returns')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .gte('created_at', since.toISOString()),
    admin
      .from('supplier_invoices')
      .select('id, invoice_number, status, total_amount, amount, created_at, paid_at')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('supplier_inventory')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'active'),
    admin
      .from('product_supplier_links')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId),
    admin
      .from('supplier_performance')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('period_end', { ascending: false })
      .limit(3),
  ])

  const assignments = assignRes.data || []
  const performance = computePerformanceForSupplier(
    assignments,
    returnsRes.count || 0,
    invCountRes.count || 0,
    linksRes.count || 0,
    90
  )

  return {
    data: {
      profile: {
        ...profile,
        displayName: supplierDisplayName(profile),
      },
      assignmentsRecent: assignments.slice(0, 15),
      assignmentsPeriod: assignments,
      performanceComputed: performance,
      performanceRows: perfRes.data || [],
      invoicesRecent: (invRes.data || []).map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        status: inv.status,
        totalAmount: parseFloat(String(inv.total_amount ?? inv.amount ?? 0)),
        createdAt: inv.created_at,
        paidAt: inv.paid_at,
      })),
    },
    error: null,
  }
}

export async function getAdminSupplierSampleRequests(supplierId: string) {
  const gate = await requireAdminOrPartner()
  if (gate.error) return { data: [], error: gate.error }

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin
    .from('sample_requests')
    .select(
      `
      id,
      request_type,
      status,
      created_at,
      updated_at,
      custom_product_name,
      supplier_inventory_id,
      product_id,
      admin_notes
    `
    )
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { data: [], error: error.message }

  const custom = (data || []).filter((r: any) => r.request_type === 'custom_product')
  const existing = (data || []).filter((r: any) => r.request_type === 'existing_product')

  return { data: { all: data || [], newProductResearch: custom, existingProductUpdates: existing }, error: null }
}

export type AdminSupplierMessage = {
  id: string
  message: string
  senderType: string
  senderId: string
  createdAt: string
  isRead: boolean
}

export async function getAdminSupplierMessages(supplierId: string) {
  const gate = await requireAdminOrPartner()
  if (gate.error) return { chatId: null as string | null, messages: [] as AdminSupplierMessage[], error: gate.error }

  const admin = createAdminSupabaseClient()
  const adminId = gate.user.id

  let { data: chat } = await admin
    .from('admin_supplier_chats')
    .select('id, subject, status, last_message_at')
    .eq('admin_id', adminId)
    .eq('supplier_id', supplierId)
    .maybeSingle()

  if (!chat) {
    return { chatId: null, messages: [] as AdminSupplierMessage[], error: null }
  }

  const { data: messages, error } = await admin
    .from('admin_supplier_messages')
    .select('id, message, sender_type, sender_id, created_at, is_read')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return { chatId: chat.id, messages: [], error: error.message }

  return {
    chatId: chat.id,
    messages: (messages || []).map((m: any) => ({
      id: m.id,
      message: m.message,
      senderType: m.sender_type,
      senderId: m.sender_id,
      createdAt: m.created_at,
      isRead: m.is_read,
    })),
    error: null,
  }
}

export async function sendAdminSupplierMessage(supplierId: string, message: string) {
  const gate = await requireAdminOrPartner()
  if (gate.error) return { success: false, error: gate.error }

  const text = message.trim()
  if (!text) return { success: false, error: 'Message is empty' }

  const admin = createAdminSupabaseClient()
  const adminId = gate.user.id

  let { data: chat } = await admin
    .from('admin_supplier_chats')
    .select('id')
    .eq('admin_id', adminId)
    .eq('supplier_id', supplierId)
    .maybeSingle()

  if (!chat) {
    const { data: created, error: cErr } = await admin
      .from('admin_supplier_chats')
      .insert({
        admin_id: adminId,
        supplier_id: supplierId,
        subject: 'Admin conversation',
        status: 'open',
        priority: 'medium',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (cErr || !created) {
      console.error('sendAdminSupplierMessage create chat:', cErr)
      return { success: false, error: cErr?.message || 'Could not start chat' }
    }
    chat = created
  }

  const now = new Date().toISOString()
  const { error: mErr } = await admin.from('admin_supplier_messages').insert({
    chat_id: chat.id,
    sender_id: adminId,
    sender_type: 'admin',
    message: text,
    is_read: false,
  })

  if (mErr) {
    console.error('sendAdminSupplierMessage insert:', mErr)
    return { success: false, error: mErr.message }
  }

  await admin
    .from('admin_supplier_chats')
    .update({ last_message_at: now })
    .eq('id', chat.id)

  const { data: supplierRow } = await admin
    .from('profiles')
    .select('email, company_name, first_name, last_name')
    .eq('id', supplierId)
    .single()

  const adminName =
    `${gate.profile?.first_name || ''} ${gate.profile?.last_name || ''}`.trim() ||
    gate.profile?.email ||
    'BREVI Admin'

  const supplierName =
    supplierRow?.company_name ||
    `${supplierRow?.first_name || ''} ${supplierRow?.last_name || ''}`.trim() ||
    supplierRow?.email ||
    'Supplier'

  if (supplierRow?.email) {
    try {
      const { sendAdminToSupplierChatEmail } = await import('@/lib/email')
      await sendAdminToSupplierChatEmail(supplierRow.email, supplierName, adminName, text)
    } catch (e) {
      console.warn('sendAdminSupplierMessage email:', e)
    }
  }

  try {
    const { sendNotification } = await import('@/app/actions/notifications')
    await sendNotification(supplierId, {
      title: 'Message from BREVI',
      message: text.length > 120 ? `${text.slice(0, 117)}…` : text,
      type: 'info',
      link: '/supplier/messages',
    })
  } catch (e) {
    console.warn('sendAdminSupplierMessage notify:', e)
  }

  revalidatePath('/admin/suppliers')
  revalidatePath(`/admin/suppliers/${supplierId}`)
  revalidatePath('/supplier/messages')

  return { success: true }
}
