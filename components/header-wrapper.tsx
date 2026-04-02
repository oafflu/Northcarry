import { Header } from "./header"
import { getMenuItems, getTopBar } from "@/app/actions/cms"

// Server component wrapper to fetch CMS data server-side
export async function HeaderWrapper() {
  // Fetch menu items and top bar server-side
  const [menuResult, topBarResult] = await Promise.all([
    getMenuItems(),
    getTopBar(),
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

  return <Header initialMenuItems={menuItems} initialTopBar={topBar} />
}

