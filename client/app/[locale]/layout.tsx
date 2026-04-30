import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { AuthProvider } from "@/context/AuthContext"
import { LanguageProvider } from "@/context/LanguageContext"
import { locales, type AppLocale } from "@/i18n/request"

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const locale = params.locale as AppLocale

  if (!locales.includes(locale)) {
    notFound()
  }

  const messages = (await import(`../../messages/${locale}.json`)).default

  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
      <LanguageProvider>
        <AuthProvider>{children}</AuthProvider>
      </LanguageProvider>
    </NextIntlClientProvider>
  )
}
