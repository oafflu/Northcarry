import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { triggerAutomation } from '@/app/actions/email-automations'

// POST - Trigger abandoned cart automation for a specific cart
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { cartId, userEmail, userName } = body
    
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      )
    }
    
    // Trigger abandoned_cart automation
    const result = await triggerAutomation('abandoned_cart', userEmail, {
      name: userName,
    })
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Abandoned cart automation triggered. ${result.triggered} automation(s) executed.`,
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to trigger automation' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error triggering abandoned cart automation:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

