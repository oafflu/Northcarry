export const EXTERNAL_GATEWAY_KEYS = [
  '2checkout',
  'kora',
  'chipper',
  'paystack',
  'payoneer',
] as const

export type ExternalGatewayKey = (typeof EXTERNAL_GATEWAY_KEYS)[number]

export const EXTERNAL_GATEWAY_LABELS: Record<ExternalGatewayKey, string> = {
  '2checkout': '2Checkout',
  kora: 'Kora',
  chipper: 'Chipper',
  paystack: 'Paystack',
  payoneer: 'Payoneer Checkout',
}

export type ExternalGatewaySettings = {
  enabled: boolean
  public_key: string
  secret_key: string
  mode: 'sandbox' | 'live'
  initialize_url: string
  verify_url: string
  checkout_url_template: string
  callback_url: string
  webhook_secret: string
  /** Label shown to customers on checkout (e.g. "Debit/credit cards") */
  checkout_label: string
  /** Payoneer: hosted redirect vs embedded SDK on checkout */
  integration_mode?: 'hosted' | 'embedded'
  /** Payoneer Client ID (falls back to public_key) */
  client_id?: string
  /** Payoneer API base URL override (e.g. https://api.sandbox.oscato.com) */
  api_base_url?: string
}

export const DEFAULT_EXTERNAL_GATEWAY_SETTINGS: ExternalGatewaySettings = {
  enabled: false,
  public_key: '',
  secret_key: '',
  mode: 'sandbox',
  initialize_url: '',
  verify_url: '',
  checkout_url_template: '',
  callback_url: '',
  webhook_secret: '',
  checkout_label: '',
}

export function normalizeExternalGatewaySettings(raw: any): ExternalGatewaySettings {
  return {
    enabled: raw?.enabled === true,
    public_key: typeof raw?.public_key === 'string' ? raw.public_key : '',
    secret_key: typeof raw?.secret_key === 'string' ? raw.secret_key : '',
    mode: raw?.mode === 'live' ? 'live' : 'sandbox',
    initialize_url: typeof raw?.initialize_url === 'string' ? raw.initialize_url : '',
    verify_url: typeof raw?.verify_url === 'string' ? raw.verify_url : '',
    checkout_url_template:
      typeof raw?.checkout_url_template === 'string' ? raw.checkout_url_template : '',
    callback_url: typeof raw?.callback_url === 'string' ? raw.callback_url : '',
    webhook_secret: typeof raw?.webhook_secret === 'string' ? raw.webhook_secret : '',
    checkout_label: typeof raw?.checkout_label === 'string' ? raw.checkout_label : '',
    integration_mode:
      raw?.integration_mode === 'embedded' || raw?.integration_mode === 'hosted'
        ? raw.integration_mode
        : undefined,
    client_id: typeof raw?.client_id === 'string' ? raw.client_id : '',
    api_base_url: typeof raw?.api_base_url === 'string' ? raw.api_base_url : '',
  }
}

export function getPayoneerClientIdFromSettings(settings: ExternalGatewaySettings): string {
  return settings.client_id?.trim() || settings.public_key?.trim() || ''
}

/** Whether an external gateway is enabled and has the minimum config to appear at checkout. */
export function isExternalGatewayConfigured(
  key: ExternalGatewayKey,
  settings: ExternalGatewaySettings
): boolean {
  if (!settings.enabled) return false

  switch (key) {
    case 'payoneer':
      return Boolean(getPayoneerClientIdFromSettings(settings) && settings.secret_key?.trim())
    case 'paystack':
      return Boolean(settings.secret_key?.trim())
    default:
      return Boolean(
        settings.secret_key?.trim() ||
          settings.initialize_url?.trim() ||
          settings.checkout_url_template?.trim()
      )
  }
}

export function normalizePayoneerSettings(raw: any): ExternalGatewaySettings {
  const base = normalizeExternalGatewaySettings(raw)
  return {
    ...base,
    integration_mode: base.integration_mode === 'embedded' ? 'embedded' : 'hosted',
  }
}
