'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Download, Trash2 } from 'lucide-react'
import { getNewsletterSubscriptions, updateNewsletterSubscription, deleteNewsletterSubscription } from '@/app/actions/newsletter'
import { toast } from 'sonner'

export default function NewsletterPage() {
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadSubscriptions()
  }, [])

  const loadSubscriptions = async () => {
    setLoading(true)
    const result = await getNewsletterSubscriptions()
    if (result.error) {
      toast.error('Failed to load newsletter subscriptions')
    } else {
      setSubscriptions(result.data || [])
    }
    setLoading(false)
  }

  const handleStatusChange = async (id: string, newStatus: 'active' | 'unsubscribed' | 'bounced') => {
    const result = await updateNewsletterSubscription(id, { status: newStatus })
    if (result.success) {
      toast.success('Subscription updated successfully')
      loadSubscriptions()
    } else {
      toast.error(result.error || 'Failed to update subscription')
    }
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the subscription for ${email}?`)) {
      return
    }

    const result = await deleteNewsletterSubscription(id)
    if (result.success) {
      toast.success('Subscription deleted successfully')
      loadSubscriptions()
    } else {
      toast.error(result.error || 'Failed to delete subscription')
    }
  }

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = 
      sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.first_name && sub.first_name.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const exportToCSV = () => {
    const headers = ['Email', 'First Name', 'Status', 'Subscribed At', 'Source']
    const rows = filteredSubscriptions.map(sub => [
      sub.email,
      sub.first_name || '',
      sub.status,
      new Date(sub.subscribed_at).toLocaleDateString(),
      sub.source || 'website',
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-subscriptions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    unsubscribed: subscriptions.filter(s => s.status === 'unsubscribed').length,
    bounced: subscriptions.filter(s => s.status === 'bounced').length,
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Newsletter Subscriptions</h1>
          <p className="text-gray-600 mt-1">Manage newsletter subscribers</p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Subscribers</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Unsubscribed</div>
          <div className="text-2xl font-bold text-gray-600">{stats.unsubscribed}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Bounced</div>
          <div className="text-2xl font-bold text-red-600">{stats.bounced}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading subscriptions...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Subscribed</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Source</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'No subscriptions found matching your filters' 
                      : 'No newsletter subscriptions yet'}
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{sub.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">{sub.first_name || '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={sub.status}
                        onValueChange={(value: 'active' | 'unsubscribed' | 'bounced') => 
                          handleStatusChange(sub.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                          <SelectItem value="bounced">Bounced</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-600">
                        {new Date(sub.subscribed_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs">
                        {sub.source || 'website'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(sub.id, sub.email)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

