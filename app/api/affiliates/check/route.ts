import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ isAffiliate: false }, { status: 200 })
    }

    const supabase = createAdminSupabaseClient()
    const { data: affiliate, error } = await supabase
      .from('affiliates')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking affiliate status:', error)
      return NextResponse.json({ isAffiliate: false }, { status: 200 })
    }

    return NextResponse.json({ 
      isAffiliate: !!affiliate && (affiliate.status === 'active' || affiliate.status === 'pending') 
    })
  } catch (error: any) {
    console.error('Error in affiliate check API:', error)
    return NextResponse.json({ isAffiliate: false }, { status: 200 })
  }
}

