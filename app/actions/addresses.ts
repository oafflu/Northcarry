'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface AddressData {
  type: 'shipping' | 'billing'
  is_default: boolean
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  phone?: string
}

export async function getAddresses() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching addresses:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

export async function createAddress(address: AddressData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // If this is set as default, unset other defaults of the same type
  if (address.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('type', address.type)
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: user.id,
      ...address,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating address:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function updateAddress(id: string, address: Partial<AddressData>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // If setting as default, unset other defaults of the same type
  if (address.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('type', address.type)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('addresses')
    .update({
      ...address,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating address:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteAddress(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting address:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function setDefaultAddress(id: string, type: 'shipping' | 'billing') {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Unset other defaults of the same type
  await supabase
    .from('addresses')
    .update({ is_default: false })
    .eq('user_id', user.id)
    .eq('type', type)

  // Set this as default
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error setting default address:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

