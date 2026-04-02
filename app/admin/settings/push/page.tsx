'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getSetting, saveSetting } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Save, Bell, CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export default function PushNotificationSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    enabled: false,
    // Client-side Firebase config (stored in admin_settings for reference, but actual values come from env)
    firebase_api_key: '',
    firebase_auth_domain: '',
    firebase_project_id: '',
    firebase_storage_bucket: '',
    firebase_messaging_sender_id: '',
    firebase_app_id: '',
    firebase_vapid_key: '',
    // Server-side Firebase Admin config
    firebase_admin_project_id: '',
    firebase_admin_client_email: '',
    firebase_admin_private_key: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const result = await getSetting('push_notifications')
    if (result.data) {
      const savedSettings = result.data as any
      setSettings({
        enabled: savedSettings.enabled || false,
        firebase_api_key: savedSettings.firebase_api_key || '',
        firebase_auth_domain: savedSettings.firebase_auth_domain || '',
        firebase_project_id: savedSettings.firebase_project_id || '',
        firebase_storage_bucket: savedSettings.firebase_storage_bucket || '',
        firebase_messaging_sender_id: savedSettings.firebase_messaging_sender_id || '',
        firebase_app_id: savedSettings.firebase_app_id || '',
        firebase_vapid_key: savedSettings.firebase_vapid_key || '',
        firebase_admin_project_id: savedSettings.firebase_admin_project_id || '',
        firebase_admin_client_email: savedSettings.firebase_admin_client_email || '',
        firebase_admin_private_key: savedSettings.firebase_admin_private_key || '',
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await saveSetting('push_notifications', settings, 'push', 'Firebase Cloud Messaging configuration')
    if (result.success) {
      toast.success('FCM settings saved successfully!')
    } else {
      toast.error(result.error || 'Failed to save settings')
    }
    setSaving(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>
  }

  // Check which env vars are configured
  // Note: In Next.js, NEXT_PUBLIC_* vars are embedded at build time
  // If they're missing here, they weren't set during the build
  const envVars = {
    apiKey: !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: !!(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: !!(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: !!(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: !!(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: !!(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    vapidKey: !!(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
    // Server-side vars can't be checked from client
    adminProjectId: true,
    adminClientEmail: true,
    adminPrivateKey: true,
  }

  const allClientVarsSet = Object.values(envVars).slice(0, 7).every(v => v)
  const hasAnyConfig = allClientVarsSet

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Firebase Cloud Messaging (FCM)</h1>
        <p className="text-gray-600 mt-1">Configure Firebase Cloud Messaging for push notifications</p>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configuration Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasAnyConfig ? (
            <div className="flex items-start gap-3 rounded-md bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Firebase configuration detected</p>
                <p className="mt-1 text-green-700">
                  Environment variables are configured. Push notifications are ready to use.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
              <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Firebase configuration required</p>
                <p className="mt-1 text-yellow-700">
                  Please configure Firebase environment variables in your deployment platform (Vercel, etc.)
                </p>
                <p className="mt-2 text-yellow-700 font-medium">
                  ⚠️ Important: After adding environment variables in Vercel, you must redeploy your application for the changes to take effect.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Client-side Config (NEXT_PUBLIC_*)</span>
              <span className={allClientVarsSet ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                {allClientVarsSet ? '✅ Configured' : '⚠️ Missing'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Server-side Config (FIREBASE_*)</span>
              <span className="text-gray-500 font-medium">Check server logs</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>FCM Settings</CardTitle>
          <CardDescription>
            Configure Firebase Cloud Messaging. Values stored here are for reference only.
            Actual configuration comes from environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Enable Push Notifications</Label>
              <p className="text-sm text-gray-500">Enable real-time push notifications via FCM</p>
            </div>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          <Separator />

          {/* Client-side Firebase Config */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Client-side Configuration</h3>
              <p className="text-sm text-gray-600 mb-4">
                These values are used in the browser. Set as <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_*</code> environment variables.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_api_key">API Key</Label>
                  {envVars.apiKey && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_api_key"
                  value={settings.firebase_api_key}
                  onChange={(e) => setSettings({ ...settings, firebase_api_key: e.target.value })}
                  placeholder="AIza..."
                  type="password"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_API_KEY</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_auth_domain">Auth Domain</Label>
                  {envVars.authDomain && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_auth_domain"
                  value={settings.firebase_auth_domain}
                  onChange={(e) => setSettings({ ...settings, firebase_auth_domain: e.target.value })}
                  placeholder="project.firebaseapp.com"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_project_id">Project ID</Label>
                  {envVars.projectId && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_project_id"
                  value={settings.firebase_project_id}
                  onChange={(e) => setSettings({ ...settings, firebase_project_id: e.target.value })}
                  placeholder="brevi-ecommerce"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_PROJECT_ID</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_storage_bucket">Storage Bucket</Label>
                  {envVars.storageBucket && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_storage_bucket"
                  value={settings.firebase_storage_bucket}
                  onChange={(e) => setSettings({ ...settings, firebase_storage_bucket: e.target.value })}
                  placeholder="project.appspot.com"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_messaging_sender_id">Messaging Sender ID</Label>
                  {envVars.messagingSenderId && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_messaging_sender_id"
                  value={settings.firebase_messaging_sender_id}
                  onChange={(e) => setSettings({ ...settings, firebase_messaging_sender_id: e.target.value })}
                  placeholder="123456789"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_app_id">App ID</Label>
                  {envVars.appId && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <Input
                  id="firebase_app_id"
                  value={settings.firebase_app_id}
                  onChange={(e) => setSettings({ ...settings, firebase_app_id: e.target.value })}
                  placeholder="1:123456789:web:abcdef"
                />
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_APP_ID</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="firebase_vapid_key">VAPID Key</Label>
                  {envVars.vapidKey && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="firebase_vapid_key"
                    value={settings.firebase_vapid_key}
                    onChange={(e) => setSettings({ ...settings, firebase_vapid_key: e.target.value })}
                    placeholder="B..."
                    type="password"
                    className="flex-1"
                  />
                  {settings.firebase_vapid_key && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(settings.firebase_vapid_key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">NEXT_PUBLIC_FIREBASE_VAPID_KEY (Web Push key pair)</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Server-side Firebase Admin Config */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Server-side Configuration</h3>
              <p className="text-sm text-gray-600 mb-4">
                These values are used server-side only. Set as <code className="bg-gray-100 px-1 rounded">FIREBASE_*</code> environment variables.
                Get these from Firebase Console → Project Settings → Service Accounts.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firebase_admin_project_id">Project ID</Label>
                <Input
                  id="firebase_admin_project_id"
                  value={settings.firebase_admin_project_id}
                  onChange={(e) => setSettings({ ...settings, firebase_admin_project_id: e.target.value })}
                  placeholder="brevi-ecommerce"
                />
                <p className="text-xs text-gray-500">FIREBASE_PROJECT_ID</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firebase_admin_client_email">Client Email</Label>
                <Input
                  id="firebase_admin_client_email"
                  value={settings.firebase_admin_client_email}
                  onChange={(e) => setSettings({ ...settings, firebase_admin_client_email: e.target.value })}
                  placeholder="firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com"
                />
                <p className="text-xs text-gray-500">FIREBASE_CLIENT_EMAIL</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="firebase_admin_private_key">Private Key</Label>
                <textarea
                  id="firebase_admin_private_key"
                  value={settings.firebase_admin_private_key}
                  onChange={(e) => setSettings({ ...settings, firebase_admin_private_key: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                  className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={4}
                />
                <p className="text-xs text-gray-500">FIREBASE_PRIVATE_KEY (Full key with newlines)</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Help Section */}
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-medium mb-2">📚 Setup Instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Create a Firebase project at{' '}
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-1"
                >
                  Firebase Console
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Enable Cloud Messaging and generate a VAPID key pair</li>
              <li>Register your web app and copy the Firebase config</li>
              <li>Generate a service account key for server-side access</li>
              <li>Add all environment variables to your deployment platform (Vercel, etc.)</li>
              <li>Values stored here are for reference - actual config comes from environment variables</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}
