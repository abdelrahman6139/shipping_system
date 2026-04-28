"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { toast } from "sonner"
import { connectSocket } from "@/lib/socket"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import {
  Download, FileText, Search, MapPin, Truck, Calendar,
  DollarSign, Package, Phone, User, Plus, Loader2,
  CheckCircle2, Clock, Boxes, XCircle, ChevronLeft, ChevronRight,
  Building2, Ruler, StickyNote, Filter, Banknote, PackageCheck,
} from "lucide-react"

/* ─────────────────────────── TYPES ─────────────────────────── */
type Order = {
  id: string
  destination: string
  pickupAddress: string
  recipientName?: string
  recipientPhone?: string
  packageDescription?: string
  totalPrice: number
  status: string
  deliveryType: string
  weight: number
  length?: number
  width?: number
  height?: number
  notes?: string
  createdAt: string
  zone?: { name: string }
  driver?: { name: string; phone?: string }
}

type Pagination = { total: number; totalPages: number; page: number }

/* ─────────────────────────── CONSTANTS ─────────────────────── */
const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; icon: any; step: number }> = {
  PENDING:    { label: "قيد الانتظار",       bg: "bg-amber-50   dark:bg-amber-900/20",   text: "text-amber-700   dark:text-amber-400",   dot: "bg-amber-400",    icon: Clock,        step: 0 },
  ASSIGNED:   { label: "تم التعيين",         bg: "bg-blue-50    dark:bg-blue-900/20",    text: "text-blue-700    dark:text-blue-400",    dot: "bg-blue-400",     icon: Truck,        step: 1 },
  PICKED_UP:  { label: "تم الاستلام",        bg: "bg-violet-50  dark:bg-violet-900/20",  text: "text-violet-700  dark:text-violet-400",  dot: "bg-violet-400",   icon: Boxes,        step: 2 },
  IN_TRANSIT: { label: "جاري التوصيل",       bg: "bg-indigo-50  dark:bg-indigo-900/20",  text: "text-indigo-700  dark:text-indigo-400",  dot: "bg-indigo-400",   icon: Truck,        step: 3 },
  DELIVERED:  { label: "في انتظار التحصيل", bg: "bg-orange-50  dark:bg-orange-900/20",  text: "text-orange-700  dark:text-orange-400",  dot: "bg-orange-500",   icon: PackageCheck, step: 4 },
  COLLECTED:  { label: "تم التحصيل",        bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500",  icon: Banknote,     step: 4 },
  CANCELLED:  { label: "ملغي",              bg: "bg-red-50     dark:bg-red-900/20",     text: "text-red-700     dark:text-red-400",     dot: "bg-red-500",      icon: XCircle,      step: -1 },
}

const DELIVERY_LABEL: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS:  "سريع",
  SAME_DAY: "نفس اليوم",
}

const STEPS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]
const STEP_SHORT_LABEL = ["انتظار", "تعيين", "استلام", "توصيل", "تسليم"]

const STATUS_FILTERS = [
  { value: "ALL",        label: "الكل" },
  { value: "PENDING",    label: "انتظار" },
  { value: "ASSIGNED",   label: "معيّن" },
  { value: "PICKED_UP",  label: "استُلم" },
  { value: "IN_TRANSIT", label: "في الطريق" },
  { value: "DELIVERED",  label: "لم يُحصَّل" },
  { value: "COLLECTED",  label: "تم التحصيل" },
  { value: "CANCELLED",  label: "ملغي" },
]

/* ─────────────────────────── COMPONENTS ────────────────────── */
function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  if (!cfg) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{status}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
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

