import { NextRequest, NextResponse } from "next/server"
import { trackAffiliateClick } from "@/app/actions/affiliates"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const affiliateCode = searchParams.get("ref")
    const linkId = searchParams.get("link_id") || undefined

    if (!affiliateCode) {
      return NextResponse.json({ success: false, error: "Missing affiliate code" }, { status: 400 })
    }

    // Get client information
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    const referrer = request.headers.get("referer") || request.headers.get("referrer") || null

    // Get or create session ID
    const cookieStore = await cookies()
    let sessionId = cookieStore.get("session_id")?.value
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      cookieStore.set("session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
    }

    // Get user ID if authenticated (from auth token in cookie/header)
    let userId: string | undefined
    try {
      const authToken = request.cookies.get("sb-access-token")?.value || 
                       request.headers.get("authorization")?.replace("Bearer ", "")
      // Note: In production, you'd decode the JWT to get user ID
      // For now, we'll track it separately if available
    } catch (e) {
      // User not authenticated, continue with session tracking
    }

    // Track the click
    const result = await trackAffiliateClick(affiliateCode, linkId || undefined, {
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer: referrer || undefined,
      session_id: sessionId,
      user_id: userId,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    // Set affiliate cookie for checkout attribution
    const response = NextResponse.json({ success: true, clickId: result.clickId })
    
    // Store affiliate code in cookie for 30 days
    response.cookies.set("affiliate_ref", affiliateCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    // Store click ID for conversion tracking
    if (result.clickId) {
      response.cookies.set("affiliate_click_id", result.clickId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    return response
  } catch (error: any) {
    console.error("Error tracking affiliate click:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

