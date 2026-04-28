"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import Link from "next/link"
import { Package, LayoutDashboard, Ticket, Truck, Users, Map, Plus, DollarSign, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  const getMobileLinks = () => {
    if (user.role === "ADMIN") {
      return [
        { href: "/admin", label: "الرئيسية", icon: Shield },
        { href: "/admin/orders", label: "الطلبات", icon: Package },
        { href: "/admin/users", label: "المستخدمون", icon: Users },
        { href: "/admin/tickets", label: "التذاكر", icon: Ticket },
      ]
    }
    if (user.role === "DRIVER") {
      return [
        { href: "/driver", label: "التوصيل", icon: Truck },
        { href: "/driver/earnings", label: "الأرباح", icon: DollarSign },
      ]
    }
    return [
      { href: "/client", label: "الرئيسية", icon: Package },
      { href: "/client/new-order", label: "طلب جديد", icon: Plus },
      { href: "/client/orders", label: "طلباتي", icon: LayoutDashboard },
      { href: "/client/tickets", label: "الدعم", icon: Ticket },
    ]
  }

  const mobileLinks = getMobileLinks()

  const isMobileLinkActive = (href: string) => {
    if (href === "/admin" || href === "/client" || href === "/driver") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onMenuToggle={() => setIsSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg md:hidden">
          <nav className="flex w-full items-center justify-around px-2">
            {mobileLinks.map((link) => {
              const Icon = link.icon
              const active = isMobileLinkActive(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className={cn(
                    "rounded-xl p-1.5 transition-colors",
                    active ? "bg-primary/10" : ""
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-[10px] font-medium", active ? "font-semibold" : "")}>
                    {link.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
