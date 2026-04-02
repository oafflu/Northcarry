'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { getSubscriptionSettings, saveSubscriptionSettings, type SubscriptionSettings } from '@/app/actions/subscription-settings'
import { toast } from 'sonner'
import { Save, HelpCircle, Globe, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SubscriptionSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await getSubscriptionSettings()
      if (result.error) {
        toast.error('Failed to load settings', { description: result.error })
      } else {
        setSettings(result.data)
      }
    } catch (error: any) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const result = await saveSubscriptionSettings(settings)
      if (result.error) {
        toast.error('Failed to save settings', { description: result.error })
      } else {
        toast.success('Settings saved successfully')
      }
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings', { description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof SubscriptionSettings>(
    key: K,
    value: SubscriptionSettings[K]
  ) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
  }

  const updateEmailNotification = (
    key: keyof SubscriptionSettings['emailNotifications'],
    value: boolean | number
  ) => {
    if (!settings) return
    setSettings({
      ...settings,
      emailNotifications: {
        ...settings.emailNotifications,
        [key]: value,
      },
    })
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Subscription Settings</h1>
        <p className="text-gray-600 mt-1">Configure subscription system settings and customer portal controls</p>
      </div>

      <div className="space-y-6">
        {/* Customer Portal Button Visibility */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Portal Button Visibility</CardTitle>
            <CardDescription>
              Control which action buttons are visible to customers in their subscription portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="showCancelButton" className="cursor-pointer">
                  Show Cancel button
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="showCancelButton"
                checked={settings.showCancelButton}
                onCheckedChange={(checked) => updateSetting('showCancelButton', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="showPauseResumeButtons" className="cursor-pointer">
                  Show Pause / Resume buttons
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="showPauseResumeButtons"
                checked={settings.showPauseResumeButtons}
                onCheckedChange={(checked) => updateSetting('showPauseResumeButtons', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="showChargeNowButton" className="cursor-pointer">
                  Show Charge Now button
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="showChargeNowButton"
                checked={settings.showChargeNowButton}
                onCheckedChange={(checked) => updateSetting('showChargeNowButton', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="showSkipPaymentButton" className="cursor-pointer">
                  Show Skip Payment button
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="showSkipPaymentButton"
                checked={settings.showSkipPaymentButton}
                onCheckedChange={(checked) => updateSetting('showSkipPaymentButton', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Important Note */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-700">
              <strong>Note:</strong> Editing subscriptions requires up-to-date stylesheets of the customer portal. 
              In case you notice any styling problems, please check our{' '}
              <Link href="/docs/migration" className="text-blue-600 hover:underline">
                migration docs
              </Link>
              , or{' '}
              <Link href="/admin/support" className="text-blue-600 hover:underline">
                contact us
              </Link>
              {' '}for support.
            </p>
          </CardContent>
        </Card>

        {/* Customer Portal Product/Discount Management */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Portal Product/Discount Management</CardTitle>
            <CardDescription>
              Control what customers can do with their subscriptions in the customer portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowAddingRemovingDiscounts" className="cursor-pointer">
                  Allow adding and removing discounts
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="allowAddingRemovingDiscounts"
                checked={settings.allowAddingRemovingDiscounts}
                onCheckedChange={(checked) => updateSetting('allowAddingRemovingDiscounts', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowChangingSellingPlans" className="cursor-pointer">
                  Allow changing selling plans
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="allowChangingSellingPlans"
                checked={settings.allowChangingSellingPlans}
                onCheckedChange={(checked) => updateSetting('allowChangingSellingPlans', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowAddingProducts" className="cursor-pointer">
                  Allow adding products
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="allowAddingProducts"
                checked={settings.allowAddingProducts}
                onCheckedChange={(checked) => updateSetting('allowAddingProducts', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowRemovingProducts" className="cursor-pointer">
                  Allow removing products
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="allowRemovingProducts"
                checked={settings.allowRemovingProducts}
                onCheckedChange={(checked) => updateSetting('allowRemovingProducts', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowSwappingProducts">Allow swapping products</Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Select
                value={settings.allowSwappingProducts}
                onValueChange={(value: 'none' | 'same_plan' | 'any_plan') =>
                  updateSetting('allowSwappingProducts', value)
                }
              >
                <SelectTrigger id="allowSwappingProducts" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not allowed</SelectItem>
                  <SelectItem value="same_plan">To any products/variants assigned to the current selling plan</SelectItem>
                  <SelectItem value="any_plan">To any products/variants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="allowChangingQuantity">Allow changing product quantity</Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Select
                value={settings.allowChangingQuantity}
                onValueChange={(value: 'none' | 'increase_only' | 'decrease_only' | 'both') =>
                  updateSetting('allowChangingQuantity', value)
                }
              >
                <SelectTrigger id="allowChangingQuantity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not allowed</SelectItem>
                  <SelectItem value="increase_only">Increase only</SelectItem>
                  <SelectItem value="decrease_only">Decrease only</SelectItem>
                  <SelectItem value="both">Increase and decrease</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Post-Checkout Link */}
        <Card>
          <CardHeader>
            <CardTitle>Post-Checkout Link</CardTitle>
            <CardDescription>
              Control whether to show a link to the customer portal after checkout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="showPortalLinkAfterCheckout" className="cursor-pointer">
                  Show link to the customer portal after checkout
                </Label>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </div>
              <Switch
                id="showPortalLinkAfterCheckout"
                checked={settings.showPortalLinkAfterCheckout}
                onCheckedChange={(checked) => updateSetting('showPortalLinkAfterCheckout', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Configure which email notifications are sent to customers for subscription events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="newSubscription" className="cursor-pointer font-medium">
                    New subscription
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when they create a new subscription
                </p>
              </div>
              <Switch
                id="newSubscription"
                checked={settings.emailNotifications.newSubscription}
                onCheckedChange={(checked) => updateEmailNotification('newSubscription', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscriptionExpired" className="cursor-pointer font-medium">
                    Subscription expired (completed)
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when their subscription expires
                </p>
              </div>
              <Switch
                id="subscriptionExpired"
                checked={settings.emailNotifications.subscriptionExpired}
                onCheckedChange={(checked) => updateEmailNotification('subscriptionExpired', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscriptionPaused" className="cursor-pointer font-medium">
                    Subscription paused
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when their subscription is paused
                </p>
              </div>
              <Switch
                id="subscriptionPaused"
                checked={settings.emailNotifications.subscriptionPaused}
                onCheckedChange={(checked) => updateEmailNotification('subscriptionPaused', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscriptionResumed" className="cursor-pointer font-medium">
                    Subscription resumed
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when their subscription is resumed
                </p>
              </div>
              <Switch
                id="subscriptionResumed"
                checked={settings.emailNotifications.subscriptionResumed}
                onCheckedChange={(checked) => updateEmailNotification('subscriptionResumed', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscriptionEdited" className="cursor-pointer font-medium">
                    Subscription edited
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when their subscription is edited. Multiple edits made less than 2 minutes apart will trigger only one e-mail
                </p>
              </div>
              <Switch
                id="subscriptionEdited"
                checked={settings.emailNotifications.subscriptionEdited}
                onCheckedChange={(checked) => updateEmailNotification('subscriptionEdited', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscriptionCancelled" className="cursor-pointer font-medium">
                    Subscription cancelled
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer when their subscription is manually cancelled by themselves or by an admin
                </p>
              </div>
              <Switch
                id="subscriptionCancelled"
                checked={settings.emailNotifications.subscriptionCancelled}
                onCheckedChange={(checked) => updateEmailNotification('subscriptionCancelled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="paymentFailedRetrying" className="cursor-pointer font-medium">
                    Payment failed (retrying)
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer after a failed payment, which is scheduled for automatic retrying
                </p>
              </div>
              <Switch
                id="paymentFailedRetrying"
                checked={settings.emailNotifications.paymentFailedRetrying}
                onCheckedChange={(checked) => updateEmailNotification('paymentFailedRetrying', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="paymentFailedLastAttempt" className="cursor-pointer font-medium">
                    Payment failed (last attempt)
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer after the last attempt at processing failed payment
                </p>
              </div>
              <Switch
                id="paymentFailedLastAttempt"
                checked={settings.emailNotifications.paymentFailedLastAttempt}
                onCheckedChange={(checked) => updateEmailNotification('paymentFailedLastAttempt', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="orderSkipped" className="cursor-pointer font-medium">
                    Order skipped
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer after skipping an order
                </p>
              </div>
              <Switch
                id="orderSkipped"
                checked={settings.emailNotifications.orderSkipped}
                onCheckedChange={(checked) => updateEmailNotification('orderSkipped', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="paymentReminder" className="cursor-pointer font-medium">
                    Payment reminder
                  </Label>
                  <Link href="#" className="text-blue-600 hover:underline text-sm">
                    (settings)
                  </Link>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sent to the customer before an upcoming payment
                </p>
                {settings.emailNotifications.paymentReminder && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.emailNotifications.paymentReminderDays}
                      onChange={(e) =>
                        updateEmailNotification('paymentReminderDays', parseInt(e.target.value) || 2)
                      }
                      className="w-32"
                    />
                    <span className="text-sm text-gray-500">days before</span>
                  </div>
                )}
              </div>
              <Switch
                id="paymentReminder"
                checked={settings.emailNotifications.paymentReminder}
                onCheckedChange={(checked) => updateEmailNotification('paymentReminder', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Translations */}
        <Card>
          <CardHeader>
            <CardTitle>Translations</CardTitle>
            <CardDescription>
              Manage translations for subscription-related text and emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/settings/languages">
                <Globe className="w-4 h-4 mr-2" />
                Manage translations
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg" className="min-w-[120px]">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
