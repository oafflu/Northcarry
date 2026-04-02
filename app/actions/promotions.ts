'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface Promotion {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y'
  discount_value: number
  usage_limit: number | null
  usage_count: number
  per_customer_limit: number
  min_purchase_amount: number | null
  applies_to: any
  starts_at: string | null
  ends_at: string | null
  status: 'active' | 'scheduled' | 'expired' | 'disabled'
  created_at: string
  updated_at: string
}

import { normalizePromoCode } from '@/lib/promo-utils'

export async function validateDiscountCode(code: string, subtotal: number) {
  const normalized = normalizePromoCode(code)
  if (!normalized) {
    return { valid: false, discountAmount: 0, error: null, promotion: null }
  }

  try {
    const adminSupabase = createAdminSupabaseClient()
    const { data: promotion, error } = await adminSupabase
      .from('promotions')
      .select('*')
      .eq('code', normalized)
      .eq('status', 'active')
      .single()

    if (error || !promotion) {
      return { valid: false, discountAmount: 0, error: 'Invalid discount code', promotion: null }
    }

    // Check date validity
    const now = new Date()
    const startsAt = promotion.starts_at ? new Date(promotion.starts_at) : null
    const endsAt = promotion.ends_at ? new Date(promotion.ends_at) : null

    if (startsAt && now < startsAt) {
      return { valid: false, discountAmount: 0, error: 'Discount code not yet active', promotion: null }
    }

    if (endsAt && now > endsAt) {
      return { valid: false, discountAmount: 0, error: 'Discount code has expired', promotion: null }
    }

    // Check minimum purchase amount
    if (promotion.min_purchase_amount && subtotal < parseFloat(promotion.min_purchase_amount.toString())) {
      return {
        valid: false,
        discountAmount: 0,
        error: `Minimum purchase of $${promotion.min_purchase_amount} required`,
        promotion: null,
      }
    }

    // Check usage limit
    if (promotion.usage_limit && promotion.usage_count >= promotion.usage_limit) {
      return { valid: false, discountAmount: 0, error: 'Discount code has reached usage limit', promotion: null }
    }

    // Calculate discount amount
    let discountAmount = 0
    if (promotion.discount_type === 'percentage') {
      discountAmount = subtotal * (parseFloat(promotion.discount_value.toString()) / 100)
    } else if (promotion.discount_type === 'fixed') {
      discountAmount = parseFloat(promotion.discount_value.toString())
      // Don't allow discount to exceed subtotal
      if (discountAmount > subtotal) {
        discountAmount = subtotal
      }
    } else if (promotion.discount_type === 'free_shipping') {
      // Free shipping is handled separately, but we can return 0 here
      discountAmount = 0
    }

    return {
      valid: true,
      discountAmount,
      error: null,
      promotion: {
        code: promotion.code,
        discount_type: promotion.discount_type,
        discount_value: promotion.discount_value,
      },
    }
  } catch (error: any) {
    console.error('Error validating discount code:', error)
    return { valid: false, discountAmount: 0, error: 'Error validating discount code', promotion: null }
  }
}

export async function getPromotions() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { data: [], error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS
  const adminSupabase = createAdminSupabaseClient()
  const { data, error } = await adminSupabase
    .from('promotions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching promotions:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getPromotion(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { data: null, error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS
  const adminSupabase = createAdminSupabaseClient()
  const { data, error } = await adminSupabase
    .from('promotions')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching promotion:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createPromotion(data: {
  code: string
  discount_type: 'percentage' | 'fixed' | 'free_shipping'
  discount_value: number
  usage_limit?: number | null
  per_customer_limit?: number
  min_purchase_amount?: number | null
  applies_to?: any
  starts_at?: string | null
  ends_at?: string | null
  status?: 'active' | 'scheduled' | 'expired' | 'disabled'
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if code already exists (use normalized code so "SAVE 10" and "SAVE10" are one)
  const adminSupabase = createAdminSupabaseClient()
  const normalizedCode = normalizePromoCode(data.code)
  if (!normalizedCode) {
    return { success: false, error: 'Invalid promotion code' }
  }
  const { data: existing } = await adminSupabase
    .from('promotions')
    .select('id')
    .eq('code', normalizedCode)
    .single()

  if (existing) {
    return { success: false, error: 'Promotion code already exists' }
  }

  // Insert promotion with normalized code
  const { data: promotion, error } = await adminSupabase
    .from('promotions')
    .insert({
      code: normalizedCode,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      usage_limit: data.usage_limit || null,
      per_customer_limit: data.per_customer_limit || 1,
      min_purchase_amount: data.min_purchase_amount || null,
      applies_to: data.applies_to || { type: 'all' },
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating promotion:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promotions')
  return { success: true, data: promotion }
}

export async function updatePromotion(
  id: string,
  data: {
    code?: string
    discount_type?: 'percentage' | 'fixed' | 'free_shipping'
    discount_value?: number
    usage_limit?: number | null
    per_customer_limit?: number
    min_purchase_amount?: number | null
    applies_to?: any
    starts_at?: string | null
    ends_at?: string | null
    status?: 'active' | 'scheduled' | 'expired' | 'disabled'
  }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Check code uniqueness if code is being updated
  const adminSupabase = createAdminSupabaseClient()
  if (data.code) {
    const { data: existing } = await adminSupabase
      .from('promotions')
      .select('id')
      .eq('code', data.code.toUpperCase())
      .neq('id', id)
      .single()

    if (existing) {
      return { success: false, error: 'Promotion code already exists' }
    }
  }

  // Update promotion
  const updateData: any = {}
  if (data.code !== undefined) updateData.code = data.code.toUpperCase()
  if (data.discount_type !== undefined) updateData.discount_type = data.discount_type
  if (data.discount_value !== undefined) updateData.discount_value = data.discount_value
  if (data.usage_limit !== undefined) updateData.usage_limit = data.usage_limit
  if (data.per_customer_limit !== undefined) updateData.per_customer_limit = data.per_customer_limit
  if (data.min_purchase_amount !== undefined) updateData.min_purchase_amount = data.min_purchase_amount
  if (data.applies_to !== undefined) updateData.applies_to = data.applies_to
  if (data.starts_at !== undefined) updateData.starts_at = data.starts_at
  if (data.ends_at !== undefined) updateData.ends_at = data.ends_at
  if (data.status !== undefined) updateData.status = data.status

  const { data: promotion, error } = await adminSupabase
    .from('promotions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating promotion:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promotions')
  return { success: true, data: promotion }
}

export async function deletePromotion(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Delete promotion
  const adminSupabase = createAdminSupabaseClient()
  const { error } = await adminSupabase
    .from('promotions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting promotion:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promotions')
  return { success: true }
}
