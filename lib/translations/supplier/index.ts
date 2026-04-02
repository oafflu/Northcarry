import enTranslations from './en.json'
import zhTranslations from './zh.json'

export type TranslationKey = 
  | keyof typeof enTranslations.common
  | `dashboard.${keyof typeof enTranslations.dashboard}`
  | `inventory.${keyof typeof enTranslations.inventory}`
  | `orders.${keyof typeof enTranslations.orders}`
  | `returns.${keyof typeof enTranslations.returns}`
  | `performance.${keyof typeof enTranslations.performance}`
  | `chat.${keyof typeof enTranslations.chat}`
  | `layout.${keyof typeof enTranslations.layout}`

export type Locale = 'en' | 'zh'

const translations = {
  en: enTranslations,
  zh: zhTranslations,
}

export function getTranslation(locale: Locale = 'en') {
  return (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[locale]
    
    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) {
        // Fallback to English if translation is missing
        value = translations.en
        for (const fallbackKey of keys) {
          value = value?.[fallbackKey]
        }
        break
      }
    }
    
    return value || key
  }
}

export function useSupplierTranslation(locale: Locale = 'zh') {
  const t = getTranslation(locale)
  
  return {
    t,
    locale,
  }
}

