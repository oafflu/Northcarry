'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { logProductAction } from '@/lib/system-logger'

/**
 * Get all active products for admin use (bypasses RLS)
 */
export async function getActiveProductsForAdmin() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .select('id, title, status, base_price, compare_at_price')
    .eq('status', 'active')
    .order('title', { ascending: true })

  if (error) {
    console.error('Error fetching active products:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

/**
 * Distinct non-empty `products.category` values for admin pickers (e.g. campaign targeting).
 */
export async function getDistinctProductCategoriesForAdmin() {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase.from('products').select('category')

  if (error) {
    return { data: [] as string[], error: error.message }
  }

  const unique = new Set<string>()
  for (const row of data || []) {
    const c = (row as { category?: string | null }).category
    if (c && String(c).trim()) unique.add(String(c).trim())
  }

  return { data: [...unique].sort((a, b) => a.localeCompare(b)), error: null }
}

/**
 * Get product variants for a specific product (admin use)
 */
export async function getProductVariantsForAdmin(productId: string) {
  const supabase = createAdminSupabaseClient()

  const { data, error } = await supabase
    .from('product_variants')
    .select('id, sku, color, price')
    .eq('product_id', productId)
    .order('color', { ascending: true })

  if (error) {
    console.error('Error fetching product variants:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function getProductBySlug(slug: string) {
  const supabase = await createServerSupabaseClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (error || !product) {
    return { data: null, error: error?.message || 'Product not found' }
  }

  return { data: product, error: null }
}

export async function getProductWithVariants(slug: string, allowDraft: boolean = false) {
  // Use admin client for preview mode to bypass RLS and see draft products
  const supabase = allowDraft 
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient()

  // Build product query - allow draft products if preview mode
  let productQuery = supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
  
  if (!allowDraft) {
    productQuery = productQuery.eq('status', 'active')
  }
  
  const productResult = await productQuery.single()

  if (productResult.error || !productResult.data) {
    return { data: null, error: productResult.error?.message || 'Product not found' }
  }

  const product = productResult.data

  // Fetch variants, images, subscription data, inventory links, and linked subscriptions for this product
  const [variants, images, subscriptionData, inventoryLinks, linkedSubscriptionsData] = await Promise.all([
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('subscription_products')
      .select('*')
      .eq('product_id', product.id)
      .eq('status', 'active')
      .eq('is_subscription_enabled', true),
    supabase
      .from('product_supplier_links')
      .select(`
        variant_id,
        supplier_inventory_id,
        is_primary_supplier,
        supplier_inventory (
          quantity_available,
          quantity_reserved,
          quantity_committed,
          reorder_point,
          status
        )
      `)
      .eq('product_id', product.id),
    // Fetch linked subscriptions where this product is the trigger
    supabase
      .from('linked_subscriptions')
      .select(`
        *,
        subscription_product:subscription_products!linked_subscriptions_subscription_product_id_fkey (
          id,
          variant_id,
          subscription_price,
          prepaid_price,
          available_frequencies,
          shipping_days,
          products (
            id,
            title,
            slug
          ),
          product_variants (
            id,
            color,
            sku,
            price
          )
        )
      `)
      .eq('trigger_product_id', product.id)
      .eq('status', 'active'),
  ])

  // Map subscription data by variant_id for easy lookup
  const subscriptionsByVariant = new Map()
  if (subscriptionData.data) {
    subscriptionData.data.forEach((sub) => {
      if (sub.variant_id) {
        subscriptionsByVariant.set(sub.variant_id, sub)
      }
    })
  }

  // Map inventory data by variant_id for easy lookup
  const inventoryByVariant = new Map()
  if (inventoryLinks.data) {
    inventoryLinks.data.forEach((link) => {
      if (link.variant_id && link.supplier_inventory && link.is_primary_supplier) {
        const inventory = link.supplier_inventory as any
        inventoryByVariant.set(link.variant_id, {
          quantity_available: inventory.quantity_available || 0,
          quantity_reserved: inventory.quantity_reserved || 0,
          quantity_committed: inventory.quantity_committed || 0,
          reorder_point: inventory.reorder_point || 10,
          status: inventory.status || 'active',
        })
      }
    })
  }

  // Process linked subscriptions - map by trigger variant (or null for all variants)
  const linkedSubscriptionsByVariant = new Map<string | null, any[]>()
  if (linkedSubscriptionsData.data) {
    linkedSubscriptionsData.data.forEach((linkedSub: any) => {
      const variantKey = linkedSub.trigger_variant_id || null
      if (!linkedSubscriptionsByVariant.has(variantKey)) {
        linkedSubscriptionsByVariant.set(variantKey, [])
      }
      linkedSubscriptionsByVariant.get(variantKey)!.push(linkedSub)
    })
  }

  return {
    data: {
      product,
      variants: variants.data || [],
      images: images.data || [],
      subscriptions: Array.from(subscriptionsByVariant.values()),
      subscriptionsByVariant: Object.fromEntries(subscriptionsByVariant),
      inventoryByVariant: Object.fromEntries(inventoryByVariant),
      linkedSubscriptions: linkedSubscriptionsData.data || [],
      linkedSubscriptionsByVariant: Object.fromEntries(linkedSubscriptionsByVariant),
    },
    error: null,
  }
}

export async function getAllActiveProducts(useAdminClient: boolean = false) {
  // Use admin client for public pages that need to bypass RLS
  // This is safe because we're only fetching active products for display
  const supabase = useAdminClient 
    ? createAdminSupabaseClient()
    : await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        id,
        color,
        price,
        image_url,
        subscription_products (
          id,
          subscription_price,
          prepaid_price,
          available_frequencies
        )
      ),
      product_images!product_id (
        id,
        image_url,
        is_primary,
        sort_order,
        variant_id
      )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllActiveProducts] Error fetching products:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      useAdminClient
    })
    return { data: [], error: error.message }
  }

  console.log('[getAllActiveProducts] Fetched products:', {
    count: data?.length || 0,
    productIds: data?.map((p: any) => p.id) || [],
    useAdminClient
  })

  return { data: data || [], error: null }
}

