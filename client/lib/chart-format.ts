export type ChartLocale = "ar" | "en"

export function safeDate(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: unknown, locale: ChartLocale = "ar") {
  const date = safeDate(value)
  if (!date) return "-"
  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
  })
}

export function formatMoney(value: unknown, locale: ChartLocale = "ar") {
  const amount = Number(value || 0).toFixed(2)
  return locale === "ar" ? `${amount} ج.م` : `EGP ${amount}`
}
