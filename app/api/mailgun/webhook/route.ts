import { createHmac, timingSafeEqual } from "crypto"
import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): boolean {
  if (!signingKey || !timestamp || !token || !signature) return false
  const enc = createHmac("sha256", signingKey)
    .update(String(timestamp).concat(String(token)))
    .digest("hex")
  try {
    if (enc.length !== signature.length) return false
    return timingSafeEqual(Buffer.from(enc, "utf8"), Buffer.from(signature, "utf8"))
  } catch {
    return false
  }
}

function parsePayload(body: string): { signature: any; eventData: any } | null {
  const trimmed = body.trim()
  if (!trimmed) return null
  try {
    const j = JSON.parse(trimmed)
    if (j?.signature && j["event-data"]) {
      return { signature: j.signature, eventData: j["event-data"] }
    }
  } catch {
    /* form body */
  }
  try {
    const params = new URLSearchParams(body)
    const sigRaw = params.get("signature")
    const evRaw = params.get("event-data") || params.get("eventData")
    if (sigRaw && evRaw) {
      return {
        signature: JSON.parse(sigRaw),
        eventData: JSON.parse(evRaw),
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function extractCampaignId(eventData: any): string | null {
  const uv = eventData?.["user-variables"] || eventData?.user_variables || {}
  if (uv.campaign_id && typeof uv.campaign_id === "string") {
    const id = uv.campaign_id.trim()
    if (/^[0-9a-f-]{36}$/i.test(id)) return id
  }
  const headers = eventData?.message?.headers || {}
  const h =
    headers["X-Campaign-Id"] ||
    headers["x-campaign-id"] ||
    headers["X-Campaign-ID"]
  if (h && typeof h === "string") {
    const id = h.trim()
    if (/^[0-9a-f-]{36}$/i.test(id)) return id
  }
  const tags: string[] = Array.isArray(eventData?.tags) ? eventData.tags : []
  for (const t of tags) {
    if (typeof t !== "string") continue
    const m = t.match(/^campaign_([0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12})$/i)
    if (m) return m[1]
  }
  return null
}

function mapEventType(mailgunEvent: string): "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | null {
  const e = String(mailgunEvent || "").toLowerCase()
  if (e === "delivered") return "delivered"
  if (e === "opened") return "opened"
  if (e === "clicked") return "clicked"
  if (e === "bounced" || e === "failed" || e === "permanent_fail" || e === "complained") return "bounced"
  if (e === "unsubscribed") return "unsubscribed"
  return null
}

async function resolveWebhookSigningKey(): Promise<string> {
  const env =
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim() ||
    process.env.MAILGUN_HTTP_WEBHOOK_SIGNING_KEY?.trim() ||
    ""
  if (env) return env
  const { getSetting } = await import("@/app/actions/settings")
  const { data, error } = await getSetting("email_provider")
  if (error || data == null) return ""
  let cfg: Record<string, unknown> = {}
  if (typeof data === "string") {
    try {
      cfg = JSON.parse(data) as Record<string, unknown>
    } catch {
      return ""
    }
  } else if (typeof data === "object") {
    cfg = data as Record<string, unknown>
  }
  return String(cfg.mailgun_webhook_signing_key || "").trim()
}

export async function POST(request: Request) {
  const signingKey = await resolveWebhookSigningKey()
  if (!signingKey) {
    console.error(
      "[Mailgun webhook] No signing key: set MAILGUN_WEBHOOK_SIGNING_KEY or add HTTP webhook signing key in /admin/settings/email"
    )
    return new Response("Server misconfigured", { status: 500 })
  }

  const raw = await request.text()
  const parsed = parsePayload(raw)
  if (!parsed) {
    return new Response("Bad Request", { status: 400 })
  }

  const { timestamp, token, signature } = parsed.signature || {}
  if (!verifyMailgunSignature(signingKey, String(timestamp), String(token), String(signature))) {
    return new Response("Unauthorized", { status: 401 })
  }

  const ed = parsed.eventData
  const campaignId = extractCampaignId(ed)
  const recipient = String(ed?.recipient || "").toLowerCase().trim()
  const mgEventId = String(ed?.id || ed?.["event-id"] || `${Date.now()}-${recipient}`)
  const mailgunEvent = ed?.event || ed?.["event-type"]

  if (!campaignId || !recipient || !recipient.includes("@")) {
    return new Response("OK", { status: 200 })
  }

  const eventType = mapEventType(mailgunEvent)
  if (!eventType) {
    return new Response("OK", { status: 200 })
  }

  const supabase = createAdminSupabaseClient()

  const { data: existing } = await supabase
    .from("email_campaign_events")
    .select("id")
    .eq("campaign_id", campaignId)
    .contains("event_data", { mg_event_id: mgEventId })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return new Response("OK", { status: 200 })
  }

  const { data: campaignRow } = await supabase
    .from("email_campaigns")
    .select("id")
    .eq("id", campaignId)
    .maybeSingle()

  if (!campaignRow) {
    return new Response("OK", { status: 200 })
  }

  let subscriberId: string | null = null
  const { data: sub } = await supabase
    .from("email_subscribers")
    .select("id")
    .ilike("email", recipient)
    .maybeSingle()
  if (sub?.id) subscriberId = sub.id

  const { error: insErr } = await supabase.from("email_campaign_events").insert({
    campaign_id: campaignId,
    subscriber_id: subscriberId,
    email: recipient,
    event_type: eventType,
    event_data: {
      mg_event_id: mgEventId,
      mailgun_event: mailgunEvent,
      reason: ed?.reason || ed?.["delivery-status"]?.message || null,
    },
  })

  if (insErr) {
    console.error("[Mailgun webhook] insert event:", insErr.message)
    return new Response("OK", { status: 200 })
  }

  const col =
    eventType === "delivered"
      ? "delivered_count"
      : eventType === "opened"
        ? "open_count"
        : eventType === "clicked"
          ? "click_count"
          : eventType === "bounced"
            ? "bounce_count"
            : eventType === "unsubscribed"
              ? "unsubscribe_count"
              : null

  if (col) {
    const { data: camp } = await supabase
      .from("email_campaigns")
      .select(col)
      .eq("id", campaignId)
      .single()
    const cur = (camp as any)?.[col] ?? 0
    await supabase
      .from("email_campaigns")
      .update({ [col]: Number(cur) + 1 })
      .eq("id", campaignId)
  }

  // Keep marketing opt-out in sync with admin customer view + segments (same as /api/unsubscribe)
  if (eventType === "unsubscribed" && recipient) {
    const unsubscribedAt = new Date().toISOString()
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", recipient)
      .eq("role", "customer")
      .maybeSingle()
    await supabase.from("email_subscribers").upsert(
      {
        email: recipient,
        user_id: profileRow?.id ?? null,
        status: "unsubscribed",
        unsubscribed_at: unsubscribedAt,
      },
      { onConflict: "email" }
    )
    await supabase
      .from("newsletter_subscriptions")
      .update({
        status: "unsubscribed",
        unsubscribed_at: unsubscribedAt,
        updated_at: unsubscribedAt,
      })
      .eq("email", recipient)
  }

  return new Response("OK", { status: 200 })
}
