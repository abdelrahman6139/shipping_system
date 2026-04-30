"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

export type AppLanguage = "ar" | "en"

type LanguageContextType = {
  language: AppLanguage
  dir: "rtl" | "ltr"
  isMounted: boolean
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

function normalizeLanguage(locale: string): AppLanguage {
  return locale === "en" ? "en" : "ar"
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const translate = useTranslations() as unknown as (key: string) => string
  const router = useRouter()
  const [language, setLanguageState] = useState<AppLanguage>(() => normalizeLanguage(locale))
  const [isMounted, setMounted] = useState(false)

  useEffect(() => {
    setLanguageState(normalizeLanguage(locale))
  }, [locale])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const dir = language === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [language])

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    document.cookie = `NEXT_LOCALE=${nextLanguage}; path=/; max-age=31536000; SameSite=Lax`
    setLanguageState(nextLanguage)
    router.refresh()
  }, [router])

  const t = useCallback((key: string) => {
    try {
      return translate(key)
    } catch {
      return key
    }
  }, [translate])

  const value = useMemo<LanguageContextType>(() => {
    const dir = language === "ar" ? "rtl" : "ltr"
    return {
      language,
      dir,
      isMounted,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
      t,
    }
  }, [isMounted, language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
