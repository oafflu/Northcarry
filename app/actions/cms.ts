'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

export async function getPageTemplate(pageType: 'home' | 'product', templateId?: string, includeDisabled: boolean = false) {
  // Check if user is admin or partner - if so, use admin client to bypass RLS
  const serverSupabase = await createServerSupabaseClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  
  let isAdminOrPartner = false
  if (user) {
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    isAdminOrPartner = profile?.role === 'admin' || profile?.role === 'partner'
  }
  
  // Use admin client for admin/partner to bypass RLS, otherwise use regular client
  const supabase = isAdminOrPartner ? createAdminSupabaseClient() : serverSupabase
  
  let query = supabase
    .from('cms_page_templates')
    .select(`
      *,
      cms_template_sections (
        *
      )
    `)
    .eq('page_type', pageType)

  // If templateId is provided, use that specific template
  if (templateId) {
    query = query.eq('id', templateId)
  } else {
    // Otherwise, get the active template
    query = query.eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
  }

  const { data: template, error } = await query.single()

  if (error || !template) {
    console.error('[getPageTemplate] Error loading template:', {
      pageType,
      templateId,
      error: error?.message,
      isAdminOrPartner,
      user: user?.id
    })
    return { data: null, error: error?.message || 'Template not found' }
  }

  // Sort sections by order
  let sections = (template.cms_template_sections || [])
    .sort((a: any, b: any) => a.section_order - b.section_order)

  // Only filter by enabled status if includeDisabled is false (for page rendering)
  if (!includeDisabled) {
    sections = sections.filter((s: any) => s.is_enabled)
  }

  // Debug logging for admin/partner preview
  if (isAdminOrPartner && includeDisabled) {
    console.log('[getPageTemplate] Loaded template for preview:', {
      templateId: template.id,
      templateName: template.template_name,
      totalSections: sections.length,
      enabledSections: sections.filter((s: any) => s.is_enabled).length,
      disabledSections: sections.filter((s: any) => s.is_enabled === false).length
    })
  }

  // Debug logging for product_grid sections
  const productGridSection = sections.find((s: any) => s.section_type === 'product_grid')
  if (productGridSection) {
    console.log('[getPageTemplate] Product Grid Section:', {
      id: productGridSection.id,
      content: productGridSection.content,
      contentKeys: productGridSection.content ? Object.keys(productGridSection.content) : [],
      productIds: productGridSection.content?.productIds,
      productIdsType: typeof productGridSection.content?.productIds,
      productIdsIsArray: Array.isArray(productGridSection.content?.productIds)
    })
  }

  return { data: { ...template, sections }, error: null }
}

export async function getProductTemplate(productId: string) {
  // Use admin client to bypass RLS and ensure we can read template_id and templates
  const supabase = createAdminSupabaseClient()
  
  // Get product's template_id
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('template_id')
    .eq('id', productId)
    .single()

  if (productError || !product) {
    console.warn(`[getProductTemplate] Product ${productId} not found, using default template. Error:`, productError)
    // Fallback to default template (active one)
    return getPageTemplate('product')
  }

  // If product has a specific template assigned, use it regardless of is_active status
  if (product.template_id) {
    console.log(`[getProductTemplate] Product ${productId} has template_id: ${product.template_id}`)
    
    // Fetch the specific template directly, bypassing is_active check
    const { data: template, error: templateError } = await supabase
      .from('cms_page_templates')
      .select(`
        *,
        cms_template_sections (
          *
        )
      `)
      .eq('id', product.template_id)
      .eq('page_type', 'product')
      .single()

    if (templateError || !template) {
      // If assigned template doesn't exist, fallback to default
      console.warn(`[getProductTemplate] Template ${product.template_id} not found for product ${productId}, using default. Error:`, templateError)
      return getPageTemplate('product')
    }

    console.log(`[getProductTemplate] Loaded template ${template.id} (${template.template_name}) with ${template.cms_template_sections?.length || 0} sections`)

    // Sort sections by order - include ALL sections (enabled and disabled) so we can check status
    let allSections = (template.cms_template_sections || [])
      .sort((a: any, b: any) => a.section_order - b.section_order)
    
    // Filter to only enabled sections for rendering
    let enabledSections = allSections.filter((s: any) => s.is_enabled)

    console.log(`[getProductTemplate] Template has ${allSections.length} total sections, ${enabledSections.length} enabled`)

    return { data: { ...template, sections: enabledSections, allSections }, error: null }
  }

  // No template assigned, use default (active) template
  console.log(`[getProductTemplate] Product ${productId} has no template_id, using default template`)
  return getPageTemplate('product')
}

