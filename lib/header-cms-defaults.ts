export type StorefrontHeaderCMS = {
  backgroundColor: string
  textColor: string
  borderColor: string
}

export type AdminHeaderCMS = {
  logo: string
  sidebarTitle: string
  headerBackgroundColor: string
  sidebarBackgroundColor: string
}

export type HeadersCMSContent = {
  storefront: StorefrontHeaderCMS
  admin: AdminHeaderCMS
}

export const HEADERS_CMS_DEFAULTS: HeadersCMSContent = {
  storefront: {
    backgroundColor: "#ffffff",
    textColor: "#111827",
    borderColor: "#e5e7eb",
  },
  admin: {
    logo: "",
    sidebarTitle: "Admin",
    headerBackgroundColor: "#ffffff",
    sidebarBackgroundColor: "#1a1a1a",
  },
}

export function mergeHeadersCMSContent(raw: unknown): HeadersCMSContent {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const storefront =
    saved.storefront && typeof saved.storefront === "object"
      ? (saved.storefront as Partial<StorefrontHeaderCMS>)
      : null
  const admin =
    saved.admin && typeof saved.admin === "object"
      ? (saved.admin as Partial<AdminHeaderCMS>)
      : null

  const str = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim() ? value : fallback

  return {
    storefront: {
      backgroundColor: str(
        storefront?.backgroundColor,
        HEADERS_CMS_DEFAULTS.storefront.backgroundColor
      ),
      textColor: str(storefront?.textColor, HEADERS_CMS_DEFAULTS.storefront.textColor),
      borderColor: str(
        storefront?.borderColor,
        HEADERS_CMS_DEFAULTS.storefront.borderColor
      ),
    },
    admin: {
      logo: typeof admin?.logo === "string" ? admin.logo : HEADERS_CMS_DEFAULTS.admin.logo,
      sidebarTitle: str(admin?.sidebarTitle, HEADERS_CMS_DEFAULTS.admin.sidebarTitle),
      headerBackgroundColor: str(
        admin?.headerBackgroundColor,
        HEADERS_CMS_DEFAULTS.admin.headerBackgroundColor
      ),
      sidebarBackgroundColor: str(
        admin?.sidebarBackgroundColor,
        HEADERS_CMS_DEFAULTS.admin.sidebarBackgroundColor
      ),
    },
  }
}
