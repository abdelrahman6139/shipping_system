"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import api from "@/lib/api"
import {
  Wallet, Truck, RefreshCw, TrendingUp, AlertTriangle,
  Building2, Banknote, Package, MapPin, CalendarDays,
  ArrowUpRight, Loader2, ShoppingBag,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"

const DriverEarningsChart = dynamic(() => import("@/components/driver/DriverEarningsChart"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart...</div>,
})

/* ─────────────── TYPES ─────────────── */
type Period = "all" | "day" | "week" | "month"

type EarningItem = {
  id: string
  orderId: string
  amount: number
  orderTotal: number
  companyProfit: number
  commissionType: string
  commissionValue: number
  date: string
  order?: {
    destination?: string
    pickupAddress?: string
    deliveryType?: string
    totalPrice?: number
    client?: { name?: string; phone?: string }
    zone?: { name?: string }
  }
}

type DayChart = {
  date: string
  driverEarning: number
  orderTotal: number
}

type EarningsResponse = {
  earnings: EarningItem[]
  total: number
  byDay: DayChart[]
  summary?: {
    deliveriesCount: number
    totalOrderValue: number
    totalDriverEarning: number
    totalCompanyProfit: number
    averageEarning: number
    bestDay: { date: string; driverEarning: number } | null
  }
}

/* ─────────────── CONSTANTS ──────────── */
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "all",   label: "الكل" },
  { value: "day",   label: "اليوم" },
  { value: "week",  label: "آخر 7 أيام" },
  { value: "month", label: "هذا الشهر" },
]

const DELIVERY_LABEL: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS:  "سريع",
  SAME_DAY: "نفس اليوم",
}

/* ─────────────── HELPERS ────────────── */
function fmt(value: number) {
  return `ج.م ${Number(value || 0).toFixed(2)}`
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })
}

function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
}

function commissionLabel(type: string, value: number) {
  if (type === "PERCENTAGE") return `${value}% من قيمة الطلب`
  if (type === "ZONE_FIXED") return `مبلغ ثابت حسب المنطقة`
  return `مبلغ ثابت ${fmt(value)}`
}

