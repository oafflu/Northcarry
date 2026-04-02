'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Stripe from 'stripe'
import { randomBytes } from 'crypto'
import { logOrderAction } from '@/lib/system-logger'
import { normalizePromoCode } from '@/lib/promo-utils'
import { taxAmountForCheckout } from '@/lib/tax'
import { fetchTaxExemptionEntries } from '@/lib/tax-server'

interface CheckoutFormData {
  userId?: string
  email: string
  firstName: string
  lastName: string
  phone: string // Required for shipping
  shippingAddress: {
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  billingAddress: {
    address_line1: string
    address_line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  shippingMethod: string // Shipping method ID
  discountCode?: string
  paymentMethod?: string
  paymentIntentId?: string // If payment is already confirmed
  subscriptionId?: string // If subscription is already created
  linkedSubscriptionId?: string // Stripe subscription for linked (future-billed) items
  isSubscription?: boolean // Whether this is a subscription checkout
  chargedAmount?: number // Actual charged amount from payment intent
}

/**
 * Calculate order totals and create payment intent
 * Returns client secret for Stripe Elements
 */
export async function createPaymentIntent(formData: Omit<CheckoutFormData, 'paymentIntentId'>) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get user session for authenticated users (allow guest checkout)
    const serverSupabase = await createServerSupabaseClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    const userId = user?.id || null

    // Get cart items
    const cookieStore = await (await import('next/headers')).cookies()
    const sessionId = cookieStore.get('session_id')?.value

    if (!userId && !sessionId) {
      return { success: false, error: 'Cart is empty' }
    }

  const cartQuery = supabase
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
        products (
          id,
          title,
          base_price,
          compare_at_price
        )
      )
    `)
  
  if (userId) {
    cartQuery.eq('user_id', userId)
  } else {
    cartQuery.eq('session_id', sessionId)
  }

  // Also fetch subscription products to get pricing
  const subscriptionProductsQuery = supabase
    .from('subscription_products')
    .select('*')
    .eq('status', 'active')
    .eq('is_subscription_enabled', true)

  const [cartResult, subscriptionProductsResult, linkedSubsResult] = await Promise.all([
    cartQuery,
    subscriptionProductsQuery,
    supabase.from('linked_subscriptions').select('subscription_product_id').eq('status', 'active'),
  ])

  const { data: cartItems, error: cartError } = cartResult
  const { data: subscriptionProducts } = subscriptionProductsResult
  const linkedSubs = linkedSubsResult.data || []
  // Subscription products that are "charged in future" (part of a linked subscription bundle)
  const linkedSubscriptionProductIds = new Set(
    linkedSubs.map((ls: any) => ls.subscription_product_id).filter(Boolean)
  )

  if (cartError || !cartItems || cartItems.length === 0) {
    return { success: false, error: 'Cart is empty' }
  }

  // Check if there are any ongoing subscription items (need Stripe Subscription, not Payment Intent)
  // Note: Prepaid subscriptions use Payment Intent (one-time charge for all cycles), not Stripe Subscription
  const hasOngoingSubscriptions = cartItems.some(
    (item: any) => item.purchase_type === 'subscription' && item.subscription_product_id
  )
  
  // Check if there are any prepaid subscription items (will use Payment Intent with upfront charge)
  const hasPrepaidSubscriptions = cartItems.some(
    (item: any) => item.purchase_type === 'prepaid' && item.subscription_product_id
  )

  // Calculate subtotal. Linked subscription products (e.g. replacement heads) are charged in future, not now.
  let subtotal = 0
  for (const item of cartItems) {
    // product_variants is a foreign key relationship, so it's a single object (not an array)
    const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
    if (!variant) continue

    // Check if this is a subscription item
    if (item.purchase_type === 'subscription' || item.purchase_type === 'prepaid') {
      // Linked subscription product: charged in future (not at checkout)
      if (item.subscription_product_id && linkedSubscriptionProductIds.has(item.subscription_product_id)) {
        continue
      }
      // Find subscription product for this variant
      const subProduct = subscriptionProducts?.find(
        (sp: any) => sp.id === item.subscription_product_id
      )

      if (subProduct) {
        // Use subscription price based on purchase type
        const price = item.purchase_type === 'prepaid'
          ? (subProduct.prepaid_price || subProduct.subscription_price || 0)
          : (subProduct.subscription_price || 0)
        
        if (item.purchase_type === 'prepaid') {
          const prepaidCycles = item.prepaid_cycles || 1
          subtotal += parseFloat(price.toString()) * item.quantity * prepaidCycles
        } else {
          // Ongoing subscription: charge first cycle only.
          subtotal += parseFloat(price.toString()) * item.quantity
        }
      } else {
        // Fallback to variant price if subscription product not found
        subtotal += parseFloat((variant as any).price || '0') * item.quantity
      }
    } else {
      // Regular one-time purchase
      subtotal += parseFloat((variant as any).price || '0') * item.quantity
    }
  }

  // Apply discount if provided
  let discountAmount = 0
  if (formData.discountCode && formData.discountCode.trim()) {
    try {
      const discountCodeNormalized = normalizePromoCode(formData.discountCode)
      console.log('Processing discount code in createPaymentIntent:', discountCodeNormalized, 'subtotal:', subtotal)
      
      const { data: promotion, error: promoError } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', discountCodeNormalized)
        .eq('status', 'active')
        .single()

      if (promoError) {
        console.error('Error fetching promotion:', promoError)
      } else if (promotion) {
        console.log('Promotion found:', {
          code: promotion.code,
          type: promotion.discount_type,
          value: promotion.discount_value,
        })
        
        const now = new Date()
        const startsAt = promotion.starts_at ? new Date(promotion.starts_at) : null
        const endsAt = promotion.ends_at ? new Date(promotion.ends_at) : null

        // Check date validity
        if (startsAt && now < startsAt) {
          console.log('Discount code not yet active')
        } else if (endsAt && now > endsAt) {
          console.log('Discount code has expired')
        } else {
          // Check minimum purchase amount
          if (promotion.min_purchase_amount && subtotal < parseFloat(promotion.min_purchase_amount.toString())) {
            console.log('Minimum purchase amount not met')
          } else {
            // Check usage limit
            if (promotion.usage_limit && (promotion.usage_count || 0) >= promotion.usage_limit) {
              console.log('Discount code usage limit reached')
            } else {
              // Calculate discount amount
              if (promotion.discount_type === 'percentage') {
                discountAmount = subtotal * (parseFloat(promotion.discount_value.toString()) / 100)
                console.log('Percentage discount calculated:', discountAmount)
              } else if (promotion.discount_type === 'fixed') {
                discountAmount = parseFloat(promotion.discount_value.toString())
                if (discountAmount > subtotal) {
                  discountAmount = subtotal
                }
                console.log('Fixed discount calculated:', discountAmount)
              } else if (promotion.discount_type === 'free_shipping') {
                // Free shipping will be handled separately
                discountAmount = 0
                console.log('Free shipping discount detected')
              }
            }
          }
        }
      } else {
        console.log('Promotion not found for code:', discountCodeNormalized)
      }
    } catch (error) {
      console.error('Error processing discount code:', error)
    }
  }

  // Get shipping cost
  const { data: shippingMethod } = await supabase
    .from('shipping_methods')
    .select('price')
    .eq('id', formData.shippingMethod)
    .single()

  const shippingCost = parseFloat(shippingMethod?.price || '0')
  
  // Apply free shipping discount if applicable
  let finalShippingCost = shippingCost
  if (formData.discountCode && formData.discountCode.trim()) {
    try {
      const discountCodeNormalized = normalizePromoCode(formData.discountCode)
      const { data: promotion } = await supabase
        .from('promotions')
        .select('discount_type')
        .eq('code', discountCodeNormalized)
        .eq('status', 'active')
        .single()
      
      if (promotion && promotion.discount_type === 'free_shipping') {
        finalShippingCost = 0
        console.log('Free shipping applied, shipping cost set to 0')
      }
    } catch (error) {
      console.error('Error checking free shipping:', error)
    }
  }
  
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
  const taxExemptions = await fetchTaxExemptionEntries()
  const taxAmount = taxAmountForCheckout(
    subtotalAfterDiscount,
    formData.shippingAddress?.country,
    formData.shippingAddress?.state,
    taxExemptions
  )
  const total = subtotalAfterDiscount + finalShippingCost + taxAmount
  
  // Use actual calculated total (don't force minimum)
  // Stripe minimum is $0.50, but we'll handle that in the validation below
  const finalTotal = Math.max(0, total) // Ensure non-negative, but don't force $0.50 minimum
  
  console.log('Final calculation in createPaymentIntent:', {
    subtotal,
    discountAmount,
    subtotalAfterDiscount,
    shippingCost,
    finalShippingCost,
    taxAmount,
    total,
    finalTotal,
    amountInCents: Math.round(finalTotal * 100),
  })

  // Get Stripe configuration
  const { data: stripeSetting } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'stripe')
    .single()

  const stripeSettings = stripeSetting?.setting_value as any
  const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY
  const stripeEnabled = stripeSettings?.enabled !== false

  if (!stripeEnabled || !stripeSecretKey) {
    return { success: false, error: 'Stripe is not configured' }
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    })

    // Create or get Stripe customer
    // For logged-in users, check profile first for stripe_customer_id
    let customerId: string | null = null
    let linkedSubscriptionId: string | null = null
    
    if (userId) {
      // Check if user already has a Stripe customer ID in their profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id, email')
        .eq('id', userId)
        .single()

      if (profile?.stripe_customer_id) {
        // Verify the customer still exists in Stripe
        try {
          const existingCustomer = await stripe.customers.retrieve(profile.stripe_customer_id)
          if (existingCustomer && !existingCustomer.deleted) {
            customerId = profile.stripe_customer_id
          }
        } catch (error) {
          // Customer doesn't exist in Stripe, will create new one below
          console.log('Stripe customer not found, will create new one')
        }
      }
    }

    // If no customer ID found from profile, create or find by email
    if (!customerId && formData.email) {
      const customers = await stripe.customers.list({
        email: formData.email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        customerId = customers.data[0].id
        if (userId) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId)
        }
      } else {
        const customer = await stripe.customers.create({
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          metadata: {
            userId: userId || '',
          },
        })
        customerId = customer.id
        if (userId) {
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId)
        }
      }
    }

    // Get enabled payment methods
    const { data: paymentMethodsSetting } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_payment_methods')
      .single()

    const enabledMethods = paymentMethodsSetting?.setting_value as any || {}
    const safePaymentMethodTypes: string[] = ['card']
    if (enabledMethods.link !== false) {
      safePaymentMethodTypes.push('link')
    }

    const amountInCents = Math.round(finalTotal * 100)
    
    // Handle free orders (total is $0.00, negative, or less than $0.50 after discount)
    // If a discount makes the order essentially free, treat it as a free order
    const minimumAmountInCents = 50
    if (amountInCents <= 0 || amountInCents < minimumAmountInCents) {
      // If total is less than $0.50, treat as free order instead of forcing $0.50 charge
      if (amountInCents < minimumAmountInCents && amountInCents > 0) {
        console.log(`Order total (${finalTotal.toFixed(2)}) is below $0.50. Treating as free order.`)
      }
      return {
        success: true,
        clientSecret: null, // No payment needed for free orders
        paymentIntentId: null,
        customerId: customerId,
        orderNumber: `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        totals: {
          subtotal,
          discountAmount,
          shippingCost: finalShippingCost,
          taxAmount,
          total: finalTotal,
        },
        isFreeOrder: true,
      }
    }
    
    // For orders $0.50 or more, use the actual calculated amount
    const finalAmountInCents = amountInCents

    // Generate order number for metadata
    const orderNumber = `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // If there are ongoing subscriptions, create a Stripe Subscription instead of Payment Intent
    if (hasOngoingSubscriptions && customerId) {
      // Get ongoing subscription items
      const ongoingSubscriptionItems = cartItems.filter(
        (item: any) => item.purchase_type === 'subscription' && item.subscription_product_id
      )

      // Create subscription items for Stripe
      const stripeSubscriptionItems: Stripe.SubscriptionCreateParams.Item[] = []
      
      for (const item of ongoingSubscriptionItems) {
        const subProduct = subscriptionProducts?.find(
          (sp: any) => sp.id === item.subscription_product_id
        )
        
        if (subProduct) {
          // Linked subscription products (e.g. replacement heads) are charged in future, not now
          if (linkedSubscriptionProductIds.has(subProduct.id)) continue
          const frequencyMonths = item.frequency_months || 1
          const subscriptionPrice = parseFloat(subProduct.subscription_price?.toString() || '0')
          
          if (subscriptionPrice > 0) {
            let stripePriceId = subProduct.stripe_price_id
            
            // If no Stripe price ID exists, create one on the fly
            if (!stripePriceId) {
              try {
                const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
                const variantObj = variant as any
                const productTitle = variantObj?.products?.title || 'Subscription'
                const variantColor = variantObj?.color || ''
                
                // Create Stripe Price for this subscription
                const stripePrice = await stripe.prices.create({
                  currency: 'usd',
                  unit_amount: Math.round(subscriptionPrice * 100), // Convert to cents
                  recurring: {
                    interval: 'month',
                    interval_count: frequencyMonths,
                  },
                  product_data: {
                    name: `${productTitle}${variantColor ? ` (${variantColor})` : ''} - Subscription`,
                    metadata: {
                      subscription_product_id: subProduct.id,
                      variant_id: variantObj?.id || '',
                    },
                  },
                  metadata: {
                    subscription_product_id: subProduct.id,
                    frequency_months: frequencyMonths.toString(),
                  },
                })
                
                stripePriceId = stripePrice.id
                
                // Save the Stripe price ID to the subscription product for future use
                await supabase
                  .from('subscription_products')
                  .update({ stripe_price_id: stripePriceId })
                  .eq('id', subProduct.id)
                
                console.log(`Created Stripe price ${stripePriceId} for subscription product ${subProduct.id}`)
              } catch (priceError: any) {
                console.error('Error creating Stripe price:', priceError)
                // Continue without this item - will fall back to payment intent
                continue
              }
            }
            
            if (stripePriceId) {
              stripeSubscriptionItems.push({
                price: stripePriceId,
                quantity: item.quantity,
              })
            }
          }
        }
      }

      // Also need to handle one-time items and prepaid subscriptions with a setup payment
      // For now, we'll create a subscription with a setup fee for shipping/tax
      if (stripeSubscriptionItems.length > 0) {
        const resolveSubscriptionPaymentIntent = async (
          subscription: Stripe.Subscription,
          formDataForMetadata: any,
          discountAmountForMetadata: number,
          subtotalForMetadata: number,
          subtotalAfterDiscountForMetadata: number,
          finalShippingCostForMetadata: number,
          taxAmountForMetadata: number,
          finalAmountInCentsForMetadata: number,
          orderNumberForMetadata: string,
        ) => {
          const latestInvoiceId =
            typeof subscription.latest_invoice === 'string'
              ? subscription.latest_invoice
              : (subscription.latest_invoice as any)?.id

          if (!latestInvoiceId) {
            return { paymentIntent: null as Stripe.PaymentIntent | null, invoice: null as Stripe.Invoice | null }
          }

          const retrieveInvoiceExpanded = async () => {
            return await stripe.invoices.retrieve(latestInvoiceId, { expand: ['payment_intent'] })
          }

          // First try: retrieve expanded invoice
          let invoice: Stripe.Invoice | null = null
          try {
            invoice = await retrieveInvoiceExpanded()
          } catch (e) {
            invoice = null
          }

          // If invoice exists but is draft, finalize it to force payment_intent creation
          if (invoice && invoice.status === 'draft') {
            try {
              invoice = await stripe.invoices.finalizeInvoice(latestInvoiceId, { expand: ['payment_intent'] })
            } catch (e) {
              // keep going
            }
          }

          // Retry a few times because invoice/payment_intent creation can be slightly delayed
          const retryDelays = [250, 500, 1000, 1500, 3000]
          for (const delayMs of retryDelays) {
            const pi = (invoice as any)?.payment_intent
            if (pi) break
            await new Promise((r) => setTimeout(r, delayMs))
            try {
              invoice = await retrieveInvoiceExpanded()
            } catch (e) {
              // ignore
            }
          }

          // One last hard refresh of subscription.latest_invoice in case invoice reference changed
          if (!(invoice as any)?.payment_intent) {
            try {
              const refreshedSub = await stripe.subscriptions.retrieve(subscription.id, {
                expand: ['latest_invoice.payment_intent'],
              })
              const refreshedInvoice = refreshedSub.latest_invoice as any
              if (refreshedInvoice?.payment_intent) {
                invoice = refreshedInvoice
              }
            } catch (e) {
              // ignore
            }
          }

          // If still no payment intent, try listing invoices for the subscription and expanding payment_intent
          if (!(invoice as any)?.payment_intent) {
            try {
              const invoiceList = await stripe.invoices.list({
                subscription: subscription.id,
                limit: 1,
                expand: ['data.payment_intent'],
              })
              if (invoiceList.data.length > 0) {
                invoice = invoiceList.data[0] as any
                
                // If invoice is draft or open without payment_intent, try to finalize it
                if (invoice.status === 'draft' || (invoice.status === 'open' && !invoice.payment_intent)) {
                  try {
                    invoice = await stripe.invoices.finalizeInvoice(invoice.id, { expand: ['payment_intent'] })
                  } catch (e: any) {
                    // If already finalized, that's okay - try to retrieve it again
                    if (e.message?.includes('already finalized') || e.message?.includes('already paid')) {
                      invoice = await stripe.invoices.retrieve(invoice.id, { expand: ['payment_intent'] })
                    }
                  }
                }
              }
            } catch (e) {
              // ignore list error
            }
          }
          
          // Extract payment_intent from invoice
          let paymentIntent: Stripe.PaymentIntent | null = null
          const expandedPi = (invoice as any)?.payment_intent
          if (expandedPi) {
            if (typeof expandedPi === 'string') {
              try {
                paymentIntent = await stripe.paymentIntents.retrieve(expandedPi)
              } catch (e) {
                paymentIntent = null
              }
            } else {
              paymentIntent = expandedPi as Stripe.PaymentIntent
            }
          }
          
          // If STILL no payment intent but invoice is open with amount due, create payment_intent manually
          // This handles the case where Stripe creates an open invoice without a payment_intent
          // (can happen when invoice items are added after subscription creation)
          if (!paymentIntent && invoice && (invoice as any).status === 'open' && (invoice as any).amount_due > 0) {
            try {
              console.log('Creating payment_intent manually for open invoice without payment_intent:', {
                invoiceId: (invoice as any).id,
                amountDue: (invoice as any).amount_due,
                subscriptionId: subscription.id,
              })
              
              // Create a payment_intent for the invoice amount
              // This payment_intent will be used for checkout, and we'll link it to the invoice via metadata
              const manualPaymentIntent = await stripe.paymentIntents.create({
                amount: (invoice as any).amount_due,
                currency: (invoice as any).currency || 'usd',
                customer: customerId,
                payment_method_types: safePaymentMethodTypes,
                metadata: {
                  email: formDataForMetadata.email,
                  firstName: formDataForMetadata.firstName,
                  lastName: formDataForMetadata.lastName,
                  discountCode: formDataForMetadata.discountCode || '',
                  discountAmount: discountAmountForMetadata.toFixed(2),
                  subtotal: subtotalForMetadata.toFixed(2),
                  subtotalAfterDiscount: subtotalAfterDiscountForMetadata.toFixed(2),
                  shipping: finalShippingCostForMetadata.toFixed(2),
                  tax: taxAmountForMetadata.toFixed(2),
                  total: (finalAmountInCentsForMetadata / 100).toFixed(2),
                  orderNumber: orderNumberForMetadata,
                  invoice_id: (invoice as any).id,
                  subscription_id: subscription.id,
                },
                description: `Payment for subscription ${subscription.id} - Invoice ${(invoice as any).id}`,
              })
              
              paymentIntent = manualPaymentIntent
              console.log('✅ Created manual payment_intent:', manualPaymentIntent.id, 'for invoice:', (invoice as any).id)
            } catch (createError: any) {
              console.error('Error creating manual payment_intent:', createError)
              // Continue - we'll return null and the error will be handled upstream
            }
          }

          return { paymentIntent, invoice }
        }

        // Create subscription with setup fee for shipping and tax
        const subscriptionParams: Stripe.SubscriptionCreateParams = {
          customer: customerId,
          items: stripeSubscriptionItems,
          payment_behavior: 'default_incomplete',
          payment_settings: {
            payment_method_types: safePaymentMethodTypes,
            save_default_payment_method: 'on_subscription',
          },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            discountCode: formData.discountCode || '',
            discountAmount: discountAmount.toFixed(2),
            subtotal: subtotal.toFixed(2),
            subtotalAfterDiscount: subtotalAfterDiscount.toFixed(2),
            shipping: finalShippingCost.toFixed(2),
            tax: taxAmount.toFixed(2),
            total: (finalAmountInCents / 100).toFixed(2),
            orderNumber: orderNumber,
          },
        }

        try {
          // Create subscription first (this will create the first invoice)
          const subscription = await stripe.subscriptions.create(subscriptionParams)
          
          // Add shipping and tax as a one-time invoice item AFTER subscription creation
          // This ensures the invoice items are added to the subscription's invoice
          if (finalShippingCost > 0 || taxAmount > 0) {
            const oneTimeAmount = Math.round((finalShippingCost + taxAmount) * 100)
            if (oneTimeAmount > 0) {
              try {
                await stripe.invoiceItems.create({
                  customer: customerId,
                  subscription: subscription.id, // Attach to subscription so it's included in the invoice
                  amount: oneTimeAmount,
                  currency: 'usd',
                  description: `Shipping and Tax for Order ${orderNumber}`,
                })
                
                // After adding invoice items, we need to finalize the invoice to get a payment_intent
                // The invoice might need to be finalized to create the payment_intent
                const latestInvoiceId = typeof subscription.latest_invoice === 'string'
                  ? subscription.latest_invoice
                  : (subscription.latest_invoice as any)?.id
                
                if (latestInvoiceId) {
                  try {
                    // Finalize the invoice to ensure payment_intent is created
                    await stripe.invoices.finalizeInvoice(latestInvoiceId, {
                      expand: ['payment_intent'],
                    })
                  } catch (finalizeError: any) {
                    // If invoice is already finalized or paid, that's okay
                    if (!finalizeError.message?.includes('already finalized') && 
                        !finalizeError.message?.includes('already paid')) {
                      console.warn('Could not finalize invoice after adding items:', finalizeError.message)
                    }
                  }
                }
              } catch (invoiceItemError) {
                console.error('Error adding invoice items:', invoiceItemError)
                // Continue anyway - subscription is created
              }
            }
          }

          // Get the client secret from the latest invoice's payment intent
          const { paymentIntent, invoice } = await resolveSubscriptionPaymentIntent(
            subscription,
            formData,
            discountAmount,
            subtotal,
            subtotalAfterDiscount,
            finalShippingCost,
            taxAmount,
            finalAmountInCents,
            orderNumber,
          )

          // If no payment is due (e.g. $0 first invoice), allow checkout to continue without payment form
          const invoiceAmountDue = invoice?.amount_due ?? invoice?.total ?? null
          if (!paymentIntent && invoiceAmountDue === 0) {
            return {
              success: true,
              clientSecret: null,
              paymentIntentId: null,
              subscriptionId: subscription.id,
              customerId: customerId,
              orderNumber: orderNumber,
              isSubscription: true,
              isFreeOrder: true,
              totals: {
                subtotal,
                discountAmount,
                shippingCost: finalShippingCost,
                taxAmount,
                total: finalTotal,
                chargedAmount: 0,
              },
            }
          }

          if (!paymentIntent?.client_secret) {
            console.error('No payment intent client secret found for subscription:', {
              subscriptionId: subscription.id,
              latestInvoiceId:
                typeof subscription.latest_invoice === 'string'
                  ? subscription.latest_invoice
                  : (subscription.latest_invoice as any)?.id,
              invoiceStatus: (invoice as any)?.status,
              invoiceAmountDue: (invoice as any)?.amount_due,
              invoiceTotal: (invoice as any)?.total,
              paymentIntentId: paymentIntent?.id || null,
            })
            // Cancel the incomplete subscription since we can't proceed
            try {
              await stripe.subscriptions.cancel(subscription.id)
              console.log(`✅ Canceled incomplete subscription ${subscription.id} due to missing payment intent`)
            } catch (cancelError) {
              console.error('Error canceling subscription:', cancelError)
            }
            return {
              success: false,
              error: 'Failed to initialize subscription payment. Please try again.',
            }
          }

          // Add subscription ID to payment intent metadata for cleanup if payment fails
          try {
            await stripe.paymentIntents.update(paymentIntent.id, {
              metadata: {
                ...paymentIntent.metadata,
                subscriptionId: subscription.id,
                orderNumber,
              },
            })
          } catch (updateError) {
            // Non-critical - just log it
            console.log('Could not update payment intent metadata:', updateError)
          }

          return {
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            subscriptionId: subscription.id,
            customerId: customerId,
            orderNumber: orderNumber,
            isSubscription: true,
            totals: {
              subtotal,
              discountAmount,
              shippingCost: finalShippingCost,
              taxAmount,
              total: finalTotal,
              chargedAmount: finalAmountInCents / 100,
            },
          }
        } catch (subscriptionError: any) {
          console.error('Error creating Stripe subscription:', subscriptionError)
          // Fall back to payment intent if subscription creation fails
          console.log('Falling back to payment intent for subscription items')
        }
      }

      // Linked subscription products (charged in future): create Stripe Subscription with future billing so it appears in Stripe and bills next cycle
      const linkedOngoingItems = ongoingSubscriptionItems.filter(
        (item: any) => subscriptionProducts?.some((sp: any) => sp.id === item.subscription_product_id && linkedSubscriptionProductIds.has(sp.id))
      )
      if (linkedOngoingItems.length > 0 && customerId) {
        const linkedStripeItems: Stripe.SubscriptionCreateParams.Item[] = []
        for (const item of linkedOngoingItems) {
          const subProduct = subscriptionProducts?.find((sp: any) => sp.id === item.subscription_product_id)
          if (!subProduct) continue
          const frequencyMonths = item.frequency_months || 1
          const subscriptionPrice = parseFloat(subProduct.subscription_price?.toString() || '0')
          if (subscriptionPrice <= 0) continue
          let stripePriceId = subProduct.stripe_price_id
          if (!stripePriceId) {
            try {
              const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
              const v = variant as any
              const stripePrice = await stripe.prices.create({
                currency: 'usd',
                unit_amount: Math.round(subscriptionPrice * 100),
                recurring: { interval: 'month', interval_count: frequencyMonths },
                product_data: {
                  name: `${v?.products?.title || 'Subscription'}${v?.color ? ` (${v.color})` : ''} - Subscription`,
                  metadata: { subscription_product_id: subProduct.id, variant_id: v?.id || '' },
                },
                metadata: { subscription_product_id: subProduct.id, frequency_months: frequencyMonths.toString() },
              })
              stripePriceId = stripePrice.id
              await supabase.from('subscription_products').update({ stripe_price_id: stripePriceId }).eq('id', subProduct.id)
            } catch (_) { continue }
          }
          if (stripePriceId) linkedStripeItems.push({ price: stripePriceId, quantity: item.quantity })
        }
        if (linkedStripeItems.length > 0) {
          try {
            const nextCycle = new Date()
            nextCycle.setMonth(nextCycle.getMonth() + (linkedOngoingItems[0]?.frequency_months || 1))
            const linkedSub = await stripe.subscriptions.create({
              customer: customerId,
              items: linkedStripeItems,
              billing_cycle_anchor: Math.floor(nextCycle.getTime() / 1000),
              proration_behavior: 'none',
              payment_behavior: 'default_incomplete',
              payment_settings: { payment_method_types: safePaymentMethodTypes, save_default_payment_method: 'on_subscription' },
              metadata: { orderNumber, email: formData.email },
            })
            linkedSubscriptionId = linkedSub.id
            console.log('Created Stripe subscription for linked (future) billing:', linkedSub.id)
          } catch (linkedSubErr: any) {
            console.error('Error creating linked Stripe subscription:', linkedSubErr)
          }
        }
      }
    }

    // Create payment intent with discounted amount (for one-time purchases or prepaid subscriptions)
    // Include setup_future_usage to allow saving payment methods for future use
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: finalAmountInCents, // Use actual calculated amount (orders < $0.50 are treated as free)
      currency: 'usd',
      customer: customerId || undefined,
      payment_method_types: safePaymentMethodTypes,
      metadata: {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        has_subscription_items: String(hasOngoingSubscriptions || hasPrepaidSubscriptions),
        checkout_mode: hasOngoingSubscriptions
          ? 'ongoing_subscription'
          : hasPrepaidSubscriptions
            ? 'prepaid_subscription'
            : 'one_time',
        discountCode: formData.discountCode || '',
        discountAmount: discountAmount.toFixed(2),
        subtotal: subtotal.toFixed(2),
        subtotalAfterDiscount: subtotalAfterDiscount.toFixed(2),
        shipping: finalShippingCost.toFixed(2),
        tax: taxAmount.toFixed(2),
        total: (finalAmountInCents / 100).toFixed(2), // Use the final amount that will be charged
      },
      description: `Order ${orderNumber}${formData.discountCode ? ` (Discount: ${formData.discountCode})` : ''}`,
      confirmation_method: 'automatic',
      confirm: false, // Will be confirmed on client side with Stripe Elements
    }

    // Enable saving payment methods for logged-in customers
    if (customerId && userId) {
      paymentIntentParams.setup_future_usage = 'off_session'
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    // Persist checkout snapshot so recovery/webhook can create full order (items + address) if createOrder never runs
    try {
      const regularItemsForSnapshot: { cartItem: any; product_variants: any }[] = []
      for (const item of cartItems) {
        const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
        if (!variant) continue
        const isSub = (item.purchase_type === 'subscription' || item.purchase_type === 'prepaid') && item.subscription_product_id
        const subProduct = isSub ? subscriptionProducts?.find((sp: any) => sp.id === item.subscription_product_id) : null
        if (isSub && subProduct) continue // skip subscription items for snapshot (order_items are regular only)
        regularItemsForSnapshot.push({ cartItem: item, product_variants: variant })
      }
      const snapshotItems = regularItemsForSnapshot
        .map(({ cartItem, product_variants: v }) => {
          const product = v?.products
          if (!product) return null
          const unitPrice = v?.price || '0'
          const qty = cartItem.quantity || 1
          return {
            product_id: product.id,
            variant_id: v.id,
            product_title: product.title || 'Product',
            variant_color: v.color || 'Unknown',
            sku: v.sku || 'N/A',
            quantity: qty,
            unit_price: unitPrice,
            line_total: (parseFloat(unitPrice) * qty).toFixed(2),
            purchase_type: cartItem.purchase_type || 'one-time',
          }
        })
        .filter(Boolean)
      const snapshot = {
        items: snapshotItems,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        customer: {
          email: formData.email.trim(),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone?.trim() || null,
        },
        totals: {
          subtotal,
          discountAmount,
          shippingCost: finalShippingCost,
          taxAmount,
          total: finalTotal,
        },
      }
      await supabase.from('checkout_snapshots').upsert(
        {
          payment_intent_id: paymentIntent.id,
          order_number: orderNumber,
          user_id: userId || null,
          session_id: sessionId || null,
          snapshot,
        },
        { onConflict: 'payment_intent_id' }
      )
    } catch (snapshotErr) {
      console.error('Failed to save checkout snapshot (recovery may have limited data):', snapshotErr)
    }

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customerId,
      orderNumber: orderNumber,
      isSubscription: false,
      linkedSubscriptionId: linkedSubscriptionId ?? undefined,
      totals: {
        subtotal,
        discountAmount,
        shippingCost: finalShippingCost,
        taxAmount,
        total: finalTotal, // Return actual calculated total
        chargedAmount: finalAmountInCents / 100, // Amount actually charged (same as total for orders >= $0.50)
      },
    }
    } catch (stripeError: any) {
      console.error('Error creating payment intent (Stripe):', stripeError)
      return { 
        success: false, 
        error: `Payment processing error: ${stripeError.message || 'Failed to create payment intent. Please try again.'}` 
      }
    }
  } catch (error: any) {
    console.error('Error in createPaymentIntent:', error)
    return { 
      success: false, 
      error: error.message || 'An error occurred while preparing payment. Please try again.' 
    }
  }
}

/**
 * Create order after payment is confirmed
 */
export async function createOrder(formData: CheckoutFormData) {
  // Use admin client to bypass RLS for order creation (supports both authenticated and guest checkout)
  const supabase = createAdminSupabaseClient()
  
  // Get user session for authenticated users (allow guest checkout)
  const serverSupabase = await createServerSupabaseClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  const userId = user?.id || null

  // Get cart items
  const cookieStore = await (await import('next/headers')).cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!userId && !sessionId) {
    return { success: false, error: 'Cart is empty' }
  }

  const cartQuery = supabase
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
        products (
          id,
          title,
          base_price,
          compare_at_price
        )
      )
    `)
  
  // Also fetch subscription products for variants to check if they're subscription items
  const subscriptionProductsQuery = supabase
    .from('subscription_products')
    .select('*')
    .eq('status', 'active')
    .eq('is_subscription_enabled', true)

  if (userId) {
    cartQuery.eq('user_id', userId)
  } else {
    cartQuery.eq('session_id', sessionId)
  }

  const [cartResult, subscriptionProductsResult, linkedSubsResult] = await Promise.all([
    cartQuery,
    subscriptionProductsQuery,
    supabase.from('linked_subscriptions').select('subscription_product_id').eq('status', 'active'),
  ])

  const { data: cartItems, error: cartError } = cartResult
  const { data: subscriptionProducts } = subscriptionProductsResult
  const linkedSubs = linkedSubsResult.data || []
  const linkedSubscriptionProductIds = new Set(
    linkedSubs.map((ls: any) => ls.subscription_product_id).filter(Boolean)
  )

  if (cartError || !cartItems || cartItems.length === 0) {
    return { success: false, error: 'Cart is empty' }
  }

  // Separate regular items from subscription items
  const regularItems: any[] = []
  const subscriptionItems: any[] = []

  for (const item of cartItems) {
    const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
    if (!variant) continue

    // Check if this is a subscription item based on purchase_type and subscription_product_id
    if ((item.purchase_type === 'subscription' || item.purchase_type === 'prepaid') && item.subscription_product_id) {
      const subProduct = subscriptionProducts?.find(
        (sp: any) => sp.id === item.subscription_product_id
      )

      if (subProduct) {
        subscriptionItems.push({
          cartItem: item,
          subscriptionProduct: subProduct,
          purchaseType: item.purchase_type,
          frequencyMonths: item.frequency_months || 1,
          prepaidCycles: item.prepaid_cycles || 1,
          shippingDays: item.shipping_days || subProduct.shipping_days || 14,
        })
      } else {
        // Subscription product not found, treat as regular item
        regularItems.push({
          cartItem: item,
          product_variants: variant,
        })
      }
    } else {
      // Regular one-time purchase
      regularItems.push({
        cartItem: item,
        product_variants: variant,
      })
    }
  }

  // Calculate subtotal for regular items
  let subtotal = 0
  for (const item of regularItems) {
    const variant = item.product_variants
    if (variant) {
      subtotal += parseFloat(variant.price || '0') * item.cartItem.quantity
    }
  }

  // Calculate subtotal for subscription items (for the first cycle)
  // Linked subscription products are charged in future, not in this order total
  let subscriptionSubtotal = 0
  for (const item of subscriptionItems) {
    const subProduct = item.subscriptionProduct
    if (subProduct && linkedSubscriptionProductIds.has(subProduct.id)) {
      continue // Charged in future (bundle: pay later)
    }
    if (subProduct) {
      // Use subscription price for ongoing subscriptions, prepaid price for prepaid
      const pricePerCycle = item.purchaseType === 'prepaid'
        ? (subProduct.prepaid_price || subProduct.subscription_price || 0)
        : (subProduct.subscription_price || 0)
      
      if (item.purchaseType === 'prepaid') {
        const prepaidCycles = item.prepaidCycles || 1
        subscriptionSubtotal += parseFloat(pricePerCycle.toString()) * item.cartItem.quantity * prepaidCycles
      } else {
        // Ongoing subscription: charge first cycle only.
        subscriptionSubtotal += parseFloat(pricePerCycle.toString()) * item.cartItem.quantity
      }
    }
  }

  // Total subtotal includes regular items + subscription items that are charged now (not linked-sub "pay later")
  // Use let so it can be updated from Stripe invoice for subscriptions
  let totalSubtotal = subtotal + subscriptionSubtotal

  // Apply discount if provided
  let discountAmount = 0
  if (formData.discountCode && formData.discountCode.trim()) {
    try {
      const { data: promotion } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', normalizePromoCode(formData.discountCode || ''))
        .eq('status', 'active')
        .single()

      if (promotion) {
        const now = new Date()
        const startsAt = promotion.starts_at ? new Date(promotion.starts_at) : null
        const endsAt = promotion.ends_at ? new Date(promotion.ends_at) : null

        if ((!startsAt || now >= startsAt) && (!endsAt || now <= endsAt)) {
          // Use total subtotal (regular + subscription) for discount validation
          if (!promotion.min_purchase_amount || totalSubtotal >= parseFloat(promotion.min_purchase_amount.toString())) {
            if (!promotion.usage_limit || (promotion.usage_count || 0) < promotion.usage_limit) {
              if (promotion.discount_type === 'percentage') {
                discountAmount = totalSubtotal * (parseFloat(promotion.discount_value.toString()) / 100)
              } else if (promotion.discount_type === 'fixed') {
                discountAmount = parseFloat(promotion.discount_value.toString())
                if (discountAmount > totalSubtotal) {
                  discountAmount = totalSubtotal
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing discount code:', error)
    }
  }

  // Get shipping cost
  const { data: shippingMethod } = await supabase
    .from('shipping_methods')
    .select('price')
    .eq('id', formData.shippingMethod)
    .single()

  const shippingCost = parseFloat(shippingMethod?.price || '0')
  
  // Apply free shipping discount if applicable
  let finalShippingCost = shippingCost
  if (formData.discountCode && formData.discountCode.trim()) {
    try {
      const discountCodeNormalized = normalizePromoCode(formData.discountCode)
      const { data: promotion } = await supabase
        .from('promotions')
        .select('discount_type')
        .eq('code', discountCodeNormalized)
        .eq('status', 'active')
        .single()
      
      if (promotion && promotion.discount_type === 'free_shipping') {
        finalShippingCost = 0
        console.log('Free shipping applied, shipping cost set to 0')
      }
    } catch (error) {
      console.error('Error checking free shipping:', error)
    }
  }
  
  // Use total subtotal (regular + subscription) for discount and tax calculation
  const subtotalAfterDiscount = Math.max(0, totalSubtotal - discountAmount)
  const orderTaxExemptions = await fetchTaxExemptionEntries()
  let taxAmount = taxAmountForCheckout(
    subtotalAfterDiscount,
    formData.shippingAddress?.country,
    formData.shippingAddress?.state,
    orderTaxExemptions
  )
  const total = subtotalAfterDiscount + finalShippingCost + taxAmount
  // Use actual calculated total (don't force $0.50 minimum here - it's handled in payment intent)
  // Use let so it can be updated from Stripe invoice for subscriptions
  let finalTotal = Math.max(0, total)

  // Verify payment intent if provided
  let paymentIntentId: string | null = formData.paymentIntentId || null
  let subscriptionId: string | null = formData.subscriptionId || null
  let paymentStatus = 'pending'

  // Verify payment for subscriptions or payment intents
  if (subscriptionId && formData.isSubscription) {
    try {
      // Get Stripe configuration
      const { data: stripeSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'stripe')
        .single()

      const stripeSettings = stripeSetting?.setting_value as any
      const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2025-10-29.clover',
        })

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['latest_invoice.payment_intent'],
        })
        
        let paymentIntent: Stripe.PaymentIntent | null = null
        
        if (subscription.latest_invoice) {
          if (typeof subscription.latest_invoice === 'string') {
            const invoice = await stripe.invoices.retrieve(subscription.latest_invoice, {
              expand: ['payment_intent'],
            })
            const invoiceWithPaymentIntent = invoice as any
            if (invoiceWithPaymentIntent.payment_intent) {
              if (typeof invoiceWithPaymentIntent.payment_intent === 'string') {
                paymentIntent = await stripe.paymentIntents.retrieve(invoiceWithPaymentIntent.payment_intent)
              } else {
                paymentIntent = invoiceWithPaymentIntent.payment_intent as Stripe.PaymentIntent
              }
            }
          } else {
            const invoice = subscription.latest_invoice as any
            if (invoice.payment_intent) {
              if (typeof invoice.payment_intent === 'string') {
                paymentIntent = await stripe.paymentIntents.retrieve(invoice.payment_intent)
              } else {
                paymentIntent = invoice.payment_intent as Stripe.PaymentIntent
              }
            }
          }
        }
        
        if (paymentIntent) {
          if (paymentIntent.status === 'succeeded') {
            paymentStatus = 'paid'
            paymentIntentId = paymentIntent.id
            // Get actual charged amount from invoice for subscription orders
            if (subscription.latest_invoice) {
              const invoice = typeof subscription.latest_invoice === 'string'
                ? await stripe.invoices.retrieve(subscription.latest_invoice)
                : subscription.latest_invoice as Stripe.Invoice
              
              // Use invoice total (includes subscription items + shipping + tax)
              const invoiceTotal = invoice.total / 100 // Convert from cents
              if (invoiceTotal > 0) {
                // Override finalTotal with actual invoice amount
                finalTotal = invoiceTotal
                // Recalculate subtotal, tax, shipping from invoice
                // Invoice amount = subtotal + shipping + tax (one-time charges)
                // For subscriptions, shipping and tax are added as invoice items
                const invoiceSubtotal = invoice.subtotal / 100
                const invoiceTax = (invoice as any).tax || 0
                const invoiceTaxAmount = typeof invoiceTax === 'number' ? invoiceTax / 100 : 0
                // Try to get shipping from invoice items or metadata
                const shippingFromInvoice = invoice.shipping_cost?.amount_total ? invoice.shipping_cost.amount_total / 100 : finalShippingCost
                
                // Update totals from actual invoice
                // Note: We update totalSubtotal to reflect the invoice subtotal
                // This ensures the order shows the correct amount charged
                totalSubtotal = invoiceSubtotal
                taxAmount = invoiceTaxAmount
                finalShippingCost = shippingFromInvoice
              }
            }
          } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
            return { 
              success: false, 
              error: 'Payment was not completed. Please try again.' 
            }
          }
        }
      }
    } catch (error) {
      console.error('Error verifying subscription:', error)
      return { 
        success: false, 
        error: 'Failed to verify subscription payment. Please try again.' 
      }
    }
  } else if (paymentIntentId) {
    try {
      // Get Stripe configuration
      const { data: stripeSetting } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'stripe')
        .single()

      const stripeSettings = stripeSetting?.setting_value as any
      const stripeSecretKey = stripeSettings?.secret_key || process.env.STRIPE_SECRET_KEY

      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2025-10-29.clover',
        })

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        
        if (paymentIntent.status === 'succeeded') {
          paymentStatus = 'paid'
          // Get actual charged amount from payment intent
          // This handles cases where total was rounded up to $0.50 minimum
          const chargedAmount = paymentIntent.amount / 100 // Convert from cents
          // Use charged amount if provided in formData, otherwise use calculated total
          if (formData.chargedAmount === undefined) {
            // Store charged amount for order creation
            formData.chargedAmount = chargedAmount
          }
        } else if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
          return { 
            success: false, 
            error: 'Payment was not completed. Please try again.' 
          }
        }
      }
    } catch (error) {
      console.error('Error verifying payment intent:', error)
      return { 
        success: false, 
        error: 'Failed to verify payment. Please try again.' 
      }
    }
  }

  // Idempotency guard: if order already exists for this payment intent, return it
  if (formData.paymentIntentId) {
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, order_number, user_id')
      .eq('stripe_payment_intent_id', formData.paymentIntentId)
      .single()

    if (existingOrder) {
      return {
        success: true,
        orderId: existingOrder.id,
        orderNumber: existingOrder.order_number,
        paymentStatus: paymentStatus || 'paid',
        userId: existingOrder.user_id || null,
      }
    }
  }

  // Validate required fields before creating order
  if (!formData.email || !formData.firstName || !formData.lastName) {
    return { 
      success: false, 
      error: 'Missing required customer information' 
    }
  }

  if (!formData.shippingAddress || !formData.shippingAddress.address_line1 || !formData.shippingAddress.city) {
    return { 
      success: false, 
      error: 'Missing required shipping address' 
    }
  }

  // Generate order number (only for regular orders or mixed orders)
  let order: any = null
  let orderNumber: string | null = null
  let firstSubscriptionOrder: { id: string; order_number: string } | null = null

  // Only create a regular order if there are regular items
  if (regularItems.length > 0) {
    orderNumber = `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`

    const orderData: any = {
      order_number: orderNumber,
      user_id: userId || null,
      customer_email: formData.email.trim(),
      customer_first_name: formData.firstName.trim(),
      customer_last_name: formData.lastName.trim(),
      customer_phone: formData.phone?.trim() || null,
      subtotal: parseFloat(subtotal.toFixed(2)), // regular items subtotal only
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      shipping_cost: parseFloat(finalShippingCost.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      total: parseFloat(finalTotal.toFixed(2)),
      shipping_address: formData.shippingAddress,
      billing_address: formData.billingAddress,
      payment_status: paymentStatus,
      fulfillment_status: 'unfulfilled',
    }

    if (paymentIntentId) {
      orderData.stripe_payment_intent_id = paymentIntentId
    }

    // Re-check for existing order right before insert (prevents duplicate when webhook created order from snapshot first)
    if (paymentIntentId) {
      const { data: existingByPi } = await supabase
        .from('orders')
        .select('id, order_number, user_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle()
      if (existingByPi) {
        try {
          await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntentId)
        } catch (_) {}
        return {
          success: true,
          orderId: existingByPi.id,
          orderNumber: existingByPi.order_number,
          paymentStatus: paymentStatus || 'paid',
          userId: existingByPi.user_id || null,
        }
      }
    }

    const { data: createdOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError || !createdOrder) {
      const isDuplicatePaymentIntent = orderError?.code === '23505'
      if (!isDuplicatePaymentIntent) {
        console.error('Error creating order:', {
          error: orderError,
          orderData,
          paymentIntentId: formData.paymentIntentId,
          message: orderError?.message,
          details: orderError?.details,
          hint: orderError?.hint,
          code: orderError?.code,
        })
      }

      if (paymentIntentId) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, order_number, user_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle()

        if (existingOrder) {
          if (isDuplicatePaymentIntent) {
            try { await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', paymentIntentId) } catch (_) {}
          }
          console.log('Order already exists for payment intent, returning existing order:', existingOrder.id)
          return {
            success: true,
            orderId: existingOrder.id,
            orderNumber: existingOrder.order_number,
            paymentStatus: paymentStatus || 'paid',
            userId: existingOrder.user_id || null,
          }
        }
      }

      if (orderData.order_number) {
        const { data: existingOrderByNumber } = await supabase
          .from('orders')
          .select('id, order_number, user_id')
          .eq('order_number', orderData.order_number)
          .single()

        if (existingOrderByNumber) {
          console.log('Order already exists with same order number, returning existing order:', existingOrderByNumber.id)
          return {
            success: true,
            orderId: existingOrderByNumber.id,
            orderNumber: existingOrderByNumber.order_number,
            paymentStatus: paymentStatus || 'paid',
            userId: existingOrderByNumber.user_id || null,
          }
        }
      }

      return {
        success: false,
        error: orderError?.message || 'Failed to create order',
        details: orderError?.details || orderError?.hint || 'Unknown error',
        code: orderError?.code || 'UNKNOWN',
      }
    }

    order = createdOrder
  }

  // For subscription-only checkouts, we intentionally skip creating a regular order

  // Create order items - must have at least regular items
  // Note: For subscription-only checkouts, we skip this section
  if (regularItems.length === 0 && subscriptionItems.length === 0) {
    console.error('No items to create order for')
    if (order) {
      await supabase.from('orders').delete().eq('id', order.id)
    }
    return { success: false, error: 'No items found in cart' }
  }

  // Create order items for regular (one-time) purchases
  if (regularItems.length > 0) {
    const orderItems = regularItems
      .map((item) => {
        const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants
        if (!variant) {
          console.error('Missing variant for cart item:', item.cartItem.id)
          return null
        }
        
        const product = (variant as any).products
        if (!product) {
          console.error('Missing product for variant:', variant.id)
          return null
        }

        const v = variant as any
        return {
          order_id: order.id,
          product_id: product.id,
          variant_id: v.id,
          product_title: product.title || 'Product',
          variant_color: v.color || 'Unknown',
          sku: v.sku || 'N/A',
          quantity: item.cartItem.quantity,
          unit_price: v.price || '0',
          line_total: (parseFloat(v.price || '0') * item.cartItem.quantity).toFixed(2),
          purchase_type: item.cartItem.purchase_type || 'one-time',
        }
      })
      .filter(Boolean) // Remove null entries

    if (orderItems.length === 0) {
      console.error('No valid order items to create')
      // Try to delete the order
      await supabase.from('orders').delete().eq('id', order.id)
      return { success: false, error: 'Failed to create order items: Invalid product data' }
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Error creating order items:', {
        error: itemsError,
        orderId: order.id,
        orderItems,
        message: itemsError.message,
        details: itemsError.details,
        hint: itemsError.hint,
        code: itemsError.code,
      })
      // Try to delete the order
      await supabase.from('orders').delete().eq('id', order.id)
      return { 
        success: false, 
        error: `Failed to create order items: ${itemsError.message}`,
        details: itemsError.details || itemsError.hint,
        code: itemsError.code,
      }
    }

    // Clear checkout snapshot so recovery/webhook won't duplicate this order
    if (formData.paymentIntentId) {
      try {
        await supabase.from('checkout_snapshots').delete().eq('payment_intent_id', formData.paymentIntentId)
      } catch (snapshotDeleteErr) {
        console.error('Failed to delete checkout snapshot after order creation:', snapshotDeleteErr)
      }
    }

    // Assign order to suppliers based on product_supplier_links
    // This runs after order_items are created, so we can properly link orders to suppliers
    try {
      const variantIds = orderItems.map(item => item?.variant_id).filter(Boolean) as string[]
      
      if (variantIds.length > 0) {
        // Get all suppliers linked to these variants
        const { data: supplierLinks } = await supabase
          .from('product_supplier_links')
          .select('supplier_id, variant_id')
          .in('variant_id', variantIds)
          .eq('is_primary_supplier', true)

        if (supplierLinks && supplierLinks.length > 0) {
          // Get unique supplier IDs
          const uniqueSupplierIds = [...new Set(supplierLinks.map(link => link.supplier_id))]
          
          // Create supplier assignments for each unique supplier
          const assignments = uniqueSupplierIds.map(supplierId => ({
            order_id: order.id,
            supplier_id: supplierId,
            assignment_status: 'pending',
          }))

          // Insert assignments (use insert with ON CONFLICT handling)
          let assignmentSuccess = false
          for (const assignment of assignments) {
            const { error: assignmentError } = await supabase
              .from('supplier_order_assignments')
              .insert(assignment)
              .select()
            
            if (assignmentError) {
              // If conflict (already exists), that's okay - skip it
              if (assignmentError.code !== '23505') { // Not a unique constraint violation
                console.error('Error assigning order to supplier:', assignmentError)
              } else {
                assignmentSuccess = true // At least one assignment succeeded or already exists
              }
            } else {
              assignmentSuccess = true
            }
          }

          if (assignmentSuccess) {
            console.log(`Order ${order.order_number} assigned to ${uniqueSupplierIds.length} supplier(s)`)
          }
        }
      }
    } catch (assignmentError) {
      console.error('Error in supplier assignment process:', assignmentError)
      // Don't fail the order creation if assignment fails
    }
  }

  // DON'T create order items for subscription items in regular orders
  // Subscription items will be in subscription orders created by the subscription system
  // The subscription system handles its own orders separately
  // We only create order items for regular (one-time) purchases here

  // Update inventory for regular items only (subscription items handled separately)
  for (const item of regularItems) {
    const variant = item.product_variants
    if (variant?.id) {
      // Get current inventory
      const { data: currentVariant } = await supabase
        .from('product_variants')
        .select('inventory_quantity')
        .eq('id', variant.id)
        .single()

      if (currentVariant) {
        const newQuantity = Math.max(0, (currentVariant.inventory_quantity || 0) - item.cartItem.quantity)
        await supabase
          .from('product_variants')
          .update({ inventory_quantity: newQuantity })
          .eq('id', variant.id)
      }
    }
  }

  // Ensure customer account exists for ALL customers (subscribers, one-time buyers, guests, authenticated)
  // This MUST happen BEFORE subscription creation for guest customers
  // For subscription-only checkouts, we'll create a temporary order number for account creation
  let finalUserId = userId
  let emailSent = false
  let tempOrderNumber = orderNumber || `BREVI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  let tempOrderId = order?.id || 'temp-' + Date.now()
  
  // Always ensure customer profile exists, whether guest or authenticated
  if (formData.email) {
    try {
      if (!userId) {
        // Guest customer - create account
        console.log('Attempting to auto-create account for guest:', formData.email)
        const createdUserId = await autoCreateAccountFromCheckout(
          formData,
          order?.id || tempOrderId,
          order?.order_number || tempOrderNumber
        )
        // If account was created successfully, email should have been sent
        if (createdUserId) {
          finalUserId = createdUserId
          emailSent = true
          console.log('Account created successfully for:', formData.email, 'User ID:', finalUserId)
        } else {
          console.warn('Account creation returned null for:', formData.email)
        }
      } else {
        // Authenticated user - ensure profile exists with role='customer'
        console.log('Ensuring customer profile exists for authenticated user:', userId)
        const ensuredUserId = await ensureCustomerProfile(userId, formData, order?.id || tempOrderId, order?.order_number || tempOrderNumber)
        if (ensuredUserId) {
          finalUserId = ensuredUserId
          console.log('Customer profile ensured for:', formData.email, 'User ID:', finalUserId)
        }
      }
    } catch (error) {
      console.error('Error ensuring customer account:', error)
      // Continue - we'll send email as fallback
    }
  }

  // Update order with user_id if account was created or if we have a finalUserId
  // Only update if order exists (not subscription-only checkout)
  if (order && finalUserId && !userId) {
    await supabase
      .from('orders')
      .update({ user_id: finalUserId })
      .eq('id', order.id)
  } else if (order && finalUserId && userId && finalUserId !== userId) {
    // This shouldn't happen, but just in case
    await supabase
      .from('orders')
      .update({ user_id: finalUserId })
      .eq('id', order.id)
  }

  // Ensure customer addresses are stored for this user (shipping/billing defaults)
  if (finalUserId) {
    await upsertCustomerAddresses(supabase, finalUserId, formData)
  }

  // Create subscriptions for subscription items
  // Use finalUserId (which includes newly created accounts for guests)
  if (subscriptionItems.length > 0 && finalUserId) {
    const { createCustomerSubscription } = await import('@/app/actions/subscriptions')
    
    // Get or create addresses
    let shippingAddressId: string | undefined
    let billingAddressId: string | undefined
    
    // Try to find existing default addresses
    const { data: existingAddresses } = await supabase
      .from('addresses')
      .select('id, type, is_default')
      .eq('user_id', finalUserId)
      .in('type', ['shipping', 'billing'])

    if (existingAddresses) {
      const shippingAddr = existingAddresses.find(a => a.type === 'shipping' && a.is_default)
      const billingAddr = existingAddresses.find(a => a.type === 'billing' && a.is_default)
      shippingAddressId = shippingAddr?.id
      billingAddressId = billingAddr?.id
    }

    // If no default addresses exist, create them
    if (!shippingAddressId) {
      const { data: newShippingAddr } = await supabase
        .from('addresses')
        .insert({
          user_id: finalUserId,
          type: 'shipping',
          is_default: true,
          address_line1: formData.shippingAddress.address_line1,
          address_line2: formData.shippingAddress.address_line2,
          city: formData.shippingAddress.city,
          state: formData.shippingAddress.state,
          postal_code: formData.shippingAddress.postal_code,
          country: formData.shippingAddress.country,
        })
        .select()
        .single()
      shippingAddressId = newShippingAddr?.id
    }

    if (!billingAddressId) {
      const { data: newBillingAddr } = await supabase
        .from('addresses')
        .insert({
          user_id: finalUserId,
          type: 'billing',
          is_default: true,
          address_line1: formData.billingAddress.address_line1,
          address_line2: formData.billingAddress.address_line2,
          city: formData.billingAddress.city,
          state: formData.billingAddress.state,
          postal_code: formData.billingAddress.postal_code,
          country: formData.billingAddress.country,
        })
        .select()
        .single()
      billingAddressId = newBillingAddr?.id
    }

    // Create subscriptions for each subscription item
    // Track the first subscription order created (for subscription-only checkouts)
    // Note: firstSubscriptionOrder is declared at the top of the function
    const createdSubscriptionIds: string[] = []

    for (const subItem of subscriptionItems) {
      const subProduct = subItem.subscriptionProduct
      // Use actual metadata from cart item
      const frequency = subItem.frequencyMonths || 1
      const purchaseType = (subItem.purchaseType === 'prepaid' ? 'prepaid' : 'ongoing') as 'ongoing' | 'prepaid'
      const shippingDays = subItem.shippingDays || subProduct.shipping_days || 14
      
      const pricePerCycle = purchaseType === 'prepaid'
        ? (subProduct.prepaid_price || subProduct.subscription_price || 0)
        : (subProduct.subscription_price || 0)

      if (pricePerCycle > 0) {
        try {
          // For ongoing subscriptions, pass the Stripe subscription ID (main or linked)
          const isLinked = linkedSubscriptionProductIds.has(subProduct.id)
          const stripeSubscriptionId = purchaseType === 'ongoing'
            ? (isLinked ? formData.linkedSubscriptionId : formData.subscriptionId) || undefined
            : undefined

          const subscriptionResult = await createCustomerSubscription({
            userId: finalUserId, // Use finalUserId (includes newly created accounts)
            subscriptionProductId: subProduct.id,
            frequencyMonths: frequency,
            purchaseType: purchaseType,
            quantity: subItem.cartItem.quantity,
            pricePerCycle,
            shippingAddressId,
            billingAddressId,
            shippingDays: shippingDays,
            // Prepaid upfront equals unit cycle price * quantity * selected prepaid cycles.
            totalPrepaidAmount: purchaseType === 'prepaid'
              ? parseFloat(pricePerCycle.toString()) * subItem.cartItem.quantity * (subItem.prepaidCycles || 1)
              : undefined,
            prepaidCycles: purchaseType === 'prepaid' ? (subItem.prepaidCycles || 1) : undefined,
            stripeSubscriptionId: stripeSubscriptionId, // Pass Stripe subscription ID for ongoing subscriptions
            existingOrderId: order?.id ?? undefined, // One order: link first cycle to main checkout order
          })
          
          if (!subscriptionResult.success) {
            console.error('Error creating subscription:', subscriptionResult.error, {
              purchaseType,
              userId: finalUserId,
              subscriptionProductId: subProduct.id,
              frequency,
            })
            // For prepaid subscriptions, we should still try to create them even if there's an error
            // The backfill function can handle it, but we log the error for debugging
            if (process.env.NODE_ENV === 'development') {
              console.error('Subscription creation failed but order will continue:', {
                purchaseType,
                error: subscriptionResult.error,
                subscriptionProductId: subProduct.id,
              })
            }
            // Log error but don't fail the order creation
          } else {
            // Log successful subscription creation for debugging
            if (process.env.NODE_ENV === 'development') {
              console.log('Successfully created subscription:', {
                purchaseType,
                subscriptionId: subscriptionResult.subscription?.id,
                subscriptionProductId: subProduct.id,
              })
            }
            if (subscriptionResult.subscription?.id) {
              createdSubscriptionIds.push(subscriptionResult.subscription.id)
            }
            
    // For subscription-only checkouts, get the first subscription order created
    if (!order && !firstSubscriptionOrder && subscriptionResult.subscription?.id) {
      // Get the first subscription order for this subscription (with brief retry for timing)
      for (const delayMs of [0, 150, 400]) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
        const { data: subscriptionOrders } = await supabase
          .from('subscription_orders')
          .select('order_id, orders(id, order_number)')
          .eq('subscription_id', subscriptionResult.subscription.id)
          .order('cycle_number', { ascending: true })
          .limit(1)
        if (subscriptionOrders && subscriptionOrders.length > 0 && subscriptionOrders[0].orders) {
          firstSubscriptionOrder = subscriptionOrders[0].orders as any
          break
        }
      }
    }
          }
        } catch (error) {
          console.error('Exception creating subscription:', error, {
            purchaseType,
            userId: finalUserId,
            subscriptionProductId: subProduct.id,
          })
          // Log error but don't fail the order creation
        }
      }
    }
    
    // For subscription-only checkouts, use the first subscription order instead of a regular order
    if (!order && firstSubscriptionOrder && firstSubscriptionOrder.order_number) {
      order = firstSubscriptionOrder as any
      orderNumber = firstSubscriptionOrder.order_number
      console.log('Using subscription order for subscription-only checkout:', order.order_number)
    } else if (!order && createdSubscriptionIds.length > 0) {
      // As a fallback, fetch the earliest order for the created subscriptions (with retry for timing)
      for (const delayMs of [0, 100, 300]) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
        const { data: subOrders } = await supabase
          .from('subscription_orders')
          .select('order_id, orders(id, order_number)')
          .in('subscription_id', createdSubscriptionIds)
          .order('cycle_number', { ascending: true })
          .limit(1)
        const foundOrder = subOrders?.[0]?.orders
        if (foundOrder?.id) {
          order = foundOrder
          orderNumber = foundOrder.order_number
          console.log('Using fetched subscription order for subscription-only checkout:', order.order_number)
          break
        }
      }
    }

    // When we have a subscription order and confirmed payment, update it so webhook can find it and it shows as paid
    if (!order && createdSubscriptionIds.length > 0) {
      console.error('Subscription order not found after creating subscriptions. createSubscriptionOrder may have failed.', {
        createdSubscriptionIds,
        subscriptionItemsCount: subscriptionItems.length,
      })
      return {
        success: false,
        error: 'Your subscription was created but we could not locate the order. Please contact support with your email and we will fix this.',
      }
    }

    // Link payment intent to subscription order and mark paid (subscription-only path; so webhook finds it and UI shows correct status)
    if (regularItems.length === 0 && order && (order as any).id && paymentIntentId && (paymentStatus === 'paid' || subscriptionId)) {
      const orderUpdate: { stripe_payment_intent_id: string; payment_status: string; total?: number; subtotal?: number; tax_amount?: number; shipping_cost?: number } = {
        stripe_payment_intent_id: paymentIntentId,
        payment_status: paymentStatus === 'paid' ? 'paid' : 'pending',
      }
      if (subscriptionId && finalTotal != null) {
        orderUpdate.total = parseFloat(finalTotal.toFixed(2))
        orderUpdate.subtotal = parseFloat(totalSubtotal.toFixed(2))
        orderUpdate.tax_amount = parseFloat(taxAmount.toFixed(2))
        orderUpdate.shipping_cost = parseFloat(finalShippingCost.toFixed(2))
      }
      const { error: updateErr } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', (order as any).id)
      if (updateErr) {
        console.error('Failed to update subscription order with payment intent:', updateErr)
      } else {
        console.log('Updated subscription order with payment intent and status:', (order as any).order_number)
      }
    }
  }

  // Process linked subscriptions (auto-create subscriptions when trigger products are purchased)
  // Only process if we have a regular order (not subscription-only checkout)
  if (order && finalUserId && regularItems.length > 0) {
    try {
      const { processLinkedSubscriptions } = await import('@/app/actions/subscriptions')
      
      // Prepare order items for linked subscription processing
      const orderItemsForLinkedSubs = regularItems.map((item: any) => ({
        product_id: item.product_variants?.products?.id,
        variant_id: item.cartItem.variant_id,
        quantity: item.cartItem.quantity,
      })).filter((item: any) => item.product_id && item.variant_id)

      if (orderItemsForLinkedSubs.length > 0) {
        await processLinkedSubscriptions(
          order.id,
          finalUserId,
          orderItemsForLinkedSubs,
          shippingAddressId,
          billingAddressId
        )
      }
    } catch (error) {
      console.error('Error processing linked subscriptions:', error)
      // Don't fail order creation if linked subscription processing fails
    }
  }

  // Send order confirmation email to customer
  // autoCreateAccountFromCheckout sends emails for new/existing accounts it processes
  // We need to send emails for:
  // 1. Existing users (userId exists and no new account was created)
  // 2. Guest customers where account creation failed (emailSent = false)
  // Only send if we have an order (regular order or subscription order)
  let emailSentSuccessfully = false
  if (order) {
    try {
      if (!emailSent) {
        const { sendOrderConfirmationForExistingAccount, sendOrderConfirmationEmail } = await import('@/lib/email')
        const adminSupabase = createAdminSupabaseClient()
        const userEmail = formData.email
        
        try {
          // Check if this is a new account (finalUserId exists but userId didn't)
          // For new accounts, temporary password should have been sent during account creation
          if (finalUserId && !userId) {
            // New account - temporary password was sent during account creation
            // Just send order confirmation email
            const { sendOrderConfirmationEmail } = await import('@/lib/email')
            await sendOrderConfirmationEmail(
              userEmail,
              formData.firstName,
              order.order_number,
              {
                total: finalTotal.toFixed(2),
                paymentStatus: paymentStatus,
                includeAccountAccess: true, // Flag to include account access info in email
              }
            )
            emailSentSuccessfully = true
            console.log('Order confirmation email sent to new account:', userEmail)
          } else if (finalUserId) {
            // Existing account - send order confirmation
            const { sendOrderConfirmationForExistingAccount } = await import('@/lib/email')
            await sendOrderConfirmationForExistingAccount(
              userEmail,
              formData.firstName,
              order.order_number,
              null, // No magic link
              {
                total: finalTotal.toFixed(2),
                paymentStatus: paymentStatus,
              }
            )
            emailSentSuccessfully = true
            console.log('Order confirmation email sent to existing account:', userEmail)
          } else {
            // No account - send regular order confirmation
            const { sendOrderConfirmationEmail } = await import('@/lib/email')
            await sendOrderConfirmationEmail(
              userEmail,
              formData.firstName,
              order.order_number,
              {
                total: finalTotal.toFixed(2),
                paymentStatus: paymentStatus,
              }
            )
            emailSentSuccessfully = true
            console.log('Order confirmation email sent (guest checkout) to:', userEmail)
          }
        } catch (emailError: any) {
          console.error('[createOrder] Error sending order confirmation email:', {
            error: emailError,
            message: emailError?.message,
            stack: emailError?.stack,
            email: userEmail,
            orderNumber: order.order_number,
            orderId: order.id,
            timestamp: new Date().toISOString(),
          })
          try {
            // Final fallback: send basic order confirmation
            await sendOrderConfirmationEmail(
              userEmail,
              formData.firstName,
              order.order_number,
              {
                total: finalTotal.toFixed(2),
                paymentStatus: paymentStatus,
              }
            )
            emailSentSuccessfully = true
            console.log('[createOrder] Order confirmation email sent (final fallback) to:', userEmail)
          } catch (fallbackError: any) {
            console.error('[createOrder] CRITICAL: Failed to send order confirmation email (all attempts failed):', {
              error: fallbackError,
              message: fallbackError?.message,
              stack: fallbackError?.stack,
              email: userEmail,
              orderNumber: order.order_number,
              orderId: order.id,
              timestamp: new Date().toISOString(),
              originalError: emailError?.message,
            })
            // Log to database or external service for monitoring
            // Don't fail order creation if email fails, but log it for investigation
            // TODO: Consider storing failed email attempts in database for retry
          }
        }
      } else {
        emailSentSuccessfully = true // Email was sent by autoCreateAccountFromCheckout
        console.log('Order confirmation email sent by autoCreateAccountFromCheckout to:', formData.email)
      }
      if (emailSentSuccessfully && order) {
        await logOrderAction(
          'confirmation_email_sent',
          `Order confirmation email sent to ${formData.email}`,
          order.id,
          order.order_number,
          { email: formData.email }
        )
      }
    } catch (error: any) {
      console.error('Error in order confirmation email flow:', {
        error: error,
        message: error?.message,
        stack: error?.stack,
        email: formData.email,
        orderNumber: order?.order_number,
      })
      // Don't fail order creation if email fails, but log it for investigation
    }
    
    // Log if email was not sent for monitoring
    if (!emailSentSuccessfully) {
      console.error('WARNING: Order confirmation email was NOT sent for order:', {
        orderId: order.id,
        orderNumber: order.order_number,
        email: formData.email,
        userId: finalUserId || userId,
      })
    }
  }

  // Send admin notification email (only if we have an order)
  if (order) {
    try {
      const { sendAdminNewOrderEmail } = await import('@/lib/email')
      
      // Get order items for admin email
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('product_title, variant_color, quantity, unit_price, line_total')
        .eq('order_id', order.id)

      if (orderItemsData) {
        await sendAdminNewOrderEmail(
          order.order_number,
          `${formData.firstName} ${formData.lastName}`,
          formData.email,
          finalTotal.toFixed(2),
          orderItemsData.map(item => ({
            product_title: item.product_title,
            variant_color: item.variant_color || undefined,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
          }))
        )
      }
    } catch (error) {
      console.error('Error sending admin notification email:', error)
    }
  }

  // Clear cart
  if (finalUserId) {
    await supabase.from('cart_items').delete().eq('user_id', finalUserId)
  } else {
    await supabase.from('cart_items').delete().eq('session_id', sessionId)
  }

  // Record promotion usage if applicable (only if we have an order)
  if (order && formData.discountCode) {
    const { data: promotion } = await supabase
      .from('promotions')
      .select('id')
      .eq('code', normalizePromoCode(formData.discountCode || ''))
      .single()

    if (promotion) {
      await supabase.from('promotion_usage').insert({
        promotion_id: promotion.id,
        user_id: finalUserId || null,
        order_id: order.id,
      })

      // Update promotion usage count
      const { data: currentPromo } = await supabase
        .from('promotions')
        .select('usage_count')
        .eq('id', promotion.id)
        .single()

      if (currentPromo) {
        await supabase
          .from('promotions')
          .update({ usage_count: (currentPromo.usage_count || 0) + 1 })
          .eq('id', promotion.id)
      }
    }
  }

  // Get affiliate code and click ID from cookies
  const affiliateCode = cookieStore.get('affiliate_ref')?.value || undefined
  const affiliateClickId = cookieStore.get('affiliate_click_id')?.value || undefined

  // Handle affiliate tracking and commission creation (only if we have an order)
  if (order && affiliateCode) {
    try {
      const { getAffiliateByCode, createAffiliateOrder } = await import('@/app/actions/affiliates')
      const affiliateResult = await getAffiliateByCode(affiliateCode)
      
      if (affiliateResult.success && affiliateResult.data && affiliateResult.data.status === 'active') {
        const affiliate = affiliateResult.data
        
        // Get affiliate tier to determine commission rate
        let commissionRate = 0
        let commissionType: 'percentage' | 'fixed' = 'percentage'
        
        if (affiliate.tier_id) {
          const { getAffiliateTiers } = await import('@/app/actions/affiliates')
          const tiersResult = await getAffiliateTiers()
          if (tiersResult.success && tiersResult.data) {
            const tier = tiersResult.data.find(t => t.id === affiliate.tier_id)
            if (tier) {
              commissionRate = tier.commission_rate
              commissionType = tier.commission_type || 'percentage'
            }
          }
        }
        
        // Calculate commission
        const commissionAmount = commissionType === 'percentage'
          ? (parseFloat(order.total?.toString() || '0') * commissionRate) / 100
          : commissionRate
        
        // Find affiliate link if click ID exists
        let affiliateLinkId: string | undefined
        if (affiliateClickId) {
          const { data: click } = await supabase
            .from('affiliate_clicks')
            .select('affiliate_link_id')
            .eq('click_id', affiliateClickId)
            .single()
          
          if (click) {
            affiliateLinkId = click.affiliate_link_id
          }
        }
        
        // Create affiliate order record
        const createAffiliateOrderResult = await createAffiliateOrder({
          affiliate_id: affiliate.id,
          order_id: order.id,
          affiliate_link_id: affiliateLinkId,
          click_id: affiliateClickId,
          referral_code: affiliateCode,
          order_number: order.order_number,
          order_total: parseFloat(order.total?.toString() || '0'),
          order_date: order.created_at,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          commission_type: commissionType,
          status: 'pending',
        })
        
        // Update affiliate statistics (using current values + increments)
        const { data: currentAffiliate } = await supabase
          .from('affiliates')
          .select('total_orders, total_revenue, total_commission, pending_commission')
          .eq('id', affiliate.id)
          .single()
        
        if (currentAffiliate) {
          await supabase
            .from('affiliates')
            .update({
              total_orders: (currentAffiliate.total_orders || 0) + 1,
              total_revenue: (currentAffiliate.total_revenue || 0) + parseFloat(order.total?.toString() || '0'),
              total_commission: (currentAffiliate.total_commission || 0) + commissionAmount,
              pending_commission: (currentAffiliate.pending_commission || 0) + commissionAmount,
            })
            .eq('id', affiliate.id)
        }
        
        // Mark click as converted if click ID exists
        if (affiliateClickId) {
          await supabase
            .from('affiliate_clicks')
            .update({
              converted: true,
              converted_at: new Date().toISOString(),
              order_id: order.id,
            })
            .eq('click_id', affiliateClickId)
        }
        
        // Update affiliate link stats if link exists
        if (affiliateLinkId) {
          const { data: currentLink } = await supabase
            .from('affiliate_links')
            .select('total_conversions, total_revenue')
            .eq('id', affiliateLinkId)
            .single()
          
          if (currentLink) {
            await supabase
              .from('affiliate_links')
              .update({
                total_conversions: (currentLink.total_conversions || 0) + 1,
                total_revenue: (currentLink.total_revenue || 0) + parseFloat(order.total?.toString() || '0'),
              })
              .eq('id', affiliateLinkId)
          }
        }
      }
    } catch (error) {
      console.error('Error creating affiliate order:', error)
      // Don't fail the main order creation if affiliate tracking fails
    }
  }
  
  // Create marketing attribution record (only if we have an order)
  if (order) {
    try {
      // Get affiliate code and click ID from cookies (if not already set)
      const affiliateCodeForAttribution = affiliateCode || cookieStore.get('affiliate_ref')?.value || undefined
      const affiliateClickIdForAttribution = affiliateClickId || cookieStore.get('affiliate_click_id')?.value || undefined
      
      // Get UTM parameters from cookies or other tracking sources
      const utmSource = cookieStore.get('utm_source')?.value
      const utmMedium = cookieStore.get('utm_medium')?.value
      const utmCampaign = cookieStore.get('utm_campaign')?.value
      const utmTerm = cookieStore.get('utm_term')?.value
      
      // Get platform click IDs
      const gclid = cookieStore.get('gclid')?.value
      const fbclid = cookieStore.get('fbclid')?.value
      const ttclid = cookieStore.get('ttclid')?.value
      
      // Determine source
      let source = 'direct'
      if (affiliateCodeForAttribution) {
        source = 'affiliate'
      } else if (fbclid) {
        source = 'meta'
      } else if (gclid) {
        source = 'google'
      } else if (ttclid) {
        source = 'tiktok'
      } else if (utmSource) {
        source = utmSource.toLowerCase()
      }
      
      // Get affiliate ID if exists
      let affiliateId: string | undefined
      if (affiliateCodeForAttribution) {
        const { getAffiliateByCode } = await import('@/app/actions/affiliates')
        const affiliateResult = await getAffiliateByCode(affiliateCodeForAttribution)
        if (affiliateResult.success && affiliateResult.data) {
          affiliateId = affiliateResult.data.id
        }
      }
      
      // Create attribution record
      await supabase
        .from('marketing_attribution')
        .insert({
          order_id: order.id,
          source,
          medium: utmMedium || (affiliateCodeForAttribution ? 'affiliate' : 'direct'),
          campaign: utmCampaign,
          term: utmTerm,
          click_id: affiliateClickIdForAttribution,
          gclid,
          fbclid,
          ttclid,
          affiliate_id: affiliateId,
          affiliate_code: affiliateCodeForAttribution,
          conversion_at: order.created_at,
          first_touch_at: order.created_at, // Simplified - in production, track from first visit
          last_touch_at: order.created_at,
        })
    } catch (error) {
      console.error('Error creating marketing attribution:', error)
      // Don't fail order creation if attribution fails
    }

    revalidatePath('/checkout')
    revalidatePath('/account/orders')

    // Log the order creation
    await logOrderAction(
      'created',
      `Order ${order.order_number} created for ${formData.email}`,
      order.id,
      order.order_number,
      {
        customer_email: formData.email,
        customer_name: `${formData.firstName} ${formData.lastName}`,
        total: finalTotal.toFixed(2),
        payment_status: paymentStatus,
        is_subscription: !!subscriptionId,
        is_guest: !finalUserId,
        discount_code: formData.discountCode || null,
      }
    )

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
    }
  } else if (order) {
    // Subscription-only checkout - we successfully resolved the subscription order
    return {
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
    }
  } else {
    console.warn('Subscription-only checkout: subscriptions created but no order found')
    return {
      success: false,
      error: 'Subscription order could not be located. Please contact support.',
    }
  }
}

/**
 * Auto-create account from checkout details (for guest customers)
 * Handles both new customers and return buyers (existing accounts)
 */
async function autoCreateAccountFromCheckout(
  formData: CheckoutFormData,
  orderId: string,
  orderNumber: string
): Promise<string | null> {
  const adminSupabase = createAdminSupabaseClient()
  const { sendOrderConfirmationWithMagicLink, sendOrderConfirmationForExistingAccount } = await import('@/lib/email')
  
  // Get order total for email
  const { data: order } = await adminSupabase
    .from('orders')
    .select('total, payment_status')
    .eq('id', orderId)
    .single()

  const orderTotal = order?.total || '0.00'
  const paymentStatus = order?.payment_status || 'pending'

  try {
    // Check if account already exists with this email
    // Use listUsers and filter by email since getUserByEmail doesn't exist
    const { data: usersList, error: userError } = await adminSupabase.auth.admin.listUsers()
    
    if (userError) {
      console.error('Error checking for existing user:', userError)
      return null
    }

    const existingUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === formData.email.toLowerCase())

    if (existingUser) {
      // Account exists - link order and send confirmation with magic link
      const userId = existingUser.id

      // Update order with user_id
      await adminSupabase
        .from('orders')
        .update({ user_id: userId })
        .eq('id', orderId)

      // Ensure profile exists and has role='customer'
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('first_name, last_name, role, phone')
        .eq('id', userId)
        .single()

      // Update profile if needed - ensure role='customer' and update name/phone if missing
      const profileUpdates: any = {}
      if (!profile?.first_name) profileUpdates.first_name = formData.firstName
      if (!profile?.last_name) profileUpdates.last_name = formData.lastName
      if (!profile?.phone && formData.phone) profileUpdates.phone = formData.phone
      if (profile?.role !== 'customer') profileUpdates.role = 'customer'

      if (Object.keys(profileUpdates).length > 0) {
        await adminSupabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId)
      }

      // If profile doesn't exist, create it
      if (!profile) {
        await adminSupabase
          .from('profiles')
          .insert({
            id: userId,
            email: formData.email,
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
            role: 'customer',
          })
      }

      // Generate magic link for existing account
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
      let magicLink = null
      let linkError = null
      try {
        const linkResult = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: formData.email,
          options: {
            redirectTo: `${siteUrl}/auth/callback?redirect_to=/account`,
          },
        })
        magicLink = linkResult.data
        linkError = linkResult.error
        
        if (linkError) {
          console.error('[autoCreateAccountFromCheckout] Error generating magic link for existing account:', {
            error: linkError,
            message: linkError.message,
            email: formData.email,
            orderNumber,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (linkGenError: any) {
        console.error('[autoCreateAccountFromCheckout] Exception generating magic link for existing account:', {
          error: linkGenError,
          message: linkGenError?.message,
          stack: linkGenError?.stack,
          email: formData.email,
          orderNumber,
          timestamp: new Date().toISOString(),
        })
        linkError = linkGenError
      }

      if (!linkError && magicLink?.properties?.action_link) {
        // Send order confirmation with magic link for existing account
        await sendOrderConfirmationForExistingAccount(
          formData.email,
          formData.firstName,
          orderNumber,
          magicLink.properties.action_link,
          {
            total: orderTotal,
            paymentStatus: paymentStatus,
          }
        )
      } else {
        // Fallback: send regular order confirmation
        const { sendOrderConfirmationEmail } = await import('@/lib/email')
        await sendOrderConfirmationEmail(
          formData.email,
          formData.firstName,
          orderNumber,
          {
            total: orderTotal,
            paymentStatus: paymentStatus,
          }
        )
      }

      return userId
    } else {
      // New account - create user and profile
      // Generate secure temporary password (won't be used if magic link is sent)
      const tempPassword = randomBytes(16).toString('hex')

      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: formData.email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
        },
      })

      if (createError || !newUser?.user) {
        // User may already exist (e.g. listUsers pagination missed them) — link order to existing account
        const isEmailExists = (createError as any)?.code === 'email_exists' || (createError as any)?.status === 422
        if (isEmailExists) {
          const { data: existingProfile } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('email', formData.email.trim().toLowerCase())
            .maybeSingle()
          if (existingProfile?.id) {
            const userId = existingProfile.id
            await adminSupabase.from('orders').update({ user_id: userId }).eq('id', orderId)
            const { data: profile } = await adminSupabase.from('profiles').select('first_name, last_name, role, phone').eq('id', userId).single()
            const profileUpdates: any = {}
            if (!profile?.first_name) profileUpdates.first_name = formData.firstName
            if (!profile?.last_name) profileUpdates.last_name = formData.lastName
            if (!profile?.phone && formData.phone) profileUpdates.phone = formData.phone
            if (profile?.role !== 'customer') profileUpdates.role = 'customer'
            if (Object.keys(profileUpdates).length > 0) {
              await adminSupabase.from('profiles').update(profileUpdates).eq('id', userId)
            }
            if (!profile) {
              await adminSupabase.from('profiles').insert({
                id: userId,
                email: formData.email,
                first_name: formData.firstName,
                last_name: formData.lastName,
                phone: formData.phone || null,
                role: 'customer',
              })
            }
            try {
              const linkResult = await adminSupabase.auth.admin.generateLink({
                type: 'magiclink',
                email: formData.email,
                options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/auth/callback?redirect_to=/account` },
              })
              if (!linkResult.error && linkResult.data?.properties?.action_link) {
                await sendOrderConfirmationForExistingAccount(formData.email, formData.firstName, orderNumber, linkResult.data.properties.action_link, { total: orderTotal, paymentStatus: paymentStatus })
              } else {
                const { sendOrderConfirmationEmail } = await import('@/lib/email')
                await sendOrderConfirmationEmail(formData.email, formData.firstName, orderNumber, { total: orderTotal, paymentStatus: paymentStatus })
              }
            } catch (_) {
              const { sendOrderConfirmationEmail } = await import('@/lib/email')
              await sendOrderConfirmationEmail(formData.email, formData.firstName, orderNumber, { total: orderTotal, paymentStatus: paymentStatus })
            }
            return userId
          }
        }
        console.error('Error creating user:', createError)
        return null
      }

      const userId = newUser.user.id

      // Create profile with role='customer'
      const { error: profileError } = await adminSupabase
        .from('profiles')
        .insert({
          id: userId,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone || null,
          role: 'customer',
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Try to delete the auth user if profile creation fails
        await adminSupabase.auth.admin.deleteUser(userId)
        return null
      }

      // Update order with user_id
      await adminSupabase
        .from('orders')
        .update({ user_id: userId })
        .eq('id', orderId)

      // Generate and send temporary password for new account
      try {
        const { sendTemporaryPasswordToCustomer } = await import('@/app/actions/customers')
        const tempPasswordResult = await sendTemporaryPasswordToCustomer(userId)
        
        if (tempPasswordResult.success) {
          // Send order confirmation email (temporary password was sent separately)
          const { sendOrderConfirmationEmail } = await import('@/lib/email')
          await sendOrderConfirmationEmail(
            formData.email,
            formData.firstName,
            orderNumber,
            {
              total: orderTotal,
              paymentStatus: paymentStatus,
              includeAccountAccess: true, // Flag to include account access info in email
            }
          )
        } else {
          // Fallback: send regular order confirmation
          const { sendOrderConfirmationEmail } = await import('@/lib/email')
          await sendOrderConfirmationEmail(
            formData.email,
            formData.firstName,
            orderNumber,
            {
              total: orderTotal,
              paymentStatus: paymentStatus,
            }
          )
        }
      } catch (tempPasswordError: any) {
        console.error('[autoCreateAccountFromCheckout] Error sending temporary password:', {
          error: tempPasswordError,
          message: tempPasswordError?.message,
          email: formData.email,
          orderNumber,
          timestamp: new Date().toISOString(),
        })
        // Fallback: send regular order confirmation
        const { sendOrderConfirmationEmail } = await import('@/lib/email')
        await sendOrderConfirmationEmail(
          formData.email,
          formData.firstName,
          orderNumber,
          {
            total: orderTotal,
            paymentStatus: paymentStatus,
          }
        )
      }

      return userId
    }
  } catch (error) {
    console.error('Error in autoCreateAccountFromCheckout:', error)
    return null
  }
}

