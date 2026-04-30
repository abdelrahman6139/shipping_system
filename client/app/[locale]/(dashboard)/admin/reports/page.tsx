"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { formatMoney, type ChartLocale } from "@/lib/chart-format"
import {
  AlertTriangle,
  Banknote,
  BarChart2,
  CheckCircle,
  Clock,
  Download,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react"

function ChartLoading() {
  const t = useTranslations("Common")
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("chartLoading")}</div>
}

const PipelineAmountChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.PipelineAmountChart), { ssr: false, loading: ChartLoading })
const RevenueAreaChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.RevenueAreaChart), { ssr: false, loading: ChartLoading })
const StatusPieChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.StatusPieChart), { ssr: false, loading: ChartLoading })
const FunnelBarChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.FunnelBarChart), { ssr: false, loading: ChartLoading })
const ZoneRevenueBarChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.ZoneRevenueBarChart), { ssr: false, loading: ChartLoading })
const CancellationReturnLineChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.CancellationReturnLineChart), { ssr: false, loading: ChartLoading })
const TypeDistributionChart = dynamic(() => import("@/components/admin/ReportsCharts").then((mod) => mod.TypeDistributionChart), { ssr: false, loading: ChartLoading })

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  ASSIGNED: "#2563eb",
  PICKED_UP: "#7c3aed",
  IN_TRANSIT: "#4f46e5",
  DELIVERED: "#10b981",
  COLLECTED: "#059669",
  CANCELLED: "#ef4444",
  RETURNED: "#a855f7",
}

const COLLECTION_COLORS: Record<string, string> = {
  NOT_COLLECTED: "#f97316",
  DRIVER_COLLECTED: "#0ea5e9",
  COMPANY_RECEIVED: "#8b5cf6",
  SETTLED_TO_MERCHANT: "#10b981",
}

function safeMessage(t: (key: string) => string, key?: string) {
  if (!key) return "-"
  try {
    return t(key)
  } catch {
    return key
  }
}

function EmptyChart() {
  const t = useTranslations("Common")
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("noDataForPeriod")}</div>
}

