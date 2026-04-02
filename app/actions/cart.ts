'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

export async function addToCart(
  variantId: string, 
  quantity: number,
  subscriptionMetadata?: {
    purchaseType?: 'one-time' | 'subscription' | 'prepaid'
    subscriptionProductId?: string
    frequencyMonths?: number
    prepaidCycles?: number
    shippingDays?: number
  }
) {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id
  
  // Get or create session ID for anonymous users
  const cookieStore = await cookies()
  let sessionId = cookieStore.get('session_id')?.value
  if (!sessionId && !userId) {
    sessionId = crypto.randomUUID()
    cookieStore.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }

  // Determine purchase type for unique constraint
  const purchaseType = subscriptionMetadata?.purchaseType || 'one-time'
  
  // Validate variant exists and has inventory before adding to cart
  const { data: variant, error: variantError } = await supabase
    .from('product_variants')
    .select('id, inventory_quantity, product_id, products(status)')
    .eq('id', variantId)
    .single()

  if (variantError || !variant) {
    return { success: false, error: 'Product variant not found' }
  }

  // Check if product is active
  const product = variant.products as any
  if (product && product.status !== 'active') {
    return { success: false, error: 'This product is no longer available' }
  }

  // Check inventory availability (check supplier inventory first, then variant inventory)
  const { data: inventoryLinks } = await supabase
    .from('product_supplier_links')
    .select(`
      variant_id,
      is_primary_supplier,
      supplier_inventory (
        quantity_available,
        status
      )
    `)
    .eq('variant_id', variantId)
    .eq('is_primary_supplier', true)
    .limit(1)

  let hasInventory = false
  if (inventoryLinks && inventoryLinks.length > 0) {
    const inventory = inventoryLinks[0].supplier_inventory as any
    if (inventory && inventory.status === 'active' && (inventory.quantity_available || 0) >= quantity) {
      hasInventory = true
    }
  } else {
    // Fallback to variant inventory_quantity
    const variantQty = variant.inventory_quantity || 0
    if (variantQty >= quantity) {
      hasInventory = true
    }
  }

  if (!hasInventory) {
    return { success: false, error: 'Insufficient inventory. This item is out of stock.' }
  }
  
  // Build cart item data
  const cartItemData: any = {
    user_id: userId || null,
    session_id: sessionId || null,
    variant_id: variantId,
    quantity,
    purchase_type: purchaseType,
    updated_at: new Date().toISOString()
  }

  // Add subscription metadata if provided
  if (subscriptionMetadata) {
    if (subscriptionMetadata.subscriptionProductId) {
      cartItemData.subscription_product_id = subscriptionMetadata.subscriptionProductId
    }
    if (subscriptionMetadata.frequencyMonths) {
      cartItemData.frequency_months = subscriptionMetadata.frequencyMonths
    }
    if (subscriptionMetadata.prepaidCycles) {
      cartItemData.prepaid_cycles = subscriptionMetadata.prepaidCycles
    }
    if (subscriptionMetadata.shippingDays) {
      cartItemData.shipping_days = subscriptionMetadata.shippingDays
    }
  }

  // Check if cart item already exists with same variant and purchase type
  // Handle NULL purchase_type by checking both the value and NULL (since constraint uses COALESCE)
  let existingItemQuery = supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('variant_id', variantId)
  
  // Handle purchase_type: check for exact match OR NULL (which defaults to 'one-time' in constraint)
  if (purchaseType === 'one-time') {
    // For 'one-time', match either 'one-time' or NULL
    existingItemQuery = existingItemQuery.or(`purchase_type.eq.one-time,purchase_type.is.null`)
  } else {
    existingItemQuery = existingItemQuery.eq('purchase_type', purchaseType)
    if (subscriptionMetadata?.subscriptionProductId) {
      existingItemQuery = existingItemQuery.eq('subscription_product_id', subscriptionMetadata.subscriptionProductId)
    }
    if (subscriptionMetadata?.frequencyMonths) {
      existingItemQuery = existingItemQuery.eq('frequency_months', subscriptionMetadata.frequencyMonths)
    }
    if (purchaseType === 'prepaid' && subscriptionMetadata?.prepaidCycles) {
      existingItemQuery = existingItemQuery.eq('prepaid_cycles', subscriptionMetadata.prepaidCycles)
    }
  }
  
  if (userId) {
    existingItemQuery = existingItemQuery.eq('user_id', userId)
  } else {
    existingItemQuery = existingItemQuery.eq('session_id', sessionId)
  }
  
  const { data: existingItem, error: checkError } = await existingItemQuery.maybeSingle()
  
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
    console.error('Error checking existing cart item:', checkError)
    return { success: false, error: checkError.message }
  }
  
  let data, error
  
  if (existingItem) {
    // Update existing item - add to existing quantity
    const newQuantity = existingItem.quantity + quantity
    const updateData: any = {
      quantity: newQuantity,
      purchase_type: purchaseType, // Ensure purchase_type is set
      updated_at: new Date().toISOString()
    }
    
    // Update subscription metadata if provided
    if (subscriptionMetadata) {
      if (subscriptionMetadata.subscriptionProductId) {
        updateData.subscription_product_id = subscriptionMetadata.subscriptionProductId
      }
      if (subscriptionMetadata.frequencyMonths) {
        updateData.frequency_months = subscriptionMetadata.frequencyMonths
      }
      if (subscriptionMetadata.prepaidCycles) {
        updateData.prepaid_cycles = subscriptionMetadata.prepaidCycles
      }
      if (subscriptionMetadata.shippingDays) {
        updateData.shipping_days = subscriptionMetadata.shippingDays
      }
    }
    
    const result = await supabase
      .from('cart_items')
      .update(updateData)
      .eq('id', existingItem.id)
      .select()
    
    data = result.data
    error = result.error
  } else {
    // Insert new item - handle duplicate key errors gracefully (race condition)
    const result = await supabase
      .from('cart_items')
      .insert(cartItemData)
      .select()
    
    data = result.data
    error = result.error
    
    // If we get a duplicate key error, it means another request just inserted it
    // Fetch the existing item and update it instead
    if (error && error.code === '23505') { // PostgreSQL unique violation
      console.log('Duplicate key detected, fetching existing item and updating...')
      
      // Re-fetch the existing item
      let retryQuery = supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('variant_id', variantId)
      
      if (purchaseType === 'one-time') {
        retryQuery = retryQuery.or(`purchase_type.eq.one-time,purchase_type.is.null`)
      } else {
        retryQuery = retryQuery.eq('purchase_type', purchaseType)
        if (subscriptionMetadata?.subscriptionProductId) {
          retryQuery = retryQuery.eq('subscription_product_id', subscriptionMetadata.subscriptionProductId)
        }
        if (subscriptionMetadata?.frequencyMonths) {
          retryQuery = retryQuery.eq('frequency_months', subscriptionMetadata.frequencyMonths)
        }
        if (purchaseType === 'prepaid' && subscriptionMetadata?.prepaidCycles) {
          retryQuery = retryQuery.eq('prepaid_cycles', subscriptionMetadata.prepaidCycles)
        }
      }
      
      if (userId) {
        retryQuery = retryQuery.eq('user_id', userId)
      } else {
        retryQuery = retryQuery.eq('session_id', sessionId)
      }
      
      const { data: retryItem, error: retryError } = await retryQuery.maybeSingle()
      
      if (retryItem && !retryError) {
        // Update the existing item
        const newQuantity = retryItem.quantity + quantity
        const updateData: any = {
          quantity: newQuantity,
          purchase_type: purchaseType,
          updated_at: new Date().toISOString()
        }
        
        if (subscriptionMetadata) {
          if (subscriptionMetadata.subscriptionProductId) {
            updateData.subscription_product_id = subscriptionMetadata.subscriptionProductId
          }
          if (subscriptionMetadata.frequencyMonths) {
            updateData.frequency_months = subscriptionMetadata.frequencyMonths
          }
          if (subscriptionMetadata.prepaidCycles) {
            updateData.prepaid_cycles = subscriptionMetadata.prepaidCycles
          }
          if (subscriptionMetadata.shippingDays) {
            updateData.shipping_days = subscriptionMetadata.shippingDays
          }
        }
        
        const updateResult = await supabase
          .from('cart_items')
          .update(updateData)
          .eq('id', retryItem.id)
          .select()
        
        data = updateResult.data
        error = updateResult.error
      } else {
        // Couldn't fetch the item, return the original error
        console.error('Error fetching existing item after duplicate key:', retryError)
      }
    }
  }
  
  if (error) {
    console.error('Error adding to cart:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/cart')
  return { success: true, data }
}

