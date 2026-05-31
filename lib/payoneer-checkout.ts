import type { ExternalGatewaySettings } from '@/lib/external-gateways'
import { getPayoneerClientIdFromSettings } from '@/lib/external-gateways'

export type PayoneerIntegrationMode = 'hosted' | 'embedded'

export type PayoneerInitParams = {
  settings: ExternalGatewaySettings
  reference: string
  amount: number
  currency: string
  email: string
  country: string
  firstName?: string
  lastName?: string
  returnUrl: string
  cancelUrl: string
}

export type PayoneerInitResult = {
  longId: string
  listUrl?: string
  redirectUrl?: string
  raw: Record<string, unknown>
}

const DEFAULT_API_BASE: Record<'sandbox' | 'live', string> = {
  sandbox: 'https://api.sandbox.oscato.com',
  live: 'https://api.live.oscato.com',
}

export function getPayoneerApiBase(settings: ExternalGatewaySettings): string {
  const configured = settings.api_base_url?.trim() || settings.initialize_url?.trim()
  if (configured) {
    return configured.replace(/\/lists\/?$/i, '').replace(/\/$/, '')
  }
  return settings.mode === 'live' ? DEFAULT_API_BASE.live : DEFAULT_API_BASE.sandbox
}

export function getPayoneerIntegrationMode(settings: ExternalGatewaySettings): PayoneerIntegrationMode {
  return settings.integration_mode === 'embedded' ? 'embedded' : 'hosted'
}

function buildAuthHeaders(settings: ExternalGatewaySettings): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (settings.secret_key?.trim()) {
    headers.Authorization = `Bearer ${settings.secret_key.trim()}`
  }
  return headers
}

function extractLongId(data: Record<string, unknown>): string | undefined {
  const identification = data.identification as Record<string, unknown> | undefined
  if (typeof identification?.longId === 'string' && identification.longId) {
    return identification.longId
  }
  const links = data.links as Record<string, unknown> | undefined
  const self = typeof links?.self === 'string' ? links.self : undefined
  if (self) {
    const segment = self.split('/').filter(Boolean).pop()
    if (segment) return segment
  }
  return undefined
}

function extractRedirectUrl(data: Record<string, unknown>): string | undefined {
  const redirect = data.redirect as Record<string, unknown> | undefined
  if (typeof redirect?.url === 'string' && redirect.url) return redirect.url

  const links = data.links as Record<string, unknown> | undefined
  if (typeof links?.redirect === 'string' && links.redirect) return links.redirect

  const nestedLinks = (data.links as { redirect?: string })?.redirect
  if (nestedLinks) return nestedLinks

  const operationLinks = (data as { links?: { redirect?: string } }).links?.redirect
  if (operationLinks) return operationLinks

  return undefined
}

export async function createPayoneerListSession(params: PayoneerInitParams): Promise<PayoneerInitResult> {
  const { settings, reference, amount, currency, email, country, firstName, lastName, returnUrl, cancelUrl } =
    params

  const clientId = getPayoneerClientIdFromSettings(settings)
  if (!clientId || !settings.secret_key?.trim()) {
    throw new Error('Payoneer Client ID and API token are required')
  }

  const apiBase = getPayoneerApiBase(settings)
  const integrationType = getPayoneerIntegrationMode(settings) === 'hosted' ? 'HOSTED' : 'DISPLAY_NATIVE'

  const listsUrl = `${apiBase}/lists?clientId=${encodeURIComponent(clientId)}`

  const body = {
    integrationType,
    transaction: {
      transactionId: reference,
      country: country || 'US',
      customer: {
        email,
        ...(firstName || lastName
          ? {
              name: {
                ...(firstName ? { firstName } : {}),
                ...(lastName ? { lastName } : {}),
              },
            }
          : {}),
      },
      payment: {
        amount,
        currency: currency || 'USD',
        reference,
      },
      callback: {
        returnUrl,
        cancelUrl,
        summaryUrl: returnUrl,
      },
    },
  }

  const response = await fetch(listsUrl, {
    method: 'POST',
    headers: buildAuthHeaders(settings),
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const message =
      (data.resultInfo as string) ||
      (data.message as string) ||
      `Payoneer list session failed (${response.status})`
    throw new Error(message)
  }

  const longId = extractLongId(data)
  if (!longId) {
    throw new Error('Payoneer did not return a payment session ID (longId)')
  }

  const links = data.links as Record<string, unknown> | undefined
  const listUrl = typeof links?.self === 'string' ? links.self : `${apiBase}/${longId}`

  let redirectUrl = extractRedirectUrl(data)
  if (!redirectUrl && integrationType === 'HOSTED') {
    redirectUrl = `${apiBase}/redirect/${longId}`
  }

  return {
    longId,
    listUrl,
    redirectUrl,
    raw: data,
  }
}

export async function getPayoneerListSession(
  settings: ExternalGatewaySettings,
  longId: string
): Promise<Record<string, unknown>> {
  const apiBase = getPayoneerApiBase(settings)
  const clientId = getPayoneerClientIdFromSettings(settings)
  const url = clientId
    ? `${apiBase}/${encodeURIComponent(longId)}?clientId=${encodeURIComponent(clientId)}`
    : `${apiBase}/${encodeURIComponent(longId)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: buildAuthHeaders(settings),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    const message =
      (data.resultInfo as string) ||
      (data.message as string) ||
      `Payoneer session lookup failed (${response.status})`
    throw new Error(message)
  }
  return data
}

export function isPayoneerPaymentSuccessful(data: Record<string, unknown>): boolean {
  const returnCode = data.returnCode as { name?: string } | undefined
  if (returnCode?.name === 'OK') return true

  const status = data.status as { code?: string; reason?: string } | undefined
  if (status?.code === 'ended' && returnCode?.name !== 'FAILED') return true

  const interaction = data.interaction as { reason?: string } | undefined
  if (interaction?.reason === 'OK') return true

  const payment = data.payment as { status?: string } | undefined
  if (payment?.status && ['paid', 'success', 'completed', 'charged'].includes(payment.status.toLowerCase())) {
    return true
  }

  return false
}

export async function verifyPayoneerPayment(
  settings: ExternalGatewaySettings,
  sessionId: string
): Promise<{ paid: boolean; raw: Record<string, unknown> }> {
  const data = await getPayoneerListSession(settings, sessionId)
  const paid = isPayoneerPaymentSuccessful(data)
  return { paid, raw: data }
}
