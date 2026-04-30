"use client"

import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Package, Users, Map, Ticket,
  LogOut, Truck, Plus, DollarSign, X, Shield, BarChart2, ScanLine
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const { localizedPath, t } = useLanguage()
  const pathname = usePathname()

  if (!user) return null

  const adminLinks = [
    { href: "/admin", label: t("adminHome"), icon: LayoutDashboard, exact: true },
    { href: "/admin/orders", label: t("adminOrders"), icon: Package, exact: false },
    { href: "/admin/waybill", label: t("adminWaybill"), icon: ScanLine, exact: false },
    { href: "/admin/users", label: t("adminUsers"), icon: Users, exact: false },
    { href: "/admin/zones", label: t("adminZones"), icon: Map, exact: false },
    { href: "/admin/tickets", label: t("adminTickets"), icon: Ticket, exact: false },
    { href: "/admin/reports", label: t("adminReports"), icon: BarChart2, exact: false },
  ]

  const clientLinks = [
    { href: "/client", label: t("clientHome"), icon: Package, exact: true },
    { href: "/client/new-order", label: t("clientNewOrder"), icon: Plus, exact: false },
    { href: "/client/orders", label: t("clientOrders"), icon: LayoutDashboard, exact: false },
    { href: "/client/tickets", label: t("clientTickets"), icon: Ticket, exact: false },
  ]

  const driverLinks = [
    { href: "/driver", label: t("driverHome"), icon: Truck, exact: true },
    { href: "/driver/earnings", label: t("driverEarnings"), icon: DollarSign, exact: false },
  ]

  const getSections = () => {
    if (user.role === "ADMIN") {
      return [
        { label: t("adminSection"), icon: Shield, links: adminLinks },
        { label: t("clientSection"), icon: Package, links: clientLinks },
        { label: t("driverSection"), icon: Truck, links: driverLinks },
      ]
    }
    if (user.role === "DRIVER") {
      return [{ label: null, icon: null, links: driverLinks }]
    }
    return [{ label: null, icon: null, links: clientLinks }]
  }

  const sections = getSections()
  const roleLabel = user.role === "ADMIN" ? t("admin") : user.role === "DRIVER" ? t("driver") : t("client")

  const normalizedPathname = (pathname || "/").replace(/^\/(ar|en)(?=\/|$)/, "") || "/"

  const isActive = (href: string, exact: boolean) => {
    if (exact) return normalizedPathname === href
    return normalizedPathname.startsWith(href) && normalizedPathname !== href.split("/").slice(0, -1).join("/")
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo Header */}
      <div className="flex h-16 items-center justify-between px-5 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Truck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">ShipFlow</span>
        </div>
        <button
          onClick={onMobileClose}
          className="md:hidden rounded-lg p-1.5 hover:bg-muted transition-colors"
          aria-label={t("closeMenu")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 scrollbar-thin">
        {sections.map((section, idx) => (
          <div key={idx}>
            {section.label && (
              <div className="px-5 pt-3 pb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  {section.label}
                </p>
              </div>
            )}
            <nav className="px-3 grid gap-0.5">
              {section.links.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href, link.exact)
                return (
                  <Link
                    key={link.href}
                    href={localizedPath(link.href)}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                )
              })}
            </nav>
            {idx < sections.length - 1 && (
              <div className="mx-5 mt-3 h-px bg-border/60" />
            )}
          </div>
        ))}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t bg-muted/20">
        <div className="flex items-center gap-3 mb-2 px-2 py-2 rounded-xl bg-card border">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 font-bold text-primary text-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); onMobileClose() }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-e bg-card text-card-foreground shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside className="relative w-72 h-full bg-card text-card-foreground shadow-2xl flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
