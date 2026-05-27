import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getSetting } from '@/app/actions/settings'
import { EXTERNAL_GATEWAY_LABELS, EXTERNAL_GATEWAY_KEYS } from '@/lib/external-gateways'

export async function GET(req: NextRequest) {
  try {
    // Use admin client to bypass RLS for reading payment method settings
    // This allows guest users to see available payment methods
    const adminSupabase = createAdminSupabaseClient()
    
    // Get Stripe settings
    const { data: stripeSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe')
      .single()

    const stripeConfig = stripeSetting?.setting_value as any

    // Get enabled payment methods from admin settings
    const { data: enabledMethodsSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_payment_methods')
      .single()

    const enabledMethods = (enabledMethodsSetting?.setting_value as Record<string, boolean>) || {}

    // Get payment method images
    const { data: paymentMethodImagesSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_method_images')
      .single()

    const paymentMethodImages = (paymentMethodImagesSetting?.setting_value as Record<string, { imageUrl?: string; cardImages?: Array<{ name: string; url: string; alt: string }> }>) || {}

    // Define available payment method types
    const paymentMethodTypes = [
      { id: 'card', name: 'Card', type: 'card', icon: '💳' },
      { id: 'apple_pay', name: 'Apple Pay', type: 'apple_pay', icon: '🍎' },
      { id: 'google_pay', name: 'Google Pay', type: 'google_pay', icon: 'G' },
      { id: 'link', name: 'Link', type: 'link', icon: '🔗' },
      { id: 'us_bank_account', name: 'US Bank Account', type: 'us_bank_account', icon: '🏦' },
      { id: 'affirm', name: 'Affirm', type: 'affirm', icon: 'A' },
      { id: 'afterpay_clearpay', name: 'Afterpay / Clearpay', type: 'afterpay_clearpay', icon: 'A' },
      { id: 'klarna', name: 'Klarna', type: 'klarna', icon: 'K' },
      { id: 'paypal', name: 'PayPal', type: 'paypal', icon: 'P' },
    ]

    const methods = paymentMethodTypes.map((method) => {
      const methodImages = paymentMethodImages[method.id] || {}
      return {
        id: method.id,
        name: method.name,
        type: method.type,
        stripeType: method.type,
        icon: method.icon,
        enabled:
          stripeConfig?.enabled && stripeConfig?.secret_key
            ? (enabledMethods[method.id] ?? (method.id === 'card'))
            : method.id === 'card',
        category: method.id === 'card' ? 'cards' : 
                  ['apple_pay', 'google_pay', 'link'].includes(method.id) ? 'wallet' : 
                  'buy_now_pay_later',
        imageUrl: methodImages.imageUrl, // Main image for the payment method
        cardImages: methodImages.cardImages, // Card type images (for Card payment method)
      }
    })

    // Add externally integrated gateways (2Checkout, Kora, Chipper, Paystack)
    const externalSettingsEntries = await Promise.all(
      EXTERNAL_GATEWAY_KEYS.map(async (key) => {
        const result = await getSetting(key)
        return { key, settings: (result.data as any) || null }
      })
    )

    const externalMethods = externalSettingsEntries
      .filter(({ settings }) => settings?.enabled === true)
      .map(({ key }) => ({
        id: key,
        name: EXTERNAL_GATEWAY_LABELS[key],
        type: key,
        stripeType: undefined,
        icon: '💳',
        enabled: true,
        category: 'wallet',
        imageUrl: paymentMethodImages[key]?.imageUrl,
        cardImages: undefined,
      }))

    // Filter to only return enabled methods
    const enabledMethodsList = [...methods.filter((method: any) => method.enabled), ...externalMethods]
    
    return NextResponse.json({ data: enabledMethodsList, error: null })
  } catch (error: any) {
    console.error('Error fetching payment methods:', error)
    // Return default card payment method on error
    return NextResponse.json({ 
      data: [{ id: 'card', name: 'Card', type: 'card', stripeType: 'card', enabled: true, category: 'cards', icon: '💳' }], 
      error: null 
    })
  }
}

