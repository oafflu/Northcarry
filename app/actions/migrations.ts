'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

/**
 * Migrate addresses from orders to customer accounts
 * This backfills addresses that were used in orders but not saved to customer accounts
 */
export async function migrateAddressesFromOrders() {
  try {
    // Verify admin authentication
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: 'Not authenticated',
      }
    }

    // Verify admin role
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: 'Unauthorized - Admin access required',
      }
    }

    const supabase = createAdminSupabaseClient()
    
    // Get all orders with user_id and addresses
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, shipping_address, billing_address')
      .not('user_id', 'is', null)
      .not('shipping_address', 'is', null)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: ordersError.message || 'Failed to fetch orders',
      }
    }

    if (!orders || orders.length === 0) {
      return {
        success: true,
        migrated: 0,
        skipped: 0,
        errors: 0,
        message: 'No orders with addresses found',
      }
    }

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Get valid country codes from countries table
    const { data: validCountries } = await supabase
      .from('countries')
      .select('code')
      .eq('is_active', true)
      .eq('shipping_enabled', true)
    
    const validCountryCodes = new Set(validCountries?.map(c => c.code) || ['US', 'CA', 'GB', 'AU'])

    // Helper function to validate and normalize country code
    const normalizeCountryCode = (countryCode: string | null | undefined): string => {
      if (!countryCode) return 'US'
      const code = countryCode.toUpperCase().trim()
      // Check if it's a valid country code
      if (validCountryCodes.has(code)) {
        return code
      }
      // Try to find a match (case-insensitive)
      const found = Array.from(validCountryCodes).find(c => c.toUpperCase() === code)
      if (found) return found
      // Default to US if not found
      return 'US'
    }

    // Helper function to check if address already exists
    const addressExists = async (userId: string, addressData: any, type: 'shipping' | 'billing'): Promise<boolean> => {
      const { data: existing } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('address_line1', addressData.address_line1 || '')
        .eq('city', addressData.city || '')
        .eq('postal_code', addressData.postal_code || '')
        .maybeSingle()
      
      return !!existing
    }

    for (const order of orders) {
      try {
        if (!order.user_id) continue

        // Process shipping address
        if (order.shipping_address && typeof order.shipping_address === 'object') {
          const shippingAddr = order.shipping_address as any
          
          if (shippingAddr.address_line1 && shippingAddr.city && shippingAddr.postal_code) {
            const exists = await addressExists(order.user_id, shippingAddr, 'shipping')
            
            if (!exists) {
              // Check if user has any default shipping address
              const { data: existingAddresses } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', order.user_id)
                .eq('type', 'shipping')
                .eq('is_default', true)
              
              const hasDefault = existingAddresses && existingAddresses.length > 0
              
              const { error: insertError } = await supabase
                .from('addresses')
                .insert({
                  user_id: order.user_id,
                  type: 'shipping',
                  is_default: !hasDefault,
                  address_line1: shippingAddr.address_line1 || '',
                  address_line2: shippingAddr.address_line2 || null,
                  city: shippingAddr.city || '',
                  state: shippingAddr.state || '',
                  postal_code: shippingAddr.postal_code || '',
                  country: normalizeCountryCode(shippingAddr.country),
                  phone: shippingAddr.phone || null,
                })
              
              if (insertError) {
                console.error(`Error migrating shipping address for order ${order.id}:`, insertError)
                errors.push(`Order ${order.id}: ${insertError.message}`)
                errorCount++
              } else {
                migratedCount++
              }
            } else {
              skippedCount++
            }
          }
        }

        // Process billing address (only if different from shipping)
        if (order.billing_address && typeof order.billing_address === 'object') {
          const billingAddr = order.billing_address as any
          const shippingAddr = order.shipping_address as any
          
          // Only save billing if it's different from shipping
          const isDifferent = !shippingAddr || 
            billingAddr.address_line1 !== shippingAddr.address_line1 ||
            billingAddr.city !== shippingAddr.city ||
            billingAddr.postal_code !== shippingAddr.postal_code
          
          if (isDifferent && billingAddr.address_line1 && billingAddr.city && billingAddr.postal_code) {
            const exists = await addressExists(order.user_id, billingAddr, 'billing')
            
            if (!exists) {
              // Check if user has any default billing address
              const { data: existingAddresses } = await supabase
                .from('addresses')
                .select('id')
                .eq('user_id', order.user_id)
                .eq('type', 'billing')
                .eq('is_default', true)
              
              const hasDefault = existingAddresses && existingAddresses.length > 0
              
              const { error: insertError } = await supabase
                .from('addresses')
                .insert({
                  user_id: order.user_id,
                  type: 'billing',
                  is_default: !hasDefault,
                  address_line1: billingAddr.address_line1 || '',
                  address_line2: billingAddr.address_line2 || null,
                  city: billingAddr.city || '',
                  state: billingAddr.state || '',
                  postal_code: billingAddr.postal_code || '',
                  country: normalizeCountryCode(billingAddr.country),
                  phone: billingAddr.phone || null,
                })
              
              if (insertError) {
                console.error(`Error migrating billing address for order ${order.id}:`, insertError)
                errors.push(`Order ${order.id}: ${insertError.message}`)
                errorCount++
              } else {
                migratedCount++
              }
            } else {
              skippedCount++
            }
          }
        }
      } catch (error: any) {
        console.error(`Error processing order ${order.id}:`, error)
        errors.push(`Order ${order.id}: ${error.message || 'Unexpected error'}`)
        errorCount++
      }
    }

    return {
      success: true,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorMessages: errors.slice(0, 10), // Limit error messages
      message: `Migrated ${migratedCount} addresses, skipped ${skippedCount} duplicates, ${errorCount} errors`,
    }
  } catch (error: any) {
    console.error('Error in migrateAddressesFromOrders:', error)
    return {
      success: false,
      migrated: 0,
      skipped: 0,
      errors: 0,
      error: error.message || 'Failed to migrate addresses',
    }
  }
}

