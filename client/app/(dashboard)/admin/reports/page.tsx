"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import api from "@/lib/api"
import {
  AlertTriangle,
  Banknote,
  BarChart2,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  Truck,
  Users,
} from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد الانتظار",
  ASSIGNED: "تم التعيين",
  PICKED_UP: "تم الاستلام",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERED: "تم التسليم",
  COLLECTED: "تم التسليم",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
}

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

const TYPE_LABELS: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS: "سريع",
  SAME_DAY: "نفس اليوم",
}

const COLLECTION_LABELS: Record<string, string> = {
  NOT_COLLECTED: "لم يحصل من العميل",
  DRIVER_COLLECTED: "مع السائق",
  COMPANY_RECEIVED: "مع الشركة",
  SETTLED_TO_MERCHANT: "مسوى للتاجر",
}

const COLLECTION_COLORS: Record<string, string> = {
  NOT_COLLECTED: "#f97316",
  DRIVER_COLLECTED: "#0ea5e9",
  COMPANY_RECEIVED: "#8b5cf6",
  SETTLED_TO_MERCHANT: "#10b981",
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
}

function formatMoney(value: number) {
  return `ج.م ${Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}`
}

function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة</div>
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
  const [data, setData] = useState<any>(null)
  const [range, setRange] = useState("last30")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const revenueData = useMemo(() => (data?.orderAnalytics?.revenueByDay || []).map((row: any) => ({
    name: new Date(row.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
    revenue: Number(row.revenue) || 0,
    orders: Number(row.orders) || 0,
  })), [data])

  const statusData = useMemo(() => (data?.orderAnalytics?.ordersByStatus || []).map((row: any) => ({
    name: STATUS_LABELS[row.status] || row.status,
    value: Number(row.count) || 0,
    color: STATUS_COLORS[row.status] || "#64748b",
  })), [data])

  const typeData = useMemo(() => (data?.orderAnalytics?.ordersByType || []).map((row: any) => ({
    name: TYPE_LABELS[row.type] || row.type,
    count: Number(row.count) || 0,
  })), [data])

  const pipelineData = useMemo(() => (data?.financial?.pipeline || []).map((row: any) => ({
    name: COLLECTION_LABELS[row.key] || row.label,
    amount: Number(row.amount) || 0,
    count: Number(row.count) || 0,
    color: COLLECTION_COLORS[row.key] || "#64748b",
  })), [data])

  const funnelData = useMemo(() => {
    const stageLabels: Record<string, string> = {
      Created: "تم الإنشاء",
      Assigned: "تم التعيين",
      "Picked Up": "تم الاستلام",
      "In Transit": "قيد التوصيل",
      Delivered: "تم التسليم",
    }
    return (data?.orderAnalytics?.deliveryFunnel || []).map((row: any) => ({
      stage: stageLabels[row.stage] || row.stage,
      count: Number(row.count) || 0,
    }))
  }, [data])

  const cancellationTrend = useMemo(() => (data?.orderAnalytics?.cancellationReturnTrend || []).map((row: any) => ({
    name: new Date(row.date).toLocaleDateString("ar-EG", { month: "short", day: "numeric" }),
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
          <h2 className="text-2xl font-bold tracking-tight">لوحة ذكاء الأعمال اللوجستية</h2>
          <p className="text-muted-foreground">تحليل التسليم والتحصيل والتسويات حسب التجار والسائقين والمناطق.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "today", label: "اليوم" },
              { value: "last7", label: "آخر 7 أيام" },
              { value: "last30", label: "آخر 30 يوم" },
              { value: "thisMonth", label: "هذا الشهر" },
              { value: "custom", label: "مخصص" },
            ].map((option) => (
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
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} /> تحديث
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="إجمالي الإيراد" value={formatMoney(data?.summary?.totalRevenue)} icon={DollarSign} tone="text-emerald-600" />
        <KpiCard title="مستحق للتجار" value={formatMoney(data?.summary?.owedToMerchants)} hint="مبالغ حصلت ولم تسو بعد" icon={Banknote} tone="text-sky-600" />
        <KpiCard title="مسوى للتجار" value={formatMoney(data?.summary?.settledToMerchants)} icon={CheckCircle} tone="text-green-600" />
        <KpiCard title="إجمالي الطلبات" value={data?.summary?.totalOrders || 0} icon={Package} tone="text-primary" />
        <KpiCard title="تم التسليم" value={data?.summary?.deliveredOrders || 0} hint={`${data?.summary?.cancelledOrders || 0} ملغي / ${data?.summary?.returnedOrders || 0} مرتجع`} icon={Truck} tone="text-indigo-600" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">خط سير التحصيل والتسوية</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="محصل من العملاء" value={formatMoney(data?.financial?.cards?.collectedFromCustomers)} icon={DollarSign} tone="text-emerald-600" />
          <KpiCard title="مع السائقين" value={formatMoney(data?.financial?.cards?.withDrivers)} icon={Truck} tone="text-sky-600" />
          <KpiCard title="مع الشركة" value={formatMoney(data?.financial?.cards?.withCompany)} icon={Users} tone="text-violet-600" />
          <KpiCard title="مسوى للتجار" value={formatMoney(data?.financial?.cards?.settledToMerchants)} icon={CheckCircle} tone="text-green-600" />
          <KpiCard title="لم يحصل من العميل" value={formatMoney(data?.financial?.collection?.notCollected?.amount)} icon={Clock} tone="text-orange-600" />
        </div>
        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>المسار المالي</CardTitle>
              <CardDescription>Customer → Driver → Company → Merchant</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              {pipelineData.length === 0 ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(Number(value)), "المبلغ"]} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {pipelineData.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>تدفق التسوية</CardTitle>
              <CardDescription>قراءة سريعة لحالة الأموال داخل الشبكة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pipelineData.map((item: any, index: number) => (
                  <div key={item.name} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: item.color }}>{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.count} طلب</p>
                    </div>
                    <p className="font-semibold">{formatMoney(item.amount)}</p>
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
            <CardTitle>الإيراد اليومي</CardTitle>
            <CardDescription>بيانات جاهزة للتصدير لاحقا حسب الفترة المختارة</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {revenueData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(Number(value)), "الإيراد"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>توزيع حالات الطلبات</CardTitle>
            <CardDescription>الحالة التشغيلية للشحنات</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {statusData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="45%" outerRadius={88} dataKey="value" nameKey="name" labelLine={false} fontSize={10}>
                    {statusData.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>قمع التسليم</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {funnelData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="stage" width={86} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الإيراد حسب المنطقة</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {zoneRevenue.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={zoneRevenue} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="zone" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(Number(value)), "الإيراد"]} />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الإلغاء والمرتجعات</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {cancellationTrend.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cancellationTrend} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="cancelled" name="ملغي" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="returned" name="مرتجع" stroke="#a855f7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أرصدة التجار المستحقة</CardTitle>
          <CardDescription>الفصل واضح بين غير المحصل، المحصل من العملاء، والمسوى للتاجر</CardDescription>
        </CardHeader>
        <CardContent>
          {merchants.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد بيانات تجار في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 text-start">التاجر</th>
                    <th className="p-3 text-start">الطلبات</th>
                    <th className="p-3 text-start">محصل من العملاء</th>
                    <th className="p-3 text-start">غير محصل</th>
                    <th className="p-3 text-start">مسوى للتاجر</th>
                    <th className="p-3 text-start">مستحق للتاجر</th>
                    <th className="p-3 text-start">نجاح</th>
                    <th className="p-3 text-start">إلغاء</th>
                    <th className="p-3 text-start">مرتجع</th>
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
                      <td className="p-3 font-medium text-emerald-600">{formatMoney(merchant.collectedFromCustomers)}</td>
                      <td className="p-3 text-orange-600">{formatMoney(merchant.notCollected)}</td>
                      <td className="p-3 text-green-600">{formatMoney(merchant.settledToMerchant)}</td>
                      <td className="p-3 font-semibold text-sky-600">{formatMoney(merchant.owedToMerchant)}</td>
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
            <CardTitle>تحليلات السائقين</CardTitle>
            <CardDescription>الأداء والتحصيل النقدي والتنبيهات التشغيلية</CardDescription>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">لا توجد بيانات سائقين في هذه الفترة</p>
            ) : (
              <div className="space-y-3">
                {drivers.slice(0, 8).map((driver: any) => (
                  <div key={driver.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.deliveredShipments} تسليم من {driver.assignedShipments} طلب</p>
                      </div>
                      <Badge variant="secondary">{driver.successRate}% نجاح</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div><span className="text-muted-foreground">الأرباح</span><p className="font-semibold">{formatMoney(driver.earnings)}</p></div>
                      <div><span className="text-muted-foreground">محصل</span><p className="font-semibold text-emerald-600">{formatMoney(driver.cashCollected)}</p></div>
                      <div><span className="text-muted-foreground">غير محصل</span><p className="font-semibold text-orange-600">{formatMoney(driver.cashNotCollected)}</p></div>
                      <div><span className="text-muted-foreground">متوسط الوقت</span><p className="font-semibold">{driver.avgDeliveryHours} ساعة</p></div>
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
            <CardTitle className="flex items-center gap-2"><BarChart2 className="h-4 w-4" /> أنواع التوصيل</CardTitle>
            <CardDescription>توزيع الطلبات حسب نوع الخدمة</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px]">
            {typeData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
