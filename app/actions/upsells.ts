'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Dashboard Stats
export async function getUpsellDashboardStats() {
  const adminSupabase = createAdminSupabaseClient()

  try {
    // Get active campaigns count
    const { count: activeCampaigns } = await adminSupabase
      .from('upsell_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get active bundles count
    const { count: activeBundles } = await adminSupabase
      .from('product_bundles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get active quantity breaks count
    const { count: activeQuantityBreaks } = await adminSupabase
      .from('quantity_breaks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get active post-purchase upsells count
    const { count: activePostPurchase } = await adminSupabase
      .from('post_purchase_upsells')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get active cart upsells count
    const { count: activeCartUpsells } = await adminSupabase
      .from('cart_upsells')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get active promotions count
    const { count: activePromotions } = await adminSupabase
      .from('promotions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get analytics data
    const { data: analytics } = await adminSupabase
      .from('upsell_analytics')
      .select('revenue, event_type')

    const totalRevenue = analytics?.reduce((sum, a) => sum + (parseFloat(a.revenue?.toString() || '0') || 0), 0) || 0
    const conversions = analytics?.filter(a => a.event_type === 'purchase').length || 0
    const views = analytics?.filter(a => a.event_type === 'view').length || 0
    const conversionRate = views > 0 ? (conversions / views) * 100 : 0

    // Calculate average order value from analytics
    const purchaseEvents = analytics?.filter(a => a.event_type === 'purchase') || []
    const averageOrderValue = purchaseEvents.length > 0
      ? purchaseEvents.reduce((sum, a) => sum + (parseFloat(a.revenue?.toString() || '0') || 0), 0) / purchaseEvents.length
      : 0

    return {
      data: {
        totalRevenue,
        totalConversions: conversions,
        conversionRate,
        averageOrderValue,
        activeCampaigns: activeCampaigns || 0,
        activeBundles: activeBundles || 0,
        activeQuantityBreaks: activeQuantityBreaks || 0,
        activePostPurchase: activePostPurchase || 0,
        activeCartUpsells: activeCartUpsells || 0,
        activePromotions: activePromotions || 0,
      },
      error: null
    }
  } catch (error: any) {
    console.error('Error fetching upsell stats:', error)
    return {
      data: {
        totalRevenue: 0,
        totalConversions: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        activeCampaigns: 0,
        activeBundles: 0,
        activeQuantityBreaks: 0,
        activePostPurchase: 0,
        activeCartUpsells: 0,
        activePromotions: 0,
      },
      error: error.message
    }
  }
}

// Campaign Management
export async function getAllCampaigns() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('upsell_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getCampaign(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('upsell_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createCampaign(data: {
  name: string
  description?: string
  campaign_type: string
  status?: string
  target_products?: any
  target_categories?: any
  target_conditions?: any
  display_settings?: any
  priority?: number
  starts_at?: string
  ends_at?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  // Prepare insert data, converting date strings to ISO format if provided
  const insertData: any = {
    name: data.name,
    description: data.description || null,
    campaign_type: data.campaign_type,
    status: data.status || 'draft',
    priority: data.priority || 0,
    target_products: data.target_products || [],
    target_categories: data.target_categories || [],
    target_conditions: data.target_conditions || {},
    display_settings: data.display_settings || {},
    created_by: user.id,
  }

  // Convert datetime-local strings to ISO timestamps
  if (data.starts_at) {
    insertData.starts_at = new Date(data.starts_at).toISOString()
  }
  if (data.ends_at) {
    insertData.ends_at = new Date(data.ends_at).toISOString()
  }

  const { data: campaign, error } = await adminSupabase
    .from('upsell_campaigns')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells')
  return { success: true, data: campaign }
}

export async function updateCampaign(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const patch = { ...updates }
  if ('starts_at' in patch) {
    patch.starts_at = patch.starts_at
      ? new Date(patch.starts_at).toISOString()
      : null
  }
  if ('ends_at' in patch) {
    patch.ends_at = patch.ends_at ? new Date(patch.ends_at).toISOString() : null
  }

  const { data, error } = await adminSupabase
    .from('upsell_campaigns')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells')
  revalidatePath('/admin/promos-upsells/campaigns')
  return { success: true, data }
}

export async function deleteCampaign(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('upsell_campaigns')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells')
  revalidatePath('/admin/promos-upsells/campaigns')
  return { success: true }
}

/** Public product URLs for email / admin copy (uses NEXT_PUBLIC_SITE_URL). */
export async function getProductStorefrontLinks(productIds: string[]) {
  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) {
    return { data: [] as Array<{ id: string; title: string; slug: string; url: string }>, error: null as string | null }
  }

  const adminSupabase = createAdminSupabaseClient()
  const { data, error } = await adminSupabase
    .from('products')
    .select('id, title, slug')
    .in('id', unique)

  if (error) {
    return { data: [], error: error.message }
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const rows = (data || []).map((p) => ({
    id: p.id,
    title: p.title || 'Product',
    slug: p.slug,
    url: `${base}/product/${p.slug}`,
  }))

  return { data: rows, error: null }
}

async function withStorefrontPreviewRows(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  rows: any[],
  pickProductId: (row: any) => string | undefined | null
) {
  if (!rows.length) return rows
  const ids = [...new Set(rows.map((r) => pickProductId(r)).filter(Boolean) as string[])]
  if (!ids.length) {
    return rows.map((r) => ({ ...r, storefront_preview: null }))
  }
  const { data: prods } = await adminSupabase
    .from('products')
    .select('id, title, slug')
    .in('id', ids)
  const map = new Map((prods || []).map((p) => [p.id, p]))
  return rows.map((row) => {
    const pid = pickProductId(row)
    const p = pid ? map.get(pid) : undefined
    const slug = p?.slug as string | undefined
    return {
      ...row,
      storefront_preview:
        p && slug
          ? { id: p.id as string, title: (p.title as string) || 'Product', slug }
          : null,
    }
  })
}

// ============================================
// PRODUCT BUNDLES
// ============================================

export async function getAllBundles() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('product_bundles')
    .select(`
      *,
      upsell_campaigns (id, name, status)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const enriched = await withStorefrontPreviewRows(
    adminSupabase,
    data || [],
    (b) => b.main_products?.[0]?.product_id
  )
  return { data: enriched, error: null }
}

export async function getBundle(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('product_bundles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createBundle(data: {
  campaign_id?: string
  name: string
  description?: string
  bundle_type: string
  main_products: any[]
  bonus_products?: any[]
  discount_type?: string
  discount_value?: number
  bundle_price?: number
  min_quantity?: number
  max_quantity?: number
  required_products?: any[]
  image_url?: string
  badge_text?: string
  status?: string
  sort_order?: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: bundle, error } = await adminSupabase
    .from('product_bundles')
    .insert({
      ...data,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/bundles')
  return { success: true, data: bundle }
}

export async function updateBundle(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('product_bundles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/bundles')
  return { success: true, data }
}

export async function deleteBundle(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('product_bundles')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/bundles')
  return { success: true }
}

// ============================================
// QUANTITY BREAKS
// ============================================

export async function getAllQuantityBreaks() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('quantity_breaks')
    .select(`
      *,
      products (id, title, slug),
      product_variants (id, sku, color, price),
      upsell_campaigns (id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const enriched = await withStorefrontPreviewRows(
    adminSupabase,
    data || [],
    (b) => b.product_id
  )
  return { data: enriched, error: null }
}

export async function getQuantityBreak(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('quantity_breaks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createQuantityBreak(data: {
  campaign_id?: string
  product_id: string
  variant_id?: string
  break_type: string
  tiers: any[]
  badge_text?: string
  show_on_product?: boolean
  show_in_cart?: boolean
  status?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: quantityBreak, error } = await adminSupabase
    .from('quantity_breaks')
    .insert({
      ...data,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/quantity-breaks')
  return { success: true, data: quantityBreak }
}

export async function updateQuantityBreak(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('quantity_breaks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/quantity-breaks')
  return { success: true, data }
}

export async function deleteQuantityBreak(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('quantity_breaks')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/quantity-breaks')
  return { success: true }
}

// ============================================
// POST-PURCHASE UPSELLS
// ============================================

export async function getAllPostPurchaseUpsells() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('post_purchase_upsells')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const enriched = await withStorefrontPreviewRows(
    adminSupabase,
    data || [],
    (u) => u.upsell_products?.[0]?.product_id
  )
  return { data: enriched, error: null }
}

export async function getPostPurchaseUpsell(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('post_purchase_upsells')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createPostPurchaseUpsell(data: {
  campaign_id?: string
  name: string
  trigger_type: string
  trigger_conditions?: any
  upsell_products: any[]
  display_delay?: number
  display_duration?: number
  headline?: string
  description?: string
  cta_text?: string
  image_url?: string
  discount_type?: string
  discount_value?: number
  urgency_text?: string
  status?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: upsell, error } = await adminSupabase
    .from('post_purchase_upsells')
    .insert({
      ...data,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/post-purchase')
  return { success: true, data: upsell }
}

export async function updatePostPurchaseUpsell(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('post_purchase_upsells')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/post-purchase')
  return { success: true, data }
}

export async function deletePostPurchaseUpsell(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('post_purchase_upsells')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/post-purchase')
  return { success: true }
}

// ============================================
// CART UPSELLS
// ============================================

export async function getAllCartUpsells() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('cart_upsells')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const enriched = await withStorefrontPreviewRows(
    adminSupabase,
    data || [],
    (u) => u.upsell_products?.[0]?.product_id
  )
  return { data: enriched, error: null }
}

export async function getCartUpsell(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('cart_upsells')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createCartUpsell(data: {
  campaign_id?: string
  name: string
  min_cart_value?: number
  max_cart_value?: number
  required_products?: any[]
  excluded_products?: any[]
  upsell_products: any[]
  position?: string
  headline?: string
  description?: string
  cta_text?: string
  image_url?: string
  discount_type?: string
  discount_value?: number
  status?: string
  sort_order?: number
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: upsell, error } = await adminSupabase
    .from('cart_upsells')
    .insert({
      ...data,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/cart-upsells')
  return { success: true, data: upsell }
}

export async function updateCartUpsell(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('cart_upsells')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/cart-upsells')
  return { success: true, data }
}

export async function deleteCartUpsell(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('cart_upsells')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/cart-upsells')
  return { success: true }
}

// ============================================
// FREQUENTLY BOUGHT TOGETHER
// ============================================

export async function getAllFrequentlyBoughtTogether() {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('frequently_bought_together')
    .select(`
      *,
      products (id, title, slug)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  const enriched = await withStorefrontPreviewRows(
    adminSupabase,
    data || [],
    (f) => f.main_product_id
  )
  return { data: enriched, error: null }
}

export async function getFrequentlyBoughtTogether(id: string) {
  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('frequently_bought_together')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

export async function createFrequentlyBoughtTogether(data: {
  campaign_id?: string
  main_product_id: string
  related_products: any[]
  algorithm_type?: string
  max_products?: number
  headline?: string
  show_discount?: boolean
  bundle_discount?: number
  status?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data: fbt, error } = await adminSupabase
    .from('frequently_bought_together')
    .insert({
      ...data,
      status: data.status || 'active',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/frequently-bought')
  return { success: true, data: fbt }
}

export async function updateFrequentlyBoughtTogether(id: string, updates: any) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { data, error } = await adminSupabase
    .from('frequently_bought_together')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/frequently-bought')
  return { success: true, data }
}

export async function deleteFrequentlyBoughtTogether(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('frequently_bought_together')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/promos-upsells/frequently-bought')
  return { success: true }
}

// ============================================
// ANALYTICS TRACKING
// ============================================

export async function trackUpsellEvent(data: {
  campaign_id?: string
  upsell_type: string
  upsell_id: string
  event_type: 'view' | 'click' | 'add_to_cart' | 'purchase' | 'dismiss'
  user_id?: string
  session_id?: string
  cart_value?: number
  order_id?: string
  product_ids?: string[]
  revenue?: number
}) {
  const adminSupabase = createAdminSupabaseClient()

  const { error } = await adminSupabase
    .from('upsell_analytics')
    .insert(data)

  if (error) {
    console.error('Error tracking upsell event:', error)
    return { success: false, error: error.message }
  }

  // Update campaign stats if campaign_id is provided (async, don't await)
  if (data.campaign_id) {
    const updateField = data.event_type === 'view' ? 'views' : 
                       data.event_type === 'click' ? 'clicks' :
                       data.event_type === 'purchase' ? 'conversions' : null

    if (updateField) {
      // Use async function to update stats
      ;(async () => {
        try {
          const { data: campaign } = await adminSupabase
            .from('upsell_campaigns')
            .select(updateField)
            .eq('id', data.campaign_id)
            .single()

          if (campaign) {
            const currentValue = (campaign as any)[updateField] || 0
            await adminSupabase
              .from('upsell_campaigns')
              .update({ [updateField]: currentValue + 1 })
              .eq('id', data.campaign_id)
          }
        } catch (error) {
          console.error('Error updating campaign stats:', error)
        }
      })()
    }

    // Update revenue if purchase event
    if (data.event_type === 'purchase' && data.revenue) {
      ;(async () => {
        try {
          const { data: campaign } = await adminSupabase
            .from('upsell_campaigns')
            .select('revenue')
            .eq('id', data.campaign_id)
            .single()

          if (campaign) {
            const currentRevenue = parseFloat(campaign.revenue?.toString() || '0') || 0
            await adminSupabase
              .from('upsell_campaigns')
              .update({ revenue: currentRevenue + (data.revenue || 0) })
              .eq('id', data.campaign_id)
          }
        } catch (error) {
          console.error('Error updating campaign revenue:', error)
        }
      })()
    }
  }

  return { success: true }
}

export async function getUpsellAnalytics(filters?: {
  campaign_id?: string
  upsell_type?: string
  upsell_id?: string
  event_type?: string
  start_date?: string
  end_date?: string
}) {
  const adminSupabase = createAdminSupabaseClient()

  let query = adminSupabase
    .from('upsell_analytics')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.campaign_id) {
    query = query.eq('campaign_id', filters.campaign_id)
  }
  if (filters?.upsell_type) {
    query = query.eq('upsell_type', filters.upsell_type)
  }
  if (filters?.upsell_id) {
    query = query.eq('upsell_id', filters.upsell_id)
  }
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type)
  }
  if (filters?.start_date) {
    query = query.gte('created_at', filters.start_date)
  }
  if (filters?.end_date) {
    query = query.lte('created_at', filters.end_date)
  }

  const { data, error } = await query.limit(1000)

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

