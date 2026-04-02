'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logSystemAction } from '@/lib/system-logger'

// Get setting by key
export async function getSetting(key: string) {
  try {
    // Use admin client to bypass RLS for reading settings (needed for email config)
    const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminSupabaseClient()
    
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .eq('setting_key', key)
      .single()

    // PGRST116 means no rows found, which is not an error
    if (error && error.code !== 'PGRST116') {
      // Handle HTML error responses (like from Cloudflare)
      let errorMessage = error.message || 'Unknown error'
      
      // If error message contains HTML, extract a cleaner message
      if (errorMessage.includes('<html>') || errorMessage.includes('500 Internal Server Error')) {
        errorMessage = 'Database connection error. Please try again later.'
        console.error('Error fetching setting (network/database error):', {
          key,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
      } else {
        console.error('Error fetching setting:', {
          key,
          code: error.code,
          message: errorMessage,
          details: error.details,
          hint: error.hint,
        })
      }
      
      return { data: null, error: errorMessage }
    }

    return { data: data?.setting_value || null, error: null }
  } catch (err: any) {
    // Catch any unexpected errors (network failures, etc.)
    let errorMessage = 'Failed to fetch setting'
    
    if (err?.message) {
      errorMessage = err.message
    } else if (typeof err === 'string') {
      errorMessage = err
    } else if (err?.toString && typeof err.toString === 'function') {
      const errStr = err.toString()
      // Check if it's HTML content
      if (errStr.includes('<html>') || errStr.includes('500 Internal Server Error')) {
        errorMessage = 'Database connection error. Please try again later.'
      } else {
        errorMessage = errStr
      }
    }
    
    console.error('Unexpected error fetching setting:', {
      key,
      error: err,
      errorType: typeof err,
      errorMessage,
    })
    
    return { data: null, error: errorMessage }
  }
}

// Get all settings by category
export async function getSettingsByCategory(category: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('admin_settings')
    .select('*')
    .eq('setting_category', category)
    .order('setting_key')

  if (error) {
    console.error('Error fetching settings:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

// Save setting
export async function saveSetting(
  key: string,
  value: any,
  category: string,
  description?: string
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('admin_settings')
    .upsert({
      setting_key: key,
      setting_value: value,
      setting_category: category,
      description: description,
    }, {
      onConflict: 'setting_key'
    })

  if (error) {
    console.error('Error saving setting:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings')
  
  // Log the action
  await logSystemAction({
    actionType: 'setting_updated',
    actionCategory: 'settings',
    actionDescription: `Setting "${key}" updated in category "${category}"`,
    resourceType: 'setting',
    resourceName: key,
    actionDetails: {
      category: category,
      description: description || null,
    },
  })
  
  return { success: true }
}

// Get all countries
export async function getCountries() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('sort_order, name')

  if (error) {
    console.error('Error fetching countries:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

/** Map default country code to IANA timezone for campaign scheduling (US default). */
const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  US: 'America/New_York',
  USA: 'America/New_York',
  CA: 'America/Toronto',
  MX: 'America/Mexico_City',
}

export async function getDefaultScheduleTimezone(): Promise<string> {
  const result = await getCountries()
  const countries = result.data || []
  const defaultCountry = countries.find((c: any) => c.is_default)
  const code = defaultCountry?.code?.toUpperCase?.()
  if (code && COUNTRY_TO_TIMEZONE[code]) return COUNTRY_TO_TIMEZONE[code]
  return 'America/New_York'
}

// Save country
export async function saveCountry(country: {
  id?: string
  code: string
  name: string
  currency_code: string
  currency_symbol: string
  is_active: boolean
  is_default: boolean
  sort_order: number
  shipping_enabled?: boolean
}) {
  const supabase = await createServerSupabaseClient()

  if (country.is_default) {
    // Unset other defaults
    await supabase
      .from('countries')
      .update({ is_default: false })
      .neq('code', country.code)
  }

  const { error } = await supabase
    .from('countries')
    .upsert(
      {
        ...country,
        shipping_enabled: country.shipping_enabled ?? true,
      },
      {
        onConflict: 'code'
      }
    )

  if (error) {
    console.error('Error saving country:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/countries')
  return { success: true }
}

// Delete country
export async function deleteCountry(countryId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('countries')
    .delete()
    .eq('id', countryId)

  if (error) {
    console.error('Error deleting country:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/countries')
  return { success: true }
}

// Get all currencies
export async function getCurrencies() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('currencies')
    .select('*')
    .order('is_base DESC, code')

  if (error) {
    console.error('Error fetching currencies:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

// Save currency
export async function saveCurrency(currency: {
  id?: string
  code: string
  name: string
  symbol: string
  symbol_position: string
  decimal_places: number
  exchange_rate: number
  is_active: boolean
  is_base: boolean
}) {
  const supabase = await createServerSupabaseClient()

  if (currency.is_base) {
    // Unset other base currencies
    await supabase
      .from('currencies')
      .update({ is_base: false })
      .neq('code', currency.code)
  }

  const { error } = await supabase
    .from('currencies')
    .upsert(currency, {
      onConflict: 'code'
    })

  if (error) {
    console.error('Error saving currency:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/currencies')
  return { success: true }
}

// Delete currency
export async function deleteCurrency(currencyId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('currencies')
    .delete()
    .eq('id', currencyId)

  if (error) {
    console.error('Error deleting currency:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/currencies')
  return { success: true }
}

// Get all languages
export async function getLanguages() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('languages')
    .select('*')
    .order('sort_order, name')

  if (error) {
    console.error('Error fetching languages:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

// Save language
export async function saveLanguage(language: {
  id?: string
  code: string
  name: string
  native_name: string
  is_active: boolean
  is_default: boolean
  sort_order: number
}) {
  const supabase = await createServerSupabaseClient()

  if (language.is_default) {
    // Unset other defaults
    await supabase
      .from('languages')
      .update({ is_default: false })
      .neq('code', language.code)
  }

  const { error } = await supabase
    .from('languages')
    .upsert(language, {
      onConflict: 'code'
    })

  if (error) {
    console.error('Error saving language:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/languages')
  return { success: true }
}

// Delete language
export async function deleteLanguage(languageId: string) {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('languages')
    .delete()
    .eq('id', languageId)

  if (error) {
    console.error('Error deleting language:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/settings/languages')
  return { success: true }
}