export async function createProduct(data: {
  title: string
  description?: string
  base_price: number
  compare_at_price?: number
  status: 'active' | 'draft' | 'archived'
  // Inventory fields
  inventory_tracked?: boolean
  quantity?: number
  shop_location?: string
  barcode?: string
  sell_when_out_of_stock?: boolean
  // Shipping fields
  physical_product?: boolean
  product_weight?: number
  weight_unit?: string
  country_of_origin?: string
  hs_code?: string
  package_type?: string
  variants: Array<{
    color: string
    price: number
    sku: string
    inventory_quantity: number
    image_url?: string
  }>
  images: Array<{
    image_url: string
    alt_text?: string
    variant_id?: string
    is_primary?: boolean
    sort_order: number
  }>
}) {
  // Verify admin using regular client for auth check
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

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Generate slug from title
  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  
  // Check if slug already exists (use admin client to bypass RLS)
  const adminSupabase = createAdminSupabaseClient()
  const { data: existing } = await adminSupabase
    .from('products')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    // Append timestamp if slug exists
    const uniqueSlug = `${slug}-${Date.now()}`
    return createProductWithSlug({ ...data, slug: uniqueSlug })
  }

  return createProductWithSlug({ ...data, slug })
}

async function createProductWithSlug(data: {
  title: string
  description?: string
  base_price: number
  compare_at_price?: number
  status: 'active' | 'draft' | 'archived'
  slug: string
  // Inventory fields
  inventory_tracked?: boolean
  quantity?: number
  shop_location?: string
  barcode?: string
  sell_when_out_of_stock?: boolean
  // Shipping fields
  physical_product?: boolean
  product_weight?: number
  weight_unit?: string
  country_of_origin?: string
  hs_code?: string
  package_type?: string
  variants: Array<{
    color: string
    price: number
    sku: string
    inventory_quantity: number
    image_url?: string
  }>
  images: Array<{
    image_url: string
    alt_text?: string
    variant_id?: string
    is_primary?: boolean
    sort_order: number
  }>
}) {
  // Use admin client to bypass RLS for product creation
  const supabase = createAdminSupabaseClient()

  // Create product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      title: data.title,
      slug: data.slug,
      description: data.description || null,
      base_price: data.base_price,
      compare_at_price: data.compare_at_price || null,
      status: data.status,
      // Inventory fields
      inventory_tracked: data.inventory_tracked !== undefined ? data.inventory_tracked : true,
      quantity: data.quantity || 0,
      shop_location: data.shop_location || '0',
      barcode: data.barcode || null,
      sell_when_out_of_stock: data.sell_when_out_of_stock || false,
      // Shipping fields
      physical_product: data.physical_product !== undefined ? data.physical_product : true,
      product_weight: data.product_weight || 0.0,
      weight_unit: data.weight_unit || 'kg',
      country_of_origin: data.country_of_origin || null,
      hs_code: data.hs_code || null,
      package_type: data.package_type || 'default',
    })
    .select()
    .single()

  if (productError || !product) {
    console.error('Error creating product:', productError)
    return { success: false, error: productError?.message || 'Failed to create product' }
  }

  // Validate SKU uniqueness before insertion
  const skus = data.variants.map(v => v.sku.trim())
  const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)
  if (duplicateSkus.length > 0) {
    // Rollback: delete product
    await supabase.from('products').delete().eq('id', product.id)
    return { success: false, error: `Duplicate SKUs found: ${[...new Set(duplicateSkus)].join(', ')}. Each variant must have a unique SKU.` }
  }

  // Check if any SKUs already exist in the database
  const existingSkus = await supabase
    .from('product_variants')
    .select('sku')
    .in('sku', skus)

  if (existingSkus.data && existingSkus.data.length > 0) {
    const existingSkuList = existingSkus.data.map(v => v.sku).join(', ')
    // Rollback: delete product
    await supabase.from('products').delete().eq('id', product.id)
    return { success: false, error: `SKUs already exist: ${existingSkuList}. Each variant must have a unique SKU.` }
  }

  // Create variants
  const variantInserts = data.variants.map((variant, index) => ({
    product_id: product.id,
    color: variant.color,
    price: variant.price,
    sku: variant.sku.trim(),
    inventory_quantity: variant.inventory_quantity,
    image_url: variant.image_url || null,
    ...(variant.color_image_url && { color_image_url: variant.color_image_url }),
    sort_order: index,
  }))

  const { data: createdVariants, error: variantsError } = await supabase
    .from('product_variants')
    .insert(variantInserts)
    .select()

  if (variantsError || !createdVariants) {
    // Rollback: delete product
    await supabase.from('products').delete().eq('id', product.id)
    console.error('Error creating variants:', variantsError)
    return { success: false, error: variantsError?.message || 'Failed to create variants' }
  }

  // Create a map of variant color to variant ID for image linking
  const variantMap = new Map<string, string>()
  createdVariants.forEach((v) => {
    variantMap.set(v.color.toLowerCase(), v.id)
  })

  // Create product images
  if (data.images.length > 0) {
    const imageInserts = data.images.map((img) => {
      let variantId: string | null = null
      
      // If variant_id is provided as color name, look it up
      if (img.variant_id && !img.variant_id.includes('-')) {
        // Assume it's a color name
        variantId = variantMap.get(img.variant_id.toLowerCase()) || null
      } else if (img.variant_id) {
        // It's already a UUID
        variantId = img.variant_id
      }

      return {
        product_id: product.id,
        variant_id: variantId,
        image_url: img.image_url,
        alt_text: img.alt_text || null,
        is_primary: img.is_primary || false,
        sort_order: img.sort_order,
      }
    })

    const { error: imagesError } = await supabase
      .from('product_images')
      .insert(imageInserts)

    if (imagesError) {
      console.error('Error creating images:', imagesError)
      // Don't rollback - images are optional
    }
  }

  revalidatePath('/admin/products')
  revalidatePath('/product')
  
  // Log the action
  await logProductAction(
    'created',
    `Product "${data.title}" created`,
    product.id,
    data.title,
    {
      base_price: data.base_price,
      status: data.status,
      variants_count: createdVariants.length,
    }
  )
  
  return { success: true, data: { ...product, slug: product.slug, variants: createdVariants } }
}

