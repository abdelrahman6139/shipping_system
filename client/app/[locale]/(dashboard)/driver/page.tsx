"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import api from "@/lib/api"
import { connectSocket } from "@/lib/socket"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import {
  Package, MapPin, Truck, CheckCircle2, Clock, Boxes,
  Navigation, Phone, User, Calendar, DollarSign, Banknote,
  PackageCheck, XCircle, Loader2, Search, RefreshCw,
  Building2, StickyNote, ChevronLeft, ChevronRight, Eye,
} from "lucide-react"

/* ─────────────── TYPES ─────────────── */
type Order = {
  id: string
  shipmentNumber?: string
  destination: string
  pickupAddress: string
  recipientName?: string
  recipientPhone?: string
  packageDescription?: string
  notes?: string
  totalPrice: number
  itemPrice?: number
  deliveryFee?: number
  addonsTotal?: number
  grandTotal?: number
  addons?: { name: string; amount: number }[]
  status: string
  deliveryType: string
  collectionStatus?: string
  createdAt: string
  updatedAt?: string
  client?: { name?: string; phone?: string; email?: string }
  zone?: { name?: string; parent?: { name?: string } | null }
}

/* ─────────────── STATUS CONFIG ─────── */
const STATUS_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  PENDING:    { label: "قيد الانتظار",         bg: "bg-amber-50   dark:bg-amber-900/20",   text: "text-amber-700   dark:text-amber-400",   icon: Clock },
  ASSIGNED:   { label: "تم التعيين",           bg: "bg-blue-50    dark:bg-blue-900/20",    text: "text-blue-700    dark:text-blue-400",    icon: Truck },
  PICKED_UP:  { label: "تم الاستلام",          bg: "bg-violet-50  dark:bg-violet-900/20",  text: "text-violet-700  dark:text-violet-400",  icon: Boxes },
  IN_TRANSIT: { label: "جاري التوصيل",         bg: "bg-indigo-50  dark:bg-indigo-900/20",  text: "text-indigo-700  dark:text-indigo-400",  icon: Truck },
  DELIVERED:  { label: "تم التسليم",           bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", icon: PackageCheck },
  COLLECTED:  { label: "تم التسليم",           bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", icon: PackageCheck },
  CANCELLED:  { label: "ملغي",                 bg: "bg-red-50     dark:bg-red-900/20",     text: "text-red-700     dark:text-red-400",     icon: XCircle },
}

const DELIVERY_LABEL: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS:  "سريع",
  SAME_DAY: "نفس اليوم",
}

const FILTER_TABS = [
  { value: "ALL",        label: "الكل" },
  { value: "ASSIGNED",   label: "معيّن" },
  { value: "PICKED_UP",  label: "استُلم" },
  { value: "IN_TRANSIT", label: "في الطريق" },
  { value: "DELIVERED",  label: "تم التسليم" },
]

/* ─────────────── COMPONENTS ─────────── */
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  if (!cfg) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{status}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3 shrink-0" />{cfg.label}
    </span>
  )
}

