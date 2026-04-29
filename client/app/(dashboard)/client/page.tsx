"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Banknote, CheckCircle, Clock, Package, Plus, Truck } from "lucide-react"

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "قيد الانتظار", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500" },
  ASSIGNED: { label: "تم التعيين", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  PICKED_UP: { label: "تم الاستلام", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  IN_TRANSIT: { label: "قيد التوصيل", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
  DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500" },
  COLLECTED: { label: "تم التسليم", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500" },
  CANCELLED: { label: "ملغي", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500" },
  RETURNED: { label: "مرتجع", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
}

function money(value: number) {
  return `ج.م ${Number(value || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })}`
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get("/analytics/client-dashboard")
        setDashboard(data)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const summary = dashboard?.summary || {}
  const orders = dashboard?.latestOrders || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">مرحباً، {user?.name}</h2>
          <p className="text-muted-foreground">تابع الشحنات والتحصيل والتسويات الخاصة بمتجرك.</p>
        </div>
        <Link href="/client/new-order">
          <Button className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            طلب جديد
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : summary.totalOrders || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">كل الشحنات</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تم التسليم</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{isLoading ? "..." : summary.deliveredShipments || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">شحنات وصلت للمستلمين</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">غير مسوى للتاجر</CardTitle>
            <Banknote className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600">{isLoading ? "..." : money(summary.amountNotSettledToMerchant)}</div>
            <p className="mt-1 text-xs text-muted-foreground">تم تحصيله ولم يدفع بعد</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مسوى للتاجر</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{isLoading ? "..." : money(summary.amountSettledToMerchant)}</div>
            <p className="mt-1 text-xs text-muted-foreground">مبالغ تم دفعها</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قيد التوصيل</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{isLoading ? "..." : summary.inTransitOrders || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">في انتظار سائق</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{isLoading ? "..." : summary.pendingOrders || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تحصيل معلق من العميل</CardTitle>
            <Banknote className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{isLoading ? "..." : money(summary.pendingCollectionAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أحدث الطلبات</CardTitle>
          <CardDescription>آخر خمس شحنات بدون تحميل كل السجل</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">جاري تحميل الطلبات...</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="mb-4 h-12 w-12 text-muted-foreground opacity-20" />
              <p className="text-lg font-medium">لا توجد طلبات بعد</p>
              <p className="mb-4 text-sm text-muted-foreground">لم تقم بإنشاء أي طلب شحن حتى الآن.</p>
              <Link href="/client/new-order"><Button variant="outline">أنشئ أول طلب لك</Button></Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => {
                const status = STATUS_MAP[order.status] || { label: order.status, cls: "bg-muted text-muted-foreground" }
                return (
                  <div key={order.id} className="flex items-center justify-between gap-4 border-b pb-4 last:border-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{order.shipmentNumber || `طلب #${order.id.slice(0, 8)}`}</p>
                      <p className="truncate text-sm text-muted-foreground" title={order.destination}>{order.destination}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("ar-EG")}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className={status.cls}>{status.label}</Badge>
                      {order.totalPrice != null && <span className="text-xs font-semibold text-green-600">{money(order.totalPrice)}</span>}
                    </div>
                  </div>
                )
              })}
              <Link href="/client/orders">
                <Button variant="outline" className="mt-4 w-full">عرض كل الطلبات</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
