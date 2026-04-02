import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const REPLY_LOCAL_PART = process.env.TICKET_REPLY_LOCAL_PART || "hello"
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://brevibrushes.com"
const REPLY_DOMAIN =
  process.env.TICKET_REPLY_DOMAIN ||
  SITE_ORIGIN.replace("https://", "").replace("http://", "")

async function requireSupportAccess() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false as const, status: 401, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const allowed = profile?.role === "admin" || profile?.role === "support"
  if (!allowed) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }

  return { ok: true as const, userId: user.id, role: profile?.role || "unknown" }
}

function extractTicketIdFromAddress(address: string) {
  const regex = new RegExp(`${REPLY_LOCAL_PART}\\+([a-f0-9-]+)@`, "i")
  const match = address.match(regex)
  return match?.[1] || null
}

export async function GET(request: NextRequest) {
  const auth = await requireSupportAccess()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const sampleTicketId = "00000000-0000-4000-8000-000000000000"
  const sampleReplyAddress = `${REPLY_LOCAL_PART}+${sampleTicketId}@${REPLY_DOMAIN}`
  const origin = request.nextUrl.origin

  return NextResponse.json({
    success: true,
    data: {
      viewerRole: auth.role,
      webhookEndpoint: `${origin}/api/tickets/email-reply`,
      replyConfig: {
        localPart: REPLY_LOCAL_PART,
        domain: REPLY_DOMAIN,
        usesExplicitReplyDomain: Boolean(process.env.TICKET_REPLY_DOMAIN),
      },
      sampleReplyAddress,
      parser: {
        extractedTicketId: extractTicketIdFromAddress(sampleReplyAddress),
      },
      checks: {
        isUuidPatternAccepted: Boolean(extractTicketIdFromAddress(sampleReplyAddress)),
      },
      note:
        "Inbound provider (Mailgun/O365/etc.) must route this reply domain/local-part to the webhook endpoint.",
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireSupportAccess()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const toAddress = String(body?.toAddress || "").trim()
  if (!toAddress) {
    return NextResponse.json({ error: "toAddress is required" }, { status: 400 })
  }

  const extractedTicketId = extractTicketIdFromAddress(toAddress)
  return NextResponse.json({
    success: true,
    data: {
      toAddress,
      extractedTicketId,
      matched: Boolean(extractedTicketId),
      expectedPattern: `${REPLY_LOCAL_PART}+<ticket-uuid>@${REPLY_DOMAIN}`,
    },
  })
}