function Timeline({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
        <XCircle className="h-4 w-4 shrink-0" /> تم إلغاء هذا الطلب
      </div>
    )
  }
  const cur = STATUS_CFG[status === "COLLECTED" ? "DELIVERED" : status]?.step ?? 0
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const cfg = STATUS_CFG[s]
        const Icon = cfg.icon
        const done = i < cur
        const active = i === cur
        return (
          <div key={s} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                done   ? "border-primary bg-primary text-primary-foreground" :
                active ? "border-primary bg-primary/10 text-primary" :
                         "border-muted bg-background text-muted-foreground/30"
              }`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className={`text-[9px] text-center leading-tight w-14 ${
                active ? "font-bold text-primary" : done ? "text-primary/60" : "text-muted-foreground/40"
              }`}>{STEP_SHORT_LABEL[i]}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-0.5 rounded ${i < cur ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="rounded-xl border p-4 animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-6 w-20 bg-muted rounded-full" />
          </div>
          <div className="h-3 w-48 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════ PAGE ══════════════════════════════ */
export default function ClientOrdersPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [orders, setOrders]           = useState<Order[]>([])
  const [pagination, setPagination]   = useState<Pagination>({ total: 0, totalPages: 1, page: 1 })
  const [isLoading, setIsLoading]     = useState(true)
  const [search, setSearch]           = useState("")
  const [debouncedSearch, setDebounced] = useState("")
  const [page, setPage]               = useState(1)
  const [filterStatus, setFilter]     = useState("ALL")

  const [detailOpen, setDetailOpen]   = useState(false)
  const [selected, setSelected]       = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  /* fetch */
  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 10 }
      if (debouncedSearch) params.search = debouncedSearch
      if (filterStatus !== "ALL") params.status = filterStatus
      const { data } = await api.get("/orders", { params })
      setOrders(data.orders || [])
      setPagination(data.pagination || { total: 0, totalPages: 1, page })
    } catch {
      toast.error("فشل تحميل الطلبات")
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, filterStatus, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  /* realtime */
  useEffect(() => {
    if (!user) return
    const socket = connectSocket()
    socket.emit("join", { userId: user.id, role: user.role })
    const refresh = () => fetchOrders()
    const events = ["order:created","order:updated","order:assigned","order:statusUpdated","order:cancelled"]
    events.forEach(e => socket.on(e, refresh))
    return () => events.forEach(e => socket.off(e, refresh))
  }, [fetchOrders, user])

  /* detail */
  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/orders/${id}`)
      setSelected(data.order)
    } catch {
      toast.error("فشل تحميل التفاصيل")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  /* invoice */
  const downloadInvoice = async (orderId: string) => {
    try {
      const res = await api.get(`/invoices/${orderId}/download`, { responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement("a")
      a.href = url
      a.download = `invoice-${orderId.slice(0,8)}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
    } catch { toast.error("فشل تنزيل الفاتورة") }
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <div className="space-y-5 pb-10 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">طلباتي</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total > 0 ? `${pagination.total} طلب إجمالي` : "لا توجد طلبات بعد"}
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => router.push("/client/new-order")}>
          <Plus className="h-4 w-4" /> طلب جديد
        </Button>
      </div>

      {/* ── Search + Status filter pills ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث برقم الطلب، اسم المستلم، الهاتف، الوجهة..."
            className="pr-10 h-11"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* Status pill filters */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
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
        </div>
      </div>

      {/* ── Orders list ── */}
      {isLoading ? (
        <Skeleton />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed">
          <Package className="h-12 w-12 text-muted-foreground/25 mb-4" />
          <p className="font-semibold text-lg">لا توجد طلبات</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            {search || filterStatus !== "ALL" ? "جرب تعديل الفلتر أو البحث" : "أنشئ أول طلب شحن الآن"}
          </p>
          {!search && filterStatus === "ALL" && (
            <Button onClick={() => router.push("/client/new-order")} className="gap-2">
              <Plus className="h-4 w-4" /> طلب شحن جديد
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 border-b">
                <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 text-right font-medium">الطلب</th>
                  <th className="px-4 py-3 text-right font-medium">المستلم</th>
                  <th className="px-4 py-3 text-right font-medium">الوجهة</th>
                  <th className="px-4 py-3 text-right font-medium">نوع التوصيل</th>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium">السعر</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o, idx) => (
                  <tr
                    key={o.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    onClick={() => openDetail(o.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        #{o.id.slice(0,8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{o.recipientName || "—"}</p>
                      {o.recipientPhone && <p className="text-xs text-muted-foreground" dir="ltr">{o.recipientPhone}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="truncate text-sm" title={o.destination}>{o.destination}</p>
                    </td>
                    <td className="px-4 py-3"><DeliveryPill type={o.deliveryType} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-primary">ج.م {o.totalPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="تفاصيل"
                          onClick={() => openDetail(o.id)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="الفاتورة"
                          onClick={() => downloadInvoice(o.id)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {orders.map(o => (
              <div
                key={o.id}
                className="rounded-xl border bg-card shadow-sm p-4 space-y-3 active:bg-muted/40 transition-colors"
                onClick={() => openDetail(o.id)}
              >
                {/* Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      #{o.id.slice(0,8).toUpperCase()}
                    </span>
                    <p className="font-semibold text-sm mt-1 leading-snug">{o.recipientName || "—"}</p>
                    {o.recipientPhone && (
                      <p className="text-xs text-muted-foreground" dir="ltr">{o.recipientPhone}</p>
                    )}
                  </div>
                  <StatusPill status={o.status} />
                </div>

                {/* Middle */}
                <div className="space-y-1 text-xs text-muted-foreground border-t pt-2">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 text-red-500" />
                    <span className="truncate">{o.destination}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{formatDate(o.createdAt)}
                    </span>
                    <DeliveryPill type={o.deliveryType} />
                  </div>
                </div>

                {/* Bottom */}
                <div className="flex items-center justify-between border-t pt-2"
                  onClick={e => e.stopPropagation()}>
                  <span className="text-lg font-bold text-primary">ج.م {o.totalPrice.toFixed(2)}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                      onClick={e => { e.stopPropagation(); openDetail(o.id) }}>
                      <FileText className="h-3.5 w-3.5" /> تفاصيل
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"
                      onClick={e => { e.stopPropagation(); downloadInvoice(o.id) }}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                صفحة {page} من {pagination.totalPages}
                <span className="text-muted-foreground/60 mr-2">({pagination.total} طلب)</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(p-1,1))}>
                  <ChevronRight className="h-4 w-4 ml-1" /> السابق
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages}
                  onClick={() => setPage(p => p+1)}>
                  التالي <ChevronLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════ Detail Dialog ══════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
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

              {/* Status timeline */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">مسار الشحنة</p>
                <Timeline status={selected.status} />
              </div>

              {/* Cash Collection Status - read-only for client */}
              {(selected.status === "DELIVERED" || selected.status === "COLLECTED") && (
                <div className={`rounded-xl border p-4 flex items-center gap-3 ${
                  selected.status === "COLLECTED"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900"
                    : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900"
                }`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                    selected.status === "COLLECTED"
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : "bg-orange-100 dark:bg-orange-900/40"
                  }`}>
                    <Banknote className={`h-5 w-5 ${
                      selected.status === "COLLECTED" ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">التحصيل المالي</p>
                    <p className={`text-sm font-semibold ${
                      selected.status === "COLLECTED"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-orange-700 dark:text-orange-400"
                    }`}>
                      {selected.status === "COLLECTED"
                        ? "✓ تم استلام مبلغ الشحنة"
                        : "في انتظار استلام مبلغ الشحنة"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selected.status === "COLLECTED"
                        ? "تم تحصيل مبلغ شحنتك بنجاح"
                        : "لم يتم تحصيل مبلغ شحنتك بعد"}
                    </p>
                  </div>
                </div>
              )}

              {/* Recipient card */}
              <div className="rounded-xl border p-4 bg-muted/30 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">بيانات المستلم</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="الاسم" value={selected.recipientName || "غير محدد"} />
                  <InfoRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="الهاتف" value={selected.recipientPhone || "غير محدد"} dir="ltr" />
                  <div className="sm:col-span-2">
                    <InfoRow icon={<MapPin className="h-4 w-4 text-red-500" />} label="عنوان التسليم" value={selected.destination} />
                  </div>
                </div>
              </div>

              {/* Shipment details */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">تفاصيل الشحنة</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoRow icon={<MapPin className="h-4 w-4 text-green-500" />} label="عنوان الاستلام" value={selected.pickupAddress} />
                  <InfoRow icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="المنطقة" value={selected.zone?.name || "—"} />
                  <InfoRow icon={<Truck className="h-4 w-4 text-muted-foreground" />} label="نوع التوصيل" value={DELIVERY_LABEL[selected.deliveryType] || selected.deliveryType} />
                  <InfoRow icon={<Package className="h-4 w-4 text-muted-foreground" />} label="الوزن" value={`${selected.weight} كغ`} />
                  <InfoRow icon={<Ruler className="h-4 w-4 text-muted-foreground" />} label="الأبعاد"
                    value={selected.length ? `${selected.length}×${selected.width}×${selected.height} cm` : "—"} dir="ltr" />
                  <InfoRow icon={<Calendar className="h-4 w-4 text-muted-foreground" />} label="التاريخ" value={formatDate(selected.createdAt)} />
                  {selected.packageDescription && (
                    <div className="sm:col-span-2">
                      <InfoRow icon={<Package className="h-4 w-4 text-muted-foreground" />} label="وصف الطرد" value={selected.packageDescription} />
                    </div>
                  )}
                </div>

                {/* Total price highlight */}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" /> إجمالي التكلفة
                  </span>
                  <span className="text-2xl font-bold text-primary">ج.م {Number(selected.totalPrice).toFixed(2)}</span>
                </div>
              </div>

              {/* Driver */}
              {selected.driver && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">السائق المعيّن</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{selected.driver.name}</p>
                      {selected.driver.phone && (
                        <p className="text-xs text-muted-foreground" dir="ltr">{selected.driver.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selected.notes && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-start gap-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">ملاحظات</p>
                      <p className="text-sm">{selected.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action */}
              <Button variant="outline" className="w-full gap-2" onClick={() => downloadInvoice(selected.id)}>
                <Download className="h-4 w-4" /> تنزيل الفاتورة PDF
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* small helper */
function InfoRow({ icon, label, value, dir: d }: { icon: React.ReactNode; label: string; value: string; dir?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium text-sm break-words" dir={d}>{value}</p>
      </div>
    </div>
  )
}
