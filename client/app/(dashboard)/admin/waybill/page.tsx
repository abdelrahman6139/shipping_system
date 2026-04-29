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
  shipmentNumber?: string
  clientId?: string
  recipientName?: string
  recipientPhone?: string
  pickupAddress?: string
  destination?: string
  packageDescription?: string
  deliveryType?: string
  status?: string
  collectionStatus?: string
  totalPrice?: number
  itemPrice?: number
  deliveryFee?: number
  addonsTotal?: number
  grandTotal?: number
  addons?: { name?: string; amount?: number }[]
  notes?: string
  createdAt?: string
  client?: { id?: string; name?: string; email?: string; phone?: string } | null
  driver?: { id?: string; name?: string; phone?: string } | null
  zone?: { id?: string; name?: string } | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHIPMENT_NUMBER_RE = /^SHP-[A-Z0-9]{6,20}$/i
const UUID_MESSAGE = "استخدم رقم الشحنة وليس معرف الطلب الداخلي"
const INVALID_SHIPMENT_MESSAGE = "أدخل رقم شحنة صحيح يبدأ بـ SHP-"

const normalizeShipmentInput = (value: string) => {
  const q = value.trim()
  if (!q) return ""

  const trackMatch = q.match(/\/track\/([^/?#\s]+)/i)
  const candidate = trackMatch?.[1] || q
  return candidate.trim().toUpperCase()
}

const isShipmentNumber = (value: string) => SHIPMENT_NUMBER_RE.test(value.trim())

const getQueryShipmentNumber = (searchParams: ReturnType<typeof useSearchParams>) =>
  searchParams.get("shipmentNumber") ||
  searchParams.get("trackingNumber") ||
  searchParams.get("q") ||
  searchParams.get("id") ||
  ""

const requiredFieldLabels: Record<string, string> = {
  shipmentNumber: "رقم الشحنة",
  recipientName: "اسم المستلم",
  recipientPhone: "هاتف المستلم",
  destination: "عنوان المستلم",
}

const missingWaybillFields = (order: Order) =>
  ([
    ["shipmentNumber", order.shipmentNumber],
    ["recipientName", order.recipientName],
    ["recipientPhone", order.recipientPhone],
    ["destination", order.destination],
  ] as const)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => requiredFieldLabels[key])

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
  const [validationError, setValidationError] = useState("")

  const videoRef   = useRef<HTMLVideoElement>(null)
  const readerRef  = useRef<BrowserMultiFormatReader | null>(null)

  /* ─── Fetch order by shipmentNumber only ─── */
  const fetchOrder = useCallback(async (query: string) => {
    const q = normalizeShipmentInput(query)
    if (!q) return

    setValidationError("")
    if (UUID_RE.test(q)) {
      setOrder(null)
      setValidationError(UUID_MESSAGE)
      toast.error(UUID_MESSAGE)
      return
    }
    if (!isShipmentNumber(q)) {
      setOrder(null)
      setValidationError(INVALID_SHIPMENT_MESSAGE)
      toast.error(INVALID_SHIPMENT_MESSAGE)
      return
    }

    setSearchInput(q)
    setLoading(true)
    setOrder(null)
    try {
      /* Search exact shipmentNumber through the authenticated orders endpoint. */
      const { data } = await api.get("/orders", { params: { search: q, limit: 5 } })
      const list: Order[] = data.orders || []

      if (list.length === 0) {
        toast.error("لم يُعثر على طلب بهذا الرقم")
        setLoading(false)
        return
      }

      /* Only shipmentNumber is valid for waybill lookup/navigation. */
      const exact = list.find(o =>
        o.shipmentNumber?.toUpperCase() === q
      )

      if (!exact) {
        toast.error("لم يُعثر على طلب بهذا الرقم")
        setLoading(false)
        return
      }

      /* Load full detail */
      const detail = await api.get(`/orders/${exact.id}`)
      const detailOrder: Order = detail.data.order
      const missing = missingWaybillFields(detailOrder)
      if (missing.length > 0) {
        const message = `لا يمكن عرض البوليصة قبل استكمال: ${missing.join("، ")}`
        setValidationError(message)
        toast.error(message)
        return
      }
      setOrder(detailOrder)
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

      const devices = await reader.listVideoInputDevices()
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
            const text = normalizeShipmentInput(result.getText())
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

  /* auto-load from URL params: shipmentNumber, trackingNumber, q. Legacy id is rejected if it is a UUID. */
  useEffect(() => {
    const queryValue = getQueryShipmentNumber(searchParams)
    if (queryValue) {
      const normalized = normalizeShipmentInput(queryValue)
      setSearchInput(normalized)
      if (isShipmentNumber(normalized) || UUID_RE.test(normalized)) {
        fetchOrder(normalized)
      } else {
        setValidationError(INVALID_SHIPMENT_MESSAGE)
      }
    }
  }, [fetchOrder, searchParams])

  /* ─── Print ─── */
  const handlePrint = () => {
    if (!order) return
    if (process.env.NODE_ENV !== "production") {
      console.log("waybill print order", order)
    }
    window.requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 200)
    })
  }

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <>
      {/* ── Print-only global styles injected into <head> via style tag ── */}
      <style>{`
        @page {
          size: 80mm 130mm;
          margin: 0;
        }
        @media print {
          html,
          body {
            width: 80mm;
            height: 130mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .shipping-label,
          .shipping-label * {
            visibility: visible !important;
          }
          .shipping-label {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            height: 130mm !important;
            min-height: 130mm !important;
            transform: scale(1) !important;
            transform-origin: top left !important;
            box-shadow: none !important;
            overflow: hidden !important;
            border-radius: 0 !important;
            page-break-after: always;
          }
          .qr-container {
            width: 34mm !important;
            height: 34mm !important;
            padding: 2mm !important;
            background: #fff !important;
            box-sizing: border-box !important;
          }
          .qr {
            width: 30mm !important;
            height: 30mm !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ══════════════ SCREEN UI ══════════════ */}
      <div className="space-y-6 pb-10 max-w-5xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="no-print flex items-start justify-between flex-wrap gap-3">
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
        <div className="no-print rounded-xl border bg-card shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">بحث برقم الشحنة أو المسح الضوئي</p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                dir="ltr"
                className="pr-10 h-11 font-mono text-sm"
                placeholder="SHP-MOJU58Y4G5"
                value={searchInput}
                onChange={e => {
                  setValidationError("")
                  setSearchInput(e.target.value)
                }}
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

          {validationError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {validationError}
            </div>
          )}

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
          <div className="no-print flex flex-col items-center py-20 text-center rounded-xl border border-dashed">
            <Package className="h-14 w-14 text-muted-foreground/20 mb-4" />
            <p className="font-medium text-muted-foreground">ابحث عن طلب لعرض البوليصة</p>
            <p className="text-sm text-muted-foreground/60 mt-1">أدخل رقم الشحنة أو امسح باركود الشحنة بالكاميرا</p>
          </div>
        )}

        {/* ── Label preview ── */}
        {!loading && order && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="no-print flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  بوليصة الشحنة {order.shipmentNumber}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setOrder(null); setSearchInput(""); setValidationError("") }}
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
                id="print-area"
                className="waybill-preview shadow-xl rounded overflow-hidden"
                data-shipment-number={order.shipmentNumber}
                style={{ width: "80mm", height: "130mm", boxShadow: "0 4px 32px rgba(0,0,0,0.18)" }}
              >
                <ShippingLabel order={order} />
              </div>
            </div>

            {/* Print hint */}
            <p className="no-print text-center text-xs text-muted-foreground">
              سيتم الطباعة بحجم 80×130 مم عمودي — تأكد من ضبط الطابعة على هذا الحجم
            </p>
          </div>
        )}
      </div>
    </>
  )
}
