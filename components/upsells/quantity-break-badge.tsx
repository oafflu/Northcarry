'use client'

import { useState, useEffect } from 'react'
import { Layers, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { trackUpsellEvent } from '@/app/actions/upsells'

interface QuantityBreakBadgeProps {
  productId: string
  variantId?: string
  quantity: number
  campaignId?: string
}

export function QuantityBreakBadge({ productId, variantId, quantity, campaignId }: QuantityBreakBadgeProps) {
  const [breakInfo, setBreakInfo] = useState<any>(null)
  const [sessionId] = useState(() => Math.random().toString(36).substring(7))

  useEffect(() => {
    loadQuantityBreak()
  }, [productId, variantId, quantity])

  useEffect(() => {
    if (breakInfo) {
      // Track view
      trackUpsellEvent({
        campaign_id: campaignId,
        upsell_type: 'quantity_break',
        upsell_id: breakInfo.id,
        event_type: 'view',
        session_id: sessionId,
      })
    }
  }, [breakInfo])

  const loadQuantityBreak = async () => {
    try {
      const response = await fetch(`/api/upsells/quantity-breaks?product_id=${productId}&variant_id=${variantId || ''}&quantity=${quantity}`)
      const data = await response.json()
      if (data.break) {
        setBreakInfo(data.break)
      }
    } catch (error) {
      console.error('Error loading quantity break:', error)
    }
  }

  if (!breakInfo) return null

  const applicableTier = breakInfo.tiers?.find((tier: any) => quantity >= tier.quantity)
  if (!applicableTier) return null

  const discountText = applicableTier.discount_type === 'percentage'
    ? `${applicableTier.discount_value}% OFF`
    : `$${applicableTier.discount_value} OFF`

  return (
    <Badge 
      variant="secondary" 
      className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1"
    >
      <TrendingDown className="w-3 h-3" />
      <span className="font-semibold">{discountText}</span>
      <span className="text-xs">when buying {applicableTier.quantity}+</span>
    </Badge>
  )
}

