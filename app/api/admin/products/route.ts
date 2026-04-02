import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()

    // Fetch all active products with regular subscription products
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        title,
        status,
        product_variants (
          id,
          subscription_products (
            id
          )
        )
      `)
      .eq('status', 'active')
      .order('title', { ascending: true })

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return NextResponse.json({ data: [], error: productsError.message }, { status: 500 })
    }

    // Fetch linked subscription products
    // These are products that are referenced via subscription_products.product_id in linked_subscriptions
    const { data: linkedSubsData, error: linkedSubsError } = await supabase
      .from('linked_subscriptions')
      .select(`
        subscription_product_id,
        subscription_products (
          product_id
        )
      `)
      .eq('status', 'active')

    if (linkedSubsError) {
      console.error('Error fetching linked subscriptions:', linkedSubsError)
    }

    // Extract product IDs from linked subscriptions
    const linkedSubscriptionProductIds = new Set<string>()
    if (linkedSubsData) {
      linkedSubsData.forEach((linkedSub: any) => {
        // subscription_products has a product_id field that references the actual product
        // Handle both single object and array responses
        const subscriptionProduct = Array.isArray(linkedSub.subscription_products) 
          ? linkedSub.subscription_products[0] 
          : linkedSub.subscription_products
        const productId = subscriptionProduct?.product_id
        if (productId) {
          linkedSubscriptionProductIds.add(productId)
        }
      })
    }

    // Map products with subscription info (both regular and linked)
    const products = (productsData || []).map((p: any) => {
      // Check for regular subscription products
      const hasRegularSubscription = p.product_variants?.some((v: any) => 
        v.subscription_products && v.subscription_products.length > 0
      )
      // Check if this product is a linked subscription product
      const hasLinkedSubscription = linkedSubscriptionProductIds.has(p.id)
      
      return {
        id: p.id,
        title: p.title,
        hasSubscription: hasRegularSubscription || hasLinkedSubscription
      }
    })

    return NextResponse.json({ data: products, error: null })
  } catch (error: any) {
    console.error('Error in products API:', error)
    return NextResponse.json({ data: [], error: error.message }, { status: 500 })
  }
}

