'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Search, ChevronRight, Package, Truck, FlaskConical, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { getAdminSuppliersList, type AdminSupplierListRow } from '@/app/actions/admin-suppliers'
import { toast } from 'sonner'

export default function AdminSuppliersPage() {
  const [rows, setRows] = useState<AdminSupplierListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const res = await getAdminSuppliersList()
      if (res.error) toast.error(res.error)
      setRows(res.data || [])
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.companyName && r.companyName.toLowerCase().includes(q))
    )
  }, [rows, search])

  const totals = useMemo(() => {
    return {
      suppliers: rows.length,
      activeOps: rows.reduce((s, r) => s + r.activeAssignments, 0),
      openSamples: rows.reduce((s, r) => s + r.openSampleRequests, 0),
      pendingInv: rows.reduce((s, r) => s + r.pendingInvoiceCount, 0),
    }
  }, [rows])

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-teal-600" />
            Suppliers
          </h1>
          <p className="text-gray-600 mt-1">
            Manage supplier relationships, messaging, fulfillment, invoices, and sample / product-update
            workflows.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/sample-requests">Sample requests</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Suppliers</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.suppliers}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open assignments</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.activeOps}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open samples</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.openSamples}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending invoices</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{totals.pendingInv}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, company, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading suppliers…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {rows.length === 0 ? 'No supplier accounts yet.' : 'No matches for your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-center">Assignments</TableHead>
                  <TableHead className="text-center">Shipped (90d)</TableHead>
                  <TableHead className="text-center">Samples</TableHead>
                  <TableHead className="text-right">Pending invoices</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50/80">
                    <TableCell>
                      <div className="font-medium text-gray-900">{r.displayName}</div>
                      <div className="text-sm text-gray-500">{r.email}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.activeAssignments > 0 ? (
                        <Badge variant="secondary" className="gap-1">
                          <Truck className="w-3 h-3" />
                          {r.activeAssignments}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">{r.shippedLast90Days}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.openSampleRequests > 0 ? (
                        <Badge variant="outline" className="gap-1 text-amber-800 border-amber-200 bg-amber-50">
                          <FlaskConical className="w-3 h-3" />
                          {r.openSampleRequests}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.pendingInvoiceCount > 0 ? (
                        <div className="text-sm">
                          <span className="font-medium">{r.pendingInvoiceCount}</span>
                          <span className="text-gray-500 ml-1">
                            (${r.pendingInvoiceTotal.toFixed(2)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm" className="gap-1">
                        <Link href={`/admin/suppliers/${r.id}`}>
                          Manage
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-800 mb-2 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Quick links
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <Link href="/admin/payments" className="text-teal-700 hover:underline flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Supplier payments & invoices
            </Link>
          </li>
          <li>
            <Link href="/admin/sample-requests" className="text-teal-700 hover:underline flex items-center gap-1">
              <FlaskConical className="w-3.5 h-3.5" /> All sample requests
            </Link>
          </li>
          <li>
            <Link href="/admin/inventory" className="text-teal-700 hover:underline">
              Inventory overview
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
