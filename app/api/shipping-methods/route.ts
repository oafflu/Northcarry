import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    // Use admin client to bypass RLS for reading shipping method settings
    // This allows guest users to see available shipping methods
    const adminSupabase = createAdminSupabaseClient()
    
    // Get shipping methods from admin settings
    const { data: shippingSetting } = await adminSupabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'shipping_methods')
      .single()

    let shippingMethods = (shippingSetting?.setting_value as any[]) || []

    if (shippingMethods.length === 0) {
      // Return default shipping methods if none configured
      return NextResponse.json({ 
        data: [
          { id: 'standard', name: 'Standard Shipping', price: 0, enabled: true, description: 'Free standard shipping', estimatedDaysMin: 7, estimatedDaysMax: 14, showEstimatedDays: true },
          { id: 'express', name: 'Express Shipping', price: 4.99, enabled: true, description: 'Fast express delivery', estimatedDaysMin: 2, estimatedDaysMax: 5, showEstimatedDays: true },
        ], 
        error: null 
      })
    }

    // Migrate legacy single estimatedDays to range format
    shippingMethods = shippingMethods.map((method: any) => {
      // If has legacy estimatedDays but no range, convert it
      if (method.estimatedDays && (method.estimatedDaysMin === undefined || method.estimatedDaysMax === undefined)) {
        return {
          ...method,
          estimatedDaysMin: method.estimatedDays,
          estimatedDaysMax: method.estimatedDays,
        }
      }
      // Ensure both min and max are set if one is set
      if (method.estimatedDaysMin !== undefined && method.estimatedDaysMax === undefined) {
        return {
          ...method,
          estimatedDaysMax: method.estimatedDaysMin,
        }
      }
      if (method.estimatedDaysMax !== undefined && method.estimatedDaysMin === undefined) {
        return {
          ...method,
          estimatedDaysMin: method.estimatedDaysMax,
        }
      }
      return method
    })

    // Filter to only return enabled methods
    const enabledMethods = shippingMethods.filter((method: any) => method.enabled)
    
    return NextResponse.json({ data: enabledMethods, error: null })
  } catch (error: any) {
    console.error('Error fetching shipping methods:', error)
    // Return default shipping methods on error
    return NextResponse.json({ 
      data: [
        { id: 'standard', name: 'Standard Shipping', price: 0, enabled: true, description: 'Free standard shipping', estimatedDaysMin: 7, estimatedDaysMax: 14, showEstimatedDays: true },
        { id: 'express', name: 'Express Shipping', price: 4.99, enabled: true, description: 'Fast express delivery', estimatedDaysMin: 2, estimatedDaysMax: 5, showEstimatedDays: true },
      ], 
      error: null 
    })
  }
}

