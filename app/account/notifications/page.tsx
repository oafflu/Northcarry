'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, X, CheckCheck, Trash2, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '@/app/actions/notifications'

interface Notification {
  id: string
  notification_type: string
  title: string
  body: string
  status: 'sent' | 'failed' | 'clicked'
  sent_at: string
  clicked_at: string | null
  data: any
  related_entity_type: string | null
  related_entity_id: string | null
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadNotifications()
  }, [filter, typeFilter])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const result = await getUserNotifications({
        limit: 100,
        unreadOnly: filter === 'unread',
        type: typeFilter !== 'all' ? typeFilter : undefined,
      })

      if (result.success) {
        setNotifications(result.data as Notification[])
      } else {
        toast.error('Failed to load notifications')
      }
    } catch (error: any) {
      console.error('Error loading notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    setProcessing(id)
    try {
      const result = await markNotificationAsRead(id)
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, status: 'clicked' as const, clicked_at: new Date().toISOString() }
              : n
          )
        )
        toast.success('Notification marked as read')
      } else {
        toast.error(result.error || 'Failed to mark as read')
      }
    } catch (error: any) {
      toast.error('Failed to mark as read')
    } finally {
      setProcessing(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    setProcessing('all')
    try {
      const result = await markAllNotificationsAsRead()
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            status: 'clicked' as const,
            clicked_at: n.clicked_at || new Date().toISOString(),
          }))
        )
        toast.success('All notifications marked as read')
      } else {
        toast.error(result.error || 'Failed to mark all as read')
      }
    } catch (error: any) {
      toast.error('Failed to mark all as read')
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification?')) {
      return
    }

    setProcessing(id)
    try {
      const result = await deleteNotification(id)
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
        toast.success('Notification deleted')
      } else {
        toast.error(result.error || 'Failed to delete notification')
      }
    } catch (error: any) {
      toast.error('Failed to delete notification')
    } finally {
      setProcessing(null)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
      case 'order_confirmed':
      case 'order_shipped':
      case 'order_delivered':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'order_confirmed':
      case 'order_shipped':
      case 'order_delivered':
        return '📦'
      case 'promotional':
        return '🎉'
      case 'abandoned_cart':
        return '🛒'
      case 'low_stock':
      case 'new_order':
        return '⚠️'
      default:
        return '🔔'
    }
  }

  const getNotificationUrl = (notification: Notification): string | null => {
    if (notification.data?.url || notification.data?.link) {
      return notification.data.url || notification.data.link
    }

    if (notification.related_entity_type === 'order' && notification.related_entity_id) {
      return `/account/orders/${notification.related_entity_id}`
    }

    if (notification.related_entity_type === 'product' && notification.related_entity_id) {
      return `/product/${notification.related_entity_id}`
    }

    return null
  }

  const unreadCount = notifications.filter((n) => n.status !== 'clicked').length
  const readCount = notifications.filter((n) => n.status === 'clicked').length

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter((n) => n.status !== 'clicked')
      : filter === 'read'
      ? notifications.filter((n) => n.status === 'clicked')
      : notifications

  const notificationTypes = Array.from(
    new Set(notifications.map((n) => n.notification_type))
  ).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-gray-600 mt-1">View and manage your notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadNotifications}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={processing === 'all'}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <Bell className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-blue-600">{unreadCount}</p>
              </div>
              <Bell className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Read</p>
                <p className="text-2xl font-bold text-gray-600">{readCount}</p>
              </div>
              <Check className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Status
              </label>
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Notifications</CardTitle>
          <CardDescription>
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">No notifications</p>
              <p className="text-gray-600">
                {filter === 'unread'
                  ? "You're all caught up! No unread notifications."
                  : filter === 'read'
                  ? 'No read notifications found.'
                  : "You don't have any notifications yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((notification) => {
                const isRead = notification.status === 'clicked'
                const url = getNotificationUrl(notification)

                return (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isRead
                        ? 'bg-gray-50 border-gray-200 opacity-75'
                        : 'bg-white border-gray-200 shadow-sm'
                    } ${getTypeColor(notification.notification_type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getTypeIcon(notification.notification_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm mb-1">{notification.title}</h3>
                            <p className="text-sm opacity-90 mb-2">{notification.body}</p>
                            <div className="flex items-center gap-4 text-xs opacity-75">
                              <span>
                                {formatDistanceToNow(new Date(notification.sent_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              <span className="capitalize">
                                {notification.notification_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isRead && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleMarkAsRead(notification.id)}
                                disabled={processing === notification.id}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDelete(notification.id)}
                              disabled={processing === notification.id}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {url && (
                          <Link
                            href={url}
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="text-xs underline mt-2 inline-block hover:no-underline"
                          >
                            View details →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
