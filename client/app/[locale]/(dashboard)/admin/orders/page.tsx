"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import api from "@/lib/api"
import { toast } from "sonner"
import { connectSocket } from "@/lib/socket"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { useLocale, useTranslations } from "next-intl"
import { formatMoney, type ChartLocale } from "@/lib/chart-format"
import {
  Search, Eye, Download, MapPin, Truck, User, Calendar,
  DollarSign, Phone, UserCheck, Package, Clock,
  XCircle, Boxes, ChevronLeft, ChevronRight, Loader2,
  X, Building2, StickyNote, RefreshCw, Banknote, PackageCheck, ScanLine,
} from "lucide-react"
import { useRouter } from "next/navigation"

/* ─────────────── TYPES ─────────────── */
type Driver = { id: string; name: string; phone?: string }
type Client = { id?: string; name?: string; email?: string; phone?: string }

type Order = {
  id: string
  shipmentNumber?: string
  clientId: string
  driverId: string | null
  destination: string
  pickupAddress?: string
  packageDescription?: string
  recipientName?: string
  recipientPhone?: string
  status: string
  deliveryType: string
  collectionStatus?: string
  totalPrice: number
  itemPrice?: number
  deliveryFee?: number
  addonsTotal?: number
  grandTotal?: number
  addons?: { name: string; amount: number }[]
  notes?: string
  cancellationReason?: string
  returnReason?: string
  createdAt: string
  updatedAt?: string
  client?: Client
  driver?: Driver | null
  zone?: { id?: string; name?: string; parent?: { id?: string; name?: string } | null } | null
  invoice?: { id?: string; pdfUrl?: string } | null
}

/* ─────────────── STATUS CONFIG ─────── */
const STATUS_CFG: Record<string, { bg: string; text: string; icon: any; step: number }> = {
  PENDING:    { bg: "bg-amber-50   dark:bg-amber-900/20",   text: "text-amber-700   dark:text-amber-400",   icon: Clock,        step: 0 },
  ASSIGNED:   { bg: "bg-blue-50    dark:bg-blue-900/20",    text: "text-blue-700    dark:text-blue-400",    icon: Truck,        step: 1 },
  PICKED_UP:  { bg: "bg-violet-50  dark:bg-violet-900/20",  text: "text-violet-700  dark:text-violet-400",  icon: Boxes,        step: 2 },
  IN_TRANSIT: { bg: "bg-indigo-50  dark:bg-indigo-900/20",  text: "text-indigo-700  dark:text-indigo-400",  icon: Truck,        step: 3 },
  DELIVERED:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", icon: PackageCheck, step: 4 },
  COLLECTED:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", icon: PackageCheck, step: 4 },
  CANCELLED:  { bg: "bg-red-50     dark:bg-red-900/20",     text: "text-red-700     dark:text-red-400",     icon: XCircle,      step: -1 },
  RETURNED:   { bg: "bg-purple-50  dark:bg-purple-900/20",  text: "text-purple-700  dark:text-purple-400",  icon: XCircle,      step: -1 },
}

const STATUS_OPTIONS = ["PENDING","ASSIGNED","PICKED_UP","IN_TRANSIT","DELIVERED","CANCELLED","RETURNED"]
const STEPS = ["PENDING","ASSIGNED","PICKED_UP","IN_TRANSIT","DELIVERED"]
const FILTER_TABS = ["ALL", "PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"]
const COLLECTION_ACTIONS = ["DRIVER_COLLECTED", "COMPANY_RECEIVED", "SETTLED_TO_MERCHANT"]

const COLLECTION_CFG: Record<string, { bg: string; text: string }> = {
  NOT_COLLECTED: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400" },
  DRIVER_COLLECTED: { bg: "bg-sky-50 dark:bg-sky-900/20", text: "text-sky-700 dark:text-sky-400" },
  COMPANY_RECEIVED: { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-400" },
  SETTLED_TO_MERCHANT: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400" },
}

/* ─────────────── COMPONENTS ─────────── */
function StatusPill({ status }: { status: string }) {
  const statusT = useTranslations("Status")
  const cfg = STATUS_CFG[status]
  if (!cfg) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{status}</span>
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3 shrink-0" />{statusT(status)}
    </span>
  )
}

