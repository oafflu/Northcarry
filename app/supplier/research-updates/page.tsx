'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Eye, Package, FileText, FlaskConical, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupplierSampleRequests } from '@/app/actions/sample-requests'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/translations/supplier/context'
import { formatDistanceToNow } from 'date-fns'

export default function SupplierResearchUpdatesPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadRequests = async () => {
    setLoading(true)
    try {
      const result = await getSupplierSampleRequests()
      if (result.error) {
        toast.error(t('sampleRequests.failedToLoad'))
      } else {
        setRequests(result.data || [])
      }
    } catch (error) {
      console.error('Error loading research / sample requests:', error)
      toast.error(t('sampleRequests.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const { newProductResearch, existingProductUpdates } = useMemo(() => {
    const custom = requests.filter((r) => r.request_type === 'custom_product')
    const existing = requests.filter((r) => r.request_type === 'existing_product')
    return { newProductResearch: custom, existingProductUpdates: existing }
  }, [requests])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-blue-100 text-blue-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'refunded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProductName = (request: any) => {
    if (request.request_type === 'custom_product') {
      return request.custom_product_name || t('sampleRequests.customProduct')
    }
    const inventoryCount = request.supplier_inventory_ids?.length || 0
    const productCount = request.product_ids?.length || 0
    const totalCount = inventoryCount + productCount
    if (totalCount > 1) {
      return `${totalCount} ${t('sampleRequests.products')}`
    }
    if (request.supplier_inventory) {
      return request.supplier_inventory.product_name
    }
    if (request.products) {
      return request.products.title
    }
    return t('sampleRequests.unknownProduct')
  }

  const getAdminName = (request: any) => {
    const admin = request.admin
    if (admin?.first_name || admin?.last_name) {
      return `${admin.first_name || ''} ${admin.last_name || ''}`.trim()
    }
    return admin?.email || 'BREVI'
  }

  function RequestTable({
    rows,
    emptyKey,
  }: {
    rows: any[]
    emptyKey: string
  }) {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t('common.loading')}
        </div>
      )
    }
    if (!rows.length) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
          {t(emptyKey)}
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-gray-200 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs font-medium uppercase text-gray-500">
                {t('sampleRequests.product')}
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500">
                {t('sampleRequests.requestedBy')}
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500">
                {t('sampleRequests.status')}
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500">
                {t('sampleRequests.payment')}
              </TableHead>
              <TableHead className="text-xs font-medium uppercase text-gray-500">
                {t('researchUpdates.updated')}
              </TableHead>
              <TableHead className="text-right text-xs font-medium uppercase text-gray-500">
                {t('sampleRequests.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((request) => (
              <TableRow key={request.id} className="hover:bg-gray-50/80">
                <TableCell>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {request.request_type === 'custom_product' ? (
                        <FileText className="w-4 h-4 text-gray-500" />
                      ) : (
                        <Package className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{getProductName(request)}</p>
                      {request.request_type === 'existing_product' &&
                        !request.supplier_inventory_ids?.length &&
                        !request.product_ids?.length &&
                        request.product_variants && (
                          <p className="text-xs text-gray-500">
                            {t('sampleRequests.color')}: {request.product_variants.color}
                          </p>
                        )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-900 whitespace-nowrap">{getAdminName(request)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getPaymentStatusColor(request.payment_status)} variant="outline">
                    {request.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                  {request.updated_at
                    ? formatDistanceToNow(new Date(request.updated_at), { addSuffix: true })
                    : request.created_at
                      ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true })
                      : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/supplier/sample-requests/${request.id}`}
                    className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    {t('researchUpdates.open')}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('researchUpdates.pageTitle')}</h1>
          </div>
          <p className="text-gray-600 max-w-2xl text-sm sm:text-base">{t('researchUpdates.pageSubtitle')}</p>
          <p className="text-xs text-gray-500">
            <Link href="/supplier/messages" className="text-teal-600 hover:underline font-medium">
              {t('researchUpdates.contactMessages')}
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => loadRequests()}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {t('researchUpdates.refresh')}
        </Button>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            {t('researchUpdates.newProductTitle')}
          </CardTitle>
          <CardDescription>{t('researchUpdates.newProductDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestTable rows={newProductResearch} emptyKey="researchUpdates.emptyNew" />
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('researchUpdates.existingTitle')}</CardTitle>
          <CardDescription>{t('researchUpdates.existingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestTable rows={existingProductUpdates} emptyKey="researchUpdates.emptyExisting" />
        </CardContent>
      </Card>
    </div>
  )
}
