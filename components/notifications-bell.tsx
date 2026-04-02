'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useNotifications } from '@/lib/notifications-context'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export function NotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Determine notifications page URL based on user role
  const getNotificationsUrl = () => {
    if (!user) return '/account/notifications'
    if (user.role === 'admin' || user.role === 'partner') return '/admin/notifications'
    if (user.role === 'supplier') return '/supplier/notifications'
    return '/account/notifications'
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-teal-600 hover:text-teal-700"
                  >
                    Mark all as read
                  </button>
                )}
                <Link
                  href={getNotificationsUrl()}
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  View All
                </Link>
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No notifications</p>
              </div>
            ) : (
              <>
                {unreadNotifications.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase">New</p>
                    </div>
                    {unreadNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${getTypeColor(notification.type)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
                            <p className="text-xs opacity-90 mb-2">{notification.message}</p>
                            <p className="text-xs opacity-75">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 hover:bg-white/50 rounded"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => clearNotification(notification.id)}
                              className="p-1 hover:bg-white/50 rounded"
                              title="Dismiss"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            className="text-xs underline mt-2 inline-block"
                            onClick={() => setIsOpen(false)}
                          >
                            View details →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {readNotifications.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase">Earlier</p>
                    </div>
                    {readNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors opacity-75"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{notification.title}</h4>
                            <p className="text-xs text-gray-600 mb-2">{notification.message}</p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                          <button
                            onClick={() => clearNotification(notification.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {notification.link && (
                          <Link
                            href={notification.link}
                            className="text-xs underline mt-2 inline-block"
                            onClick={() => setIsOpen(false)}
                          >
                            View details →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

