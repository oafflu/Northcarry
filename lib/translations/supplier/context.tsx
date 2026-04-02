'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSupplierTranslation, Locale } from './index'

interface SupplierTranslationContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const SupplierTranslationContext = createContext<SupplierTranslationContextType | undefined>(undefined)

export function SupplierTranslationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh') // Default to Chinese

  useEffect(() => {
    // Check for saved locale preference
    const savedLocale = localStorage.getItem('supplier-locale') as Locale
    if (savedLocale && (savedLocale === 'en' || savedLocale === 'zh')) {
      setLocale(savedLocale)
    }
  }, [])

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale)
    localStorage.setItem('supplier-locale', newLocale)
  }

  const { t } = useSupplierTranslation(locale)

  return (
    <SupplierTranslationContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </SupplierTranslationContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(SupplierTranslationContext)
  if (context === undefined) {
    throw new Error('useTranslation must be used within SupplierTranslationProvider')
  }
  return context
}

