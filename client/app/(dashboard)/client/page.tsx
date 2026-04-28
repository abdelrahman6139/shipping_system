"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Package, Plus, Clock, Truck, CheckCircle } from "lucide-react"

export default function ClientDashboard() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "قيد الانتظار"
      case "ASSIGNED":
        return "تم التعيين"
      case "PICKED_UP":
        return "تم الاستلام"
      case "IN_TRANSIT":
        return "قيد التوصيل"
      case "DELIVERED":
        return "تم التسليم"
      case "CANCELLED":
        return "ملغي"
      default:
        return status
    }
  }

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await api.get('/orders')
        setOrders(data.orders || [])
      } catch (error) {
        console.error("Failed to fetch orders", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">مرحباً، {user?.name}</h2>
          <p className="text-muted-foreground">أدر شحناتك وتتبع الطلبات النشطة.</p>
        </div>
        <Link href="/client/new-order">
          <Button className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            طلب جديد
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : orders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">كل الطلبات</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قيد الانتظار</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {isLoading ? "..." : (orders as any[]).filter((o: any) => o.status === "PENDING").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">تنتظر سائقاً</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قيد التوصيل</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {isLoading ? "..." : (orders as any[]).filter((o: any) =>
                ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(o.status)
              ).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">في الطريق إليك</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تم التسليم</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoading ? "..." : (orders as any[]).filter((o: any) => o.status === "DELIVERED").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">مكتملة بنجاح</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>أحدث الطلبات</CardTitle>
          <CardDescription>أحدث الشحنات الخاصة بك</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">جاري تحميل الطلبات...</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <p className="text-lg font-medium">لا توجد طلبات بعد</p>
              <p className="text-sm text-muted-foreground mb-4">لم تقم بإنشاء أي طلب شحن حتى الآن.</p>
              <Link href="/client/new-order">
                <Button variant="outline">أنشئ أول طلب لك</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {(orders as any[]).slice(0, 5).map((order: any) => {
                const statusMap: Record<string, { label: string; cls: string }> = {
                  PENDING: { label: "قيد الانتظار", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500" },
                  ASSIGNED: { label: "تم التعيين", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
                  PICKED_UP: { label: "تم الاستلام", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
                  IN_TRANSIT: { label: "قيد التوصيل", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
                  DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500" },
                  CANCELLED: { label: "ملغي", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500" },
                }
                const s = statusMap[order.status] || { label: order.status, cls: "bg-muted text-muted-foreground" }
                return (
                  <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">طلب #{order.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground truncate" title={order.destination}>{order.destination}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("ar-SA")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className={s.cls}>{s.label}</Badge>
                      {order.totalPrice != null && (
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">ج.م {Number(order.totalPrice).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {orders.length > 5 && (
                <Link href="/client/orders">
                  <Button variant="outline" className="w-full mt-4">عرض كل الطلبات</Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
