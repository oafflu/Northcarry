'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireLoyaltyAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = profile?.role === 'admin' || profile?.role === 'support'
  if (!allowed) {
    return { ok: false as const, error: 'Unauthorized' }
  }

  return { ok: true as const, userId: user.id }
}

// ==================== TIERS ====================

export async function getLoyaltyTiers() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_tiers')
    .select('*')
    .order('min_points', { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

export async function createLoyaltyTier(tierData: {
  name: string
  min_points: number
  points_multiplier: number
  benefits?: string[]
  sort_order?: number
}) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_tiers')
    .insert({
      name: tierData.name,
      min_points: tierData.min_points,
      points_multiplier: tierData.points_multiplier,
      benefits: tierData.benefits || [],
      sort_order: tierData.sort_order || 0,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  return { success: true, data }
}

export async function updateLoyaltyTier(
  tierId: string,
  tierData: {
    name?: string
    min_points?: number
    points_multiplier?: number
    benefits?: string[]
    sort_order?: number
  }
) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_tiers')
    .update(tierData)
    .eq('id', tierId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  return { success: true, data }
}

export async function deleteLoyaltyTier(tierId: string) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('loyalty_tiers')
    .delete()
    .eq('id', tierId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  return { success: true }
}

// ==================== REWARDS ====================

export async function getLoyaltyRewards() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .order('points_cost', { ascending: true })

  if (error) {
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

export async function createLoyaltyReward(rewardData: {
  title: string
  description?: string
  points_cost: number
  reward_type: 'discount' | 'free_shipping' | 'free_product'
  reward_value: any // JSONB - discount amount, product ID, etc.
  is_active?: boolean
  stock_limit?: number
  stock_remaining?: number
}) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .insert({
      title: rewardData.title,
      description: rewardData.description || '',
      points_cost: rewardData.points_cost,
      reward_type: rewardData.reward_type,
      reward_value: rewardData.reward_value,
      is_active: rewardData.is_active !== false,
      stock_limit: rewardData.stock_limit || null,
      stock_remaining: rewardData.stock_remaining ?? rewardData.stock_limit ?? null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  revalidatePath('/account/loyalty')
  return { success: true, data }
}

export async function updateLoyaltyReward(
  rewardId: string,
  rewardData: {
    title?: string
    description?: string
    points_cost?: number
    reward_type?: 'discount' | 'free_shipping' | 'free_product'
    reward_value?: any
    is_active?: boolean
    stock_limit?: number
    stock_remaining?: number
  }
) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .update(rewardData)
    .eq('id', rewardId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  revalidatePath('/account/loyalty')
  return { success: true, data }
}

export async function deleteLoyaltyReward(rewardId: string) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('loyalty_rewards')
    .delete()
    .eq('id', rewardId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  revalidatePath('/account/loyalty')
  return { success: true }
}

// ==================== SETTINGS ====================

export async function getLoyaltySettings() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'loyalty_program')
    .single()

  if (error && error.code !== 'PGRST116') {
    return { success: false, error: error.message }
  }

  const defaultSettings = {
    enabled: false, // Default to disabled
    show_in_account: false, // Default to hidden
    point_rules: {
      purchase: { enabled: true, points_per_dollar: 1 },
      review: { enabled: true, points: 50 },
      referral: { enabled: true, points: 200 },
      birthday: { enabled: true, points: 100 },
    },
  }

  if (!data || !data.setting_value) {
    return {
      success: true,
      data: defaultSettings,
    }
  }

  const settings = data.setting_value as any
  // Ensure boolean values are properly set
  return {
    success: true,
    data: {
      enabled: settings?.enabled === true,
      show_in_account: settings?.show_in_account === true,
      point_rules: settings?.point_rules || defaultSettings.point_rules,
    },
  }
}

export async function updateLoyaltySettings(settings: {
  enabled?: boolean
  show_in_account?: boolean
  point_rules?: {
    purchase?: { enabled: boolean; points_per_dollar?: number }
    review?: { enabled: boolean; points?: number }
    referral?: { enabled: boolean; points?: number }
    birthday?: { enabled: boolean; points?: number }
  }
}) {
  const supabase = createAdminSupabaseClient()

  // Get existing settings
  const { data: existing } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'loyalty_program')
    .single()

  const defaultSettings = {
    enabled: false,
    show_in_account: false,
    point_rules: {
      purchase: { enabled: true, points_per_dollar: 1 },
      review: { enabled: true, points: 50 },
      referral: { enabled: true, points: 200 },
      birthday: { enabled: true, points: 100 },
    },
  }

  const currentSettings = (existing?.setting_value as any) || defaultSettings
  
  // Ensure boolean values are properly handled
  if (currentSettings.enabled === undefined) currentSettings.enabled = false
  if (currentSettings.show_in_account === undefined) currentSettings.show_in_account = false

  const updatedSettings = {
    ...currentSettings,
    ...settings,
    point_rules: {
      ...currentSettings.point_rules,
      ...settings.point_rules,
      purchase: {
        ...currentSettings.point_rules?.purchase,
        ...settings.point_rules?.purchase,
      },
      review: {
        ...currentSettings.point_rules?.review,
        ...settings.point_rules?.review,
      },
      referral: {
        ...currentSettings.point_rules?.referral,
        ...settings.point_rules?.referral,
      },
      birthday: {
        ...currentSettings.point_rules?.birthday,
        ...settings.point_rules?.birthday,
      },
    },
  }

  const { error } = await supabase
    .from('admin_settings')
    .upsert({
      setting_key: 'loyalty_program',
      setting_value: updatedSettings,
      setting_category: 'loyalty',
      description: 'Loyalty program configuration',
    }, {
      onConflict: 'setting_key'
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/loyalty')
  revalidatePath('/account/loyalty')
  revalidatePath('/account')
  return { success: true }
}

// ==================== STATISTICS ====================

export async function getLoyaltyStats() {
  const supabase = createAdminSupabaseClient()

  // Get total members
  const { count: totalMembers } = await supabase
    .from('loyalty_members')
    .select('*', { count: 'exact', head: true })

  // Get total points awarded (sum of all positive transactions)
  const { data: transactions } = await supabase
    .from('loyalty_transactions')
    .select('points_change')
    .gt('points_change', 0)

  const totalPointsAwarded = transactions?.reduce((sum, t) => sum + t.points_change, 0) || 0

  // Get total redemptions
  const { count: totalRedemptions } = await supabase
    .from('loyalty_redemptions')
    .select('*', { count: 'exact', head: true })

  // Get members by tier
  const { data: membersByTier } = await supabase
    .from('loyalty_members')
    .select('tier_id, loyalty_tiers(name)')

  const tierCounts: Record<string, number> = {}
  membersByTier?.forEach((m: any) => {
    const tierName = m.loyalty_tiers?.name || 'Unknown'
    tierCounts[tierName] = (tierCounts[tierName] || 0) + 1
  })

  return {
    success: true,
    data: {
      totalMembers: totalMembers || 0,
      totalPointsAwarded,
      totalRedemptions: totalRedemptions || 0,
      tierCounts,
    },
  }
}

// ==================== RECENT ACTIVITY ====================

export async function getLoyaltyRecentActivity(limit = 10) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select(`
      *,
      loyalty_members!inner (
        user_id,
        profiles!inner (
          first_name,
          last_name,
          email
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { success: false, error: error.message, data: [] }
  }

  return { success: true, data: data || [] }
}

// ==================== BACKFILL TOOL ====================

export async function recalculateLoyaltyForCustomer(input: {
  userId?: string
  email?: string
  dryRun?: boolean
}) {
  const auth = await requireLoyaltyAdmin()
  if (!auth.ok) {
    return { success: false, error: auth.error }
  }

  const supabase = createAdminSupabaseClient()
  const email = String(input.email || '').trim().toLowerCase()
  const userId = String(input.userId || '').trim()
  const dryRun = Boolean(input.dryRun)

  if (!email && !userId) {
    return { success: false, error: 'Provide a customer email or user ID' }
  }

  let profileQuery = supabase.from('profiles').select('id, email, first_name, last_name, role').limit(1)
  if (userId) {
    profileQuery = profileQuery.eq('id', userId)
  } else {
    profileQuery = profileQuery.ilike('email', email)
  }

  const { data: profiles, error: profileError } = await profileQuery
  if (profileError || !profiles || profiles.length === 0) {
    return { success: false, error: 'Customer not found' }
  }

  const customer = profiles[0]
  const customerId = customer.id as string
  if (customer.role && customer.role !== 'customer') {
    return { success: false, error: 'Selected user is not a customer account' }
  }

  const { data: setting } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'loyalty_program')
    .single()

  const settings = (setting?.setting_value as any) || {}
  const pointsPerDollar = Number(settings?.point_rules?.purchase?.points_per_dollar || 1)

  const { data: paidOrders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, total, payment_status, created_at')
    .eq('user_id', customerId)
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: true })

  if (ordersError) {
    return { success: false, error: ordersError.message }
  }

  const orders = paidOrders || []
  if (orders.length === 0) {
    return {
      success: true,
      data: {
        customerId,
        customerEmail: customer.email,
        dryRun,
        scannedOrders: 0,
        missingOrders: 0,
        pointsToAward: 0,
        awardedOrders: 0,
      },
    }
  }

  const orderIds = orders.map((o) => o.id)
  const { data: existingTransactions } = await supabase
    .from('loyalty_transactions')
    .select('reference_id')
    .eq('transaction_type', 'purchase')
    .in('reference_id', orderIds)

  const existingOrderRefs = new Set((existingTransactions || []).map((t) => t.reference_id))
  const missingOrders = orders.filter((o) => !existingOrderRefs.has(o.id))

  const pointsPlan = missingOrders.map((o) => ({
    orderId: o.id,
    orderNumber: o.order_number,
    points: Math.max(0, Math.floor((parseFloat(String(o.total || '0')) || 0) * pointsPerDollar)),
  }))
  const pointsToAward = pointsPlan.reduce((sum, p) => sum + p.points, 0)

  let awardedOrders = 0
  let awardedPoints = 0
  const errors: string[] = []

  if (!dryRun) {
    const { awardPoints } = await import('@/app/actions/loyalty')
    for (const plan of pointsPlan) {
      if (plan.points <= 0) continue
      const result = await awardPoints(customerId, plan.points, 'purchase', plan.orderId)
      if (!result.success) {
        errors.push(`${plan.orderNumber || plan.orderId}: ${result.error}`)
        continue
      }
      awardedOrders += 1
      awardedPoints += plan.points
    }
    revalidatePath('/admin/loyalty')
    revalidatePath('/account/loyalty')
  }

  return {
    success: true,
    data: {
      customerId,
      customerEmail: customer.email,
      customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email,
      dryRun,
      pointsPerDollar,
      scannedOrders: orders.length,
      missingOrders: missingOrders.length,
      pointsToAward,
      awardedOrders,
      awardedPoints,
      errors,
    },
  }
}