export async function deleteProduct(productId: string) {
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

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  // Use admin client to bypass RLS
  const supabase = createAdminSupabaseClient()

  // Check if product has active orders
  const { data: orders } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', productId)
    .limit(1)

  if (orders && orders.length > 0) {
    return { success: false, error: 'Cannot delete product with existing orders. Archive it instead.' }
  }

  // Delete product (cascade will handle variants, images, etc.)
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (error) {
    console.error('Error deleting product:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/products')
  revalidatePath('/product')
  
  // Get product name before deletion for logging
  const { data: product } = await supabase
    .from('products')
    .select('title')
    .eq('id', productId)
    .single()
  
  // Log the action (before deletion)
  await logProductAction(
    'deleted',
    `Product "${product?.title || productId}" deleted`,
    productId,
    product?.title || 'Unknown',
    {}
  )
  
  return { success: true }
}

export async function updateProduct(productId: string, data: {
  title: string
  description?: string
  base_price: number
  compare_at_price?: number
  status: 'active' | 'draft' | 'archived'
  template_id?: string | null
  category?: string
  // Note: image_url removed - images are stored in product_images table
  // Inventory fields
  inventory_tracked?: boolean
  quantity?: number
  shop_location?: string
  barcode?: string
  sell_when_out_of_stock?: boolean
  // Shipping fields
  physical_product?: boolean
  product_weight?: number
  weight_unit?: string
  country_of_origin?: string
  hs_code?: string
  package_type?: string
  variants: Array<{
    id?: string
    color: string
    price: number
    sku: string
    inventory_quantity: number
    image_url?: string
    color_image_url?: string
  }>
  images: Array<{
    image_url: string
    alt_text?: string
    variant_id?: string
    is_primary?: boolean
    sort_order: number
  }>
}) {
  try {
    // Verify admin
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify admin or partner
    const { data: profile } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin' && profile?.role !== 'partner') {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input data
    if (!productId || typeof productId !== 'string') {
      return { success: false, error: 'Invalid product ID' }
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      return { success: false, error: 'Product title is required' }
    }

    if (typeof data.base_price !== 'number' || isNaN(data.base_price) || data.base_price <= 0) {
      return { success: false, error: 'Valid base price is required' }
    }

    if (!data.variants || !Array.isArray(data.variants) || data.variants.length === 0) {
      return { success: false, error: 'At least one variant is required' }
    }

    // Validate variants
    for (const variant of data.variants) {
      if (!variant.color || typeof variant.color !== 'string' || variant.color.trim().length === 0) {
        return { success: false, error: 'All variants must have a color' }
      }
      if (!variant.sku || typeof variant.sku !== 'string' || variant.sku.trim().length === 0) {
        return { success: false, error: 'All variants must have a SKU' }
      }
      if (typeof variant.price !== 'number' || isNaN(variant.price) || variant.price <= 0) {
        return { success: false, error: 'All variants must have a valid price' }
      }
      if (typeof variant.inventory_quantity !== 'number' || isNaN(variant.inventory_quantity)) {
        return { success: false, error: 'All variants must have a valid inventory quantity' }
      }
    }

    // Use admin client to bypass RLS
    const supabase = createAdminSupabaseClient()

    // Update product - ensure all numeric values are valid
    // Build update data object, excluding fields that may not exist in the database
    // Note: image_url is not stored on products table - images are in product_images table
    const updateData: any = {
      title: data.title.trim(),
      description: data.description?.trim() || null,
      base_price: parseFloat(String(data.base_price)),
      compare_at_price: data.compare_at_price ? parseFloat(String(data.compare_at_price)) : null,
      status: data.status,
      template_id: data.template_id || null,
      category: data.category?.trim() || null,
      // Inventory fields
      inventory_tracked: data.inventory_tracked !== undefined ? Boolean(data.inventory_tracked) : true,
      quantity: data.quantity !== undefined ? parseInt(String(data.quantity), 10) : 0,
      shop_location: data.shop_location || '0',
      sell_when_out_of_stock: Boolean(data.sell_when_out_of_stock || false),
      // Shipping fields
      physical_product: data.physical_product !== undefined ? Boolean(data.physical_product) : true,
      product_weight: data.product_weight !== undefined ? parseFloat(String(data.product_weight)) : 0.0,
      weight_unit: data.weight_unit || 'kg',
      country_of_origin: data.country_of_origin?.trim() || null,
      hs_code: data.hs_code?.trim() || null,
      package_type: data.package_type || 'default',
    }

    // Conditionally add barcode only if provided (column may not exist in all databases)
    // If the column doesn't exist, this will be caught and handled gracefully
    if (data.barcode !== undefined && data.barcode !== null && data.barcode.trim() !== '') {
      updateData.barcode = data.barcode.trim()
    }

    // Validate numeric values
    if (isNaN(updateData.base_price) || updateData.base_price <= 0) {
      return { success: false, error: 'Invalid base price' }
    }
    if (updateData.compare_at_price !== null && (isNaN(updateData.compare_at_price) || updateData.compare_at_price <= 0)) {
      return { success: false, error: 'Invalid compare at price' }
    }
    if (isNaN(updateData.quantity)) {
      updateData.quantity = 0
    }
    if (isNaN(updateData.product_weight)) {
      updateData.product_weight = 0.0
    }

    // Try to update with all fields first
    let { data: product, error: productError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single()

    // If update fails due to missing column (like barcode), retry without optional fields
    if (productError && productError.code === 'PGRST204') {
      console.warn('Column not found in schema, retrying without optional fields:', productError.message)
      
      // Remove potentially missing columns and retry
      const safeUpdateData = { ...updateData }
      delete safeUpdateData.barcode
      
      const retryResult = await supabase
        .from('products')
        .update(safeUpdateData)
        .eq('id', productId)
        .select()
        .single()
      
      product = retryResult.data
      productError = retryResult.error
      
      if (!productError && product) {
        console.log('Product updated successfully without optional fields')
      }
    }

    if (productError || !product) {
      console.error('Error updating product:', productError)
      return { success: false, error: productError?.message || 'Failed to update product' }
    }

    // Validate SKU uniqueness (excluding current product's variants)
    const skus = data.variants.map(v => v.sku.trim())
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)
    if (duplicateSkus.length > 0) {
      return { success: false, error: `Duplicate SKUs found: ${[...new Set(duplicateSkus)].join(', ')}. Each variant must have a unique SKU.` }
    }

    // Get existing variants to check for SKU conflicts
    const { data: existingVariants } = await supabase
      .from('product_variants')
      .select('id, sku')
      .eq('product_id', productId)

    const existingVariantIds = new Set(existingVariants?.map(v => v.id) || [])
    const existingSkus = new Set(existingVariants?.map(v => v.sku) || [])

    // Check for SKU conflicts with other products
    const newSkus = data.variants
      .filter(v => !v.id || !existingVariantIds.has(v.id))
      .map(v => v.sku.trim())
    
    if (newSkus.length > 0) {
      const { data: conflictingSkus } = await supabase
        .from('product_variants')
        .select('sku')
        .in('sku', newSkus)
        .neq('product_id', productId)

      if (conflictingSkus && conflictingSkus.length > 0) {
        const conflictingSkuList = conflictingSkus.map(v => v.sku).join(', ')
        return { success: false, error: `SKUs already exist in other products: ${conflictingSkuList}. Each variant must have a unique SKU.` }
      }
    }

    // Update or create variants
    const variantMap = new Map<string, string>()
    
    for (const variant of data.variants) {
      // Ensure all variant values are properly formatted
      const variantColor = String(variant.color).trim()
      const variantPrice = parseFloat(String(variant.price))
      const variantSku = String(variant.sku).trim()
      const variantInventory = parseInt(String(variant.inventory_quantity || 0), 10)

      if (isNaN(variantPrice) || variantPrice <= 0) {
        return { success: false, error: `Invalid price for variant: ${variantColor}` }
      }
      if (isNaN(variantInventory)) {
        return { success: false, error: `Invalid inventory quantity for variant: ${variantColor}` }
      }

      if (variant.id && existingVariantIds.has(variant.id)) {
        // Update existing variant
        const { data: updatedVariant, error: variantError } = await supabase
          .from('product_variants')
          .update({
            color: variantColor,
            price: variantPrice,
            sku: variantSku,
            inventory_quantity: variantInventory,
            image_url: variant.image_url?.trim() || null,
            color_image_url: variant.color_image_url?.trim() || null,
          })
          .eq('id', variant.id)
          .select()
          .single()

        if (variantError) {
          console.error('Error updating variant:', variantError)
          return { success: false, error: variantError.message || 'Failed to update variant' }
        }

        if (updatedVariant) {
          variantMap.set(updatedVariant.color.toLowerCase(), updatedVariant.id)
        }
      } else {
        // Create new variant
        const { data: createdVariant, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: productId,
            color: variantColor,
            price: variantPrice,
            sku: variantSku,
            inventory_quantity: variantInventory,
            image_url: variant.image_url?.trim() || null,
            color_image_url: variant.color_image_url?.trim() || null,
            sort_order: data.variants.indexOf(variant),
          })
          .select()
          .single()

        if (variantError || !createdVariant) {
          console.error('Error creating variant:', variantError)
          return { success: false, error: variantError?.message || 'Failed to create variant' }
        }

        variantMap.set(createdVariant.color.toLowerCase(), createdVariant.id)
      }
    }

    // Delete variants that are no longer in the data
    const variantIdsToKeep = new Set(data.variants.filter(v => v.id).map(v => v.id!))
    const variantsToDelete = existingVariants?.filter(v => !variantIdsToKeep.has(v.id)) || []
    
    if (variantsToDelete.length > 0) {
      const variantIdsToDelete = variantsToDelete.map(v => v.id)
      const { error: deleteError } = await supabase
        .from('product_variants')
        .delete()
        .in('id', variantIdsToDelete)
      
      if (deleteError) {
        console.error('Error deleting variants:', deleteError)
        // Don't fail the update - continue with remaining operations
      }
    }

    // Delete all existing images and recreate them
    const { error: deleteImagesError } = await supabase
      .from('product_images')
      .delete()
      .eq('product_id', productId)

    if (deleteImagesError) {
      console.error('Error deleting existing images:', deleteImagesError)
      // Don't fail the update - continue with image creation
    }

    // Create product images
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const imageInserts = data.images
        .filter(img => img.image_url && img.image_url.trim().length > 0)
        .map((img) => {
          let variantId: string | null = null
          
          // If variant_id is provided as color name, look it up
          if (img.variant_id && !img.variant_id.includes('-')) {
            variantId = variantMap.get(img.variant_id.toLowerCase()) || null
          } else if (img.variant_id) {
            variantId = img.variant_id
          }

          return {
            product_id: productId,
            variant_id: variantId,
            image_url: String(img.image_url).trim(),
            alt_text: img.alt_text?.trim() || null,
            is_primary: Boolean(img.is_primary || false),
            sort_order: parseInt(String(img.sort_order || 0), 10),
          }
        })

      if (imageInserts.length > 0) {
        const { error: imagesError } = await supabase
          .from('product_images')
          .insert(imageInserts)

        if (imagesError) {
          console.error('Error creating images:', imagesError)
          // Don't fail the update - images are optional
        }
      }
    }

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${productId}`)
    revalidatePath('/product')
    revalidatePath(`/product/${product.slug}`)

    // Log the action
    await logProductAction(
      'updated',
      `Product "${data.title}" updated`,
      productId,
      data.title,
      {
        base_price: data.base_price,
        status: data.status,
        variants_count: data.variants.length,
      }
    )

    return { success: true, data: { ...product, slug: product.slug } }
  } catch (error: any) {
    console.error('Error in updateProduct:', error)
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      productId,
      dataKeys: Object.keys(data || {}),
    })
    return { 
      success: false, 
      error: error?.message || 'An unexpected error occurred while updating the product. Please try again.' 
    }
  }
}