/**
 * Migrate payment methods from orders to customer accounts
 * This backfills payment methods that were used in orders but not saved to customer accounts
 */
export async function migratePaymentMethodsFromOrders() {
  try {
    // Verify admin authentication
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()

    if (!user) {
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: 'Not authenticated',
      }
    }

    // Verify admin role
    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: 'Unauthorized - Admin access required',
      }
    }

    const supabase = createAdminSupabaseClient()
    
    // Get Stripe secret key
    const { data: stripeSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeSettings = stripeSetting?.setting_value as any
    const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: 'Stripe is not configured',
      }
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    })
    
    // Get all orders with user_id and stripe_payment_intent_id
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, user_id, stripe_payment_intent_id')
      .not('user_id', 'is', null)
      .not('stripe_payment_intent_id', 'is', null)
      .eq('payment_status', 'paid')

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return {
        success: false,
        migrated: 0,
        skipped: 0,
        errors: 0,
        error: ordersError.message || 'Failed to fetch orders',
      }
    }

    if (!orders || orders.length === 0) {
      return {
        success: true,
        migrated: 0,
        skipped: 0,
        errors: 0,
        message: 'No orders with payment intents found',
      }
    }

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const order of orders) {
      try {
        if (!order.user_id || !order.stripe_payment_intent_id) continue

        // Check if payment method already exists for this user
        const { data: existingMethods } = await supabase
          .from('saved_payment_methods')
          .select('stripe_payment_method_id')
          .eq('user_id', order.user_id)

        // Retrieve payment intent from Stripe
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
            expand: ['payment_method']
          })

          if (paymentIntent.status === 'succeeded' && paymentIntent.payment_method) {
            const paymentMethod = typeof paymentIntent.payment_method === 'string' 
              ? await stripe.paymentMethods.retrieve(paymentIntent.payment_method)
              : paymentIntent.payment_method

            if (paymentMethod && paymentMethod.type === 'card' && paymentMethod.card) {
              // Check if this payment method is already saved
              const isAlreadySaved = existingMethods?.some(
                (m: any) => m.stripe_payment_method_id === paymentMethod.id
              )

              if (!isAlreadySaved) {
                // Get Stripe customer ID
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('stripe_customer_id')
                  .eq('id', order.user_id)
                  .single()

                // Attach payment method to customer if not already attached
                if (profile?.stripe_customer_id && paymentMethod.customer !== profile.stripe_customer_id) {
                  try {
                    await stripe.paymentMethods.attach(paymentMethod.id, {
                      customer: profile.stripe_customer_id,
                    })
                  } catch (attachError: any) {
                    // Payment method might already be attached, continue
                    if (!attachError.message?.includes('already been attached')) {
                      throw attachError
                    }
                  }
                }

                // Save payment method to database
                const isFirstMethod = !existingMethods || existingMethods.length === 0

                const { error: insertError } = await supabase
                  .from('saved_payment_methods')
                  .insert({
                    user_id: order.user_id,
                    stripe_payment_method_id: paymentMethod.id,
                    type: paymentMethod.type,
                    last4: paymentMethod.card.last4,
                    brand: paymentMethod.card.brand,
                    exp_month: paymentMethod.card.exp_month,
                    exp_year: paymentMethod.card.exp_year,
                    is_default: isFirstMethod,
                  })

                if (insertError) {
                  console.error(`Error migrating payment method for order ${order.id}:`, insertError)
                  errors.push(`Order ${order.id}: ${insertError.message}`)
                  errorCount++
                } else {
                  migratedCount++
                }
              } else {
                skippedCount++
              }
            }
          }
        } catch (stripeError: any) {
          console.error(`Error retrieving payment intent ${order.stripe_payment_intent_id}:`, stripeError)
          errors.push(`Order ${order.id}: ${stripeError.message || 'Stripe error'}`)
          errorCount++
        }
      } catch (error: any) {
        console.error(`Error processing order ${order.id}:`, error)
        errors.push(`Order ${order.id}: ${error.message || 'Unexpected error'}`)
        errorCount++
      }
    }

    return {
      success: true,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorMessages: errors.slice(0, 10), // Limit error messages
      message: `Migrated ${migratedCount} payment methods, skipped ${skippedCount} duplicates, ${errorCount} errors`,
    }
  } catch (error: any) {
    console.error('Error in migratePaymentMethodsFromOrders:', error)
    return {
      success: false,
      migrated: 0,
      skipped: 0,
      errors: 0,
      error: error.message || 'Failed to migrate payment methods',
    }
  }
}

