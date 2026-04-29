"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { Menu, Moon, Sun, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"

interface HeaderProps {
  onMenuToggle: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth()
  const { setTheme, theme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accountOpen) return

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false)
    }

    document.addEventListener("mousedown", closeOnOutsideClick)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [accountOpen])

  if (!user) return null

  const roleLabel = user.role === "ADMIN" ? t("admin") : user.role === "DRIVER" ? t("driver") : t("client")
  const nextLanguage = language === "ar" ? "en" : "ar"
  const nextLanguageLabel = nextLanguage === "ar" ? "العربية" : "English"
  const accountMenuLabel = language === "ar" ? "قائمة الحساب" : "Account menu"

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      {/* Mobile: logo + menu */}
      <div className="flex items-center gap-3 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="shrink-0"
          aria-label={t("openMenu")}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-[10px] font-black text-primary-foreground">SF</span>
          </div>
          <span className="text-base font-bold tracking-tight">ShipFlow</span>
        </div>
      </div>

      {/* Desktop: breadcrumb or role badge */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
          {roleLabel}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("themeToggle")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setLanguage(nextLanguage)}
          className="h-9 min-w-20 px-3 text-xs font-semibold"
          aria-label={nextLanguageLabel}
        >
          {nextLanguageLabel}
        </Button>

        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={accountMenuLabel}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            title={accountMenuLabel}
            onClick={() => setAccountOpen((open) => !open)}
          >
            <UserCircle className="h-5 w-5" />
          </button>

          {accountOpen && (
            <div
              role="menu"
              className="absolute end-0 top-11 z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            >
              <div className="px-2 py-2">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="-mx-1 my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                onClick={() => {
                  setAccountOpen(false)
                  logout()
                }}
              >
                {t("logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
