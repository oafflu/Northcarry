import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { CartProvider } from "@/lib/cart-context"
import { AuthProvider } from "@/lib/auth-context"
import { NotificationsProvider } from "@/lib/notifications-context"
import { CartDrawer } from "@/components/cart-drawer"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { getCMSContent } from "@/app/actions/cms"
import { AffiliateTracker } from "@/components/affiliate-tracker"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

async function getMetadata(): Promise<Metadata> {
  try {
    const branding = await getCMSContent('branding')
    const data = branding.data

    if (data) {
      return {
        title: data.siteTitle || "BREVI - Premium Toothbrushes",
        description: data.metaDescription || "Premium quality toothbrushes for a healthier smile",
        keywords: data.metaKeywords?.split(',').map(k => k.trim()) || [],
        authors: [{ name: data.author || "BREVI" }],
        creator: data.author || "BREVI",
        publisher: data.author || "BREVI",
        robots: data.robots || "index, follow",
        alternates: {
          canonical: data.canonicalUrl || "https://brevibrushes.com",
        },
        openGraph: {
          title: data.ogTitle || data.siteTitle || "BREVI - Premium Toothbrushes",
          description: data.ogDescription || data.metaDescription || "Premium quality toothbrushes for a healthier smile",
          url: data.canonicalUrl || "https://brevibrushes.com",
          siteName: data.siteName || "BREVI",
          images: [
            {
              url: data.ogImage || "/images/brevi_banner_web.png",
              width: 1200,
              height: 630,
              alt: data.ogTitle || data.siteTitle || "BREVI",
            },
          ],
          locale: data.language || "en",
          type: data.ogType || "website",
        },
        twitter: {
          card: data.twitterCard || "summary_large_image",
          site: data.twitterSite || "@brevibrushes",
          creator: data.twitterCreator || "@brevibrushes",
          title: data.ogTitle || data.siteTitle || "BREVI - Premium Toothbrushes",
          description: data.ogDescription || data.metaDescription || "Premium quality toothbrushes for a healthier smile",
          images: [data.ogImage || "/images/brevi_banner_web.png"],
        },
        icons: {
          icon: data.favicon || "/favicon.ico",
          shortcut: data.favicon || "/favicon.ico",
          apple: data.favicon || "/favicon.ico",
        },
        metadataBase: new URL(data.canonicalUrl || "https://brevibrushes.com"),
      }
    }
  } catch (error: any) {
    // Silently fail during build time - cookies may not be available
    // Only log in development
    if (process.env.NODE_ENV === 'development' && error?.message && !error.message.includes('cookies')) {
      console.error('Error loading branding metadata:', error)
    }
  }

  // Fallback metadata
  return {
    title: "BREVI - Premium Toothbrushes",
    description: "Premium quality toothbrushes for a healthier smile",
    icons: {
      icon: "/favicon.ico",
    },
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return await getMetadata()
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Get language from branding
  let lang = "en"
  try {
    const branding = await getCMSContent('branding')
    if (branding.data?.language) {
      lang = branding.data.language
    }
  } catch (error: any) {
    // Silently fail during build time - cookies may not be available
    // Use default language
  }

  // Firebase config for client-side
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const firebaseStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  const firebaseMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  const firebaseAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  const hasFirebaseConfig = !!(
    firebaseApiKey &&
    firebaseAuthDomain &&
    firebaseProjectId &&
    firebaseStorageBucket &&
    firebaseMessagingSenderId &&
    firebaseAppId
  )

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Permissions-Policy" content="unload=*" />
        {hasFirebaseConfig && (
          <>
            <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js" />
            <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js" />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if (!window.firebaseAppsInitialized) {
                    firebase.initializeApp({
                      apiKey: "${firebaseApiKey}",
                      authDomain: "${firebaseAuthDomain}",
                      projectId: "${firebaseProjectId}",
                      storageBucket: "${firebaseStorageBucket}",
                      messagingSenderId: "${firebaseMessagingSenderId}",
                      appId: "${firebaseAppId}"
                    });
                    window.firebaseAppsInitialized = true;
                  }
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ErrorBoundary>
            <AuthProvider>
              <NotificationsProvider>
                <CartProvider>
                  <AffiliateTracker />
                  {children}
                  <CartDrawer />
                </CartProvider>
              </NotificationsProvider>
            </AuthProvider>
          </ErrorBoundary>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