/**
 * Ensure customer profile exists for authenticated users
 * Updates profile to ensure role='customer' and fills in missing information
 */
async function ensureCustomerProfile(
  userId: string,
  formData: CheckoutFormData,
  orderId: string,
  orderNumber: string
): Promise<string | null> {
  const adminSupabase = createAdminSupabaseClient()
  
  try {
    // Check if profile exists
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role')
      .eq('id', userId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileError)
      return null
    }

    if (!profile) {
      // Profile doesn't exist - create it
      console.log('Creating missing profile for user:', userId)
      const { error: createError } = await adminSupabase
        .from('profiles')
        .insert({
          id: userId,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone || null,
          role: 'customer',
        })

      if (createError) {
        console.error('Error creating profile:', createError)
        return null
      }
    } else {
      // Profile exists - ensure it has role='customer' and update missing fields
      const updates: any = {}
      
      if (profile.role !== 'customer') {
        updates.role = 'customer'
        console.log('Updating profile role to customer for user:', userId)
      }
      
      if (!profile.first_name && formData.firstName) {
        updates.first_name = formData.firstName
      }
      
      if (!profile.last_name && formData.lastName) {
        updates.last_name = formData.lastName
      }
      
      if (!profile.phone && formData.phone) {
        updates.phone = formData.phone
      }
      
      if (!profile.email || profile.email !== formData.email) {
        updates.email = formData.email
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await adminSupabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)

        if (updateError) {
          console.error('Error updating profile:', updateError)
          return null
        }
      }
    }

    return userId
  } catch (error) {
    console.error('Error in ensureCustomerProfile:', error)
    return null
  }
}