export async function removeFromCart(cartItemId: string) {
  const supabase = await createServerSupabaseClient()
  
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId)
  
  if (error) {
    console.error('Error removing from cart:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/cart')
  return { success: true }
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const supabase = await createServerSupabaseClient()
  
  if (quantity < 1) {
    return removeFromCart(cartItemId)
  }
  
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', cartItemId)
  
  if (error) {
    console.error('Error updating cart:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/cart')
  return { success: true }
}

export async function getCart() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id
  
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!userId && !sessionId) {
    return { data: [], error: null }
  }

  const query = supabase
    .from('cart_items')
    .select(`
      id,
      quantity,
      purchase_type,
      subscription_product_id,
      frequency_months,
      prepaid_cycles,
      shipping_days,
      product_variants (
        id,
        color,
        price,
        sku,
        image_url,
        inventory_quantity,
        products (
          id,
          title,
          base_price,
          slug,
          status
        )
      ),
      subscription_products (
        id,
        subscription_price,
        prepaid_price,
        one_time_price,
        shipping_days
      )
    `)
    .order('created_at', { ascending: false })

  if (userId) {
    query.eq('user_id', userId)
  } else {
    query.eq('session_id', sessionId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching cart:', error)
    return { data: [], error: error.message }
  }

  // Filter out invalid cart items (variants that no longer exist, products that are inactive, or out of stock)
  const validItems: any[] = []
  const itemsToRemove: string[] = []

  // Batch fetch all inventory links for all variants in cart
  const variantIds = (data || []).map((item: any) => item.product_variants?.id).filter(Boolean)
  const { data: allInventoryLinks } = variantIds.length > 0 ? await supabase
    .from('product_supplier_links')
    .select(`
      variant_id,
      is_primary_supplier,
      supplier_inventory (
        quantity_available,
        status
      )
    `)
    .in('variant_id', variantIds)
    .eq('is_primary_supplier', true) : { data: [] }

  // Create a map of variant_id -> inventory for quick lookup
  const inventoryMap = new Map()
  if (allInventoryLinks) {
    allInventoryLinks.forEach((link: any) => {
      if (link.variant_id && link.supplier_inventory) {
        const inventory = link.supplier_inventory as any
        inventoryMap.set(link.variant_id, {
          quantity_available: inventory.quantity_available || 0,
          status: inventory.status || 'active',
        })
      }
    })
  }

  for (const item of (data || [])) {
    const variant = item.product_variants
    const product = variant?.products

    // Check if variant or product is missing
    if (!variant || !product) {
      itemsToRemove.push(item.id)
      continue
    }

    // Check if product is active
    if (product.status !== 'active') {
      itemsToRemove.push(item.id)
      continue
    }

    // Check inventory availability
    const inventory = inventoryMap.get(variant.id)
    let hasInventory = false

    if (inventory) {
      // Use supplier inventory
      if (inventory.status === 'active' && inventory.quantity_available >= item.quantity) {
        hasInventory = true
      }
    } else {
      // Fallback to variant inventory_quantity
      const variantQty = variant.inventory_quantity || 0
      if (variantQty >= item.quantity) {
        hasInventory = true
      }
    }

    if (!hasInventory) {
      itemsToRemove.push(item.id)
      continue
    }

    validItems.push(item)
  }

  // Remove invalid items from cart
  if (itemsToRemove.length > 0) {
    await supabase
      .from('cart_items')
      .delete()
      .in('id', itemsToRemove)
  }

  return { data: validItems, error: null }
}

export async function clearCart() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id
  
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!userId && !sessionId) {
    return { success: false, error: 'No cart found' }
  }

  const query = supabase
    .from('cart_items')
    .delete()

  if (userId) {
    query.eq('user_id', userId)
  } else {
    query.eq('session_id', sessionId)
  }

  const { error } = await query

  if (error) {
    console.error('Error clearing cart:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/cart')
  return { success: true }
}

