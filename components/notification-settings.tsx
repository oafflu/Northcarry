'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getNotificationPreferences, updateNotificationPreferences, saveFCMToken } from '@/app/actions/notifications'
import { requestNotificationPermission, getFCMToken } from '@/lib/firebase-client'
import { useToast } from '@/hooks/use-toast'
import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react'

interface NotificationPreferences {
  order_updates: boolean
  shipping_updates: boolean
  promotional: boolean
  low_stock_alerts: boolean
  new_orders: boolean
  support_tickets: boolean
  review_posted: boolean
  abandoned_cart: boolean
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [enablingNotifications, setEnablingNotifications] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadPreferences()
    checkNotificationPermission()
  }, [])

  const checkNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }

  const loadPreferences = async () => {
    const result = await getNotificationPreferences()
    if (result.success && result.data) {
      setPreferences(result.data as NotificationPreferences)
    }
    setLoading(false)
  }

  const handleEnableNotifications = async () => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      toast({
        title: 'Firebase not configured',
        description: 'Push notifications are not configured. Please contact support.',
        variant: 'destructive',
      })
      return
    }

    setEnablingNotifications(true)
    try {
      // Request permission (this requires user gesture)
      const token = await requestNotificationPermission()
      
      if (token) {
        // Save token to database
        await saveFCMToken(token, 'web')
        setNotificationPermission('granted')
        toast({
          title: 'Notifications enabled!',
          description: 'You will now receive push notifications.',
        })
      } else {
        setNotificationPermission(Notification.permission)
        if (Notification.permission === 'denied') {
          toast({
            title: 'Notifications blocked',
            description: 'Please enable notifications in your browser settings.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Permission required',
            description: 'Please allow notifications when prompted.',
          })
        }
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to enable notifications.',
        variant: 'destructive',
      })
    } finally {
      setEnablingNotifications(false)
    }
  }

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!preferences) return

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    }

    setPreferences(newPreferences)

    const result = await updateNotificationPreferences({ [key]: !preferences[key] })
    
    if (result.success) {
      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.',
      })
    } else {
      // Revert on error
      setPreferences(preferences)
      toast({
        title: 'Error',
        description: 'Failed to update preferences. Please try again.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div>Loading preferences...</div>
  }

  if (!preferences) {
    return <div>Failed to load preferences</div>
  }

  const notificationOptions: { key: keyof NotificationPreferences; label: string; description: string }[] = [
    {
      key: 'order_updates',
      label: 'Order Updates',
      description: 'Notifications about order confirmations and status changes',
    },
    {
      key: 'shipping_updates',
      label: 'Shipping Updates',
      description: 'Tracking updates and delivery notifications',
    },
    {
      key: 'promotional',
      label: 'Promotional Offers',
      description: 'Special deals, discounts, and sales announcements',
    },
    {
      key: 'abandoned_cart',
      label: 'Cart Reminders',
      description: 'Reminders about items left in your cart',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Manage your push notification preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Notification Permission Status */}
        {notificationPermission === 'default' && (
          <div className="rounded-md bg-blue-50 p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Enable Push Notifications</p>
                <p className="text-sm text-blue-700 mt-1">
                  Click the button below to enable browser push notifications. You'll be asked to allow notifications.
                </p>
                <Button
                  onClick={handleEnableNotifications}
                  disabled={enablingNotifications}
                  className="mt-3"
                  size="sm"
                >
                  {enablingNotifications ? 'Enabling...' : 'Enable Notifications'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {notificationPermission === 'granted' && (
          <div className="rounded-md bg-green-50 p-4 border border-green-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Notifications Enabled</p>
                <p className="text-sm text-green-700 mt-1">
                  You're receiving push notifications. Manage your preferences below.
                </p>
              </div>
            </div>
          </div>
        )}

        {notificationPermission === 'denied' && (
          <div className="rounded-md bg-yellow-50 p-4 border border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">Notifications Blocked</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Notifications are blocked in your browser. To enable them, please:
                </p>
                <ol className="text-sm text-yellow-700 mt-2 list-decimal list-inside space-y-1">
                  <li>Click the lock icon in your browser's address bar</li>
                  <li>Find "Notifications" in the permissions list</li>
                  <li>Change it from "Block" to "Allow"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {notificationPermission === 'granted' && (
          <>
            <div className="pt-2 border-t">
              <p className="text-sm font-medium mb-3">Notification Preferences</p>
            </div>
            {notificationOptions.map((option) => (
          <div key={option.key} className="flex items-center justify-between space-x-2">
            <Label htmlFor={option.key} className="flex flex-col space-y-1">
              <span>{option.label}</span>
              <span className="font-normal text-sm text-muted-foreground">
                {option.description}
              </span>
            </Label>
            <Switch
              id={option.key}
              checked={preferences[option.key]}
              onCheckedChange={() => handleToggle(option.key)}
            />
          </div>
            ))}
          </>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            <BellOff className="h-4 w-4 inline mr-1" />
            You can disable all notifications by blocking them in your browser settings.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
