import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "نظام إدارة الشحن",
  description: "منصة احترافية لإدارة عمليات الشحن والتوصيل",
};

export const dynamic = "force-dynamic";

function getRequestLocale() {
  const cookieLocale = cookies().get("NEXT_LOCALE")?.value;
  if (cookieLocale === "en" || cookieLocale === "ar") return cookieLocale;

  const acceptLanguage = headers().get("accept-language") || "";
  return acceptLanguage.toLowerCase().startsWith("en") ? "en" : "ar";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getRequestLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  const dir = locale === "en" ? "ltr" : "rtl";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            <LanguageProvider>
              <AuthProvider>{children}</AuthProvider>
            </LanguageProvider>
          </NextIntlClientProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
