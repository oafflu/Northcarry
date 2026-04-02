'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getSystemLogs, getSystemLogStats, type SystemLog, type SystemLogFilters } from '@/app/actions/system-logs'
import { toast } from 'sonner'
import { Search, Filter, Download, Trash2, Calendar, User, MapPin, Globe, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

const ACTION_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'order_management', label: 'Order Management' },
  { value: 'customer_management', label: 'Customer Management' },
  { value: 'product_management', label: 'Product Management' },
  { value: 'inventory_management', label: 'Inventory Management' },
  { value: 'cms', label: 'CMS' },
  { value: 'support', label: 'Support' },
  { value: 'media_library', label: 'Media Library' },
  { value: 'settings', label: 'Settings' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'email_marketing', label: 'Email Marketing' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'other', label: 'Other' },
]

const USER_ROLES = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'marketer', label: 'Marketer' },
  { value: 'partner', label: 'Partner' },
  { value: 'customer', label: 'Customer' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
]

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<any>(null)
  const pageSize = 50

  const [filters, setFilters] = useState<SystemLogFilters>({
    userRole: 'all',
    actionCategory: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    search: '',
  })

  useEffect(() => {
    loadLogs()
    loadStats()
  }, [page, filters])

  const loadLogs = async () => {
    setLoading(true)
    const activeFilters: SystemLogFilters = {}
    if (filters.userRole && filters.userRole !== 'all') activeFilters.userRole = filters.userRole
    if (filters.actionCategory && filters.actionCategory !== 'all') activeFilters.actionCategory = filters.actionCategory
    if (filters.status && filters.status !== 'all') activeFilters.status = filters.status
    if (filters.dateFrom) activeFilters.dateFrom = filters.dateFrom
    if (filters.dateTo) activeFilters.dateTo = filters.dateTo
    if (filters.search) activeFilters.search = filters.search

    const result = await getSystemLogs(activeFilters, page, pageSize)
    if (result.success && result.data) {
      setLogs(result.data)
      setTotalCount(result.count || 0)
    } else {
      toast.error(result.error || 'Failed to load logs')
    }
    setLoading(false)
  }

  const loadStats = async () => {
    const activeFilters: SystemLogFilters = {}
    if (filters.userRole && filters.userRole !== 'all') activeFilters.userRole = filters.userRole
    if (filters.actionCategory && filters.actionCategory !== 'all') activeFilters.actionCategory = filters.actionCategory
    if (filters.status && filters.status !== 'all') activeFilters.status = filters.status
    if (filters.dateFrom) activeFilters.dateFrom = filters.dateFrom
    if (filters.dateTo) activeFilters.dateTo = filters.dateTo

    const result = await getSystemLogStats(activeFilters)
    if (result.success && result.data) {
      setStats(result.data)
    }
  }

  const handleFilterChange = (key: keyof SystemLogFilters, value: string) => {
    setFilters({ ...filters, [key]: value })
    setPage(1) // Reset to first page when filters change
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      success: 'default',
      error: 'destructive',
      warning: 'secondary',
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      order_management: 'bg-blue-100 text-blue-800',
      customer_management: 'bg-green-100 text-green-800',
      product_management: 'bg-purple-100 text-purple-800',
      inventory_management: 'bg-orange-100 text-orange-800',
      cms: 'bg-pink-100 text-pink-800',
      support: 'bg-yellow-100 text-yellow-800',
      media_library: 'bg-indigo-100 text-indigo-800',
      settings: 'bg-gray-100 text-gray-800',
      subscriptions: 'bg-teal-100 text-teal-800',
      email_marketing: 'bg-cyan-100 text-cyan-800',
      authentication: 'bg-red-100 text-red-800',
      other: 'bg-slate-100 text-slate-800',
    }
    return (
      <Badge className={colors[category] || 'bg-gray-100 text-gray-800'}>
        {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    )
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">System Logs</h1>
        <p className="text-gray-600 mt-1">Comprehensive activity log for all user actions</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.byStatus?.success || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.byStatus?.error || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.byStatus?.warning || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter logs by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search logs..."
                  value={filters.search || ''}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filters.actionCategory || 'all'} onValueChange={(value) => handleFilterChange('actionCategory', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>User Role</Label>
              <Select value={filters.userRole || 'all'} onValueChange={(value) => handleFilterChange('userRole', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} logs
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No logs found</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getCategoryBadge(log.action_category)}
                        {getStatusBadge(log.status)}
                        <span className="text-sm text-gray-500">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{log.action_description}</p>
                      {log.action_type && (
                        <p className="text-sm text-gray-500 mt-1">Action: {log.action_type}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 text-sm">
                    {log.user_name && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span>
                          {log.user_name}
                          {log.user_role && <span className="text-gray-400"> ({log.user_role})</span>}
                        </span>
                      </div>
                    )}

                    {log.ip_address && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Globe className="h-4 w-4" />
                        <span>{log.ip_address}</span>
                      </div>
                    )}

                    {(log.country || log.city) && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {[log.city, log.region, log.country].filter(Boolean).join(', ') || 'Unknown location'}
                        </span>
                      </div>
                    )}

                    {log.resource_name && (
                      <div className="text-gray-600">
                        <span className="font-medium">Resource:</span> {log.resource_name}
                      </div>
                    )}
                  </div>

                  {log.error_message && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      <strong>Error:</strong> {log.error_message}
                    </div>
                  )}

                  {log.action_details && Object.keys(log.action_details).length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                        View Details
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(log.action_details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
