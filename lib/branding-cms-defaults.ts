export type BrandingCMSContent = {
  logo: string
  siteName: string
}

export const BRANDING_CMS_DEFAULTS: BrandingCMSContent = {
  logo: "/brevi-logo.png",
  siteName: "BREVI",
}

export function mergeBrandingCMSContent(raw: unknown): BrandingCMSContent {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    logo:
      typeof saved.logo === "string" && saved.logo.trim()
        ? saved.logo
        : BRANDING_CMS_DEFAULTS.logo,
    siteName:
      typeof saved.siteName === "string" && saved.siteName.trim()
        ? saved.siteName
        : BRANDING_CMS_DEFAULTS.siteName,
  }
}
