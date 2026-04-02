'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

// ===========================
// AFFILIATE TIERS
// ===========================

export interface AffiliateTier {
  id: string
  name: string
  description?: string
  commission_type: 'percentage' | 'fixed'
  commission_rate: number
  min_sales: number
  max_sales?: number
  benefits?: any
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getAffiliateTiers() {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliate_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_sales', { ascending: true })

    if (error) {
      console.error('Error fetching affiliate tiers:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: data as AffiliateTier[], error: null }
  } catch (error: any) {
    console.error('Error in getAffiliateTiers:', error)
    return { success: false, error: error.message, data: [] }
  }
}

export async function createAffiliateTier(input: {
  name: string
  description?: string
  commission_type: 'percentage' | 'fixed'
  commission_rate: number
  min_sales?: number
  max_sales?: number
  benefits?: any
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliate_tiers')
      .insert({
        ...input,
        min_sales: input.min_sales || 0,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating affiliate tier:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, data: data as AffiliateTier, error: null }
  } catch (error: any) {
    console.error('Error in createAffiliateTier:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function updateAffiliateTier(id: string, input: Partial<AffiliateTier>) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliate_tiers')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating affiliate tier:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, data: data as AffiliateTier, error: null }
  } catch (error: any) {
    console.error('Error in updateAffiliateTier:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function deleteAffiliateTier(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from('affiliate_tiers')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting affiliate tier:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, error: null }
  } catch (error: any) {
    console.error('Error in deleteAffiliateTier:', error)
    return { success: false, error: error.message }
  }
}

// ===========================
// AFFILIATES
// ===========================

export interface Affiliate {
  id: string
  user_id: string
  tier_id?: string
  affiliate_code: string
  company_name?: string
  website?: string
  tax_id?: string
  payment_method?: string
  payment_details?: any
  status: 'pending' | 'active' | 'suspended' | 'inactive'
  approved_at?: string
  approved_by?: string
  total_clicks: number
  total_orders: number
  total_revenue: number
  total_commission: number
  paid_commission: number
  pending_commission: number
  auto_approve: boolean
  notes?: string
  created_at: string
  updated_at: string
  user?: {
    email: string
    first_name?: string
    last_name?: string
  }
  tier?: AffiliateTier
}

export async function getAffiliates(filters?: {
  status?: string
  search?: string
  page?: number
  pageSize?: number
}) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase
      .from('affiliates')
      .select(`
        *,
        user:profiles!affiliates_user_id_fkey(email, first_name, last_name),
        tier:affiliate_tiers(*)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.search) {
      query = query.or(`affiliate_code.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,profiles.email.ilike.%${filters.search}%`)
    }

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query.range(from, to)

    if (error) {
      console.error('Error fetching affiliates:', error)
      return { success: false, error: error.message, data: [], count: 0 }
    }

    return { success: true, data: data as Affiliate[], count: count || 0, error: null }
  } catch (error: any) {
    console.error('Error in getAffiliates:', error)
    return { success: false, error: error.message, data: [], count: 0 }
  }
}

export async function getAffiliateById(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliates')
      .select(`
        *,
        user:profiles!affiliates_user_id_fkey(email, first_name, last_name),
        tier:affiliate_tiers(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching affiliate:', error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in getAffiliateById:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function getAffiliateByUserId(userId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliates')
      .select(`
        *,
        user:profiles!affiliates_user_id_fkey(email, first_name, last_name),
        tier:affiliate_tiers(*)
      `)
      .eq('user_id', userId)
      .single()

    if (error) {
      // Not found is okay - user might not be an affiliate yet
      if (error.code === 'PGRST116') {
        return { success: true, data: null, error: null }
      }
      console.error('Error fetching affiliate by user ID:', error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in getAffiliateByUserId:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function getAffiliateByCode(code: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .eq('affiliate_code', code)
      .eq('status', 'active')
      .single()

    if (error) {
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as Affiliate, error: null }
  } catch (error: any) {
    return { success: false, error: error.message, data: null }
  }
}

export async function createAffiliate(input: {
  user_id: string
  company_name?: string
  website?: string
  tax_id?: string
  payment_method?: string
  payment_details?: any
  tier_id?: string
  invitation_token?: string | null
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Check if affiliate already exists (by user_id or invitation_token)
    let existingAffiliate = null
    
    // First check by user_id
    const { data: existingByUserId } = await supabase
      .from('affiliates')
      .select('*')
      .eq('user_id', input.user_id)
      .maybeSingle()
    
    if (existingByUserId) {
      existingAffiliate = existingByUserId
    } else if (input.invitation_token) {
      // If no affiliate by user_id, check by invitation_token
      const { data: existingByToken } = await supabase
        .from('affiliates')
        .select('*')
        .eq('invitation_token', input.invitation_token)
        .maybeSingle()
      
      if (existingByToken) {
        existingAffiliate = existingByToken
      }
    }
    
    // If affiliate exists, update it instead of creating new
    if (existingAffiliate) {
      const updates: any = {}
      if (input.company_name !== undefined) updates.company_name = input.company_name
      if (input.website !== undefined) updates.website = input.website
      if (input.tax_id !== undefined) updates.tax_id = input.tax_id
      if (input.payment_method !== undefined) updates.payment_method = input.payment_method
      if (input.payment_details !== undefined) updates.payment_details = input.payment_details
      if (input.tier_id !== undefined) updates.tier_id = input.tier_id
      
      // Update user_id if it's different (invitation was for different user)
      if (existingAffiliate.user_id !== input.user_id) {
        updates.user_id = input.user_id
      }
      
      // Clear invitation token since they've completed registration
      updates.invitation_token = null
      updates.invitation_token_expiry = null
      
      const { data: updatedAffiliate, error: updateError } = await supabase
        .from('affiliates')
        .update(updates)
        .eq('id', existingAffiliate.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('Error updating affiliate:', updateError)
        return { success: false, error: updateError.message, data: null }
      }
      
      // Get user info for email
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', input.user_id)
        .single()

      // Send application confirmation email
      if (userProfile?.email) {
        try {
          const { sendAffiliateApplicationConfirmationEmail } = await import('@/lib/email')
          const userName = userProfile.first_name && userProfile.last_name
            ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
            : userProfile.email

          await sendAffiliateApplicationConfirmationEmail(
            userProfile.email,
            userName
          )
        } catch (emailError) {
          console.error('Error sending application confirmation email:', emailError)
          // Don't fail the application if email fails
        }
      }
      
      revalidatePath('/admin/marketing/affiliate')
      revalidatePath('/account/affiliate')
      return { success: true, data: updatedAffiliate as Affiliate, error: null }
    }
    
    // No existing affiliate - create new one
    // Generate unique affiliate code
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    let affiliateCode = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('affiliates')
        .select('id')
        .eq('affiliate_code', affiliateCode)
        .single()
      
      if (!existing) break
      affiliateCode = generateCode()
      attempts++
    }

    // Get user info for email
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', input.user_id)
      .single()

    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: input.user_id,
        company_name: input.company_name,
        website: input.website,
        tax_id: input.tax_id,
        payment_method: input.payment_method,
        payment_details: input.payment_details,
        tier_id: input.tier_id,
        affiliate_code: affiliateCode,
        status: 'pending',
        // Don't set invitation_token for new registrations (only for invited ones)
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating affiliate:', error)
      return { success: false, error: error.message, data: null }
    }

    // Send application confirmation email
    if (userProfile?.email) {
      try {
        const { sendAffiliateApplicationConfirmationEmail } = await import('@/lib/email')
        const userName = userProfile.first_name && userProfile.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`.trim()
          : userProfile.email

        await sendAffiliateApplicationConfirmationEmail(
          userProfile.email,
          userName
        )
      } catch (emailError) {
        console.error('Error sending application confirmation email:', emailError)
        // Don't fail the application if email fails
      }
    }

    revalidatePath('/admin/marketing/affiliate')
    revalidatePath('/account/affiliate')
    return { success: true, data: data as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in createAffiliate:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function updateAffiliate(id: string, input: Partial<Affiliate>) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliates')
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating affiliate:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, data: data as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in updateAffiliate:', error)
    return { success: false, error: error.message, data: null }
  }
}

export async function deleteAffiliate(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from('affiliates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting affiliate:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/marketing/affiliate')
    revalidatePath('/account/affiliate')
    return { success: true, error: null }
  } catch (error: any) {
    console.error('Error in deleteAffiliate:', error)
    return { success: false, error: error.message }
  }
}

export async function cleanupDuplicateAffiliates() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get all affiliates with user info
    const { data: allAffiliates, error: fetchError } = await supabase
      .from('affiliates')
      .select('id, user_id, created_at, status, total_orders, total_revenue')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching affiliates:', fetchError)
      return { success: false, error: fetchError.message, deleted: 0 }
    }

    if (!allAffiliates || allAffiliates.length === 0) {
      return { success: true, error: null, deleted: 0, message: 'No affiliates found' }
    }

    // Group affiliates by user_id
    const affiliatesByUser = new Map<string, typeof allAffiliates>()
    for (const affiliate of allAffiliates) {
      if (!affiliatesByUser.has(affiliate.user_id)) {
        affiliatesByUser.set(affiliate.user_id, [])
      }
      affiliatesByUser.get(affiliate.user_id)!.push(affiliate)
    }

    // Find duplicates (users with more than one affiliate)
    const duplicates: string[] = []
    for (const [userId, affiliates] of affiliatesByUser.entries()) {
      if (affiliates.length > 1) {
        // Sort by: 1) status (active > pending > others), 2) total_orders, 3) created_at (newest)
        affiliates.sort((a, b) => {
          const statusPriority: Record<string, number> = { active: 3, pending: 2, suspended: 1, inactive: 0 }
          const statusDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0)
          if (statusDiff !== 0) return statusDiff
          
          const ordersDiff = (b.total_orders || 0) - (a.total_orders || 0)
          if (ordersDiff !== 0) return ordersDiff
          
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        
        // Keep the first one (best), delete the rest
        const toKeep = affiliates[0]
        const toDelete = affiliates.slice(1)
        
        console.log(`User ${userId} has ${affiliates.length} affiliates. Keeping ${toKeep.id}, deleting ${toDelete.length} duplicates.`)
        
        for (const duplicate of toDelete) {
          duplicates.push(duplicate.id)
        }
      }
    }

    if (duplicates.length === 0) {
      return { success: true, error: null, deleted: 0, message: 'No duplicate affiliates found' }
    }

    // Delete duplicates
    const { error: deleteError } = await supabase
      .from('affiliates')
      .delete()
      .in('id', duplicates)

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError)
      return { success: false, error: deleteError.message, deleted: 0 }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { 
      success: true, 
      error: null, 
      deleted: duplicates.length,
      message: `Successfully removed ${duplicates.length} duplicate affiliate(s)`
    }
  } catch (error: any) {
    console.error('Error in cleanupDuplicateAffiliates:', error)
    return { success: false, error: error.message, deleted: 0 }
  }
}

export async function approveAffiliate(id: string, userId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get affiliate with user and tier info
    const { data: affiliate, error: fetchError } = await supabase
      .from('affiliates')
      .select(`
        *,
        user:profiles!affiliates_user_id_fkey(email, first_name, last_name),
        tier:affiliate_tiers(name, commission_rate)
      `)
      .eq('id', id)
      .single()

    if (fetchError || !affiliate) {
      console.error('Error fetching affiliate:', fetchError)
      return { success: false, error: fetchError?.message || 'Affiliate not found', data: null }
    }

    // Update affiliate status
    const { data: updatedAffiliate, error } = await supabase
      .from('affiliates')
      .update({
        status: 'active',
        approved_at: new Date().toISOString(),
        approved_by: userId,
      })
      .eq('id', id)
      .select(`
        *,
        user:profiles!affiliates_user_id_fkey(email, first_name, last_name),
        tier:affiliate_tiers(name, commission_rate)
      `)
      .single()

    if (error) {
      console.error('Error approving affiliate:', error)
      return { success: false, error: error.message, data: null }
    }

    // Send approval email
    if (updatedAffiliate?.user?.email) {
      try {
        const { sendAffiliateApprovedEmail } = await import('@/lib/email')
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
        const dashboardUrl = `${siteUrl}/account/affiliate`
        
        const userName = updatedAffiliate.user.first_name 
          ? `${updatedAffiliate.user.first_name} ${updatedAffiliate.user.last_name || ''}`.trim()
          : updatedAffiliate.user.email

        await sendAffiliateApprovedEmail(
          updatedAffiliate.user.email,
          userName,
          updatedAffiliate.affiliate_code,
          dashboardUrl,
          updatedAffiliate.tier?.name,
          updatedAffiliate.tier?.commission_rate
        )
      } catch (emailError) {
        console.error('Error sending approval email:', emailError)
        // Don't fail the approval if email fails
      }
    }

    revalidatePath('/admin/marketing/affiliate')
    revalidatePath('/account/affiliate')
    return { success: true, data: updatedAffiliate as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in approveAffiliate:', error)
    return { success: false, error: error.message, data: null }
  }
}

// Invite a new affiliate (creates user account and sends invitation)
export async function inviteAffiliate(input: {
  email: string
  firstName: string
  lastName: string
  tier_id?: string
  company_name?: string
  website?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const adminSupabase = createAdminSupabaseClient()

    // Check if user already exists by checking profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', input.email.toLowerCase().trim())
      .single()
    
    let userId: string
    let isNewUser = false

    if (existingProfile?.id) {
      userId = existingProfile.id
    } else {
      // Create new user account
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12).toUpperCase() + '!1'
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: input.email.toLowerCase().trim(),
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          first_name: input.firstName,
          last_name: input.lastName,
        },
      })

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError)
        return { success: false, error: createError?.message || 'Failed to create user account', data: null }
      }

      userId = newUser.user.id
      isNewUser = true

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        email: input.email.toLowerCase().trim(),
        first_name: input.firstName,
        last_name: input.lastName,
        role: 'customer', // Affiliates are customers who can also be affiliates
      })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Try to clean up the user if profile creation fails
        await adminSupabase.auth.admin.deleteUser(userId)
        return { success: false, error: 'Failed to create user profile', data: null }
      }
    }

    // Check if affiliate already exists
    const { data: existingAffiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existingAffiliate) {
      return { success: false, error: 'This user is already an affiliate', data: null }
    }

    // Generate invitation token
    const invitationToken = randomUUID()
    const tokenExpiry = new Date()
    tokenExpiry.setDate(tokenExpiry.getDate() + 7) // 7 days expiry

    // Create affiliate record with pending status
    const generateCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    let affiliateCode = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('affiliates')
        .select('id')
        .eq('affiliate_code', affiliateCode)
        .single()
      
      if (!existing) break
      affiliateCode = generateCode()
      attempts++
    }

    // Get tier info if provided
    let tierName: string | undefined
    let commissionRate: number | undefined
    if (input.tier_id) {
      const { data: tier } = await supabase
        .from('affiliate_tiers')
        .select('name, commission_rate')
        .eq('id', input.tier_id)
        .single()
      
      if (tier) {
        tierName = tier.name
        commissionRate = tier.commission_rate
      }
    }

    const { data: affiliate, error: affiliateError } = await supabase
      .from('affiliates')
      .insert({
        user_id: userId,
        affiliate_code: affiliateCode,
        tier_id: input.tier_id,
        company_name: input.company_name,
        website: input.website,
        status: 'pending',
        invitation_token: invitationToken,
        invitation_token_expiry: tokenExpiry.toISOString(),
      })
      .select()
      .single()

    if (affiliateError) {
      console.error('Error creating affiliate:', affiliateError)
      return { success: false, error: affiliateError.message, data: null }
    }

    // Send invitation email
    try {
      const { sendAffiliateInvitationEmail } = await import('@/lib/email')
      const userName = `${input.firstName} ${input.lastName}`.trim()
      await sendAffiliateInvitationEmail(
        input.email,
        userName,
        invitationToken,
        tierName,
        commissionRate
      )
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError)
      // Don't fail the invitation if email fails
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, data: affiliate as Affiliate, error: null }
  } catch (error: any) {
    console.error('Error in inviteAffiliate:', error)
    return { success: false, error: error.message, data: null }
  }
}

// ===========================
// AFFILIATE LINKS
// ===========================

export interface AffiliateLink {
  id: string
  affiliate_id: string
  link_type: 'product' | 'category' | 'home' | 'custom'
  product_id?: string
  category_id?: string
  custom_url?: string
  affiliate_url: string
  short_code?: string
  total_clicks: number
  total_conversions: number
  total_revenue: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getAffiliateLinks(affiliateId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliate_links')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching affiliate links:', error)
      return { success: false, error: error.message, data: [] }
    }

    return { success: true, data: data as AffiliateLink[], error: null }
  } catch (error: any) {
    console.error('Error in getAffiliateLinks:', error)
    return { success: false, error: error.message, data: [] }
  }
}

export async function createAffiliateLink(input: {
  affiliate_id: string
  link_type: 'product' | 'category' | 'home' | 'custom'
  product_id?: string
  category_id?: string
  custom_url?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get affiliate code
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('affiliate_code')
      .eq('id', input.affiliate_id)
      .single()

    if (!affiliate) {
      return { success: false, error: 'Affiliate not found', data: null }
    }

    // Build affiliate URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
    let affiliateUrl = ''
    
    if (input.link_type === 'product' && input.product_id) {
      affiliateUrl = `${baseUrl}/product/${input.product_id}?ref=${affiliate.affiliate_code}`
    } else if (input.link_type === 'home') {
      affiliateUrl = `${baseUrl}/?ref=${affiliate.affiliate_code}`
    } else if (input.link_type === 'custom' && input.custom_url) {
      affiliateUrl = `${input.custom_url}${input.custom_url.includes('?') ? '&' : '?'}ref=${affiliate.affiliate_code}`
    } else {
      affiliateUrl = `${baseUrl}/?ref=${affiliate.affiliate_code}`
    }

    const { data, error } = await supabase
      .from('affiliate_links')
      .insert({
        ...input,
        affiliate_url: affiliateUrl,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating affiliate link:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing/affiliate')
    return { success: true, data: data as AffiliateLink, error: null }
  } catch (error: any) {
    console.error('Error in createAffiliateLink:', error)
    return { success: false, error: error.message, data: null }
  }
}

// ===========================
// AFFILIATE ORDERS/COMMISSIONS
// ===========================

export interface AffiliateOrder {
  id: string
  affiliate_id: string
  order_id: string
  affiliate_link_id?: string
  click_id?: string
  referral_code: string
  order_number: string
  order_total: number
  order_date: string
  commission_rate: number
  commission_amount: number
  commission_type: string
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  approved_at?: string
  paid_at?: string
  payment_id?: string
  created_at: string
  updated_at: string
}

export async function getAffiliateOrders(affiliateId: string, filters?: {
  status?: string
  page?: number
  pageSize?: number
}) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase
      .from('affiliate_orders')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query.range(from, to)

    if (error) {
      console.error('Error fetching affiliate orders:', error)
      return { success: false, error: error.message, data: [], count: 0 }
    }

    return { success: true, data: data as AffiliateOrder[], count: count || 0, error: null }
  } catch (error: any) {
    console.error('Error in getAffiliateOrders:', error)
    return { success: false, error: error.message, data: [], count: 0 }
  }
}

export async function createAffiliateOrder(input: {
  affiliate_id: string
  order_id: string
  affiliate_link_id?: string
  click_id?: string
  referral_code: string
  order_number: string
  order_total: number
  order_date: string
  commission_rate: number
  commission_amount: number
  commission_type: string
  status?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('affiliate_orders')
      .insert({
        ...input,
        status: input.status || 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating affiliate order:', error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath('/admin/marketing/affiliate')
    revalidatePath('/account/affiliate')
    return { success: true, data: data as AffiliateOrder, error: null }
  } catch (error: any) {
    console.error('Error in createAffiliateOrder:', error)
    return { success: false, error: error.message, data: null }
  }
}

// Track affiliate click
export async function trackAffiliateClick(affiliateCode: string, linkId?: string, metadata?: {
  ip_address?: string
  user_agent?: string
  referrer?: string
  session_id?: string
  user_id?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get affiliate by code
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('affiliate_code', affiliateCode)
      .eq('status', 'active')
      .single()

    if (!affiliate) {
      return { success: false, error: 'Invalid affiliate code', clickId: null }
    }

    // Generate unique click ID
    const clickId = `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create click record
    const { error: clickError } = await supabase
      .from('affiliate_clicks')
      .insert({
        affiliate_id: affiliate.id,
        affiliate_link_id: linkId,
        click_id: clickId,
        ip_address: metadata?.ip_address,
        user_agent: metadata?.user_agent,
        referrer: metadata?.referrer,
        session_id: metadata?.session_id,
        user_id: metadata?.user_id,
      })

    if (clickError) {
      console.error('Error tracking affiliate click:', clickError)
      return { success: false, error: clickError.message, clickId: null }
    }

    // Update affiliate click count
    const { data: currentAffiliate } = await supabase
      .from('affiliates')
      .select('total_clicks')
      .eq('id', affiliate.id)
      .single()
    
    if (currentAffiliate) {
      await supabase
        .from('affiliates')
        .update({ total_clicks: (currentAffiliate.total_clicks || 0) + 1 })
        .eq('id', affiliate.id)
    }

    // Update link click count if link provided
    if (linkId) {
      const { data: currentLink } = await supabase
        .from('affiliate_links')
        .select('total_clicks')
        .eq('id', linkId)
        .single()
      
      if (currentLink) {
        await supabase
          .from('affiliate_links')
          .update({ total_clicks: (currentLink.total_clicks || 0) + 1 })
          .eq('id', linkId)
      }
    }

    return { success: true, clickId, error: null }
  } catch (error: any) {
    console.error('Error in trackAffiliateClick:', error)
    return { success: false, error: error.message, clickId: null }
  }
}

