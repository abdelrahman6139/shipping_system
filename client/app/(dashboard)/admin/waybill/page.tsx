"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BrowserMultiFormatReader } from "@zxing/library"
import ShippingLabel from "@/components/ShippingLabel"
import api from "@/lib/api"
import { toast } from "sonner"
import {
  ScanLine, Search, Printer, X, Camera, CameraOff,
  Package, Loader2, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/* ─────────────── Types ─────────────── */
type Order = {
  id: string
  clientId?: string
  recipientName?: string
  recipientPhone?: string
  pickupAddress?: string
  destination?: string
  packageDescription?: string
  weight?: number
  length?: number
  width?: number
  height?: number
  deliveryType?: string
  status?: string
  totalPrice?: number
  notes?: string
  createdAt?: string
  client?: { id?: string; name?: string; email?: string; phone?: string } | null
  driver?: { id?: string; name?: string; phone?: string } | null
  zone?: { id?: string; name?: string } | null
}

/* ══════════════════════════════ PAGE ═══════════════════════════════════ */
export default function WaybillPage() {
  const searchParams = useSearchParams()
  const [order,         setOrder]         = useState<Order | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [searchInput,   setSearchInput]   = useState("")
  const [scannerOn,     setScannerOn]     = useState(false)
  const [scannerReady,  setScannerReady]  = useState(false)
  const [cameraError,   setCameraError]   = useState("")
  const [scanning,      setScanning]      = useState(false)   // "actively reading"

  const videoRef   = useRef<HTMLVideoElement>(null)
  const readerRef  = useRef<BrowserMultiFormatReader | null>(null)
  const printFrame = useRef<HTMLIFrameElement | null>(null)

  /* ─── Fetch order by short ID or full UUID ─── */
  const fetchOrder = useCallback(async (query: string) => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setOrder(null)
    try {
      /* Try search endpoint first */
      const { data } = await api.get("/orders", { params: { search: q, limit: 5 } })
      const list: Order[] = data.orders || []

      if (list.length === 0) {
        toast.error("لم يُعثر على طلب بهذا الرقم")
        setLoading(false)
        return
      }

      /* Pick exact match if available (barcode = first 12 hex chars without dashes) */
      const exact = list.find(o =>
        o.id.replace(/-/g, "").slice(0, 12).toUpperCase() === q.toUpperCase() ||
        o.id === q
      ) ?? list[0]

      /* Load full detail */
      const detail = await api.get(`/orders/${exact.id}`)
      setOrder(detail.data.order)
      toast.success("تم العثور على الطلب")
    } catch {
      toast.error("فشل تحميل الطلب")
    } finally {
      setLoading(false)
    }
  }, [])

  /* ─── Start camera scanner ─── */
  const startScanner = useCallback(async () => {
    setCameraError("")
    setScannerOn(true)
    setScannerReady(false)
    setScanning(true)

    try {
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      if (devices.length === 0) throw new Error("لا توجد كاميرا متاحة")

      /* Prefer rear camera */
      const deviceId = devices.find(d =>
        /back|rear|environment/i.test(d.label)
      )?.deviceId ?? devices[0]?.deviceId ?? undefined

      await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const text = result.getText()
            reader.reset()
            setScannerOn(false)
            setScanning(false)
            setSearchInput(text)
            fetchOrder(text)
          }
          if (err && !(err.name === "NotFoundException")) {
            console.debug("scanner:", err.message)
          }
        }
      )
      setScannerReady(true)
    } catch (e: any) {
      setCameraError(e.message || "فشل تشغيل الكاميرا")
      setScannerOn(false)
      setScanning(false)
      toast.error(e.message || "فشل تشغيل الكاميرا")
    }
  }, [fetchOrder])

  /* ─── Stop camera ─── */
  const stopScanner = useCallback(() => {
    readerRef.current?.reset()
    setScannerOn(false)
    setScannerReady(false)
    setScanning(false)
  }, [])

  /* cleanup on unmount */
  useEffect(() => () => readerRef.current?.reset(), [])

  /* auto-load order from URL ?id= param */
  useEffect(() => {
    const id = searchParams.get("id")
    if (id) {
      setSearchInput(id)
      fetchOrder(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ─── Print ─── */
  const handlePrint = () => {
    if (!order) return
    window.print()
  }

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <>
      {/* ── Print-only global styles injected into <head> via style tag ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #waybill-print-target { display: block !important; }
          @page {
            size: 8cm 13cm;
            margin: 0;
          }
        }
        #waybill-print-target {
          display: none;
        }
      `}</style>

      {/* Hidden print target */}
      <div id="waybill-print-target">
        {order && <ShippingLabel order={order} />}
      </div>

      {/* ══════════════ SCREEN UI ══════════════ */}
      <div className="space-y-6 pb-10 max-w-5xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-primary" />
              بوليصة الشحن
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              ابحث عن طلب أو امسحه بالكاميرا لعرض وطباعة البوليصة
            </p>
          </div>
        </div>

        {/* ── Search + Scanner controls ── */}
        <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">بحث بالرقم أو المسح الضوئي</p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                dir="ltr"
                className="pr-10 h-11 font-mono text-sm"
                placeholder="أدخل رقم الطلب أو كود الباركود..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && fetchOrder(searchInput)}
              />
            </div>
            <Button
              className="h-11 px-6 gap-2"
              onClick={() => fetchOrder(searchInput)}
              disabled={loading || !searchInput.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              بحث
            </Button>
          </div>

          {/* Camera toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={scannerOn ? "destructive" : "outline"}
              size="sm"
              className="gap-2"
              onClick={scannerOn ? stopScanner : startScanner}
            >
              {scannerOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {scannerOn ? "إيقاف الكاميرا" : "مسح بالكاميرا"}
            </Button>
            {scanning && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                جارٍ المسح...
              </span>
            )}
            {cameraError && (
              <span className="text-xs text-destructive">{cameraError}</span>
            )}
          </div>

          {/* Video feed */}
          {scannerOn && (
            <div className="relative rounded-xl overflow-hidden border bg-black aspect-video max-w-md">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {!scannerReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
              )}
              {/* Scan line overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-2/3 h-0.5 bg-red-500 opacity-80 animate-bounce shadow-[0_0_8px_red]" />
                <p className="text-white text-xs mt-2 bg-black/50 px-2 py-1 rounded">
                  وجّه الكاميرا نحو الباركود
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white"
                onClick={stopScanner}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !order && (
          <div className="flex flex-col items-center py-20 text-center rounded-xl border border-dashed">
            <Package className="h-14 w-14 text-muted-foreground/20 mb-4" />
            <p className="font-medium text-muted-foreground">ابحث عن طلب لعرض البوليصة</p>
            <p className="text-sm text-muted-foreground/60 mt-1">أدخل رقم الطلب أو امسح الباركود بالكاميرا</p>
          </div>
        )}

        {/* ── Label preview ── */}
        {!loading && order && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  بوليصة الطلب #{order.id.replace(/-/g,"").slice(0,12).toUpperCase()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setOrder(null); setSearchInput("") }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  بحث جديد
                </Button>
                <Button
                  size="sm"
                  className="gap-2 print:hidden"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                  طباعة البوليصة
                </Button>
              </div>
            </div>

            {/* Preview card */}
            <div className="flex justify-center">
              <div
                className="shadow-xl rounded overflow-hidden"
                style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}
              >
                <ShippingLabel order={order} />
              </div>
            </div>

            {/* Print hint */}
            <p className="text-center text-xs text-muted-foreground">
              سيتم الطباعة بحجم 8×13 سم — تأكد من ضبط الطابعة على هذا الحجم
            </p>
          </div>
        )}
      </div>
    </>
  )
}
