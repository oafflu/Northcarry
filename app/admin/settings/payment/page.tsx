'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSetting, saveSetting } from '@/app/actions/settings'
import { getStripePaymentMethods, savePaymentMethods, getPaymentMethodImages, savePaymentMethodImages } from '@/app/actions/payment-methods'
import { toast } from 'sonner'
import { Save, CreditCard, CheckCircle2, XCircle, Image as ImageIcon, Plus, Trash2 } from 'lucide-react'
import { ImagePicker } from '@/components/admin/image-picker'
import Image from 'next/image'

export default function PaymentSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stripeSettings, setStripeSettings] = useState({
    enabled: false,
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
  })
  const [paypalSettings, setPaypalSettings] = useState({
    enabled: false,
    client_id: '',
    client_secret: '',
    mode: 'sandbox',
  })
  const [afterpaySettings, setAfterpaySettings] = useState({
    enabled: false,
    merchant_id: '',
    secret_key: '',
    environment: 'sandbox',
  })
  const [stripePaymentMethods, setStripePaymentMethods] = useState<any[]>([])
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<Record<string, boolean>>({})
  const [loadingMethods, setLoadingMethods] = useState(false)
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null)
  const [paymentMethodImages, setPaymentMethodImages] = useState<Record<string, { imageUrl?: string; cardImages?: Array<{ name: string; url: string; alt: string }> }>>({})

  useEffect(() => {
    loadSettings()
  }, [])

  // Reload payment methods when Stripe settings change
  useEffect(() => {
    if (stripeSettings.enabled && stripeSettings.secret_key) {
      loadPaymentMethods()
    } else {
      setStripePaymentMethods([])
      setEnabledPaymentMethods({})
      setPaymentMethodsError(null)
    }
  }, [stripeSettings.enabled, stripeSettings.secret_key])

  const loadPaymentMethods = async () => {
    setLoadingMethods(true)
    setPaymentMethodsError(null)
    try {
      const result = await getStripePaymentMethods()
      if (result.error) {
        setPaymentMethodsError(result.error)
        setStripePaymentMethods([])
        setEnabledPaymentMethods({})
      } else if (result.data && result.data.length > 0) {
        setStripePaymentMethods(result.data)
        // Build enabled methods object
        const enabled: Record<string, boolean> = {}
        result.data.forEach((method: any) => {
          enabled[method.id] = method.enabled
        })
        setEnabledPaymentMethods(enabled)
        setPaymentMethodsError(null)
      } else {
        setStripePaymentMethods([])
        setEnabledPaymentMethods({})
        setPaymentMethodsError('No payment methods found')
      }
    } catch (error: any) {
      console.error('Error loading payment methods:', error)
      setPaymentMethodsError(error.message || 'Failed to load payment methods')
      setStripePaymentMethods([])
    } finally {
      setLoadingMethods(false)
    }
  }

  const loadSettings = async () => {
    setLoading(true)
    const [stripeResult, paypalResult, afterpayResult, imagesResult] = await Promise.all([
      getSetting('stripe'),
      getSetting('paypal'),
      getSetting('afterpay'),
      getPaymentMethodImages(),
    ])
    if (stripeResult.data) {
      const data = stripeResult.data as any
      setStripeSettings({
        enabled: data.enabled ?? false,
        publishable_key: data.publishable_key ?? '',
        secret_key: data.secret_key ?? '',
        webhook_secret: data.webhook_secret ?? '',
      })
    }
    if (paypalResult.data) setPaypalSettings(paypalResult.data as any)
    if (afterpayResult.data) setAfterpaySettings(afterpayResult.data as any)
    if (imagesResult.data) setPaymentMethodImages(imagesResult.data)
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const [stripeResult, paypalResult, afterpayResult, paymentMethodsResult, imagesResult] = await Promise.all([
        saveSetting('stripe', stripeSettings, 'payment', 'Stripe payment gateway settings'),
        saveSetting('paypal', paypalSettings, 'payment', 'PayPal payment gateway settings'),
        saveSetting('afterpay', afterpaySettings, 'payment', 'AfterPay payment gateway settings'),
        savePaymentMethods(enabledPaymentMethods),
        savePaymentMethodImages(paymentMethodImages),
      ])
      
      if (stripeResult.success && paypalResult.success && afterpayResult.success && paymentMethodsResult.success && imagesResult.success) {
        toast.success('Payment settings saved successfully!')
      } else {
        const errors = [
          !stripeResult.success && `Stripe: ${stripeResult.error}`,
          !paypalResult.success && `PayPal: ${paypalResult.error}`,
          !afterpayResult.success && `AfterPay: ${afterpayResult.error}`,
          !paymentMethodsResult.success && `Payment Methods: ${paymentMethodsResult.error}`,
          !imagesResult.success && `Payment Images: ${imagesResult.error}`,
        ].filter(Boolean).join(', ')
        toast.error(`Failed to save some settings: ${errors}`)
      }
    } catch (error: any) {
      console.error('Error saving payment settings:', error)
      toast.error('An unexpected error occurred while saving settings')
    } finally {
      setSaving(false)
    }
  }

  const togglePaymentMethod = (methodId: string) => {
    setEnabledPaymentMethods(prev => ({
      ...prev,
      [methodId]: !prev[methodId],
    }))
  }

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Payment Settings</h1>
        <p className="text-gray-600 mt-1">Configure payment gateways</p>
      </div>

      <Tabs defaultValue="stripe" className="space-y-6">
        <TabsList>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="paypal">PayPal</TabsTrigger>
          <TabsTrigger value="afterpay">AfterPay</TabsTrigger>
        </TabsList>

        <TabsContent value="stripe">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Stripe Configuration
              </CardTitle>
              <CardDescription>
                Configure Stripe payment gateway. Get your API keys from{" "}
                <a
                  href="https://dashboard.stripe.com/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Stripe Dashboard
                </a>
                .
              </CardDescription>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-900 font-medium mb-1">🧪 Testing with Test Cards</p>
                <p className="text-xs text-blue-700 mb-2">
                  <strong>Important:</strong> Test cards only work with <strong>test API keys</strong> (<code className="bg-blue-100 px-1 rounded">pk_test_...</code> and <code className="bg-blue-100 px-1 rounded">sk_test_...</code>).
                </p>
                <p className="text-xs text-blue-700">
                  <strong>Most common test card:</strong> <code className="bg-blue-100 px-1 rounded">4242 4242 4242 4242</code> (any CVC, any future expiry date)
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  See <code className="bg-blue-100 px-1 rounded">STRIPE_TEST_CARDS.md</code> in the project root for all test card numbers.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="stripe_enabled">Enable Stripe</Label>
                  <p className="text-sm text-gray-500">Enable Stripe as a payment method</p>
                </div>
                <Switch
                  id="stripe_enabled"
                  checked={stripeSettings.enabled}
                  onCheckedChange={(checked) => setStripeSettings({ ...stripeSettings, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_publishable_key">Publishable Key</Label>
                <Input
                  id="stripe_publishable_key"
                  value={stripeSettings.publishable_key}
                  onChange={(e) => setStripeSettings({ ...stripeSettings, publishable_key: e.target.value })}
                  placeholder="pk_test_... or pk_live_..."
                />
                <p className="text-xs text-gray-500">
                  Use <code className="bg-gray-100 px-1 rounded">pk_test_...</code> for testing, <code className="bg-gray-100 px-1 rounded">pk_live_...</code> for production
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_secret_key">Secret Key</Label>
                <Input
                  id="stripe_secret_key"
                  type="password"
                  value={stripeSettings.secret_key}
                  onChange={(e) => setStripeSettings({ ...stripeSettings, secret_key: e.target.value })}
                  placeholder="sk_test_... or sk_live_..."
                />
                <p className="text-xs text-gray-500">
                  Use <code className="bg-gray-100 px-1 rounded">sk_test_...</code> for testing, <code className="bg-gray-100 px-1 rounded">sk_live_...</code> for production
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe_webhook_secret">Webhook Secret</Label>
                <Input
                  id="stripe_webhook_secret"
                  type="password"
                  value={stripeSettings.webhook_secret}
                  onChange={(e) => setStripeSettings({ ...stripeSettings, webhook_secret: e.target.value })}
                  placeholder="whsec_... (from Stripe Dashboard → Webhooks → your endpoint → Signing secret)"
                />
                <p className="text-xs text-gray-500">Signing secret for your webhook endpoint (payment, refunds, subscriptions, etc.)</p>
              </div>
            </CardContent>
          </Card>

          {/* Stripe Payment Methods */}
          {stripeSettings.enabled && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Stripe Payment Methods</CardTitle>
                <CardDescription>Enable or disable specific Stripe payment methods</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMethods ? (
                  <div className="text-center py-8 text-gray-500">Loading payment methods...</div>
                ) : paymentMethodsError ? (
                  <div className="text-center py-8">
                    <p className="text-red-600 font-medium mb-2">Error loading payment methods</p>
                    <p className="text-sm text-gray-500">{paymentMethodsError}</p>
                    {paymentMethodsError.includes('not configured') && (
                      <p className="text-xs text-gray-400 mt-2">
                        Please enable Stripe and add your API keys above, then refresh this page.
                      </p>
                    )}
                  </div>
                ) : stripePaymentMethods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No payment methods available.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {!stripeSettings.enabled 
                        ? 'Please enable Stripe first.'
                        : !stripeSettings.secret_key
                        ? 'Please add your Stripe secret key first.'
                        : 'Payment methods will appear here once Stripe is configured.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group by category */}
                    {['cards', 'wallet', 'buy_now_pay_later'].map((category) => {
                      const methods = stripePaymentMethods.filter((m: any) => m.category === category)
                      if (methods.length === 0) return null
                      
                      return (
                        <div key={category} className="space-y-3">
                          <h4 className="font-semibold text-sm text-gray-700 capitalize">
                            {category.replace(/_/g, ' ')}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {methods.map((method: any) => (
                              <div
                                key={method.id}
                                className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                                  enabledPaymentMethods[method.id]
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => togglePaymentMethod(method.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{method.icon}</span>
                                  <div>
                                    <div className="font-medium">{method.name}</div>
                                    <div className="text-xs text-gray-500">
                                      {method.popularIn.join(', ')}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {enabledPaymentMethods[method.id] ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-gray-400" />
                                  )}
                                  <Switch
                                    checked={enabledPaymentMethods[method.id] || false}
                                    onCheckedChange={() => togglePaymentMethod(method.id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Method Images */}
          {stripeSettings.enabled && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Payment Method Images
                </CardTitle>
                <CardDescription>
                  Set custom images for payment methods displayed on the checkout page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {stripePaymentMethods.filter((m: any) => enabledPaymentMethods[m.id]).map((method: any) => {
                  const methodImage = paymentMethodImages[method.id] || {}
                  return (
                    <div key={method.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl">{method.icon}</span>
                        <h4 className="font-semibold">{method.name}</h4>
                      </div>

                      {/* Main Image (for Apple Pay, Google Pay, etc.) */}
                      {method.id !== 'card' && (
                        <div>
                          <Label>Payment Method Image</Label>
                          <p className="text-xs text-gray-500 mb-2">
                            Image displayed next to the payment method name (recommended: 40x24px)
                          </p>
                          <ImagePicker
                            value={methodImage.imageUrl || ''}
                            onChange={(url) => {
                              setPaymentMethodImages({
                                ...paymentMethodImages,
                                [method.id]: { ...methodImage, imageUrl: url },
                              })
                            }}
                            label={`${method.name} Image`}
                            bucket="cms-media"
                            recommendedSize="40x24px"
                            previewWidth={40}
                            previewHeight={24}
                          />
                        </div>
                      )}

                      {/* Card Images (for Card payment method) */}
                      {method.id === 'card' && (
                        <div>
                          <Label>Card Type Images</Label>
                          <p className="text-xs text-gray-500 mb-2">
                            Images for card types (Visa, Mastercard, Amex, etc.) displayed on the checkout page
                          </p>
                          <div className="space-y-3">
                            {(methodImage.cardImages || []).map((cardImage, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1">
                                  <Input
                                    placeholder="Card name (e.g., Visa)"
                                    value={cardImage.name}
                                    onChange={(e) => {
                                      const newCardImages = [...(methodImage.cardImages || [])]
                                      newCardImages[index] = { ...cardImage, name: e.target.value }
                                      setPaymentMethodImages({
                                        ...paymentMethodImages,
                                        [method.id]: { ...methodImage, cardImages: newCardImages },
                                      })
                                    }}
                                  />
                                </div>
                                <div className="flex-1">
                                  <ImagePicker
                                    value={cardImage.url}
                                    onChange={(url) => {
                                      const newCardImages = [...(methodImage.cardImages || [])]
                                      newCardImages[index] = { ...cardImage, url }
                                      setPaymentMethodImages({
                                        ...paymentMethodImages,
                                        [method.id]: { ...methodImage, cardImages: newCardImages },
                                      })
                                    }}
                                    label=""
                                    bucket="cms-media"
                                    recommendedSize="32x20px"
                                    previewWidth={32}
                                    previewHeight={20}
                                  />
                                </div>
                                <div className="flex-1">
                                  <Input
                                    placeholder="Alt text"
                                    value={cardImage.alt}
                                    onChange={(e) => {
                                      const newCardImages = [...(methodImage.cardImages || [])]
                                      newCardImages[index] = { ...cardImage, alt: e.target.value }
                                      setPaymentMethodImages({
                                        ...paymentMethodImages,
                                        [method.id]: { ...methodImage, cardImages: newCardImages },
                                      })
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    const newCardImages = (methodImage.cardImages || []).filter((_, i) => i !== index)
                                    setPaymentMethodImages({
                                      ...paymentMethodImages,
                                      [method.id]: { ...methodImage, cardImages: newCardImages },
                                    })
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newCardImages = [...(methodImage.cardImages || []), { name: '', url: '', alt: '' }]
                                setPaymentMethodImages({
                                  ...paymentMethodImages,
                                  [method.id]: { ...methodImage, cardImages: newCardImages },
                                })
                              }}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Card Image
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="paypal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                PayPal Configuration
              </CardTitle>
              <CardDescription>Configure PayPal payment gateway</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="paypal_enabled">Enable PayPal</Label>
                  <p className="text-sm text-gray-500">Enable PayPal as a payment method</p>
                </div>
                <Switch
                  id="paypal_enabled"
                  checked={paypalSettings.enabled}
                  onCheckedChange={(checked) => setPaypalSettings({ ...paypalSettings, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal_client_id">Client ID</Label>
                <Input
                  id="paypal_client_id"
                  value={paypalSettings.client_id}
                  onChange={(e) => setPaypalSettings({ ...paypalSettings, client_id: e.target.value })}
                  placeholder="Enter PayPal Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal_client_secret">Client Secret</Label>
                <Input
                  id="paypal_client_secret"
                  type="password"
                  value={paypalSettings.client_secret}
                  onChange={(e) => setPaypalSettings({ ...paypalSettings, client_secret: e.target.value })}
                  placeholder="Enter PayPal Client Secret"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paypal_mode">Mode</Label>
                <Select
                  value={paypalSettings.mode}
                  onValueChange={(value) => setPaypalSettings({ ...paypalSettings, mode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="afterpay">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                AfterPay Configuration
              </CardTitle>
              <CardDescription>Configure AfterPay payment gateway</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="afterpay_enabled">Enable AfterPay</Label>
                  <p className="text-sm text-gray-500">Enable AfterPay as a payment method</p>
                </div>
                <Switch
                  id="afterpay_enabled"
                  checked={afterpaySettings.enabled}
                  onCheckedChange={(checked) => setAfterpaySettings({ ...afterpaySettings, enabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="afterpay_merchant_id">Merchant ID</Label>
                <Input
                  id="afterpay_merchant_id"
                  value={afterpaySettings.merchant_id}
                  onChange={(e) => setAfterpaySettings({ ...afterpaySettings, merchant_id: e.target.value })}
                  placeholder="Enter AfterPay Merchant ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="afterpay_secret_key">Secret Key</Label>
                <Input
                  id="afterpay_secret_key"
                  type="password"
                  value={afterpaySettings.secret_key}
                  onChange={(e) => setAfterpaySettings({ ...afterpaySettings, secret_key: e.target.value })}
                  placeholder="Enter AfterPay Secret Key"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="afterpay_environment">Environment</Label>
                <Select
                  value={afterpaySettings.environment}
                  onValueChange={(value) => setAfterpaySettings({ ...afterpaySettings, environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