function DeliveryPill({ type }: { type: string }) {
  const colors: Record<string, string> = {
    STANDARD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    EXPRESS:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    SAME_DAY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[type] || "bg-muted text-muted-foreground"}`}>
      {DELIVERY_LABEL[type] || type}
    </span>
  )
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="rounded-xl border p-4 animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-6 w-24 bg-muted rounded-full" />
          </div>
          <div className="h-3 w-48 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded-lg" />
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════ PAGE ══════════════════════════════ */
export default function DriverDashboard() {
  const { user } = useAuth()

  const [orders, setOrders]       = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefresh, setIsRefresh] = useState(false)
  const [search, setSearch]       = useState("")
  const [debSearch, setDebSearch] = useState("")
  const [filterStatus, setFilter] = useState("ALL")
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)

  /* stats */
  const [stats, setStats] = useState({ active: 0, delivered: 0, cashCollected: 0, cashNotCollected: 0 })

  /* detail dialog */
  const [selected, setSelected]         = useState<Order | null>(null)
  const [detailOpen, setDetailOpen]     = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusUpdating, setStatusUpd]  = useState(false)

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  /* fetch orders */
  const fetchOrders = useCallback(async (showLoad = false) => {
    if (showLoad) setIsLoading(true); else setIsRefresh(true)
    try {
      const params: Record<string, string | number> = { page, limit: 15 }
      if (filterStatus !== "ALL") params.status = filterStatus
      if (debSearch) params.search = debSearch
      const { data } = await api.get("/orders", { params })
      setOrders(data.orders || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch { toast.error("فشل تحميل الطلبات") }
    finally { setIsLoading(false); setIsRefresh(false) }
  }, [debSearch, filterStatus, page])

  useEffect(() => { fetchOrders(true) }, [fetchOrders])

  /* fetch stats */
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get("/driver/stats")
      setStats({
        active: data.pendingDeliveries || 0,
        delivered: data.deliveredOrders || 0,
        cashCollected: data.cashCollected?.amount || 0,
        cashNotCollected: data.cashNotCollected?.amount || 0,
      })
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  /* realtime */
  useEffect(() => {
    if (!user) return
    const socket = connectSocket()
    socket.emit("join", { userId: user.id, role: user.role })
    const refresh = () => { fetchOrders(); fetchStats() }
    const evts = ["order:assigned","order:updated","order:statusUpdated","order:collectionUpdated","order:cancelled"]
    evts.forEach(e => socket.on(e, refresh))
    return () => evts.forEach(e => socket.off(e, refresh))
  }, [fetchOrders, fetchStats, user])

  /* open detail */
  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/orders/${id}`)
      setSelected(data.order)
    } catch { toast.error("فشل تحميل التفاصيل"); setDetailOpen(false) }
    finally { setDetailLoading(false) }
  }

  /* update status */
  const updateStatus = async (newStatus: string) => {
    if (!selected) return
    setStatusUpd(true)
    try {
      await api.patch(`/orders/${selected.id}/status`, { status: newStatus })
      toast.success("تم تحديث الحالة بنجاح")
      const { data } = await api.get(`/orders/${selected.id}`)
      setSelected(data.order)
      fetchOrders(); fetchStats()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل تحديث الحالة") }
    finally { setStatusUpd(false) }
  }

  const markDriverCollected = async () => {
    if (!selected) return
    setStatusUpd(true)
    try {
      await api.patch(`/orders/${selected.id}/status`, { status: "DELIVERED", collectionStatus: "DRIVER_COLLECTED" })
      toast.success("تم تسجيل تحصيل الكاش من العميل")
      const { data } = await api.get(`/orders/${selected.id}`)
      setSelected(data.order)
      fetchOrders(); fetchStats()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل تسجيل التحصيل") }
    finally { setStatusUpd(false) }
  }

  /* next status action */
  const getNextAction = (status: string) => {
    if (statusUpdating) {
      return (
        <Button className="w-full gap-2" disabled>
          <Loader2 className="h-4 w-4 animate-spin" /> جاري التحديث...
        </Button>
      )
    }
    switch (status) {
      case "ASSIGNED":
        return (
          <Button className="w-full gap-2" onClick={() => updateStatus("PICKED_UP")}>
            <Boxes className="h-4 w-4" /> تأكيد استلام الطرد
          </Button>
        )
      case "PICKED_UP":
        return (
          <Button className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => updateStatus("IN_TRANSIT")}>
            <Navigation className="h-4 w-4" /> بدء رحلة التوصيل
          </Button>
        )
      case "IN_TRANSIT":
        return (
          <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus("DELIVERED")}>
            <CheckCircle2 className="h-4 w-4" /> تأكيد التسليم للمستلم
          </Button>
        )
      case "DELIVERED":
        if (selected?.collectionStatus === "DRIVER_COLLECTED" || selected?.collectionStatus === "COMPANY_RECEIVED" || selected?.collectionStatus === "SETTLED_TO_MERCHANT") {
          return (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center text-sm font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950/20 dark:text-sky-400">
              تم تسجيل تحصيل الكاش من العميل. التسوية مع التاجر تتم من الإدارة.
            </div>
          )
        }
        return (
          <Button className="w-full gap-2 bg-sky-600 text-white hover:bg-sky-700" onClick={markDriverCollected}>
            <Banknote className="h-4 w-4" /> تسجيل تحصيل الكاش من العميل
          </Button>
        )
      case "COLLECTED":
        return (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 dark:text-emerald-400 text-center font-medium">
            تم التسليم
          </div>
        )
      case "CANCELLED":
        return (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400 text-center font-medium">
            ✗ هذا الطلب ملغي
          </div>
        )
      default:
        return null
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })

  const orderGrandTotal = (order: Pick<Order, "grandTotal" | "totalPrice">) =>
    Number(order.grandTotal ?? order.totalPrice ?? 0)

  const orderAddons = (order: Order) =>
    Array.isArray(order.addons) ? order.addons : []

  const zoneLabel = (zone?: Order["zone"]) =>
    zone?.parent?.name ? `${zone.parent.name} / ${zone.name || "—"}` : (zone?.name || "—")

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة السائق</h1>
          <p className="text-sm text-muted-foreground mt-0.5">أدر مسارك وتابع طلباتك المعيّنة</p>
        </div>
        <button
          onClick={() => { fetchOrders(); fetchStats() }}
          disabled={isRefresh}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefresh ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "جاري التوصيل",      value: stats.active,    icon: Truck,        cls: "text-indigo-600" },
          { label: "تم التسليم",        value: stats.delivered, icon: PackageCheck, cls: "text-emerald-600" },
          { label: "كاش مع السائق",     value: `ج.م ${Number(stats.cashCollected).toFixed(0)}`, icon: Banknote, cls: "text-sky-600" },
          { label: "غير محصل",          value: `ج.م ${Number(stats.cashNotCollected).toFixed(0)}`, icon: DollarSign, cls: "text-orange-600" },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={`flex items-center gap-2 mb-1 ${s.cls}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[11px] font-medium leading-tight">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* ── Search + filter ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="ابحث بالوجهة أو اسم المستلم أو رقم الهاتف..."
            className="w-full rounded-lg border bg-background px-4 pr-10 h-11 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1) }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                filterStatus === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input text-muted-foreground hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="mr-auto self-center text-xs text-muted-foreground">{total} طلب</span>
        </div>
      </div>

      {/* ── Orders list ── */}
      {isLoading ? (
        <SkeletonCards />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed text-center">
          <Package className="h-12 w-12 text-muted-foreground/25 mb-4" />
          <p className="font-semibold text-lg">لا توجد طلبات</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || filterStatus !== "ALL" ? "جرب تعديل الفلتر أو البحث" : "لا توجد طلبات معيّنة لك حالياً"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const isActive = ["ASSIGNED","PICKED_UP","IN_TRANSIT"].includes(order.status)
            return (
              <div
                key={order.id}
                onClick={() => openDetail(order.id)}
                className={`rounded-xl border bg-card shadow-sm p-4 cursor-pointer active:bg-muted/30 transition-all hover:shadow-md hover:border-primary/30 ${
                  isActive ? "border-primary/40 ring-1 ring-primary/20" : ""
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        #{order.id.slice(0,8).toUpperCase()}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wide animate-pulse">● نشط</span>
                      )}
                    </div>
                    <p className="font-semibold text-sm leading-snug truncate">{order.destination}</p>
                    {order.recipientName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 shrink-0" />{order.recipientName}
                        {order.recipientPhone && <span dir="ltr"> • {order.recipientPhone}</span>}
                      </p>
                    )}
                  </div>
                  <StatusPill status={order.status} />
                </div>

                {/* Address row */}
                <div className="space-y-1 text-xs text-muted-foreground mb-3">
                  {order.pickupAddress && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-green-500 shrink-0" />
                      <span className="truncate">من: {order.pickupAddress}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                    <span className="truncate">إلى: {order.destination}</span>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between border-t pt-3 gap-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <DeliveryPill type={order.deliveryType} />
                    {order.shipmentNumber && (
                      <span className="text-xs text-muted-foreground font-mono">{order.shipmentNumber}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-primary text-sm">ج.م {orderGrandTotal(order).toFixed(2)}</span>
                    <button
                      className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium bg-background hover:bg-muted transition-colors"
                      onClick={e => { e.stopPropagation(); openDetail(order.id) }}
                    >
                      <Eye className="h-3.5 w-3.5" /> التفاصيل
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p-1,1))}>
              <ChevronRight className="h-4 w-4 ml-1" /> السابق
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>
              التالي <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════ DETAIL DIALOG ══════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> تفاصيل الطلب
            </DialogTitle>
            {selected && (
              <DialogDescription className="font-mono text-xs">
                #{selected.id?.slice(0,8).toUpperCase()}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : selected ? (
            <div className="space-y-4">

              {/* Status + Action */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">الحالة الحالية</p>
                  <StatusPill status={selected.status} />
                </div>
                {getNextAction(selected.status)}
              </div>

              {/* Recipient */}
              {(selected.recipientName || selected.recipientPhone) && (
                <div className="rounded-xl border p-4 space-y-3 bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">بيانات المستلم</p>
                  <div className="space-y-2 text-sm">
                    {selected.recipientName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{selected.recipientName}</span>
                      </div>
                    )}
                    {selected.recipientPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a href={`tel:${selected.recipientPhone}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline" dir="ltr">
                          {selected.recipientPhone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Addresses */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">مسار التوصيل</p>
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col items-center mt-1 shrink-0">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="w-0.5 h-8 bg-border my-1"></div>
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  </div>
                  <div className="space-y-4 flex-1 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">الاستلام من</p>
                      <p className="font-medium">{selected.pickupAddress || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">التوصيل إلى</p>
                      <p className="font-semibold">{selected.destination}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Package details */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">تفاصيل الشحنة</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">المنطقة</p>
                      <p className="font-medium">{zoneLabel(selected.zone)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">نوع التوصيل</p>
                      <p className="font-medium">{DELIVERY_LABEL[selected.deliveryType] || selected.deliveryType}</p>
                    </div>
                  </div>
                  {selected.shipmentNumber && (
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">رقم الشحنة</p>
                        <p className="font-mono font-bold text-primary">{selected.shipmentNumber}</p>
                      </div>
                    </div>
                  )}
                  {selected.packageDescription && (
                    <div className="col-span-2 flex items-start gap-2">
                      <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">وصف الطرد</p>
                        <p className="font-medium">{selected.packageDescription}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">تاريخ الطلب</p>
                      <p className="font-medium">{fmtDate(selected.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 mt-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" /> COD المطلوب تحصيله
                    </span>
                    <span className="text-2xl font-bold text-primary">ج.م {orderGrandTotal(selected).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-primary/10 pt-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">سعر المنتج</span>
                      <span className="font-semibold" dir="ltr">EGP {Number(selected.itemPrice || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">الشحن</span>
                      <span className="font-semibold" dir="ltr">EGP {Number(selected.deliveryFee || 0).toFixed(2)}</span>
                    </div>
                    {Number(selected.addonsTotal || 0) > 0 && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">الإضافات</span>
                        <span className="font-semibold" dir="ltr">EGP {Number(selected.addonsTotal || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {orderAddons(selected).length > 0 && (
                      <div className="col-span-2 text-muted-foreground">
                        {orderAddons(selected).map(addon => `${addon.name}: ${Number(addon.amount || 0).toFixed(2)}`).join("، ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div className="rounded-xl border bg-muted/30 p-4 flex items-start gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">ملاحظات</p>
                    <p className="text-sm">{selected.notes}</p>
                  </div>
                </div>
              )}

              {/* Client contact */}
              {selected.client?.name && (
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">بيانات العميل</p>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold">{selected.client.name}</p>
                      {selected.client.phone && (
                        <a href={`tel:${selected.client.phone}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1" dir="ltr">
                          <Phone className="h-3 w-3" />{selected.client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

