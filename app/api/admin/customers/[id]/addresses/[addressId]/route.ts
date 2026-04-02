import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'

// PATCH - Update an address
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id: customerId, addressId } = await params
    const supabase = createAdminSupabaseClient()
    const body = await request.json()

    if (!customerId || !addressId) {
      return NextResponse.json(
        { error: 'Customer ID and Address ID are required' },
        { status: 400 }
      )
    }

    // Verify the address belongs to this customer and get its current type
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id, user_id, type')
      .eq('id', addressId)
      .eq('user_id', customerId)
      .single()

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found or does not belong to this customer' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults of the same type
    if (body.is_default) {
      const addressType = body.type || existingAddress.type
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', customerId)
        .eq('type', addressType)
        .neq('id', addressId)
    }

    const updateData: any = {}
    if (body.type !== undefined) updateData.type = body.type
    if (body.is_default !== undefined) updateData.is_default = body.is_default
    if (body.address_line1 !== undefined) updateData.address_line1 = body.address_line1
    if (body.address_line2 !== undefined) updateData.address_line2 = body.address_line2 || null
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.postal_code !== undefined) updateData.postal_code = body.postal_code
    if (body.country !== undefined) updateData.country = body.country

    const { data, error } = await supabase
      .from('addresses')
      .update(updateData)
      .eq('id', addressId)
      .eq('user_id', customerId)
      .select()
      .single()

    if (error) {
      console.error('Error updating address:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update address' },
        { status: 500 }
      )
    }

    return NextResponse.json({ address: data })
  } catch (error: any) {
    console.error('Error updating address:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id: customerId, addressId } = await params
    const supabase = createAdminSupabaseClient()

    if (!customerId || !addressId) {
      return NextResponse.json(
        { error: 'Customer ID and Address ID are required' },
        { status: 400 }
      )
    }

    // Verify the address belongs to this customer
    const { data: existingAddress } = await supabase
      .from('addresses')
      .select('id, user_id')
      .eq('id', addressId)
      .eq('user_id', customerId)
      .single()

    if (!existingAddress) {
      return NextResponse.json(
        { error: 'Address not found or does not belong to this customer' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('user_id', customerId)

    if (error) {
      console.error('Error deleting address:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete address' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting address:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

