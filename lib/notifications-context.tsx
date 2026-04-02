'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { requestNotificationPermission, onForegroundMessage, getFCMToken } from '@/lib/firebase-client'
import { saveFCMToken, removeFCMToken, getUserNotifications } from '@/app/actions/notifications'
import { toast } from 'sonner'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  link?: string
  metadata?: Record<string, any>
  timestamp: string
  read: boolean
}

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearNotification: (id: string) => void
  clearAll: () => void
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [mounted, setMounted] = useState(false)
  const [fcmToken, setFcmToken] = useState<string | null>(null)
  const [loadedFromDb, setLoadedFromDb] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load notifications from database
  useEffect(() => {
    if (!mounted || !user || loadedFromDb) return

    const loadNotifications = async () => {
      try {
        const result = await getUserNotifications({ limit: 50 })
        if (result.success && result.data) {
          // Convert database notifications to context format
          const dbNotifications: Notification[] = (result.data as any[]).map((n) => ({
            id: n.id,
            title: n.title,
            message: n.body,
            type: (n.notification_type as any) || 'info',
            link: n.data?.url || n.data?.link || 
                  (n.related_entity_type === 'order' && n.related_entity_id 
                    ? `/account/orders/${n.related_entity_id}` 
                    : undefined),
            metadata: n.data || {},
            timestamp: n.sent_at,
            read: n.status === 'clicked',
          }))
          setNotifications(dbNotifications)
          setLoadedFromDb(true)
        }
      } catch (error) {
        console.error('Error loading notifications from database:', error)
      }
    }

    loadNotifications()
  }, [user, mounted, loadedFromDb])

  // Initialize FCM and register token
  useEffect(() => {
    if (!mounted || !user) return

    const initializeFCM = async () => {
      try {
        // Check if Firebase is configured
        if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
          console.warn('Firebase not configured - skipping FCM initialization')
          return
        }

        // Register service worker
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
            console.log('Service Worker registered:', registration)
          } catch (error) {
            console.error('Service Worker registration failed:', error)
            return
          }
        }

        // Only get token if permission is already granted (don't request automatically)
        // Permission requests must be triggered by user action
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            // Permission already granted, get token
            try {
              const token = await getFCMToken()
              if (token) {
                console.log('FCM Token obtained:', token.substring(0, 20) + '...')
                setFcmToken(token)
                await saveFCMToken(token, 'web')
              }
            } catch (error) {
              console.error('Error getting FCM token:', error)
            }
          } else {
            console.log('Notification permission not granted. User must enable notifications manually.')
          }
        }
      } catch (error) {
        console.error('Error initializing FCM:', error)
      }
    }

    initializeFCM()

    // Listen for foreground messages
    onForegroundMessage((payload) => {
      console.log('Foreground notification received:', payload)
      
      const notification: Notification = {
        id: `notif-${Date.now()}-${Math.random()}`,
        title: payload.notification?.title || payload.data?.title || 'New notification',
        message: payload.notification?.body || payload.data?.message || '',
        type: (payload.data?.type as any) || 'info',
        link: payload.data?.url || payload.data?.link,
        metadata: payload.data,
        timestamp: new Date().toISOString(),
        read: false,
      }

      setNotifications((prev) => {
        // Avoid duplicates - check if notification with same title/message already exists
        const exists = prev.some(
          (n) => n.title === notification.title && 
                 n.message === notification.message &&
                 Math.abs(new Date(n.timestamp).getTime() - new Date(notification.timestamp).getTime()) < 5000
        )
        if (exists) return prev
        return [notification, ...prev]
      })

      // Show toast notification
      const toastType = notification.type === 'error' ? 'error' : 
                       notification.type === 'warning' ? 'warning' : 
                       notification.type === 'success' ? 'success' : 'info'
      
      toast[toastType](notification.title, {
        description: notification.message,
        action: notification.link ? {
          label: 'View',
          onClick: () => window.location.href = notification.link!,
        } : undefined,
      })
    })

    // Cleanup on logout
    return () => {
      if (fcmToken) {
        removeFCMToken(fcmToken).catch(console.error)
      }
    }
  }, [user, mounted, fcmToken])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    )
  }, [])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })))
  }, [])

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider')
  }
  return context
}
