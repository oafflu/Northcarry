import { US_STATE_OPTIONS } from '@/lib/us-states'

/** Flat sales tax rate applied when the shipping address is not in an exempt region. */
export const DEFAULT_TAX_RATE = 0.08

const US_STATE_NAME_TO_CODE = new Map(
  US_STATE_OPTIONS.map((s) => [s.name.toUpperCase(), s.code])
)

/** Normalize shipping `state` for matching (US: 2-letter code, including from full state name). */
export function normalizeStateForTaxMatch(countryCode: string, state: string | undefined): string {
  const s = (state || '').trim()
  if (!s) return ''
  const c = countryCode.trim().toUpperCase()
  if (c !== 'US') return s.toUpperCase()
  const u = s.toUpperCase()
  if (u.length === 2) return u
  return US_STATE_NAME_TO_CODE.get(u) || u
}

export const TAX_EXEMPTIONS_SETTING_KEY = 'tax_exemptions'

export type TaxExemptionEntry = {
  id: string
  countryCode: string
  stateCode: string | null
  active: boolean
}

export type TaxExemptionsSettingValue = {
  exemptions: TaxExemptionEntry[]
}

export function parseTaxExemptions(value: unknown): TaxExemptionEntry[] {
  if (!value || typeof value !== 'object') return []
  const v = value as Record<string, unknown>
  const raw = v.exemptions
  if (!Array.isArray(raw)) return []
  const out: TaxExemptionEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const countryCode =
      typeof o.countryCode === 'string' ? o.countryCode.trim().toUpperCase() : ''
    if (!id || !countryCode) continue
    let stateCode: string | null = null
    if (typeof o.stateCode === 'string' && o.stateCode.trim()) {
      stateCode = o.stateCode.trim().toUpperCase()
    }
    out.push({
      id,
      countryCode,
      stateCode,
      active: o.active !== false,
    })
  }
  return out
}

/**
 * Exemption match uses the customer's shipping country and state (ISO-style country code, state/province as stored at checkout).
 * - Country-only rule: `stateCode` is null → entire country is exempt.
 * - US (and any country with a rule that includes `stateCode`): exempt only when state matches.
 */
export function isShippingAddressTaxExempt(
  entries: TaxExemptionEntry[],
  country: string | undefined,
  state: string | undefined
): boolean {
  const c = (country || '').trim().toUpperCase()
  if (!c) return false
  const s = normalizeStateForTaxMatch(c, state)
  for (const e of entries) {
    if (!e.active) continue
    if (e.countryCode !== c) continue
    if (!e.stateCode) return true
    if (s && e.stateCode === s) return true
  }
  return false
}

export function taxAmountForCheckout(
  subtotalAfterDiscount: number,
  country: string | undefined,
  state: string | undefined,
  entries: TaxExemptionEntry[]
): number {
  if (isShippingAddressTaxExempt(entries, country, state)) return 0
  return subtotalAfterDiscount * DEFAULT_TAX_RATE
}
