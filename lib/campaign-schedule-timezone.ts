/**
 * Campaign schedule timezone helpers.
 * Converts between local date/time in a given IANA timezone and ISO (UTC) for storage.
 */

export const CAMPAIGN_SCHEDULE_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
] as const

export const DEFAULT_CAMPAIGN_TIMEZONE = "America/New_York"

/**
 * Convert local date and time in a given timezone to ISO string (UTC) for storage.
 */
export function localDateTimeInTimezoneToISO(
  dateStr: string,
  timeStr: string,
  tz: string
): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const [hh, mm] = timeStr.split(":").map(Number)
  const monthIndex = m - 1
  const noonUtc = new Date(Date.UTC(y, monthIndex, d, 12, 0, 0))
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const noonInTz = formatter.format(noonUtc)
  const [noonH, noonM] = noonInTz.split(":").map(Number)
  const offsetHours = noonH - 12 + (noonM - 0) / 60
  const localHours = hh + mm / 60
  const utcHours = localHours - offsetHours
  const utcMs = Date.UTC(y, monthIndex, d, 0, 0, 0) + utcHours * 3600 * 1000
  return new Date(utcMs).toISOString()
}

/**
 * Convert an ISO string (UTC) to local date and time in a given timezone for form inputs.
 */
export function isoToLocalDateTimeInTimezone(
  iso: string,
  tz: string
): { date: string; time: string } {
  const d = new Date(iso)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0"
  const year = get("year")
  const month = get("month").padStart(2, "0")
  const day = get("day").padStart(2, "0")
  const hour = get("hour").padStart(2, "0")
  const minute = get("minute").padStart(2, "0")
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
  }
}

/**
 * Get min date and time for schedule inputs in the given timezone (now in that zone).
 */
export function getMinDateTimeInTimezone(tz: string): { date: string; time: string } {
  const now = new Date()
  return isoToLocalDateTimeInTimezone(now.toISOString(), tz)
}

/**
 * Format an ISO date for display in a timezone (e.g. "Jan 26, 2026, 3:00 PM EST").
 * Returns a fallback string for invalid dates so callers never throw.
 */
export function formatScheduledAtInTimezone(iso: string, tz: string): string {
  if (!iso || typeof iso !== "string") return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  try {
    return d.toLocaleString("en-US", {
      timeZone: tz || "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
      timeZoneName: "short",
    })
  } catch {
    return d.toLocaleDateString()
  }
}