function KpiCard({ title, value, hint, icon: Icon, tone = "text-primary" }: { title: string; value: string | number; hint?: string; icon: any; tone?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function AdminReportsPage() {
  const t = useTranslations("Reports")
  const commonT = useTranslations("Common")
  const statusT = useTranslations("Status")
  const collectionT = useTranslations("CollectionStatus")
  const deliveryT = useTranslations("DeliveryType")
  const locale = useLocale() as ChartLocale
  const money = useCallback((value: unknown) => formatMoney(value, locale), [locale])

  const [data, setData] = useState<any>(null)
  const [range, setRange] = useState("last30")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const rangeOptions = useMemo(() => [
    { value: "today", label: t("range.today") },
    { value: "last7", label: t("range.last7") },
    { value: "last30", label: t("range.last30") },
    { value: "thisMonth", label: t("range.thisMonth") },
    { value: "custom", label: t("range.custom") },
  ], [t])

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const params: Record<string, string | number> = { range, page: 1, limit: 12 }
      if (range === "custom") {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }
      const res = await api.get("/analytics/bi", { params })
      setData(res.data)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [endDate, range, startDate])

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  const exportReports = async () => {
    setIsExporting(true)
    try {
      const params: Record<string, string | number> = { range }
      if (range === "custom") {
        if (startDate) params.startDate = startDate
        if (endDate) params.endDate = endDate
      }
      const res = await api.get("/admin/export/reports.xlsx", { params, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = `reports-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert(t("exportFailed"))
    } finally {
      setIsExporting(false)
    }
  }

  const revenueData = useMemo(() => (data?.orderAnalytics?.revenueByDay || []).map((row: any) => ({
    date: String(row.date ?? ""),
    revenue: Number(row.revenue) || 0,
    orders: Number(row.orders) || 0,
  })), [data])

  const statusData = useMemo(() => (data?.orderAnalytics?.ordersByStatus || []).map((row: any) => ({
    name: safeMessage(statusT, row.status),
    value: Number(row.count) || 0,
    color: STATUS_COLORS[row.status] || "#64748b",
  })), [data, statusT])

  const typeData = useMemo(() => (data?.orderAnalytics?.ordersByType || []).map((row: any) => ({
    name: safeMessage(deliveryT, row.type),
    count: Number(row.count) || 0,
  })), [data, deliveryT])

  const pipelineData = useMemo(() => (data?.financial?.pipeline || []).map((row: any) => ({
    name: safeMessage(collectionT, row.key) || row.label,
    amount: Number(row.amount) || 0,
    count: Number(row.count) || 0,
    color: COLLECTION_COLORS[row.key] || "#64748b",
  })), [collectionT, data])

  const funnelData = useMemo(() => (data?.orderAnalytics?.deliveryFunnel || []).map((row: any) => ({
    stage: safeMessage((key) => t(`funnel.${key}`), row.stage),
    count: Number(row.count) || 0,
  })), [data, t])

  const cancellationTrend = useMemo(() => (data?.orderAnalytics?.cancellationReturnTrend || []).map((row: any) => ({
    date: String(row.date ?? ""),
    cancelled: Number(row.cancelled) || 0,
    returned: Number(row.returned) || 0,
  })), [data])

  const zoneRevenue = data?.orderAnalytics?.revenueByZone || []
  const merchants = data?.merchantAnalytics?.merchants || []
  const drivers = data?.driverAnalytics?.drivers || []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[...Array(5)].map((_, index) => <Card key={index}><CardContent className="m-4 h-24 animate-pulse rounded-lg bg-muted" /></Card>)}
        </div>
        <Card><CardContent className="h-80 animate-pulse bg-muted/50" /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  range === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex gap-2">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-36" />
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-36" />
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> {commonT("refresh")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportReports} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {commonT("exportExcel")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard title={t("shippingRevenue")} value={money(data?.summary?.shippingRevenue ?? data?.summary?.totalRevenue)} hint={t("shippingRevenueHint")} icon={DollarSign} tone="text-emerald-600" />
        <KpiCard title={t("itemValue")} value={money(data?.summary?.itemValue)} hint={t("itemValueHint")} icon={Package} tone="text-orange-600" />
        <KpiCard title={t("owedToMerchants")} value={money(data?.summary?.owedToMerchants)} hint={t("owedToMerchantsHint")} icon={Banknote} tone="text-sky-600" />
        <KpiCard title={t("settledToMerchants")} value={money(data?.summary?.settledToMerchants)} icon={CheckCircle} tone="text-green-600" />
        <KpiCard title={t("totalOrders")} value={data?.summary?.totalOrders || 0} icon={Package} tone="text-primary" />
        <KpiCard title={t("deliveredOrders")} value={data?.summary?.deliveredOrders || 0} hint={t("deliveredHint", { cancelled: data?.summary?.cancelledOrders || 0, returned: data?.summary?.returnedOrders || 0 })} icon={Truck} tone="text-indigo-600" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t("financialPipeline")}</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title={t("collectedFromCustomers")} value={money(data?.financial?.cards?.collectedFromCustomers)} icon={DollarSign} tone="text-emerald-600" />
          <KpiCard title={t("withDrivers")} value={money(data?.financial?.cards?.withDrivers)} icon={Truck} tone="text-sky-600" />
          <KpiCard title={t("withCompany")} value={money(data?.financial?.cards?.withCompany)} icon={Users} tone="text-violet-600" />
          <KpiCard title={t("settledToMerchants")} value={money(data?.financial?.cards?.settledToMerchants)} icon={CheckCircle} tone="text-green-600" />
          <KpiCard title={t("notCollectedFromCustomer")} value={money(data?.financial?.collection?.notCollected?.amount)} icon={Clock} tone="text-orange-600" />
        </div>
        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>{t("financialPath")}</CardTitle>
              <CardDescription>{t("financialPathDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              {pipelineData.length === 0 ? <EmptyChart /> : <PipelineAmountChart data={pipelineData} />}
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t("settlementFlow")}</CardTitle>
              <CardDescription>{t("settlementFlowDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pipelineData.map((item: any, index: number) => (
                  <div key={item.name} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: item.color }}>{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{t("orderCount", { count: item.count })}</p>
                    </div>
                    <p className="font-semibold" dir="ltr">{money(item.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t("dailyRevenue")}</CardTitle>
            <CardDescription>{t("dailyRevenueDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {revenueData.length === 0 ? <EmptyChart /> : <RevenueAreaChart data={revenueData} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("statusDistribution")}</CardTitle>
            <CardDescription>{t("statusDistributionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusData.length === 0 ? <EmptyChart /> : <StatusPieChart data={statusData} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t("deliveryFunnel")}</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {funnelData.length === 0 ? <EmptyChart /> : <FunnelBarChart data={funnelData} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("revenueByZone")}</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {zoneRevenue.length === 0 ? <EmptyChart /> : <ZoneRevenueBarChart data={zoneRevenue} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("cancellationReturns")}</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            {cancellationTrend.length === 0 ? <EmptyChart /> : <CancellationReturnLineChart data={cancellationTrend} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("merchantBalances")}</CardTitle>
          <CardDescription>{t("merchantBalancesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {merchants.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("noMerchants")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start">{t("merchant")}</th>
                    <th className="p-3 text-start">{t("orders")}</th>
                    <th className="p-3 text-start">{t("collectedFromCustomers")}</th>
                    <th className="p-3 text-start">{t("notCollected")}</th>
                    <th className="p-3 text-start">{t("settledToMerchants")}</th>
                    <th className="p-3 text-start">{t("owedToMerchant")}</th>
                    <th className="p-3 text-start">{commonT("success")}</th>
                    <th className="p-3 text-start">{t("cancellation")}</th>
                    <th className="p-3 text-start">{t("returnRate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((merchant: any) => (
                    <tr key={merchant.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <p className="font-medium">{merchant.name}</p>
                        <p className="text-xs text-muted-foreground">{merchant.email}</p>
                      </td>
                      <td className="p-3">{merchant.totalOrders}</td>
                      <td className="p-3 font-medium text-emerald-600" dir="ltr">{money(merchant.collectedFromCustomers)}</td>
                      <td className="p-3 text-orange-600" dir="ltr">{money(merchant.notCollected)}</td>
                      <td className="p-3 text-green-600" dir="ltr">{money(merchant.settledToMerchant)}</td>
                      <td className="p-3 font-semibold text-sky-600" dir="ltr">{money(merchant.owedToMerchant)}</td>
                      <td className="p-3">{merchant.successRate}%</td>
                      <td className="p-3">{merchant.cancellationRate}%</td>
                      <td className="p-3">{merchant.returnRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("driverAnalytics")}</CardTitle>
            <CardDescription>{t("driverAnalyticsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("noDrivers")}</p>
            ) : (
              <div className="space-y-3">
                {drivers.slice(0, 8).map((driver: any) => (
                  <div key={driver.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{t("driverDeliveredSummary", { delivered: driver.deliveredShipments, assigned: driver.assignedShipments })}</p>
                      </div>
                      <Badge variant="secondary">{driver.successRate}% {commonT("success")}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div><span className="text-muted-foreground">{t("earnings")}</span><p className="font-semibold" dir="ltr">{money(driver.earnings)}</p></div>
                      <div><span className="text-muted-foreground">{t("collected")}</span><p className="font-semibold text-emerald-600" dir="ltr">{money(driver.cashCollected)}</p></div>
                      <div><span className="text-muted-foreground">{t("notCollected")}</span><p className="font-semibold text-orange-600" dir="ltr">{money(driver.cashNotCollected)}</p></div>
                      <div><span className="text-muted-foreground">{t("avgTime")}</span><p className="font-semibold">{driver.avgDeliveryHours} {commonT("hours")}</p></div>
                    </div>
                    {driver.alerts?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {driver.alerts.map((alert: string) => (
                          <span key={alert} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> {alert}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4" /> {t("deliveryTypes")}</CardTitle>
            <CardDescription>{t("deliveryTypesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            {typeData.length === 0 ? <EmptyChart /> : <TypeDistributionChart data={typeData} />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
