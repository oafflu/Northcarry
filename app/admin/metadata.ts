import type { Metadata } from "next"
import { getCMSContent } from "@/app/actions/cms"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await getCMSContent("branding")
    const data = branding.data || {}

    const favicon = data.favicon || "/favicon.ico"
    const siteTitle = data.siteTitle || "BREVI Admin"
    const description = data.metaDescription || "BREVI admin dashboard"

    return {
      title: siteTitle,
      description,
      icons: {
        icon: favicon,
        shortcut: favicon,
        apple: favicon,
      },
    }
  } catch (error) {
    // Fallback metadata if branding fetch fails
    return {
      title: "BREVI Admin",
      description: "BREVI admin dashboard",
      icons: {
        icon: "/favicon.ico",
      },
    }
  }
}
