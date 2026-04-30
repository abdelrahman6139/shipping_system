import createMiddleware from "next-intl/middleware"

export default createMiddleware({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
})

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}
