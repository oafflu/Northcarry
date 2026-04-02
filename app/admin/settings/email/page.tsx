'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getSetting, saveSetting } from '@/app/actions/settings'
import { testEmailTemplate, testMailgunConnection, testSMTPConnection, diagnoseEmailConfiguration } from '@/app/actions/email-test'
import { toast } from 'sonner'
import { Save, Mail, Send, ExternalLink, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [emailProvider, setEmailProvider] = useState<'mailgun' | 'smtp'>('mailgun')
  const [providerSettings, setProviderSettings] = useState({
    // Mailgun settings
    mailgun_api_key: '',
    mailgun_domain: '',
    mailgun_base_url: 'https://api.mailgun.net',
    mailgun_from_email: 'hello@brevibrushes.com',
    mailgun_from_name: 'BREVI',
    /** Verifies POSTs to /api/mailgun/webhook (Mailgun → Domain → Webhooks → signing key) */
    mailgun_webhook_signing_key: '',
    // Microsoft 365 SMTP settings
    smtp_host: 'smtp.office365.com',
    smtp_port: '587',
    smtp_user: 'hello@brevibrushes.com',
    smtp_password: '',
    smtp_from_email: 'hello@brevibrushes.com',
    smtp_from_name: 'BREVI',
  })
  const [templateSettings, setTemplateSettings] = useState({
    welcome: true,
    order_confirmation: true,
    shipping_notification: true,
  })
  const [testEmail, setTestEmail] = useState('')
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false)

  useEffect(() => {
    loadSettings()
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setLoadingDiagnostics(true)
    try {
      const result = await diagnoseEmailConfiguration()
      if (result.success && result.diagnostics) {
        setDiagnostics(result.diagnostics)
      } else {
        toast.error('Failed to load diagnostics')
      }
    } catch (error) {
      console.error('Error running diagnostics:', error)
      toast.error('Failed to run diagnostics')
    } finally {
      setLoadingDiagnostics(false)
    }
  }

  const loadSettings = async () => {
    setLoading(true)
    try {
      const [providerResult, templateResult] = await Promise.all([
        getSetting('email_provider'),
        getSetting('email_templates'),
      ])
      if (providerResult.data) {
        const data = providerResult.data as any
        const provider = data.provider || 'mailgun'
        setEmailProvider(provider === 'smtp' ? 'smtp' : 'mailgun')
        setProviderSettings({
          mailgun_api_key: data.mailgun_api_key || '',
          mailgun_domain: data.mailgun_domain || '',
          mailgun_base_url: data.mailgun_base_url || 'https://api.mailgun.net',
          mailgun_from_email: data.mailgun_from_email || data.from_email || 'hello@brevibrushes.com',
          mailgun_from_name: data.mailgun_from_name || data.from_name || 'BREVI',
          mailgun_webhook_signing_key: data.mailgun_webhook_signing_key || '',
          smtp_host: data.smtp_host || data.smtp_server_host || 'smtp.office365.com',
          smtp_port: data.smtp_port || '587',
          smtp_user: data.smtp_user || data.smtp_username || data.smtp_email || 'hello@brevibrushes.com',
          smtp_password: data.smtp_password || '',
          smtp_from_email: data.smtp_from_email || data.from_email || 'hello@brevibrushes.com',
          smtp_from_name: data.smtp_from_name || data.from_name || 'BREVI',
        })
      }
      if (templateResult.data) {
        setTemplateSettings(templateResult.data as any)
      }
    } catch (error) {
      console.error('[Email Settings] Error loading settings:', error)
      toast.error('Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    
    try {
      // Validate based on selected provider
      if (emailProvider === 'mailgun') {
        if (!providerSettings.mailgun_api_key || providerSettings.mailgun_api_key.trim() === '') {
          toast.error('Mailgun API key is required')
          setSaving(false)
          return
        }
        if (!providerSettings.mailgun_domain || providerSettings.mailgun_domain.trim() === '') {
          toast.error('Mailgun domain is required')
          setSaving(false)
          return
        }
        if (!providerSettings.mailgun_from_email || !providerSettings.mailgun_from_email.includes('@')) {
          toast.error('Valid sender email address is required')
          setSaving(false)
          return
        }
      } else if (emailProvider === 'smtp') {
        if (!providerSettings.smtp_host || providerSettings.smtp_host.trim() === '') {
          toast.error('SMTP host is required')
          setSaving(false)
          return
        }
        if (!providerSettings.smtp_user || providerSettings.smtp_user.trim() === '') {
          toast.error('SMTP username/email is required')
          setSaving(false)
          return
        }
        if (!providerSettings.smtp_password || providerSettings.smtp_password.trim() === '') {
          toast.error('SMTP password is required')
          setSaving(false)
          return
        }
        if (!providerSettings.smtp_from_email || !providerSettings.smtp_from_email.includes('@')) {
          toast.error('Valid sender email address is required')
          setSaving(false)
          return
        }
      }

      // Save settings
      const settingsToSave: any = {
        provider: emailProvider,
        from_email: emailProvider === 'mailgun' 
          ? providerSettings.mailgun_from_email.trim() 
          : providerSettings.smtp_from_email.trim(),
        from_name: emailProvider === 'mailgun' 
          ? providerSettings.mailgun_from_name.trim() 
          : providerSettings.smtp_from_name.trim(),
      }

      // Add provider-specific settings
      if (emailProvider === 'mailgun') {
        const { data: existingProvider } = await getSetting('email_provider')
        const prev = (existingProvider as Record<string, unknown>) || {}
        settingsToSave.mailgun_api_key = providerSettings.mailgun_api_key.trim()
        settingsToSave.mailgun_domain = providerSettings.mailgun_domain.trim()
        settingsToSave.mailgun_base_url = providerSettings.mailgun_base_url.trim()
        settingsToSave.mailgun_from_email = providerSettings.mailgun_from_email.trim()
        settingsToSave.mailgun_from_name = providerSettings.mailgun_from_name.trim()
        const wh = providerSettings.mailgun_webhook_signing_key?.trim()
        settingsToSave.mailgun_webhook_signing_key =
          wh || String(prev.mailgun_webhook_signing_key || '')
      } else if (emailProvider === 'smtp') {
        settingsToSave.smtp_host = providerSettings.smtp_host.trim()
        settingsToSave.smtp_port = providerSettings.smtp_port.trim()
        settingsToSave.smtp_user = providerSettings.smtp_user.trim()
        settingsToSave.smtp_password = providerSettings.smtp_password.trim()
        settingsToSave.smtp_from_email = providerSettings.smtp_from_email.trim()
        settingsToSave.smtp_from_name = providerSettings.smtp_from_name.trim()
      }
      
      const [providerResult, templateResult] = await Promise.all([
        saveSetting('email_provider', settingsToSave, 'email', 'Email service provider configuration'),
        saveSetting('email_templates', templateSettings, 'email', 'Email template settings'),
      ])
      
      if (providerResult.success && templateResult.success) {
        toast.success('Email settings saved successfully!')
        await loadSettings()
      } else {
        const errorMsg = providerResult.error || templateResult.error || 'Unknown error'
        console.error('[Email Settings] Save failed:', errorMsg)
        toast.error(`Failed to save email settings: ${errorMsg}`)
      }
    } catch (error: any) {
      console.error('[Email Settings] Error saving settings:', error)
      toast.error(`Error saving settings: ${error.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async (templateType: 'welcome' | 'order_confirmation' | 'shipping_notification') => {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setTestingTemplate(templateType)
    
    try {
      const result = await testEmailTemplate(templateType, testEmail)
      
      if (result.success) {
        toast.success(result.message || 'Test email sent successfully!')
      } else {
        toast.error(result.error || 'Failed to send test email', {
          duration: 10000,
        })
      }
    } catch (error: any) {
      console.error('Error testing email:', error)
      toast.error(error.message || 'An unexpected error occurred while sending the test email', {
        duration: 10000,
      })
    } finally {
      setTestingTemplate(null)
    }
  }

  const handleTestConnection = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setTestingConnection(true)
    
    try {
      const result = emailProvider === 'mailgun' 
        ? await testMailgunConnection(testEmail)
        : await testSMTPConnection(testEmail)
      
      if (result.success) {
        toast.success(result.message || `${emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} connection test successful!`, {
          duration: 5000,
        })
      } else {
        toast.error(result.error || `${emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} connection test failed`, {
          duration: 15000,
        })
      }
    } catch (error: any) {
      console.error(`Error testing ${emailProvider} connection:`, error)
      toast.error(error.message || `An unexpected error occurred while testing ${emailProvider} connection`, {
        duration: 15000,
      })
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Email Settings</h1>
        <p className="text-gray-600 mt-1">Configure email service provider for all communications</p>
      </div>

      {/* Email Configuration Diagnostics */}
      <Card className="mb-6 border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Configuration Diagnostics</CardTitle>
              <CardDescription>Current email provider status and configuration check</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={loadingDiagnostics}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDiagnostics ? (
            <div className="text-center py-4">Loading diagnostics...</div>
          ) : diagnostics ? (
            <div className="space-y-4">
              {/* Current Provider Status */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-teal-600" />
                  <h3 className="font-semibold">Current Provider</h3>
                </div>
                <div className="flex items-center gap-2">
                  {diagnostics.providerStatus.includes('✓') ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : diagnostics.providerStatus.includes('✗') ? (
                    <XCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">{diagnostics.providerStatus}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Provider: <strong>{diagnostics.provider}</strong>
                </p>
              </div>

              {/* Mailgun Configuration */}
              {diagnostics.provider === 'mailgun' && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Mailgun Configuration
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>API Key:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.mailgun.apiKey.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.mailgun.apiKey.valid ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.mailgun.apiKey.valid ? 'Valid' : 'Invalid/Missing'}
                        </span>
                      </div>
                    </div>
                    {diagnostics.mailgun.apiKey.present && (
                      <div className="text-xs text-gray-500 pl-4">
                        Length: {diagnostics.mailgun.apiKey.length} characters
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Domain:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.mailgun.domain.present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.mailgun.domain.present ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.mailgun.domain.present ? diagnostics.mailgun.domain.value : 'Missing'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>From Email:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.mailgun.fromEmail.present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.mailgun.fromEmail.present ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.mailgun.fromEmail.value || 'Missing'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Base URL:</span>
                      <span className="text-gray-600">{diagnostics.mailgun.baseUrl.value}</span>
                    </div>
                    {diagnostics.mailgun.issues.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm font-semibold text-red-800 mb-1">Issues Found:</p>
                        <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                          {diagnostics.mailgun.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SMTP Configuration */}
              {diagnostics.provider === 'smtp' && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Microsoft 365 SMTP Configuration
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>SMTP Host:</span>
                      <span className="text-gray-600">{diagnostics.smtp.host.value}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>SMTP Port:</span>
                      <span className="text-gray-600">{diagnostics.smtp.port.value}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Username:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.smtp.user.present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.smtp.user.present ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.smtp.user.value || 'Missing'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Password:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.smtp.password.present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.smtp.password.present ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.smtp.password.present ? 'Configured' : 'Missing'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>From Email:</span>
                      <div className="flex items-center gap-2">
                        {diagnostics.smtp.fromEmail.present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={diagnostics.smtp.fromEmail.present ? 'text-green-600' : 'text-red-600'}>
                          {diagnostics.smtp.fromEmail.value || 'Missing'}
                        </span>
                      </div>
                    </div>
                    {diagnostics.smtp.issues.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm font-semibold text-red-800 mb-1">Issues Found:</p>
                        <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                          {diagnostics.smtp.issues.map((issue: string, idx: number) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {diagnostics.recommendations.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-800">
                    <AlertCircle className="w-4 h-4" />
                    Recommendations
                  </h3>
                  <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                    {diagnostics.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-gray-500 pt-2 border-t">
                Last updated: {new Date(diagnostics.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">No diagnostic data available</div>
          )}
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Email Provider</CardTitle>
          <CardDescription>Select your email service provider for all emails (system and marketing)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="email_provider">Email Service Provider <span className="text-red-500">*</span></Label>
            <select
              id="email_provider"
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value as 'mailgun' | 'smtp')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="mailgun">Mailgun (Default - Recommended)</option>
              <option value="smtp">Microsoft 365 SMTP</option>
            </select>
            <p className="text-xs text-gray-500">
              Mailgun is the default for all emails (system, transactional, and marketing). SMTP is available as a fallback option.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Microsoft 365 SMTP Configuration */}
      {emailProvider === 'smtp' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Microsoft 365 SMTP Configuration</CardTitle>
            <CardDescription>
              Configure Microsoft 365 SMTP settings for email sending
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="smtp_host">SMTP Server Host <span className="text-red-500">*</span></Label>
              <Input
                id="smtp_host"
                type="text"
                value={providerSettings.smtp_host}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_host: e.target.value })}
                placeholder="smtp.office365.com"
              />
              <p className="text-xs text-gray-500">
                Microsoft 365 SMTP server: smtp.office365.com
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_port">SMTP Port <span className="text-red-500">*</span></Label>
              <Input
                id="smtp_port"
                type="text"
                value={providerSettings.smtp_port}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_port: e.target.value })}
                placeholder="587"
              />
              <p className="text-xs text-gray-500">
                Use 587 for STARTTLS (recommended) or 465 for SSL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_user">SMTP Username/Email <span className="text-red-500">*</span></Label>
              <Input
                id="smtp_user"
                type="email"
                value={providerSettings.smtp_user}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_user: e.target.value })}
                placeholder="hello@brevibrushes.com"
              />
              <p className="text-xs text-gray-500">
                Your Microsoft 365 email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_password">SMTP Password <span className="text-red-500">*</span></Label>
              <Input
                id="smtp_password"
                type="password"
                value={providerSettings.smtp_password}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_password: e.target.value })}
                placeholder="Enter your password or app password"
              />
              <p className="text-xs text-gray-500">
                Use an app-specific password if MFA is enabled on your Microsoft 365 account
              </p>
              <p className="text-xs text-gray-500">
                <a 
                  href="https://account.microsoft.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-teal-600 hover:underline"
                >
                  Create app password →
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_from_email">From Email Address <span className="text-red-500">*</span></Label>
              <Input
                id="smtp_from_email"
                type="email"
                value={providerSettings.smtp_from_email}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_from_email: e.target.value })}
                placeholder="hello@brevibrushes.com"
              />
              <p className="text-xs text-gray-500">
                Email address that will appear as the sender
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp_from_name">From Name</Label>
              <Input
                id="smtp_from_name"
                value={providerSettings.smtp_from_name}
                onChange={(e) => setProviderSettings({ ...providerSettings, smtp_from_name: e.target.value })}
                placeholder="BREVI"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mailgun Configuration */}
      {emailProvider === 'mailgun' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Mailgun Configuration</CardTitle>
            <CardDescription>
              API key and domain are required to send. Add the webhook signing key so Mailgun can post opens/clicks/bounces to your site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mailgun_api_key">Mailgun API Key <span className="text-red-500">*</span></Label>
              <Input
                id="mailgun_api_key"
                type="password"
                value={providerSettings.mailgun_api_key}
                onChange={(e) => setProviderSettings({ ...providerSettings, mailgun_api_key: e.target.value })}
                placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500">
                Get your API key from{' '}
                <a 
                  href="https://app.mailgun.com/app/account/security/api_keys" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-teal-600 hover:underline inline-flex items-center gap-1"
                >
                  Mailgun Settings <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailgun_domain">Mailgun Domain <span className="text-red-500">*</span></Label>
              <Input
                id="mailgun_domain"
                type="text"
                value={providerSettings.mailgun_domain}
                onChange={(e) => setProviderSettings({ ...providerSettings, mailgun_domain: e.target.value })}
                placeholder="sandbox8a1e77b8dc814af59af2cffc4b280c40.mailgun.org"
              />
              <p className="text-xs text-gray-500">
                Your Mailgun domain (sandbox domain for testing, or verified domain for production)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailgun_base_url">Mailgun Base URL</Label>
              <Input
                id="mailgun_base_url"
                type="text"
                value={providerSettings.mailgun_base_url}
                onChange={(e) => setProviderSettings({ ...providerSettings, mailgun_base_url: e.target.value })}
                placeholder="https://api.mailgun.net"
              />
              <p className="text-xs text-gray-500">
                Default: https://api.mailgun.net (US) or https://api.eu.mailgun.net (EU)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailgun_webhook_signing_key">HTTP webhook signing key (opens, clicks, bounces)</Label>
              <Input
                id="mailgun_webhook_signing_key"
                type="password"
                autoComplete="off"
                value={providerSettings.mailgun_webhook_signing_key}
                onChange={(e) =>
                  setProviderSettings({ ...providerSettings, mailgun_webhook_signing_key: e.target.value })
                }
                placeholder="Paste from Mailgun → Sending → your domain → Webhooks"
              />
              <p className="text-xs text-gray-500">
                Required for <code className="bg-gray-100 px-1 rounded">/api/mailgun/webhook</code>. In Mailgun, open your domain → <strong>Webhooks</strong> → copy the <strong>HTTP webhook signing key</strong>, add webhook URL{' '}
                <code className="bg-gray-100 px-1 rounded text-[11px]">https://your-domain.com/api/mailgun/webhook</code> for delivered, opened, clicked, bounced, failed. Leave blank when saving to keep the existing key.{' '}
                <code className="bg-gray-100 px-1 rounded">MAILGUN_WEBHOOK_SIGNING_KEY</code> in env overrides this if set.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailgun_from_email">From Email Address <span className="text-red-500">*</span></Label>
              <Input
                id="mailgun_from_email"
                type="email"
                value={providerSettings.mailgun_from_email}
                onChange={(e) => setProviderSettings({ ...providerSettings, mailgun_from_email: e.target.value })}
                placeholder="hello@brevibrushes.com"
              />
              <p className="text-xs text-gray-500">
                Email address that will appear as the sender. Must be from your verified domain.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mailgun_from_name">From Name</Label>
              <Input
                id="mailgun_from_name"
                value={providerSettings.mailgun_from_name}
                onChange={(e) => setProviderSettings({ ...providerSettings, mailgun_from_name: e.target.value })}
                placeholder="BREVI"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Templates */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Enable or disable automated email templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="welcome">Welcome Email</Label>
              <p className="text-sm text-gray-500">Send welcome email to new customers</p>
            </div>
            <Switch
              id="welcome"
              checked={templateSettings.welcome}
              onCheckedChange={(checked) => setTemplateSettings({ ...templateSettings, welcome: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="order_confirmation">Order Confirmation</Label>
              <p className="text-sm text-gray-500">Send order confirmation emails</p>
            </div>
            <Switch
              id="order_confirmation"
              checked={templateSettings.order_confirmation}
              onCheckedChange={(checked) => setTemplateSettings({ ...templateSettings, order_confirmation: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="shipping_notification">Shipping Notification</Label>
              <p className="text-sm text-gray-500">Send shipping update emails</p>
            </div>
            <Switch
              id="shipping_notification"
              checked={templateSettings.shipping_notification}
              onCheckedChange={(checked) => setTemplateSettings({ ...templateSettings, shipping_notification: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Email Configuration */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Test Email Configuration
          </CardTitle>
          <CardDescription>Test your {emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} connection and email templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="test_email">Test Email Address</Label>
            <Input
              id="test_email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
            <p className="text-xs text-gray-500">Enter an email address to receive test emails</p>
          </div>

          {/* Connection Test */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">{emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} Connection Test</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Test your {emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} configuration
                  </p>
                </div>
                <Button
                  onClick={handleTestConnection}
                  disabled={!testEmail || testingConnection || testingTemplate !== null}
                  variant="default"
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {testingConnection ? (
                    <>Testing {emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'}...</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Test {emailProvider === 'mailgun' ? 'Mailgun' : 'SMTP'} Connection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Template Tests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Welcome Email</h4>
                <p className="text-xs text-gray-500 mt-1">Test the welcome email template</p>
              </div>
              <Button
                onClick={() => handleTestEmail('welcome')}
                disabled={!testEmail || testingTemplate !== null}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {testingTemplate === 'welcome' ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Order Confirmation</h4>
                <p className="text-xs text-gray-500 mt-1">Test the order confirmation template</p>
              </div>
              <Button
                onClick={() => handleTestEmail('order_confirmation')}
                disabled={!testEmail || testingTemplate !== null}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {testingTemplate === 'order_confirmation' ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-sm">Shipping Notification</h4>
                <p className="text-xs text-gray-500 mt-1">Test the shipping notification template</p>
              </div>
              <Button
                onClick={() => handleTestEmail('shipping_notification')}
                disabled={!testEmail || testingTemplate !== null}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {testingTemplate === 'shipping_notification' ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Make sure your email provider settings are saved before testing. 
              Test emails will be sent via {emailProvider === 'mailgun' ? 'Mailgun' : 'Microsoft 365 SMTP'}.
            </p>
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
