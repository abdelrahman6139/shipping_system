import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

export const locales = ["ar", "en"] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = "ar"

function normalizeLocale(value?: string | null): AppLocale {
  return value === "en" || value === "ar" ? value : defaultLocale
}

function getPreferredLocale() {
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value
  if (cookieLocale) return normalizeLocale(cookieLocale)

  const acceptLanguage = headers().get("accept-language") || ""
  return acceptLanguage.toLowerCase().startsWith("en") ? "en" : defaultLocale
}

export default getRequestConfig(async () => {
  const locale = getPreferredLocale()

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