export async function getAllTemplates() {
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_page_templates')
    .select('*')
    .order('page_type', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getTemplateSections(templateId: string) {
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_template_sections')
    .select('*')
    .eq('template_id', templateId)
    .order('section_order', { ascending: true })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function updateTemplateSection(
  sectionId: string,
  updates: {
    config?: any
    content?: any
    is_enabled?: boolean
    section_order?: number
  }
) {
  const supabase = createAdminSupabaseClient()
  
  // If content is being updated, we need to merge it with existing content
  // to preserve other fields that might not be in the updates
  let finalUpdates = { ...updates }
  
  if (updates.content) {
    // Get existing section to merge content
    const { data: existingSection } = await supabase
      .from('cms_template_sections')
      .select('content')
      .eq('id', sectionId)
      .single()
    
    if (existingSection?.content) {
      // Merge existing content with new content
      finalUpdates.content = {
        ...existingSection.content,
        ...updates.content
      }
    }
  }
  
  // Debug logging
  console.log('[updateTemplateSection] Updating section:', {
    sectionId,
    updates,
    finalUpdates,
    contentProductIds: finalUpdates.content?.productIds,
    contentKeys: finalUpdates.content ? Object.keys(finalUpdates.content) : []
  })
  
  const { data, error } = await supabase
    .from('cms_template_sections')
    .update(finalUpdates)
    .eq('id', sectionId)
    .select()
    .single()

  if (error) {
    console.error('[updateTemplateSection] Error:', error)
    return { success: false, error: error.message }
  }

  // Debug logging - check what was saved
  console.log('[updateTemplateSection] Saved data:', {
    savedContent: data?.content,
    savedContentProductIds: data?.content?.productIds,
    savedContentKeys: data?.content ? Object.keys(data.content) : []
  })

  revalidatePath('/')
  revalidatePath('/product')
  revalidatePath('/', 'layout')
  
  return { success: true, data }
}

export async function createTemplateSection(
  templateId: string,
  sectionData: {
    section_type: string
    section_order: number
    is_enabled?: boolean
    config?: any
    content?: any
  }
) {
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_template_sections')
    .insert({
      template_id: templateId,
      ...sectionData,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/product')
  return { success: true, data }
}

export async function deleteTemplateSection(sectionId: string) {
  const supabase = createAdminSupabaseClient()
  
  const { error } = await supabase
    .from('cms_template_sections')
    .delete()
    .eq('id', sectionId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/product')
  return { success: true }
}

export async function reorderSections(sections: Array<{ id: string; order: number }>) {
  const supabase = createAdminSupabaseClient()
  
  // Update each section's order
  const updates = sections.map(section =>
    supabase
      .from('cms_template_sections')
      .update({ section_order: section.order })
      .eq('id', section.id)
  )

  const results = await Promise.all(updates)
  const errors = results.filter(r => r.error)

  if (errors.length > 0) {
    return { success: false, error: errors[0].error?.message || 'Failed to reorder sections' }
  }

  revalidatePath('/')
  revalidatePath('/product')
  return { success: true }
}

// Menu Management Functions
export async function getMenuItems() {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('section', 'menu')
    .single()

  if (error && error.code !== 'PGRST116') {
    return { data: null, error: error.message }
  }

  if (!data) {
    return {
      data: {
        items: [
          { id: 1, label: "Home", url: "/", order: 1 },
          { id: 2, label: "Shop Now", url: "/product", order: 2 },
          { id: 3, label: "About Us", url: "#", order: 3 },
        ],
      },
      error: null
    }
  }

  return { data: data.content, error: null }
}

export async function saveMenuItems(items: Array<{ 
  id: number
  label: string
  url: string
  order: number
  badge?: {
    text: string
    color: string
    bgColor?: string
    textColor?: string
  }
}>) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify admin
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Update or insert menu content
  const { error } = await supabase
    .from('cms_content')
    .upsert({
      section: 'menu',
      content: { items },
      updated_by: user.id,
    }, {
      onConflict: 'section'
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

// Top Bar Management Functions
export async function getTopBar() {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('section', 'topbar')
    .single()

  if (error && error.code !== 'PGRST116') {
    return { data: null, error: error.message }
  }

  if (!data) {
    return {
      data: {
        message: '50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS',
        enabled: true,
        bgColor: '#000000',
        textColor: '#ffffff',
      },
      error: null
    }
  }

  return { data: data.content, error: null }
}

export async function saveTopBar(content: { message: string; enabled: boolean; bgColor: string; textColor: string }) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('cms_content')
    .upsert({
      section: 'topbar',
      content,
      updated_by: user.id,
    }, {
      onConflict: 'section'
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/', 'layout')
  return { success: true }
}

// Hero Banner Management Functions
export async function getHeroBanner() {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('section', 'hero')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching hero banner:', error)
    return { data: null, error: error.message }
  }

  if (!data || !data.content) {
    // Return default values if no data exists
    return {
      data: {
        heroImage: '/images/brevi_banner_web.png',
        heading: '50% OFF',
        subheading: 'FOR A LIMITED TIME',
        buttonText: 'Shop Now',
        buttonLink: '/product',
        showRating: true,
      },
      error: null
    }
  }

  // Return the content object directly (it's already JSONB/object)
  return { data: data.content, error: null }
}

export async function saveHeroBanner(content: {
  heroImage: string
  mobileHeroImage?: string
  heading: string
  subheading: string
  buttonText: string
  buttonLink: string
  showRating: boolean
}) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Validate content to prevent invalid values (but allow empty strings)
  if (content.heading && content.heading.includes('/admin/')) {
    return { success: false, error: 'Invalid heading value' }
  }
  if (content.subheading && content.subheading.includes('/admin/')) {
    return { success: false, error: 'Invalid subheading value' }
  }
  if (content.heroImage && content.heroImage.includes('/admin/')) {
    return { success: false, error: 'Invalid hero image URL' }
  }
  if (content.mobileHeroImage && content.mobileHeroImage.includes('/admin/')) {
    return { success: false, error: 'Invalid mobile hero image URL' }
  }

  const { error } = await supabase
    .from('cms_content')
    .upsert({
      section: 'hero',
      content, // This should be a JSONB object with all hero banner fields
      updated_by: user.id,
    }, {
      onConflict: 'section'
    })

  if (error) {
    console.error('Error saving hero banner:', error)
    return { success: false, error: error.message }
  }

  // Revalidate the home page to ensure changes are reflected
  revalidatePath('/')
  revalidatePath('/', 'layout') // Also revalidate the layout
  
  return { success: true }
}

// Generic CMS Content Functions (for Footer, Branding, About, Checkout)
export async function getCMSContent(section: string) {
  noStore()
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('section', section)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { data: null, error: error.message }
  }

  return { data: data?.content || null, error: null }
}

export async function saveCMSContent(section: string, content: any) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('cms_content')
    .upsert({
      section,
      content,
      updated_by: user.id,
    }, {
      onConflict: 'section'
    })

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate relevant pages based on section
  revalidatePath('/')
  if (section === 'branding') {
    // Branding affects metadata, revalidate all pages
    revalidatePath('/', 'layout')
  }
  if (section === 'privacy') revalidatePath('/privacy')
  if (section === 'terms') revalidatePath('/terms')
  if (section === 'refund') revalidatePath('/refund')
  if (section === 'faq') revalidatePath('/faq')
  if (section === 'footer') {
    revalidatePath('/', 'layout')
  }
  if (section === 'headers') {
    revalidatePath('/', 'layout')
    revalidatePath('/admin', 'layout')
  }

  return { success: true }
}

// Product Page Content Management Functions
export async function getProductPageContent() {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('section', 'product_page')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching product page content:', error)
    return { data: null, error: error.message }
  }

  if (!data || !data.content) {
    // Return default values if no data exists
    return {
      data: {
        saleBannerText: '50% OFF EASTER SALE TODAY!',
        saleBannerEnabled: true,
        saleBannerBgColor: '#3B82F6',
        saleBannerTextColor: '#FFFFFF',
        showRating: true,
        defaultReviewCount: 233,
        defaultRating: 5,
        paymentIcons: [
          { name: 'Visa', url: '/placeholder.svg?height=24&width=40', alt: 'Visa' },
          { name: 'Mastercard', url: '/placeholder.svg?height=24&width=40', alt: 'Mastercard' },
          { name: 'Amex', url: '/placeholder.svg?height=24&width=40', alt: 'Amex' },
          { name: 'PayPal', url: '/placeholder.svg?height=24&width=40', alt: 'PayPal' },
          { name: 'Apple Pay', url: '/placeholder.svg?height=24&width=40', alt: 'Apple Pay' },
        ],
        useVariantImages: true, // Use variant images instead of color circles
      },
      error: null
    }
  }

  // Return the content object directly (it's already JSONB/object)
  return { data: data.content, error: null }
}

export async function saveProductPageContent(content: {
  saleBannerText: string
  saleBannerEnabled: boolean
  saleBannerBgColor: string
  saleBannerTextColor: string
  showRating: boolean
  defaultReviewCount?: number
  defaultRating?: number
  paymentIcons?: Array<{ name: string; url: string; alt: string }>
  useVariantImages?: boolean
}) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Validate content to prevent invalid values
  if (content.saleBannerText && content.saleBannerText.includes('/admin/')) {
    return { success: false, error: 'Invalid sale banner text' }
  }

  const { error } = await supabase
    .from('cms_content')
    .upsert({
      section: 'product_page',
      content, // This should be a JSONB object with all product page fields
      updated_by: user.id,
    }, {
      onConflict: 'section'
    })

  if (error) {
    console.error('Error saving product page content:', error)
    return { success: false, error: error.message }
  }

  // Revalidate the product pages to ensure changes are reflected
  revalidatePath('/product')
  revalidatePath('/product/[slug]', 'page')
  
  return { success: true }
}

// Product Template Management Functions
export async function createProductTemplate(templateName: string) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Get the default template to copy sections from
  const { data: defaultTemplate, error: defaultError } = await supabase
    .from('cms_page_templates')
    .select(`
      *,
      cms_template_sections (*)
    `)
    .eq('page_type', 'product')
    .eq('template_name', 'Default')
    .single()

  // Create new template (don't activate it automatically)
  const { data, error } = await supabase
    .from('cms_page_templates')
    .insert({
      page_type: 'product',
      template_name: templateName,
      is_active: false, // New templates are not active by default
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Copy sections from default template if it exists
  if (defaultTemplate && defaultTemplate.cms_template_sections && defaultTemplate.cms_template_sections.length > 0) {
    const sectionsToInsert = defaultTemplate.cms_template_sections.map((section: any) => ({
      template_id: data.id,
      section_type: section.section_type,
      section_order: section.section_order,
      is_enabled: section.is_enabled,
      config: section.config || {},
      content: section.content || {},
    }))

    const { error: sectionsError } = await supabase
      .from('cms_template_sections')
      .insert(sectionsToInsert)

    if (sectionsError) {
      console.error('Error copying sections from default template:', sectionsError)
      // Continue anyway, as the template was created successfully
    }
  }

  revalidatePath('/admin/cms/product-template')
  return { success: true, data }
}

export async function getProductTemplateById(templateId: string) {
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_page_templates')
    .select(`
      *,
      cms_template_sections (
        *
      )
    `)
    .eq('id', templateId)
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  const sections = (data.cms_template_sections || [])
    .sort((a: any, b: any) => a.section_order - b.section_order)

  return { data: { ...data, sections }, error: null }
}

export async function getAllProductTemplates() {
  const supabase = createAdminSupabaseClient()
  
  const { data, error } = await supabase
    .from('cms_page_templates')
    .select('*')
    .eq('page_type', 'product')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function updateProductTemplate(templateId: string, updates: { template_name?: string; is_active?: boolean }) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Note: For product templates, is_active is only used as a fallback for products without assigned templates
  // Multiple templates can be used simultaneously when assigned to different products
  // We don't deactivate other templates when activating one, as each product can have its own template
  // The is_active flag only determines which template is used as the default for products without template_id

  const { data, error } = await supabase
    .from('cms_page_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/cms/product-template')
  revalidatePath('/product')
  revalidatePath('/product/[slug]', 'page')
  return { success: true, data }
}

export async function deleteProductTemplate(templateId: string) {
  const supabase = createAdminSupabaseClient()
  const supabaseAuth = await createServerSupabaseClient()
  
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'partner') {
    return { success: false, error: 'Unauthorized' }
  }

  // Check if this is the only template
  const { data: templates } = await supabase
    .from('cms_page_templates')
    .select('id')
    .eq('page_type', 'product')

  if (templates && templates.length <= 1) {
    return { success: false, error: 'Cannot delete the last template' }
  }

  const { error } = await supabase
    .from('cms_page_templates')
    .delete()
    .eq('id', templateId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/cms/product-template')
  return { success: true }
}
