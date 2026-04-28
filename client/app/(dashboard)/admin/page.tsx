"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import api from "@/lib/api"
import { Package, Users, DollarSign, Activity } from "lucide-react"

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeDrivers: 0,
    totalRevenue: 0,
    pendingTickets: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    totalDrivers: 0,
  })
  const [chartData, setChartData] = useState([])
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [dashRes, chartRes, ticketsRes, ordersRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/analytics/charts'),
          api.get('/tickets'),
          api.get('/orders', { params: { limit: 5 } }),
        ])
        const d = dashRes.data
        const openTickets = (ticketsRes.data?.tickets || []).filter((t: any) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length

        setStats({
          totalOrders: d.totalOrders || 0,
          activeDrivers: d.activeDrivers || 0,
          totalRevenue: d.revenueMonth || 0,
          pendingTickets: openTickets,
          pendingOrders: d.pendingOrders || 0,
          deliveredOrders: d.deliveredOrders || 0,
          totalDrivers: d.totalDrivers || 0,
        })

        setRecentOrders(ordersRes.data?.orders || [])

        // Format revenueByDay for the chart
        const revenueByDay: { day: string; revenue: number }[] = chartRes.data?.revenueByDay || []
        if (revenueByDay.length > 0) {
          setChartData(
            revenueByDay.map((r) => ({
              name: new Date(r.day).toLocaleDateString('en-US', { weekday: 'short' }),
              revenue: Number(r.revenue) || 0,
            })) as any
          )
        } else {
          setChartData([
            { name: "Mon", revenue: 1500 },
            { name: "Tue", revenue: 2300 },
            { name: "Wed", revenue: 1900 },
            { name: "Thu", revenue: 2800 },
            { name: "Fri", revenue: 3500 },
            { name: "Sat", revenue: 1200 },
            { name: "Sun", revenue: 950 },
          ] as any)
        }
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
        setChartData([
          { name: "Mon", revenue: 1500 },
          { name: "Tue", revenue: 2300 },
          { name: "Wed", revenue: 1900 },
          { name: "Thu", revenue: 2800 },
          { name: "Fri", revenue: 3500 },
          { name: "Sat", revenue: 1200 },
          { name: "Sun", revenue: 950 },
        ] as any)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchAnalytics()
  }, [])

  const getTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diff < 60) return 'الآن'
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`
    return `قبل ${Math.floor(diff / 86400)} يوم`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">نظرة عامة للمشرف</h2>
        <p className="text-muted-foreground">راقب نشاط النظام والإيرادات وأداء الأسطول بشكل لحظي.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : (stats?.totalOrders || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : `${stats.pendingOrders} قيد الانتظار`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : `ج.م ${(stats?.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : `${stats.deliveredOrders} طلب مكتمل هذا الشهر`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">السائقون النشطون</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : (stats?.activeDrivers || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "" : `من أصل ${stats.totalDrivers} سائق`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">التذاكر المفتوحة</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : (stats?.pendingTickets || 0)}</div>
            <p className="text-xs text-muted-foreground">تحتاج متابعة قريباً</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>نظرة عامة على الإيرادات</CardTitle>
            <CardDescription>الإيراد اليومي الناتج من الشحنات خلال آخر 7 أيام.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {isLoading ? (
               <div className="w-full h-full flex items-center justify-center text-muted-foreground">جاري تحميل الرسم البياني...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `ج.م ${value}`} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                  <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>أحدث الأنشطة</CardTitle>
            <CardDescription>تحديثات مباشرة من الأسطول.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد طلبات حديثة.</p>
              ) : (
                recentOrders.map((order: any) => {
                  const statusMap: Record<string, {label: string, color: string}> = {
                    PENDING: { label: 'قيد الانتظار', color: 'text-yellow-600' },
                    ASSIGNED: { label: 'تم التعيين', color: 'text-blue-500' },
                    PICKED_UP: { label: 'تم الاستلام', color: 'text-purple-500' },
                    IN_TRANSIT: { label: 'قيد التوصيل', color: 'text-indigo-500' },
                    DELIVERED: { label: 'تم التسليم', color: 'text-green-500' },
                    CANCELLED: { label: 'ملغي', color: 'text-red-500' },
                  }
                  const s = statusMap[order.status] || { label: order.status, color: 'text-muted-foreground' }
                  const timeAgo = getTimeAgo(new Date(order.createdAt))
                  return (
                    <div key={order.id} className="flex items-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="ml-4 space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">طلب #{order.id.slice(0, 8)}</p>
                        <p className={`text-xs ${s.color}`}>{s.label} {order.driver?.name ? `• ${order.driver.name}` : ''}</p>
                      </div>
                      <div className="ml-auto font-medium text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</div>
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

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
