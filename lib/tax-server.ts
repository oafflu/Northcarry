import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import {
  parseTaxExemptions,
  TAX_EXEMPTIONS_SETTING_KEY,
  type TaxExemptionEntry,
} from '@/lib/tax'

export async function fetchTaxExemptionEntries(): Promise<TaxExemptionEntry[]> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', TAX_EXEMPTIONS_SETTING_KEY)
    .single()
  return parseTaxExemptions(data?.setting_value)
}