// Upsert shipping and billing addresses for a user (used during checkout)
// This saves addresses from orders to the customer's address book
async function upsertCustomerAddresses(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  formData: CheckoutFormData
) {
  // Fetch all existing addresses to check for duplicates
  const { data: existingAddresses } = await supabase
    .from('addresses')
    .select('id, type, is_default, address_line1, address_line2, city, state, postal_code, country')
    .eq('user_id', userId)
    .in('type', ['shipping', 'billing'])

  // Helper function to check if address already exists
  const addressExists = (addressData: any, type: 'shipping' | 'billing') => {
    return existingAddresses?.some((addr) => {
      if (addr.type !== type) return false
      return (
        addr.address_line1 === addressData.address_line1 &&
        addr.city === addressData.city &&
        addr.state === addressData.state &&
        addr.postal_code === addressData.postal_code &&
        addr.country === addressData.country &&
        (addr.address_line2 || '') === (addressData.address_line2 || '')
      )
    })
  }

  // Save shipping address if it doesn't already exist
  const shippingData = formData.shippingAddress
  if (shippingData?.address_line1 && shippingData.city && shippingData.state && shippingData.postal_code && shippingData.country) {
    if (!addressExists(shippingData, 'shipping')) {
      // Check if user has any default shipping address
      const hasDefaultShipping = existingAddresses?.some((a) => a.type === 'shipping' && a.is_default)
      
      // Get valid country codes to validate
      const { data: validCountries } = await supabase
        .from('countries')
        .select('code')
        .eq('is_active', true)
        .eq('shipping_enabled', true)
      
      const validCountryCodes = new Set(validCountries?.map(c => c.code) || ['US', 'CA', 'GB', 'AU'])
      const normalizedCountry = validCountryCodes.has(shippingData.country?.toUpperCase() || '') 
        ? shippingData.country.toUpperCase() 
        : 'US'

      await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          type: 'shipping',
          is_default: !hasDefaultShipping, // Set as default if no default exists
          address_line1: shippingData.address_line1,
          address_line2: shippingData.address_line2 || null,
          city: shippingData.city,
          state: shippingData.state,
          postal_code: shippingData.postal_code,
          country: normalizedCountry,
          phone: formData.phone || null,
        })
    }
  }

  // Save billing address if it doesn't already exist
  const billingData = formData.billingAddress || formData.shippingAddress
  if (billingData?.address_line1 && billingData.city && billingData.state && billingData.postal_code && billingData.country) {
    // Only save billing if it's different from shipping
    const isBillingDifferent = formData.billingAddress && 
      (billingData.address_line1 !== shippingData?.address_line1 ||
       billingData.city !== shippingData?.city ||
       billingData.state !== shippingData?.state ||
       billingData.postal_code !== shippingData?.postal_code ||
       billingData.country !== shippingData?.country)
    
    if (isBillingDifferent && !addressExists(billingData, 'billing')) {
      // Check if user has any default billing address
      const hasDefaultBilling = existingAddresses?.some((a) => a.type === 'billing' && a.is_default)
      
      // Get valid country codes to validate
      const { data: validCountries } = await supabase
        .from('countries')
        .select('code')
        .eq('is_active', true)
        .eq('shipping_enabled', true)
      
      const validCountryCodes = new Set(validCountries?.map(c => c.code) || ['US', 'CA', 'GB', 'AU'])
      const normalizedCountry = validCountryCodes.has(billingData.country?.toUpperCase() || '') 
        ? billingData.country.toUpperCase() 
        : 'US'

      await supabase
        .from('addresses')
        .insert({
          user_id: userId,
          type: 'billing',
          is_default: !hasDefaultBilling, // Set as default if no default exists
          address_line1: billingData.address_line1,
          address_line2: billingData.address_line2 || null,
          city: billingData.city,
          state: billingData.state,
          postal_code: billingData.postal_code,
          country: normalizedCountry,
          phone: formData.phone || null,
        })
    }
  }
}

