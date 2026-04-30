"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import { Activity, DollarSign, Package, Users } from "lucide-react"
import { formatMoney, safeDate, type ChartLocale } from "@/lib/chart-format"

const AdminRevenueChart = dynamic(() => import("@/components/admin/AdminRevenueChart"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-muted/50" />,
})

type DashboardStats = {
  totalOrders: number
  activeDrivers: number
  totalRevenue: number
  pendingTickets: number
  pendingOrders: number
  deliveredOrders: number
  totalDrivers: number
}

type RecentOrder = {
  id: string
  shipmentNumber?: string
  status?: string
  createdAt?: string
  driver?: { name?: string } | null
}

function getFallbackRevenueData() {
  const values = [1500, 2300, 1900, 2800, 3500, 1200, 950]
  return values.map((revenue, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (values.length - index - 1))
    return { date: date.toISOString().split("T")[0], revenue }
  })
}

function statusClass(status?: string) {
  const classes: Record<string, string> = {
    PENDING: "text-yellow-600",
    ASSIGNED: "text-blue-500",
    PICKED_UP: "text-purple-500",
    IN_TRANSIT: "text-indigo-500",
    DELIVERED: "text-green-500",
    COLLECTED: "text-green-500",
    CANCELLED: "text-red-500",
    RETURNED: "text-purple-500",
  }
  return classes[status || ""] || "text-muted-foreground"
}

function safeMessage(t: (key: string) => string, key?: string) {
  if (!key) return "-"
  try {
    return t(key)
  } catch {
    return key
  }
}

function getTimeAgo(value: unknown, t: (key: string, values?: Record<string, number>) => string) {
  const date = safeDate(value)
  if (!date) return "-"

  const now = new Date()
  const diff = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (diff < 60) return t("time.justNow")
  if (diff < 3600) return t("time.minutesAgo", { count: Math.floor(diff / 60) })
  if (diff < 86400) return t("time.hoursAgo", { count: Math.floor(diff / 3600) })
  return t("time.daysAgo", { count: Math.floor(diff / 86400) })
}

export default function AdminDashboard() {
  const t = useTranslations("AdminDashboard")
  const commonT = useTranslations("Common")
  const statusT = useTranslations("Status")
  const locale = useLocale() as ChartLocale

  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    activeDrivers: 0,
    totalRevenue: 0,
    pendingTickets: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    totalDrivers: 0,
  })
  const [chartData, setChartData] = useState<{ date: string; revenue: number }[]>([])
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [dashRes, chartRes, ordersRes] = await Promise.all([
          api.get("/analytics/dashboard"),
          api.get("/analytics/charts"),
          api.get("/orders", { params: { limit: 5 } }),
        ])
        const d = dashRes.data

        setStats({
          totalOrders: d.totalOrders || 0,
          activeDrivers: d.activeDrivers || 0,
          totalRevenue: d.revenueMonth || 0,
          pendingTickets: d.openTickets ?? d.pendingTickets ?? 0,
          pendingOrders: d.pendingOrders || 0,
          deliveredOrders: d.deliveredOrders || 0,
          totalDrivers: d.totalDrivers || 0,
        })

        setRecentOrders(ordersRes.data?.orders || [])

        const revenueByDay: { date?: string; day?: string; revenue: number }[] = chartRes.data?.revenueByDay || []
        setChartData(
          revenueByDay.length > 0
            ? revenueByDay.map((row) => ({
              date: String(row.date ?? row.day ?? ""),
              revenue: Number(row.revenue) || 0,
            }))
            : getFallbackRevenueData()
        )
      } catch (error) {
        console.error("Failed to fetch analytics, using fallback data for demo.")
        setStats({
          totalOrders: 0,
          activeDrivers: 0,
          totalRevenue: 0,
          pendingTickets: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          totalDrivers: 0,
        })
        setChartData(getFallbackRevenueData())
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("totalOrders")}</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : t("pendingOrders", { count: stats.pendingOrders })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" dir="ltr">
              {isLoading ? "..." : formatMoney(stats.totalRevenue, locale)}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : t("deliveredThisMonth", { count: stats.deliveredOrders })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("activeDrivers")}</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.activeDrivers}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : t("ofDrivers", { count: stats.totalDrivers })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("openTickets")}</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats.pendingTickets}</div>
            <p className="text-xs text-muted-foreground">{t("needsFollowUp")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t("revenueOverview")}</CardTitle>
            <CardDescription>{t("revenueDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">{commonT("chartLoading")}</div>
            ) : (
              <AdminRevenueChart data={chartData} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("recentActivity")}</CardTitle>
            <CardDescription>{t("recentActivityDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentOrders.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t("noRecentOrders")}</p>
              ) : (
                recentOrders.map((order) => {
                  const status = order.status || ""
                  const driverText = order.driver?.name ? ` • ${t("withDriver", { name: order.driver.name })}` : ""
                  return (
                    <div key={order.id} className="flex items-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="ms-4 min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium leading-none">
                          {t("orderPrefix")} #{order.shipmentNumber || order.id.slice(0, 8)}
                        </p>
                        <p className={`text-xs ${statusClass(status)}`}>
                          {safeMessage(statusT, status)}{driverText}
                        </p>
                      </div>
                      <div className="ms-auto whitespace-nowrap text-xs font-medium text-muted-foreground">
                        {getTimeAgo(order.createdAt, t)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
