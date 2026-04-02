'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Check if loyalty program is enabled and visible
export async function isLoyaltyProgramEnabled() {
  const adminSupabase = createAdminSupabaseClient()

  const { data: setting, error } = await adminSupabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'loyalty_program')
    .single()

  if (error || !setting || !setting.setting_value) {
    return { enabled: false, showInAccount: false }
  }

  const settings = setting.setting_value as any
  return {
    enabled: settings?.enabled === true, // Explicitly check for true
    showInAccount: settings?.show_in_account === true, // Explicitly check for true
  }
}

// Get point earning rules
export async function getPointRules() {
  const adminSupabase = createAdminSupabaseClient()

  const { data: setting } = await adminSupabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'loyalty_program')
    .single()

  if (!setting) {
    return {
      purchase: { enabled: true, points_per_dollar: 1 },
      review: { enabled: true, points: 50 },
      referral: { enabled: true, points: 200 },
      birthday: { enabled: true, points: 100 },
    }
  }

  const settings = setting.setting_value as any
  return settings?.point_rules || {
    purchase: { enabled: true, points_per_dollar: 1 },
    review: { enabled: true, points: 50 },
    referral: { enabled: true, points: 200 },
    birthday: { enabled: true, points: 100 },
  }
}

export async function awardPoints(
  userId: string,
  points: number,
  type: 'purchase' | 'review' | 'referral' | 'birthday',
  referenceId?: string
) {
  const supabase = createAdminSupabaseClient()

  // Check if loyalty program is enabled
  const programStatus = await isLoyaltyProgramEnabled()
  if (!programStatus.enabled) {
    return { success: false, error: 'Loyalty program is disabled' }
  }

  // Get point rules
  const rules = await getPointRules()
  const typeRule = rules[type]
  if (!typeRule?.enabled) {
    return { success: false, error: `${type} points are disabled` }
  }

  // Get or create loyalty member
  let { data: member } = await supabase
    .from('loyalty_members')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!member) {
    const { data: defaultTier } = await supabase
      .from('loyalty_tiers')
      .select('id')
      .order('min_points', { ascending: true })
      .limit(1)
      .maybeSingle()

    const referralCode = `REF-${userId.substring(0, 8).toUpperCase()}`

    const { data: newMember, error: createError } = await supabase
      .from('loyalty_members')
      .insert({
        user_id: userId,
        tier_id: defaultTier?.id || null,
        points_balance: 0,
        lifetime_points: 0,
        referral_code: referralCode,
      })
      .select()
      .single()

    if (createError || !newMember) {
      return { success: false, error: createError?.message || 'Failed to create loyalty member' }
    }

    member = newMember
  }

  const newBalance = member.points_balance + points
  const newLifetime = member.lifetime_points + points

  // Update member balance
  const { error: updateError } = await supabase
    .from('loyalty_members')
    .update({
      points_balance: newBalance,
      lifetime_points: newLifetime,
    })
    .eq('id', member.id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Record transaction
  const { error: transactionError } = await supabase
    .from('loyalty_transactions')
    .insert({
      member_id: member.id,
      points_change: points,
      transaction_type: type,
      reference_id: referenceId,
      balance_after: newBalance,
      description: `${type} points`,
    })

  if (transactionError) {
    console.error('Error recording transaction:', transactionError)
  }

  // Check tier upgrade
  await checkTierUpgrade(member.id, newBalance)

  revalidatePath('/account/loyalty')
  return { success: true, newBalance }
}

async function checkTierUpgrade(memberId: string, currentPoints: number) {
  const supabase = createAdminSupabaseClient()

  // Get all tiers ordered by min_points
  const { data: tiers } = await supabase
    .from('loyalty_tiers')
    .select('*')
    .order('min_points', { ascending: false })

  if (!tiers) return

  // Find the highest tier the member qualifies for
  const eligibleTier = tiers.find((tier) => currentPoints >= tier.min_points)

  if (eligibleTier) {
    const { data: member } = await supabase
      .from('loyalty_members')
      .select('tier_id')
      .eq('id', memberId)
      .single()

    if (member && member.tier_id !== eligibleTier.id) {
      // Upgrade tier
      await supabase
        .from('loyalty_members')
        .update({ tier_id: eligibleTier.id })
        .eq('id', memberId)
    }
  }
}

