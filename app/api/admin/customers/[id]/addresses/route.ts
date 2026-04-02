import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// GET - Get all addresses for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = createAdminSupabaseClient()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching addresses:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch addresses' },
        { status: 500 }
      )
    }

    return NextResponse.json({ addresses: addresses || [] })
  } catch (error: any) {
    console.error('Error fetching addresses:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new address for a customer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.address_line1 || !body.city || !body.state || !body.postal_code || !body.country) {
      return NextResponse.json(
        { error: 'Missing required address fields' },
        { status: 400 }
      )
    }

    // If this is set as default, unset other defaults of the same type
    if (body.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', customerId)
        .eq('type', body.type)
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: customerId,
        type: body.type || 'shipping',
        is_default: body.is_default || false,
        address_line1: body.address_line1,
        address_line2: body.address_line2 || null,
        city: body.city,
        state: body.state,
        postal_code: body.postal_code,
        country: body.country || 'US',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating address:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create address' },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: data })
  } catch (error: any) {
    console.error('Error creating address:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