function DeliveryPill({ type }: { type: string }) {
  const deliveryT = useTranslations("DeliveryType")
  const colors: Record<string, string> = {
    STANDARD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    EXPRESS:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    SAME_DAY: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[type] || "bg-muted text-muted-foreground"}`}>
      {deliveryT(type)}
    </span>
  )
}

function Timeline({ status }: { status: string }) {
  const t = useTranslations("Orders")
  const statusT = useTranslations("Status")
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
        <XCircle className="h-4 w-4 shrink-0" /> {t("cancelledOrder")}
      </div>
    )
  }
  const cur = STATUS_CFG[status === "COLLECTED" ? "DELIVERED" : status]?.step ?? 0
  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const cfg = STATUS_CFG[s]
        const Icon = cfg.icon
        const done = i < cur
        const active = i === cur
        return (
          <div key={s} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                done   ? "border-primary bg-primary text-primary-foreground" :
                active ? "border-primary bg-primary/10 text-primary" :
                         "border-muted bg-background text-muted-foreground/30"
              }`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className={`text-[9px] text-center leading-tight w-14 ${
                active ? "font-bold text-primary" : done ? "text-primary/60" : "text-muted-foreground/40"
              }`}>{statusT(s)}</p>
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

function SkeletonRows() {
  return (
    <>
      {[1,2,3,4,5].map(i => (
        <tr key={i} className="border-b animate-pulse">
          <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded" /></td>
          <td className="px-4 py-3"><div className="h-4 w-28 bg-muted rounded" /></td>
          <td className="px-4 py-3"><div className="h-4 w-28 bg-muted rounded" /></td>
          <td className="px-4 py-3"><div className="h-4 w-32 bg-muted rounded" /></td>
          <td className="px-4 py-3"><div className="h-6 w-20 bg-muted rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-4 w-16 bg-muted rounded" /></td>
          <td className="px-4 py-3"><div className="h-8 w-20 bg-muted rounded" /></td>
        </tr>
      ))}
    </>
  )
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
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
export default function AdminOrdersPage() {
  const { user } = useAuth()
  const { localizedPath } = useLanguage()
  const router = useRouter()
  const t = useTranslations("Orders")
  const commonT = useTranslations("Common")
  const statusT = useTranslations("Status")
  const collectionT = useTranslations("CollectionStatus")
  const deliveryT = useTranslations("DeliveryType")
  const locale = useLocale() as ChartLocale

  const [orders, setOrders]       = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefresh, setIsRefresh] = useState(false)
  const [search, setSearch]       = useState("")
  const [debSearch, setDebSearch] = useState("")
  const [filterStatus, setFilter] = useState("ALL")
  const [drivers, setDrivers]     = useState<Driver[]>([])
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]         = useState(0)
  const [exporting, setExporting] = useState(false)

  /* detail dialog */
  const [selected, setSelected]         = useState<Order | null>(null)
  const [detailOpen, setDetailOpen]     = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignDriverId, setAssignId]   = useState("")
  const [assigning, setAssigning]       = useState(false)
  const [statusUpdating, setStatusUpd]  = useState(false)
  const [cancelling, setCancelling]     = useState(false)

  /* stats */
  const [stats, setStats] = useState({ total: 0, pending: 0, inTransit: 0, delivered: 0, collected: 0, cancelled: 0 })

  /* debounce */
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search.trim()); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  /* fetch drivers once */
  useEffect(() => {
    api.get("/users/drivers/available")
      .then(r => setDrivers(r.data.drivers || []))
      .catch(() => {})
  }, [])

  /* fetch stats once */
  const fetchStats = useCallback(async () => {
    try {
      const calls = await Promise.all([
        api.get("/orders", { params: { limit: 1 } }),
        api.get("/orders", { params: { status: "PENDING",    limit: 1 } }),
        api.get("/orders", { params: { status: "IN_TRANSIT", limit: 1 } }),
        api.get("/orders", { params: { status: "DELIVERED",  limit: 1 } }),
        api.get("/orders", { params: { collectionStatus: "DRIVER_COLLECTED", limit: 1 } }),
        api.get("/orders", { params: { status: "CANCELLED",  limit: 1 } }),
      ])
      setStats({
        total:     calls[0].data.pagination?.total || 0,
        pending:   calls[1].data.pagination?.total || 0,
        inTransit: calls[2].data.pagination?.total || 0,
        delivered: calls[3].data.pagination?.total || 0,
        collected: calls[4].data.pagination?.total || 0,
        cancelled: calls[5].data.pagination?.total || 0,
      })
    } catch {}
  }, [])

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
    } catch { toast.error(t("errors.loadOrders")) }
    finally { setIsLoading(false); setIsRefresh(false) }
  }, [debSearch, filterStatus, page])

  useEffect(() => { fetchOrders(true) }, [fetchOrders])
  useEffect(() => { fetchStats() }, [fetchStats])

  /* realtime */
  useEffect(() => {
    if (!user) return
    const socket = connectSocket()
    socket.emit("join", { userId: user.id, role: user.role })
    const refresh = () => { fetchOrders(); fetchStats() }
    const evts = ["order:created","order:updated","order:assigned","order:statusUpdated","order:collectionUpdated","order:cancelled"]
    evts.forEach(e => socket.on(e, refresh))
    return () => evts.forEach(e => socket.off(e, refresh))
  }, [fetchOrders, fetchStats, user])

  /* open detail */
  const openDetail = async (id: string) => {
    setDetailOpen(true); setDetailLoading(true); setAssignId("")
    try {
      const { data } = await api.get(`/orders/${id}`)
      setSelected(data.order)
    } catch { toast.error(t("errors.loadDetails")); setDetailOpen(false) }
    finally { setDetailLoading(false) }
  }

  /* update status */
  const updateStatus = async (newStatus: string) => {
    if (!selected) return
    if ((selected.status === "CANCELLED" || selected.status === "RETURNED") && newStatus !== selected.status) {
      const confirmed = window.confirm(t("confirmTerminalChange"))
      if (!confirmed) return
    }
    setStatusUpd(true)
    try {
      await api.patch(`/orders/${selected.id}/status`, { status: newStatus })
      toast.success(t("success.statusUpdated"))
      const { data } = await api.get(`/orders/${selected.id}`)
      setSelected(data.order)
      fetchOrders(); fetchStats()
    } catch (e: any) { toast.error(e.response?.data?.error || t("errors.updateStatus")) }
    finally { setStatusUpd(false) }
  }

  const updateCollectionStatus = async (collectionStatus: string) => {
    if (!selected) return
    setStatusUpd(true)
    try {
      await api.patch(`/orders/${selected.id}/collection`, { collectionStatus })
      toast.success(t("success.collectionUpdated"))
      const { data } = await api.get(`/orders/${selected.id}`)
      setSelected(data.order)
      fetchOrders(); fetchStats()
    } catch (e: any) { toast.error(e.response?.data?.error || t("errors.updateCollection")) }
    finally { setStatusUpd(false) }
  }

  /* assign driver */
  const assignDriver = async () => {
    if (!selected || !assignDriverId) return
    setAssigning(true)
    try {
      await api.patch(`/orders/${selected.id}/assign`, { driverId: assignDriverId })
      toast.success(t("success.driverAssigned"))
      setAssignId("")
      const { data } = await api.get(`/orders/${selected.id}`)
      setSelected(data.order)
      fetchOrders()
    } catch (e: any) { toast.error(e.response?.data?.error || t("errors.assignDriver")) }
    finally { setAssigning(false) }
  }

  /* cancel order */
  const cancelOrder = async () => {
    if (!selected) return
    setCancelling(true)
    try {
      await api.delete(`/orders/${selected.id}`)
      toast.success(t("success.orderCancelled"))
      setDetailOpen(false)
      fetchOrders(); fetchStats()
    } catch (e: any) { toast.error(e.response?.data?.error || t("errors.cancelOrder")) }
    finally { setCancelling(false) }
  }

  /* download invoice */
  const downloadInvoice = async (orderId: string) => {
    try {
      const res = await api.get(`/invoices/${orderId}/download`, { responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a"); a.href = url
      a.download = `invoice-${orderId.slice(0,8)}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
    } catch { toast.error(t("errors.downloadInvoice")) }
  }

  const openWaybill = (order: Order) => {
    if (!order.shipmentNumber) {
      toast.error(t("errors.noShipmentNumber"))
      return
    }
    router.push(localizedPath(`/admin/waybill?shipmentNumber=${encodeURIComponent(order.shipmentNumber)}`))
  }

  const orderGrandTotal = (order: Pick<Order, "grandTotal" | "totalPrice">) =>
    Number(order.grandTotal ?? order.totalPrice ?? 0)

  const orderAddons = (order: Order) =>
    Array.isArray(order.addons) ? order.addons : []

  const zoneLabel = (zone?: Order["zone"]) =>
    zone?.parent?.name ? `${zone.parent.name} / ${zone.name || "—"}` : (zone?.name || "—")

  const exportOrders = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = {}
      if (filterStatus !== "ALL") params.status = filterStatus
      if (debSearch) params.search = debSearch
      const res = await api.get("/admin/export/orders.xlsx", { params, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = `orders-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error(e.response?.data?.error || t("errors.exportExcel"))
    } finally {
      setExporting(false)
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { year: "numeric", month: "short", day: "numeric" })

  const money = useCallback((value: unknown) => formatMoney(value, locale), [locale])

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportOrders} disabled={exporting}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {commonT("exportExcel")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { fetchOrders(); fetchStats() }} disabled={isRefresh}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefresh ? "animate-spin" : ""}`} />
            {commonT("refresh")}
          </Button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: t("stats.total"),     value: stats.total,     icon: Package,      cls: "text-primary" },
          { label: statusT("PENDING"),   value: stats.pending,   icon: Clock,        cls: "text-amber-600" },
          { label: statusT("IN_TRANSIT"), value: stats.inTransit, icon: Truck,        cls: "text-indigo-600" },
          { label: statusT("DELIVERED"), value: stats.delivered, icon: PackageCheck, cls: "text-emerald-600" },
          { label: collectionT("DRIVER_COLLECTED"), value: stats.collected, icon: Banknote, cls: "text-sky-600" },
          { label: statusT("CANCELLED"), value: stats.cancelled, icon: XCircle,      cls: "text-red-600" },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className={`flex items-center gap-2 mb-1 ${s.cls}`}>
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="pr-10 h-11"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                filterStatus === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {t("results", { count: total })}
          </span>
        </div>
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden sm:block rounded-xl border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 border-b">
              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-right font-medium">{t("table.order")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.client")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.receiver")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.destination")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.delivery")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.date")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.price")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("table.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <Package className="h-10 w-10 mx-auto text-muted-foreground/25 mb-3" />
                    <p className="text-muted-foreground">{t("emptyFiltered")}</p>
                  </td>
                </tr>
              ) : orders.map((o, idx) => (
                <tr
                  key={o.id}
                  className={`border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}
                  onClick={() => openDetail(o.id)}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                      {o.shipmentNumber || `#${o.id.slice(0,8).toUpperCase()}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{o.client?.name || "—"}</p>
                    {o.client?.phone && (
                      <p className="text-xs text-muted-foreground" dir="ltr">{o.client.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{o.recipientName || "—"}</p>
                    {o.recipientPhone && (
                      <p className="text-xs text-muted-foreground" dir="ltr">{o.recipientPhone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[140px]">
                    <p className="truncate text-sm" title={o.destination}>{o.destination}</p>
                  </td>
                  <td className="px-4 py-3"><DeliveryPill type={o.deliveryType} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-primary">{money(orderGrandTotal(o))}</span>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => openDetail(o.id)}>
                      <Eye className="h-3.5 w-3.5" /> {t("actions.view")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="sm:hidden space-y-3">
        {isLoading ? <SkeletonCards /> : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center rounded-xl border border-dashed">
            <Package className="h-10 w-10 text-muted-foreground/25 mb-3" />
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </div>
        ) : orders.map(o => (
          <div
            key={o.id}
            className="rounded-xl border bg-card shadow-sm p-4 space-y-3 active:bg-muted/40 transition-colors"
            onClick={() => openDetail(o.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  #{o.id.slice(0,8).toUpperCase()}
                </span>
                <p className="font-semibold text-sm mt-1">{o.client?.name || "—"}</p>
                {o.client?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{o.client.phone}</p>}
              </div>
              <StatusPill status={o.status} />
            </div>
            <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
              {o.recipientName && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" /> {t("receiverPrefix")} <span className="font-medium text-foreground">{o.recipientName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                <span className="truncate">{o.destination}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(o.createdAt)}</span>
                <DeliveryPill type={o.deliveryType} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-2" onClick={e => e.stopPropagation()}>
              <span className="text-lg font-bold text-primary">{money(orderGrandTotal(o))}</span>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={e => { e.stopPropagation(); openDetail(o.id) }}>
                <Eye className="h-3.5 w-3.5" /> {t("actions.details")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t("pageOf", { page, totalPages })}
            <span className="text-muted-foreground/50 mr-2">({t("orderCount", { count: total })})</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(p-1,1))}>
              <ChevronRight className="h-4 w-4 ml-1" /> {t("pagination.previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>
              {t("pagination.next")} <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════ DETAIL DIALOG ══════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> {t("details.title")}
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

              {/* Timeline */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.timeline")}</p>
                <Timeline status={selected.status} />
              </div>

              {/* Collection / merchant settlement status */}
              {selected.status === "DELIVERED" && (
                <div className={`rounded-xl border p-4 space-y-3 ${COLLECTION_CFG[selected.collectionStatus || "NOT_COLLECTED"]?.bg || "bg-muted/30"}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/80">
                      <Banknote className={`h-5 w-5 ${COLLECTION_CFG[selected.collectionStatus || "NOT_COLLECTED"]?.text || "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.collectionSettlement")}</p>
                      <p className={`text-sm font-semibold ${COLLECTION_CFG[selected.collectionStatus || "NOT_COLLECTED"]?.text || ""}`}>
                        {collectionT(selected.collectionStatus || "NOT_COLLECTED")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("details.collectionHint")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    {COLLECTION_ACTIONS.map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={selected.collectionStatus === value ? "default" : "outline"}
                        disabled={statusUpdating}
                        onClick={() => updateCollectionStatus(value)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        {statusUpdating && selected.collectionStatus !== value ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
                        {collectionT(value)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Change Status */}
              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /> {t("details.changeStatus")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.filter(s => s !== selected.status).map(s => {
                    const cfg = STATUS_CFG[s]
                    const Icon = cfg?.icon
                    return (
                      <button
                        key={s}
                        disabled={statusUpdating}
                        onClick={() => updateStatus(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all hover:scale-105 ${cfg?.bg} ${cfg?.text} disabled:opacity-50`}
                      >
                        {Icon && <Icon className="h-3 w-3" />}
                        {statusT(s)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* People — Client & Driver */}
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Client */}
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.client")}</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{selected.client?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{selected.client?.email || ""}</p>
                      {selected.client?.phone && (
                        <a href={`tel:${selected.client.phone}`}
                          className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline" dir="ltr">
                          <Phone className="h-3 w-3" />{selected.client.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Driver */}
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.driver")}</p>
                  {selected.driver ? (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{selected.driver.name}</p>
                        {selected.driver.phone && (
                          <a href={`tel:${selected.driver.phone}`}
                            className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline" dir="ltr">
                            <Phone className="h-3 w-3" />{selected.driver.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{t("details.notAssigned")}</p>
                  )}
                </div>
              </div>

              {/* Assign / Reassign Driver */}
              {selected.status !== "DELIVERED" && selected.status !== "COLLECTED" && selected.status !== "CANCELLED" && (
                <div className="rounded-xl border border-dashed p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    {selected.driver ? t("details.reassignDriver") : t("details.assignDriver")}
                  </p>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 text-sm rounded-lg border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
                      value={assignDriverId}
                      onChange={e => setAssignId(e.target.value)}
                    >
                      <option value="">{t("details.chooseDriver")}</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}{d.phone ? ` • ${d.phone}` : ""}</option>
                      ))}
                    </select>
                    <Button size="sm" disabled={!assignDriverId || assigning} onClick={assignDriver} className="shrink-0">
                      {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : t("details.assign")}
                    </Button>
                  </div>
                </div>
              )}

              {/* Recipient */}
              {(selected.recipientName || selected.recipientPhone) && (
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.receiverInfo")}</p>
                  <div className="flex flex-col gap-1.5 text-sm">
                    {selected.recipientName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>{selected.recipientName}</span>
                      </div>
                    )}
                    {selected.recipientPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span dir="ltr">{selected.recipientPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Addresses */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.addresses")}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("details.pickup")}</p>
                      <p className="font-medium">{selected.pickupAddress || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("details.delivery")}</p>
                      <p className="font-medium">{selected.destination}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipment details */}
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("details.shipmentDetails")}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selected.shipmentNumber && (
                    <div className="col-span-2 flex items-start gap-2">
                      <ScanLine className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t("details.shipmentNumber")}</p>
                        <p className="font-mono font-bold text-primary">{selected.shipmentNumber}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t("details.zone")}</p>
                      <p className="font-medium">{zoneLabel(selected.zone)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t("details.deliveryType")}</p>
                      <p className="font-medium">{deliveryT(selected.deliveryType)}</p>
                    </div>
                  </div>
                  {selected.packageDescription && (
                    <div className="col-span-2 flex items-start gap-2">
                      <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t("details.packageDescription")}</p>
                        <p className="font-medium">{selected.packageDescription}</p>
                      </div>
                    </div>
                  )}
                  {(selected.cancellationReason || selected.returnReason) && (
                    <div className="col-span-2 flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          {selected.cancellationReason ? t("details.cancellationReason") : t("details.returnReason")}
                        </p>
                        <p className="font-medium text-red-600">{selected.cancellationReason || selected.returnReason}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t("details.date")}</p>
                      <p className="font-medium">{fmtDate(selected.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-primary" /> {t("details.codTotal")}
                    </span>
                    <span className="text-2xl font-bold text-primary">{money(orderGrandTotal(selected))}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-primary/10 pt-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("details.itemPrice")}</span>
                      <span className="font-semibold" dir="ltr">{money(selected.itemPrice || 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("details.deliveryFee")}</span>
                      <span className="font-semibold" dir="ltr">{money(selected.deliveryFee || 0)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{t("details.addons")}</span>
                      <span className="font-semibold" dir="ltr">{money(selected.addonsTotal || 0)}</span>
                    </div>
                    {orderAddons(selected).length > 0 && (
                      <div className="col-span-2 text-muted-foreground">
                        {orderAddons(selected).map(addon => `${addon.name}: ${Number(addon.amount || 0).toFixed(2)}`).join(locale === "ar" ? "\u060C " : ", ")}
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
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t("details.notes")}</p>
                    <p className="text-sm">{selected.notes}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" className="gap-1.5 flex-1" onClick={() => downloadInvoice(selected.id)}>
                  <Download className="h-4 w-4" /> {t("actions.downloadInvoice")}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 flex-1 border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => openWaybill(selected)}
                >
                  <ScanLine className="h-4 w-4" /> {t("actions.printWaybill")}
                </Button>
                {(selected.status === "PENDING" || selected.status === "ASSIGNED") && (
                  <Button variant="destructive" className="gap-1.5" disabled={cancelling} onClick={cancelOrder}>
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    {t("actions.cancel")}
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
