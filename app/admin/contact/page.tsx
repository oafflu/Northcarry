'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, Mail, Eye } from 'lucide-react'
import { getContactMessages, updateContactMessage } from '@/app/actions/contact'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedMessage, setSelectedMessage] = useState<any>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    setLoading(true)
    const result = await getContactMessages()
    if (result.error) {
      toast.error('Failed to load contact messages')
    } else {
      setMessages(result.data || [])
    }
    setLoading(false)
  }

  const handleStatusChange = async (id: string, newStatus: 'new' | 'read' | 'replied' | 'archived') => {
    const result = await updateContactMessage(id, { status: newStatus })
    if (result.success) {
      toast.success('Message status updated')
      loadMessages()
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, status: newStatus })
      }
    } else {
      toast.error(result.error || 'Failed to update message')
    }
  }

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = 
      msg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: messages.length,
    new: messages.filter(m => m.status === 'new').length,
    read: messages.filter(m => m.status === 'read').length,
    replied: messages.filter(m => m.status === 'replied').length,
    archived: messages.filter(m => m.status === 'archived').length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800'
      case 'read':
        return 'bg-gray-100 text-gray-800'
      case 'replied':
        return 'bg-green-100 text-green-800'
      case 'archived':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contact Messages</h1>
          <p className="text-gray-600 mt-1">View and manage customer inquiries</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Messages</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">New</div>
          <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Read</div>
          <div className="text-2xl font-bold text-gray-600">{stats.read}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Replied</div>
          <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Archived</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.archived}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2">
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search messages..."
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
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Messages */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Loading messages...</p>
            </div>
          ) : (
            <div className="bg-white border rounded-lg divide-y">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No messages found matching your filters' 
                    : 'No contact messages yet'}
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedMessage?.id === msg.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium">{msg.name}</p>
                        <p className="text-sm text-gray-600">{msg.email}</p>
                      </div>
                      <Badge className={getStatusColor(msg.status)}>
                        {msg.status}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm mt-2">{msg.subject}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{msg.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-1">
          {selectedMessage ? (
            <div className="bg-white border rounded-lg p-6 sticky top-8">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Message Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMessage(null)}
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500">From</label>
                  <p className="font-medium">{selectedMessage.name}</p>
                  <a
                    href={`mailto:${selectedMessage.email}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {selectedMessage.email}
                  </a>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Subject</label>
                  <p className="font-medium">{selectedMessage.subject}</p>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Message</label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">
                    {selectedMessage.message}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <Select
                    value={selectedMessage.status}
                    onValueChange={(value: 'new' | 'read' | 'replied' | 'archived') =>
                      handleStatusChange(selectedMessage.id, value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="replied">Replied</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Received</label>
                  <p className="text-sm text-gray-600">
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                    className="w-full"
                  >
                    <Button className="w-full">
                      <Mail className="mr-2 h-4 w-4" />
                      Reply via Email
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-lg p-6 text-center text-gray-500">
              <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a message to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

