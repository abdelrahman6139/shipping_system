"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell
} from "recharts"
import api from "@/lib/api"
import {
  DollarSign, Package, Users, Truck, TrendingUp, CheckCircle,
  Clock, XCircle, BarChart2, RefreshCw, Medal
} from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد الانتظار",
  ASSIGNED: "تم التعيين",
  PICKED_UP: "تم الاستلام",
  IN_TRANSIT: "قيد التوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  ASSIGNED: "#3b82f6",
  PICKED_UP: "#8b5cf6",
  IN_TRANSIT: "#6366f1",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
}

const TYPE_LABELS: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS: "سريع",
  SAME_DAY: "نفس اليوم",
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<any>(null)
  const [charts, setCharts] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [dashRes, chartRes] = await Promise.all([
        api.get("/analytics/dashboard"),
        api.get("/analytics/charts"),
      ])
      setStats(dashRes.data)
      setCharts(chartRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const revenueData = (charts?.revenueByDay || []).map((r: any) => ({
    name: new Date(r.day).toLocaleDateString("ar-SA", { month: "short", day: "numeric" }),
    الإيراد: Number(r.revenue) || 0,
  }))

  const statusData = (charts?.ordersByStatus || []).map((s: any) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#888",
  }))

  const typeData = (charts?.ordersByType || []).map((t: any) => ({
    name: TYPE_LABELS[t.type] || t.type,
    عدد: t.count,
  }))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse bg-muted rounded" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded-lg m-4" /></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">التقارير والتحليلات</h2>
          <p className="text-muted-foreground">نظرة شاملة على الإيرادات، الطلبات، وأداء الأسطول.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> تحديث البيانات
        </Button>
      </div>

      {/* ── Revenue KPIs ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">الإيرادات</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إيراد اليوم</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ج.م {(stats?.revenueToday || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إيراد هذا الأسبوع</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ج.م {(stats?.revenueWeek || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إيراد هذا الشهر</CardTitle>
              <BarChart2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ج.م {(stats?.revenueMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Orders KPIs ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">الطلبات</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">قيد الانتظار</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingOrders || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">تحتاج تعيين سائق</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">تم التسليم</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.deliveredOrders || 0}</div>
              {stats?.totalOrders > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((stats.deliveredOrders / stats.totalOrders) * 100).toFixed(0)}% من الإجمالي
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ملغاة</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.cancelledOrders || 0}</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Users ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">المستخدمون</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي السائقين</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalDrivers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">السائقون النشطون</CardTitle>
              <Truck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.activeDrivers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">من أصل {stats?.totalDrivers || 0}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Charts Row 1 ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>الإيراد اليومي</CardTitle>
            <CardDescription>آخر 30 يوم · الطلبات المكتملة فقط</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {revenueData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `ج.م ${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: any) => [`ج.م ${Number(v).toFixed(2)}`, "الإيراد"]}
                  />
                  <Bar dataKey="الإيراد" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>توزيع حالات الطلبات</CardTitle>
            <CardDescription>نسبة كل حالة من إجمالي الطلبات</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {statusData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="45%"
                    outerRadius={85}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                    fontSize={10}
                  >
                    {statusData.map((s: any, i: number) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-4 w-4 text-yellow-500" /> أفضل السائقين
            </CardTitle>
            <CardDescription>مرتبون حسب عدد التوصيلات المكتملة</CardDescription>
          </CardHeader>
          <CardContent>
            {(charts?.topDrivers || []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">لا توجد بيانات بعد</p>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-10">#</th>
                      <th className="p-3 text-left">السائق</th>
                      <th className="p-3 text-right">التوصيلات</th>
                      <th className="p-3 text-right">الأرباح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(charts?.topDrivers || []).map((d: any, i: number) => (
                      <tr key={d.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-center">
                          <span className={`font-bold text-base ${
                            i === 0 ? "text-yellow-500" :
                            i === 1 ? "text-slate-400" :
                            i === 2 ? "text-orange-400" : "text-muted-foreground"
                          }`}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </span>
                        </td>
                        <td className="p-3 font-medium">{d.name}</td>
                        <td className="p-3 text-right">
                          <Badge variant="secondary">{d.deliveries}</Badge>
                        </td>
                        <td className="p-3 text-right font-semibold text-green-600 dark:text-green-400">
                          ج.م {Number(d.earnings).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>أنواع التوصيل</CardTitle>
            <CardDescription>توزيع الطلبات حسب سرعة التوصيل</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px]">
            {typeData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <XAxis type="number" stroke="#888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} width={75} />
                  <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="عدد" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
