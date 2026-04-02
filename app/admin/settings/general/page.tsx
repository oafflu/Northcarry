'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getSetting, saveSetting } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    site_name: 'BREVI',
    site_url: '',
    maintenance_mode: false,
    allow_registration: true,
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    const result = await getSetting('general')
    if (result.data) {
      setSettings(result.data as any)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await saveSetting('general', settings, 'general', 'General website settings')
    if (result.success) {
      toast.success('Settings saved successfully!')
    } else {
      toast.error(result.error || 'Failed to save settings')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">General Settings</h1>
        <p className="text-gray-600 mt-1">Configure general website settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website Information</CardTitle>
          <CardDescription>Basic information about your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="site_name">Site Name</Label>
            <Input
              id="site_name"
              value={settings.site_name}
              onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
              placeholder="BREVI"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site_url">Site URL</Label>
            <Input
              id="site_url"
              type="url"
              value={settings.site_url}
              onChange={(e) => setSettings({ ...settings, site_url: e.target.value })}
              placeholder="https://yourdomain.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Site Status</CardTitle>
          <CardDescription>Control site availability and registration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenance_mode">Maintenance Mode</Label>
              <p className="text-sm text-gray-500">Enable to put the site in maintenance mode</p>
            </div>
            <Switch
              id="maintenance_mode"
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow_registration">Allow Registration</Label>
              <p className="text-sm text-gray-500">Allow new users to register accounts</p>
            </div>
            <Switch
              id="allow_registration"
              checked={settings.allow_registration}
              onCheckedChange={(checked) => setSettings({ ...settings, allow_registration: checked })}
            />
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

