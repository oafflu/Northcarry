export const EXTERNAL_GATEWAY_KEYS = [
  '2checkout',
  'kora',
  'chipper',
  'paystack',
] as const

export type ExternalGatewayKey = (typeof EXTERNAL_GATEWAY_KEYS)[number]

export const EXTERNAL_GATEWAY_LABELS: Record<ExternalGatewayKey, string> = {
  '2checkout': '2Checkout',
  kora: 'Kora',
  chipper: 'Chipper',
  paystack: 'Paystack',
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
  }
}
