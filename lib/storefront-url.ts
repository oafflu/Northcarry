/**
 * Client-safe absolute URLs for the public storefront (uses NEXT_PUBLIC_SITE_URL).
 */
export function storefrontProductAbsoluteUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const path = `/product/${slug}`
  if (!base) return path
  return `${base}${path}`
}

export function storefrontPathAbsolute(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  if (!base) return normalized
  return `${base}${normalized}`
}