export async function redeemReward(memberId: string, rewardId: string) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if loyalty program is enabled
  const programStatus = await isLoyaltyProgramEnabled()
  if (!programStatus.enabled) {
    return { success: false, error: 'Loyalty program is disabled' }
  }

  // Get member and reward
  const [memberResult, rewardResult] = await Promise.all([
    adminSupabase.from('loyalty_members').select('*').eq('id', memberId).single(),
    adminSupabase.from('loyalty_rewards').select('*').eq('id', rewardId).eq('is_active', true).single(),
  ])

  if (memberResult.error || !memberResult.data) {
    return { success: false, error: 'Member not found' }
  }

  if (rewardResult.error || !rewardResult.data) {
    return { success: false, error: 'Reward not found or inactive' }
  }

  const member = memberResult.data
  const reward = rewardResult.data
  if (member.user_id !== user.id) {
    return { success: false, error: 'Unauthorized member access' }
  }

  // Check if member has enough points
  if (member.points_balance < reward.points_cost) {
    return { success: false, error: 'Insufficient points' }
  }

  // Check stock if applicable
  if (reward.stock_limit !== null && (reward.stock_remaining || 0) <= 0) {
    return { success: false, error: 'Reward out of stock' }
  }

  const newBalance = member.points_balance - reward.points_cost

  // Update member balance
  await adminSupabase
    .from('loyalty_members')
    .update({ points_balance: newBalance })
    .eq('id', member.id)

  // Create redemption
  const redemptionCode = `REDEEM-${Date.now().toString(36).toUpperCase()}`
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1) // Expires in 1 year

  const { data: redemption, error: redemptionError } = await adminSupabase
    .from('loyalty_redemptions')
    .insert({
      member_id: member.id,
      reward_id: reward.id,
      points_spent: reward.points_cost,
      redemption_code: redemptionCode,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (redemptionError || !redemption) {
    return { success: false, error: redemptionError?.message || 'Failed to create redemption' }
  }

  // Record transaction
  await adminSupabase.from('loyalty_transactions').insert({
    member_id: member.id,
    points_change: -reward.points_cost,
    transaction_type: 'redemption',
    reference_id: redemption.id,
    balance_after: newBalance,
    description: `Redeemed: ${reward.title}`,
  })

  // Update reward stock if applicable
  if (reward.stock_limit !== null) {
    await adminSupabase
      .from('loyalty_rewards')
      .update({ stock_remaining: (reward.stock_remaining || 0) - 1 })
      .eq('id', reward.id)
  }

  revalidatePath('/account/loyalty')
  return { success: true, redemptionCode, redemption }
}

export async function getLoyaltyMember(userId: string) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) {
    return null
  }

  const { data: member, error } = await adminSupabase
    .from('loyalty_members')
    .select(`
      *,
      loyalty_tiers (
        name,
        min_points,
        points_multiplier,
        benefits
      )
    `)
    .eq('user_id', userId)
    .single()

  if (error || !member) {
    const { data: defaultTier } = await adminSupabase
      .from('loyalty_tiers')
      .select('id')
      .order('min_points', { ascending: true })
      .limit(1)
      .maybeSingle()

    const referralCode = `REF-${userId.substring(0, 8).toUpperCase()}`
    const { data: created } = await adminSupabase
      .from('loyalty_members')
      .insert({
        user_id: userId,
        tier_id: defaultTier?.id || null,
        points_balance: 0,
        lifetime_points: 0,
        referral_code: referralCode,
      })
      .select(`
        *,
        loyalty_tiers (
          name,
          min_points,
          points_multiplier,
          benefits
        )
      `)
      .single()

    return created || null
  }

  return member
}

export async function getLoyaltyTransactions(memberId: string, limit = 20, offset = 0) {
  const supabase = await createServerSupabaseClient()
  const adminSupabase = createAdminSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data: member } = await adminSupabase
    .from('loyalty_members')
    .select('user_id')
    .eq('id', memberId)
    .single()
  if (!member || member.user_id !== user.id) {
    return { data: [], error: 'Unauthorized member access' }
  }

  const { data, error } = await adminSupabase
    .from('loyalty_transactions')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getAvailableRewards() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('is_active', true)
    .order('points_cost', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getNextTier(currentPoints: number) {
  const supabase = createAdminSupabaseClient()

  const { data: tiers } = await supabase
    .from('loyalty_tiers')
    .select('*')
    .gt('min_points', currentPoints)
    .order('min_points', { ascending: true })
    .limit(1)

  return tiers && tiers.length > 0 ? tiers[0] : null
}
