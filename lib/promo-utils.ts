/** Normalize promo code for consistent lookup: strip "Use code:", "Code:", etc., remove all whitespace, uppercase */
export function normalizePromoCode(code: string): string {
  if (!code || typeof code !== 'string') return ''
  const stripped = code.replace(/^(use\s+code|code|promo)[\s:]*/gi, '').trim()
  return stripped.replace(/\s+/g, '').toUpperCase()
}
