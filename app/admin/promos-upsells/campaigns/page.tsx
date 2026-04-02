'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteCampaign, getAllCampaigns } from '@/app/actions/upsells'
import { toast } from 'sonner'

export default function UpsellCampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    setLoading(true)
    try {
      const result = await getAllCampaigns()
      if (result.data) {
        setCampaigns(result.data)
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (campaignId: string, campaignName: string) => {
    if (
      !confirm(
        `Delete campaign "${campaignName}"? This cannot be undone.`
      )
    ) {
      return
    }
    setDeletingId(campaignId)
    try {
      const result = await deleteCampaign(campaignId)
      if (result.success) {
        toast.success('Campaign deleted')
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
      } else {
        toast.error(result.error || 'Failed to delete campaign')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete campaign')
    } finally {
      setDeletingId(null)
    }
  }

  const getCampaignTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      product_bundle: 'Product Bundle',
      quantity_break: 'Quantity Break',
      post_purchase: 'Post-Purchase',
      cart_upsell: 'Cart Upsell',
      one_click: 'One-Click',
      frequently_bought: 'Frequently Bought',
      volume_discount: 'Volume Discount',
      upsell_funnel: 'Upsell Funnel',
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Upsell Campaigns</h1>
          <p className="text-gray-600 mt-1">Manage all your upsell and promotion campaigns</p>
        </div>
        <Button onClick={() => router.push('/admin/promos-upsells/campaigns/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 mb-4">Create your first upsell campaign to increase revenue</p>
            <Button onClick={() => router.push('/admin/promos-upsells/campaigns/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{campaign.name}</CardTitle>
                  {campaign.status === 'active' ? (
                    <Eye className="w-4 h-4 text-green-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <CardDescription>
                  {getCampaignTypeLabel(campaign.campaign_type)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Views:</span>
                    <span className="font-medium">{campaign.views || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Conversions:</span>
                    <span className="font-medium">{campaign.conversions || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium">${campaign.revenue || 0}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/admin/promos-upsells/campaigns/${campaign.id}`)}>
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deletingId === campaign.id}
                    onClick={() => handleDelete(campaign.id, campaign.name)}
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

