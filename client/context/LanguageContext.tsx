"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"

export type AppLanguage = "ar" | "en"

type LanguageContextType = {
  language: AppLanguage
  dir: "rtl" | "ltr"
  isMounted: boolean
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  t: (key: string) => string
}

const dictionary: Record<AppLanguage, Record<string, string>> = {
  ar: {
    loading: "جاري التحميل...",
    admin: "مشرف",
    driver: "سائق",
    client: "عميل",
    logout: "تسجيل الخروج",
    themeToggle: "تبديل المظهر",
    languageToggle: "English",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    adminHome: "لوحة التحكم",
    adminOrders: "الطلبات",
    adminWaybill: "بوليصة الشحن",
    adminUsers: "المستخدمون",
    adminZones: "المناطق والتسعير",
    adminTickets: "التذاكر",
    adminReports: "التقارير",
    clientHome: "طلباتي",
    clientNewOrder: "طلب جديد",
    clientOrders: "سجل الطلبات",
    clientTickets: "الدعم",
    driverHome: "عمليات التوصيل",
    driverEarnings: "الأرباح",
    adminSection: "الإدارة",
    clientSection: "واجهة العميل",
    driverSection: "واجهة السائق",
    home: "الرئيسية",
    delivery: "التوصيل",
  },
  en: {
    loading: "Loading...",
    admin: "Admin",
    driver: "Driver",
    client: "Client",
    logout: "Log out",
    themeToggle: "Toggle theme",
    languageToggle: "العربية",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    adminHome: "Dashboard",
    adminOrders: "Orders",
    adminWaybill: "Waybill",
    adminUsers: "Users",
    adminZones: "Zones & Pricing",
    adminTickets: "Tickets",
    adminReports: "Reports",
    clientHome: "My Orders",
    clientNewOrder: "New Order",
    clientOrders: "Order History",
    clientTickets: "Support",
    driverHome: "Deliveries",
    driverEarnings: "Earnings",
    adminSection: "Admin",
    clientSection: "Client View",
    driverSection: "Driver View",
    home: "Home",
    delivery: "Delivery",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("ar")
  const [isMounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("language")
    if (stored === "ar" || stored === "en") setLanguageState(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    const dir = language === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = language
    document.documentElement.dir = dir
    window.localStorage.setItem("language", language)
  }, [language, isMounted])

  const value = useMemo<LanguageContextType>(() => {
    const dir = language === "ar" ? "rtl" : "ltr"
    return {
      language,
      dir,
      isMounted,
      setLanguage: setLanguageState,
      toggleLanguage: () => setLanguageState((current) => (current === "ar" ? "en" : "ar")),
      t: (key: string) => dictionary[language][key] || key,
    }
  }, [isMounted, language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
