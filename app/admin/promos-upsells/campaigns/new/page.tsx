'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { createCampaign } from '@/app/actions/upsells'
import {
  CampaignTargetingFields,
  buildCampaignTargetingPayload,
} from '@/components/admin/campaign-targeting-fields'

export default function NewCampaignPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [campaignType, setCampaignType] = useState('bundle')
  const [status, setStatus] = useState('draft')
  const [priority, setPriority] = useState('0')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const [productIds, setProductIds] = useState<string[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const [minCartValue, setMinCartValue] = useState('')
  const [maxCartValue, setMaxCartValue] = useState('')
  const [customerSegment, setCustomerSegment] = useState('any')
  const [displayTheme, setDisplayTheme] = useState('inherit')
  const [displayPosition, setDisplayPosition] = useState('bottom')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Campaign name is required')
      return
    }

    const targeting = buildCampaignTargetingPayload({
      productIds,
      categoryIds,
      minCartValue,
      maxCartValue,
      customerSegment,
      displayTheme,
      displayPosition,
    })

    setSaving(true)
    try {
      const result = await createCampaign({
        name: name.trim(),
        description: description.trim() || undefined,
        campaign_type: campaignType,
        status: status as 'draft' | 'active' | 'paused' | 'archived',
        priority: parseInt(priority, 10) || 0,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
        target_products: targeting.target_products,
        target_categories: targeting.target_categories,
        target_conditions: targeting.target_conditions,
        display_settings: targeting.display_settings,
      })

      if (result.success) {
        toast.success('Campaign created successfully')
        router.push('/admin/promos-upsells/campaigns')
      } else {
        toast.error(result.error || 'Failed to create campaign')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Campaign</h1>
          <p className="mt-1 text-gray-600">Create a new upsell campaign to organize your promotions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Set up your campaign name and type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Summer Sale 2024"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Campaign description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="campaignType">Campaign Type *</Label>
                <Select value={campaignType} onValueChange={setCampaignType}>
                  <SelectTrigger id="campaignType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bundle">Product Bundles</SelectItem>
                    <SelectItem value="quantity_break">Quantity Breaks</SelectItem>
                    <SelectItem value="post_purchase">Post-Purchase Upsells</SelectItem>
                    <SelectItem value="cart_upsell">Cart Upsells</SelectItem>
                    <SelectItem value="frequently_bought">Frequently Bought Together</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduling
            </CardTitle>
            <CardDescription>Set when the campaign should start and end</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startsAt">Start Date (Optional)</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Campaign will start automatically at this time</p>
              </div>
              <div>
                <Label htmlFor="endsAt">End Date (Optional)</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Campaign will end automatically at this time</p>
              </div>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Higher numbers = higher priority when multiple campaigns apply
              </p>
            </div>
          </CardContent>
        </Card>

        <CampaignTargetingFields
          productIds={productIds}
          onProductIdsChange={setProductIds}
          categoryIds={categoryIds}
          onCategoryIdsChange={setCategoryIds}
          minCartValue={minCartValue}
          onMinCartValueChange={setMinCartValue}
          maxCartValue={maxCartValue}
          onMaxCartValueChange={setMaxCartValue}
          customerSegment={customerSegment}
          onCustomerSegmentChange={setCustomerSegment}
          displayTheme={displayTheme}
          onDisplayThemeChange={setDisplayTheme}
          displayPosition={displayPosition}
          onDisplayPositionChange={setDisplayPosition}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  )
}