/* ─────────────── SUB-COMPONENTS ──────── */
function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string
  value: string
  sub: string
  icon: any
  accent?: string
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${accent || ""}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────── PAGE ───────────────── */
export default function DriverEarningsPage() {
  const { user, isLoading: isAuthLoading } = useAuth()

  const [period, setPeriod]           = useState<Period>("all")
  const [earnings, setEarnings]       = useState<EarningItem[]>([])
  const [chartData, setChartData]     = useState<DayChart[]>([])
  const [summary, setSummary]         = useState({
    deliveriesCount:    0,
    totalOrderValue:    0,
    totalDriverEarning: 0,
    totalCompanyProfit: 0,
    averageEarning:     0,
    bestDay:            null as { date: string; driverEarning: number } | null,
  })
  const [isLoading, setIsLoading]     = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const fetchEarnings = useCallback(async (showLoader = false) => {
    if (!user || user.role !== "DRIVER") {
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }
    if (showLoader) setIsLoading(true); else setIsRefreshing(true)
    try {
      setError(null)
      const params = period === "all" ? {} : { period }
      const { data } = await api.get<EarningsResponse>("/driver/earnings", { params })

      setEarnings(data?.earnings || [])
      setChartData(data?.byDay || [])

      const e = data?.earnings || []
      const fallback = {
        deliveriesCount:    e.length,
        totalOrderValue:    e.reduce((s, x) => s + (x.orderTotal    || 0), 0),
        totalDriverEarning: e.reduce((s, x) => s + (x.amount        || 0), 0),
        totalCompanyProfit: e.reduce((s, x) => s + (x.companyProfit || 0), 0),
        averageEarning:     e.length ? e.reduce((s, x) => s + x.amount, 0) / e.length : 0,
        bestDay:            null,
      }
      setSummary({
        deliveriesCount:    data?.summary?.deliveriesCount    ?? fallback.deliveriesCount,
        totalOrderValue:    data?.summary?.totalOrderValue    ?? fallback.totalOrderValue,
        totalDriverEarning: data?.summary?.totalDriverEarning ?? fallback.totalDriverEarning,
        totalCompanyProfit: data?.summary?.totalCompanyProfit ?? fallback.totalCompanyProfit,
        averageEarning:     data?.summary?.averageEarning     ?? fallback.averageEarning,
        bestDay:            data?.summary?.bestDay            ?? null,
      })
    } catch (err: any) {
      const code = err?.response?.status
      setError(code === 403 ? "غير مصرح. سجّل الدخول بحساب سائق." : (err?.response?.data?.error || "فشل تحميل البيانات"))
      toast.error("فشل تحميل بيانات الأرباح")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [period, user])

  useEffect(() => {
    if (!isAuthLoading) fetchEarnings(true)
  }, [fetchEarnings, isAuthLoading])

  /* ── Not driver guard ── */
  if (!isAuthLoading && user?.role !== "DRIVER") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/20">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="font-semibold text-amber-800 dark:text-amber-300">هذه الصفحة مخصصة لحسابات السائقين فقط</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">أنت مسجل الدخول كـ {user?.role}. انتقل إلى لوحة حسابك المناسبة.</p>
        </div>
      </div>
    )
  }

  /* ─────────── RENDER ─────────── */
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الأرباح والسجل المالي</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">ملخص كامل لكل طلب حصّلته — ما دفعه العميل، حصتك، وحصة الشركة.</p>
        </div>
        <button
          onClick={() => fetchEarnings(false)}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> تحديث
        </button>
      </div>

      {/* Period filters */}
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            disabled={isLoading}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              period === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50/60 p-4 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchEarnings(false)} className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* ── KPI strip ── */}
      {isAuthLoading || isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted" />)}
        </div>
      ) : (
        <>
          {/* Summary finance strip */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-x-reverse">
              {[
                { label: "إجمالي قيمة الطلبات",  value: summary.totalOrderValue,    sub: "ما حصّلته من العملاء", color: "text-foreground", bg: "" },
                { label: "حصة السائق (أنت)",      value: summary.totalDriverEarning, sub: "ما تحتفظ به",            color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-950/20" },
                { label: "حصة الشركة",             value: summary.totalCompanyProfit, sub: "يُحوَّل للشركة",          color: "text-blue-600 dark:text-blue-400",      bg: "bg-blue-50/50 dark:bg-blue-950/20" },
              ].map((col) => (
                <div key={col.label} className={`flex flex-col items-center justify-center p-5 text-center ${col.bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">{col.label}</p>
                  <p className={`text-2xl font-bold ${col.color}`}>{fmt(col.value)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{col.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* KPI cards row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="عدد التسليمات"  value={`${summary.deliveriesCount}`} sub="طلب مكتمل"    icon={Truck}      />
            <KpiCard label="متوسط حصتك"     value={fmt(summary.averageEarning)} sub="لكل طلب"     icon={TrendingUp} />
            <KpiCard
              label="أفضل يوم"
              value={summary.bestDay ? fmt(summary.bestDay.driverEarning) : "—"}
              sub={summary.bestDay ? fmtDate(summary.bestDay.date) : "لا يوجد بعد"}
              icon={CalendarDays}
            />
            <KpiCard
              label="نسبة حصتك"
              value={summary.totalOrderValue > 0 ? `${((summary.totalDriverEarning / summary.totalOrderValue) * 100).toFixed(1)}%` : "—"}
              sub="من إجمالي الطلبات"
              icon={ArrowUpRight}
            />
          </div>
        </>
      )}

      {/* ── Chart ── */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="font-semibold text-sm mb-4">أرباحك اليومية مقابل قيمة الطلبات</p>
        <div className="h-[260px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              لا توجد بيانات في هذه الفترة.
            </div>
          ) : (
            <DriverEarningsChart data={chartData} />
          )}
        </div>
      </div>

      {/* ── Earnings History ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <p className="font-semibold text-sm">سجل الطلبات المنجزة</p>
          {!isLoading && <span className="mr-auto text-xs text-muted-foreground">{earnings.length} طلب</span>}
        </div>

        {isLoading ? (
          <div className="p-5"><Skeleton /></div>
        ) : earnings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Banknote className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="font-semibold">لا توجد طلبات مكتملة</p>
            <p className="text-sm text-muted-foreground mt-1">ستظهر هنا الأرباح بعد تسليم الطلبات وتحصيلها.</p>
          </div>
        ) : (
          <div className="divide-y">
            {earnings.map((e) => {
              const orderTotal    = e.orderTotal    || e.order?.totalPrice || 0
              const driverCut     = e.amount        || 0
              const companyCut    = e.companyProfit || (orderTotal - driverCut)
              const pct           = orderTotal > 0 ? ((driverCut / orderTotal) * 100).toFixed(0) : 0
              return (
                <div key={e.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{e.orderId.slice(0,8).toUpperCase()}
                        </span>
                        {e.order?.deliveryType && (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {DELIVERY_LABEL[e.order.deliveryType] || e.order.deliveryType}
                          </span>
                        )}
                      </div>
                      {e.order?.destination && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                          <span className="truncate max-w-[220px]">{e.order.destination}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {e.order?.client?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {e.order.client.name}
                          </span>
                        )}
                        {e.order?.zone?.name && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" /> {e.order.zone.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {fmtDate(e.date)} {fmtTime(e.date)}
                        </span>
                      </div>
                    </div>
                    {/* Driver earning badge */}
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">+{fmt(driverCut)}</div>
                      <div className="text-[11px] text-muted-foreground">حصتك ({pct}%)</div>
                    </div>
                  </div>

                  {/* Finance breakdown bar */}
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">قيمة الطلب</p>
                        <p className="font-bold">{fmt(orderTotal)}</p>
                      </div>
                      <div className="border-x">
                        <p className="text-muted-foreground mb-1">حصتك</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(driverCut)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">حصة الشركة</p>
                        <p className="font-bold text-blue-600 dark:text-blue-400">{fmt(companyCut)}</p>
                      </div>
                    </div>
                    {/* Visual split bar */}
                    {orderTotal > 0 && (
                      <div className="mt-3 h-2 rounded-full overflow-hidden bg-muted flex">
                        <div
                          className="bg-emerald-400 transition-all"
                          style={{ width: `${(driverCut / orderTotal) * 100}%` }}
                        />
                        <div
                          className="bg-blue-400 transition-all"
                          style={{ width: `${(companyCut / orderTotal) * 100}%` }}
                        />
                      </div>
                    )}
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-400" /> السائق</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" /> الشركة</span>
                    </div>
                    <p className="mt-2 text-[11px] text-center text-muted-foreground">
                      {commissionLabel(e.commissionType, e.commissionValue)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

