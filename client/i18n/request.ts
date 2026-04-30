import { getRequestConfig } from "next-intl/server"

export const locales = ["ar", "en"] as const
export type AppLocale = (typeof locales)[number]
export const defaultLocale: AppLocale = "ar"

function normalizeLocale(value?: string | null): AppLocale {
  return value === "en" || value === "ar" ? value : defaultLocale
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = normalizeLocale(await requestLocale)

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
