"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Package, MapPin, Clock, Truck, CheckCircle2,
  Boxes, XCircle, Banknote, PackageCheck, Loader2,
  AlertCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

type Shipment = {
  id: string
  shipmentNumber: string
  status: string
  deliveryType: string
  collectionStatus: string
  recipientName?: string
  destination: string
  createdAt: string
  updatedAt: string
  zone?: { name: string }
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: any; description: string }> = {
  PENDING:    { label: "قيد الانتظار",       color: "text-amber-600",   icon: Clock,        description: "تم استلام طلبك وهو قيد المراجعة." },
  ASSIGNED:   { label: "تم التعيين",         color: "text-blue-600",    icon: Truck,        description: "تم تعيين سائق لشحنتك." },
  PICKED_UP:  { label: "تم الاستلام",        color: "text-violet-600",  icon: Boxes,        description: "السائق في طريقه بشحنتك." },
  IN_TRANSIT: { label: "جاري التوصيل",       color: "text-indigo-600",  icon: Truck,        description: "شحنتك في الطريق إليك." },
  DELIVERED:  { label: "تم التسليم",        color: "text-orange-600",  icon: PackageCheck, description: "تم تسليم الشحنة بنجاح." },
  COLLECTED:  { label: "تم التحصيل",        color: "text-emerald-600", icon: Banknote,     description: "تم التسليم وتحصيل المبلغ." },
  CANCELLED:  { label: "ملغي",              color: "text-red-600",     icon: XCircle,      description: "تم إلغاء هذه الشحنة." },
  RETURNED:   { label: "مرتجع",             color: "text-purple-600",  icon: XCircle,      description: "تم إرجاع هذه الشحنة." },
}

const DELIVERY_LABEL: Record<string, string> = {
  STANDARD: "توصيل عادي (3–5 أيام)",
  EXPRESS:  "توصيل سريع (1–2 يوم)",
  SAME_DAY: "توصيل نفس اليوم",
}

const STEPS = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"]
const STEP_LABEL = ["استلام الطلب", "تعيين سائق", "استلام الشحنة", "في الطريق", "التسليم"]

function Timeline({ status }: { status: string }) {
  const activeStep = STEPS.indexOf(status === "COLLECTED" ? "DELIVERED" : status)
  const cancelled  = status === "CANCELLED" || status === "RETURNED"

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        <XCircle className="h-5 w-5 shrink-0" />
        {STATUS_CFG[status]?.description}
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-start min-w-max">
        {STEPS.map((s, i) => {
          const cfg    = STATUS_CFG[s]
          const Icon   = cfg.icon
          const done   = i < activeStep
          const active = i === activeStep
          return (
            <div key={s} className="flex items-start">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  done   ? "border-primary bg-primary text-primary-foreground" :
                  active ? "border-primary bg-primary/10 text-primary" :
                           "border-gray-200 bg-white text-gray-300"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className={`text-[10px] text-center leading-tight w-16 ${
                  active ? "font-bold text-primary" : done ? "text-primary/60" : "text-gray-400"
                }`}>{STEP_LABEL[i]}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 mt-[18px] mx-1 rounded ${i < activeStep ? "bg-primary" : "bg-gray-200"}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TrackingPage() {
  const params = useParams()
  const shipmentNumber = params.shipmentNumber as string

  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")

  useEffect(() => {
    if (!shipmentNumber) return
    fetch(`${API_URL}/orders/track/${shipmentNumber}`)
      .then(r => r.json())
      .then(d => {
        if (d.shipment) setShipment(d.shipment)
        else setError(d.error || "لم يتم العثور على الشحنة")
      })
      .catch(() => setError("فشل في الاتصال بالخادم"))
      .finally(() => setLoading(false))
  }, [shipmentNumber])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir="rtl">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white py-4 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Package className="h-6 w-6" />
          <h1 className="text-xl font-bold">تتبع الشحنة</h1>
        </div>
        <p className="text-blue-200 text-sm">شركة الشحن المصرية</p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Shipment number display */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">رقم الشحنة</p>
          <p className="font-mono text-2xl font-bold text-[#1e3a5f] tracking-wider">{shipmentNumber}</p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="font-semibold text-red-700">{error}</p>
            <p className="text-sm text-red-500">تأكد من صحة رقم الشحنة وحاول مرة أخرى</p>
          </div>
        )}

        {!loading && shipment && (() => {
          const cfg  = STATUS_CFG[shipment.status] || { label: shipment.status, color: "text-gray-600", icon: Package, description: "" }
          const Icon = cfg.icon
          return (
            <>
              {/* Status card */}
              <div className="rounded-2xl border bg-white shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gray-50 border-2 ${cfg.color.replace("text-", "border-")}`}>
                    <Icon className={`h-6 w-6 ${cfg.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">الحالة الحالية</p>
                    <p className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</p>
                    {cfg.description && <p className="text-sm text-gray-500 mt-0.5">{cfg.description}</p>}
                  </div>
                </div>

                <Timeline status={shipment.status} />
              </div>

              {/* Details card */}
              <div className="rounded-2xl border bg-white shadow-sm p-6 space-y-4">
                <h2 className="font-semibold text-gray-800 border-b pb-2">تفاصيل الشحنة</h2>
                <div className="space-y-3 text-sm">
                  {shipment.recipientName && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">اسم المستلم</p>
                        <p className="font-medium">{shipment.recipientName}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-red-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase">عنوان التسليم</p>
                      <p className="font-medium">{shipment.destination}</p>
                    </div>
                  </div>
                  {shipment.zone && (
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase">المنطقة</p>
                        <p className="font-medium">{shipment.zone.name}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <Truck className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase">نوع التوصيل</p>
                      <p className="font-medium">{DELIVERY_LABEL[shipment.deliveryType] || shipment.deliveryType}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase">تاريخ الطلب</p>
                      <p className="font-medium">{fmtDate(shipment.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase">آخر تحديث</p>
                      <p className="font-medium">{fmtDate(shipment.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer note */}
              <p className="text-center text-xs text-gray-400">
                للاستفسار تواصل مع خدمة العملاء على support@shipping.com.eg
              </p>
            </>
          )
        })()}
      </main>
    </div>
  )
}
