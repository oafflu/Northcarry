import { Header } from "./header"
import { getMenuItems, getTopBar, getCMSContent } from "@/app/actions/cms"
import { mergeBrandingCMSContent } from "@/lib/branding-cms-defaults"
import { mergeHeadersCMSContent } from "@/lib/header-cms-defaults"

// Server component wrapper to fetch CMS data server-side
export async function HeaderWrapper() {
  const [menuResult, topBarResult, brandingResult, headersResult] = await Promise.all([
    getMenuItems(),
    getTopBar(),
    getCMSContent("branding"),
    getCMSContent("headers"),
  ])

  // Extract and sort menu items
  const menuItems = menuResult.data?.items 
    ? menuResult.data.items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    : [
        { id: 1, label: "Home", url: "/", order: 1 },
        { id: 2, label: "Shop Now", url: "/product", order: 2 },
        { id: 3, label: "About Us", url: "#", order: 3 },
      ]

  // Extract top bar data
  const topBar = topBarResult.data || {
    message: "50% OFF TODAY ONLY & FREE SHIPPING ON ALL ORDERS",
    enabled: true,
    bgColor: "#000000",
    textColor: "#ffffff",
  }

  const branding = mergeBrandingCMSContent(brandingResult.data)
  const headers = mergeHeadersCMSContent(headersResult.data)

  return (
    <Header
      initialMenuItems={menuItems}
      initialTopBar={topBar}
      initialBranding={branding}
      initialStorefrontHeader={headers.storefront}
    />
  )
}

