"use client"

import { useEffect, useMemo, useRef } from "react"
import JsBarcode from "jsbarcode"
import { QRCodeSVG } from "qrcode.react"
import companyLogo from "@/app/images/logo.png"

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
  notes?: string
  createdAt?: string
  client?: { id?: string; name?: string; email?: string; phone?: string } | null
  driver?: { id?: string; name?: string; phone?: string } | null
  zone?: { id?: string; name?: string } | null
}

interface ShippingLabelProps {
  order: Order
}

const LABEL_WIDTH = "130mm"
const LABEL_HEIGHT = "80mm"
const SHIPMENT_NUMBER_RE = /^SHP-[A-Z0-9]{6,20}$/i
const FALLBACK = "غير متوفر"

const DELIVERY_AR: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS: "سريع",
  SAME_DAY: "نفس اليوم",
}

const STATUS_AR: Record<string, string> = {
  PENDING: "قيد الانتظار",
  ASSIGNED: "تم التعيين",
  PICKED_UP: "تم الاستلام",
  IN_TRANSIT: "جاري التوصيل",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
}

const COLLECTION_AR: Record<string, string> = {
  NOT_COLLECTED: "لم يحصل من العميل",
  DRIVER_COLLECTED: "السائق حصل من العميل",
  COMPANY_RECEIVED: "الشركة استلمت من السائق",
  SETTLED_TO_MERCHANT: "تمت التسوية مع التاجر",
}

const noWrapStyle = {
  whiteSpace: "nowrap",
  wordBreak: "keep-all",
  overflowWrap: "normal",
  direction: "ltr",
  unicodeBidi: "isolate",
} as const

const textClamp = (lines: number) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: lines,
  overflow: "hidden",
  overflowWrap: "anywhere" as const,
  lineHeight: 1.25,
})

function safe(value?: string | number | null) {
  const text = String(value ?? "").trim()
  return text || FALLBACK
}

function fmtDate(value?: string) {
  if (!value) return FALLBACK
  return new Date(value).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function money(value?: number) {
  const amount = Number(value ?? 0)
  return amount.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
}

function routeCode(zoneName?: string) {
  const name = safe(zoneName)
  if (name === FALLBACK) return "ZONE / ROUTE"
  return name.replace(/\s+/g, "").slice(0, 6) || "ZONE / ROUTE"
}

function NoWrap({
  value,
  size = "8pt",
  weight = 800,
  mono = false,
}: {
  value: string
  size?: string
  weight?: number
  mono?: boolean
}) {
  return (
    <span
      style={{
        ...noWrapStyle,
        display: "inline-block",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontSize: size,
        fontWeight: weight,
        fontFamily: mono ? "Consolas, 'Courier New', monospace" : "Arial, sans-serif",
      }}
      title={value}
    >
      {value}
    </span>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{
      border: "0.35mm solid #000",
      minHeight: 0,
      overflow: "hidden",
      background: "#fff",
    }}>
      <div style={{
        background: "#111",
        color: "#fff",
        padding: "0.9mm 1.4mm",
        fontSize: "6.8pt",
        fontWeight: 900,
        lineHeight: 1,
      }}>
        {title}
      </div>
      <div style={{
        padding: "1mm 1.4mm",
        display: "grid",
        gap: "0.7mm",
        fontSize: "7.2pt",
        lineHeight: 1.18,
      }}>
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "15mm 1fr", gap: "1mm", alignItems: "start", minWidth: 0 }}>
      <span style={{ color: "#555", fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ minWidth: 0, fontWeight: 700 }}>{children}</span>
    </div>
  )
}

export default function ShippingLabel({ order }: ShippingLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const shipmentNumber = safe(order.shipmentNumber).toUpperCase()
  const hasValidShipmentNumber = SHIPMENT_NUMBER_RE.test(shipmentNumber)
  const receiverName = safe(order.recipientName)
  const receiverPhone = safe(order.recipientPhone)
  const receiverAddress = safe(order.destination)
  const merchantName = safe(order.client?.name)
  const merchantPhone = safe(order.client?.phone)
  const pickupAddress = safe(order.pickupAddress)
  const zoneName = safe(order.zone?.name)
  const deliveryType = DELIVERY_AR[order.deliveryType || ""] || safe(order.deliveryType)
  const status = STATUS_AR[order.status || ""] || safe(order.status)
  const collectionStatus = COLLECTION_AR[order.collectionStatus || ""] || safe(order.collectionStatus)
  const packageDescription = safe(order.packageDescription)
  const notes = safe(order.notes)
  const createdAt = fmtDate(order.createdAt)
  const cod = money(order.totalPrice)
  const trackingPath = hasValidShipmentNumber ? `/track/${encodeURIComponent(shipmentNumber)}` : ""
  const trackingUrl = typeof window !== "undefined" && trackingPath
    ? `${window.location.origin}${trackingPath}`
    : trackingPath

  const qrValue = useMemo(() => trackingUrl, [trackingUrl])

  useEffect(() => {
    if (!barcodeRef.current || !hasValidShipmentNumber) return

    JsBarcode(barcodeRef.current, shipmentNumber, {
      format: "CODE128",
      displayValue: false,
      width: 1.45,
      height: 56,
      margin: 8,
      marginTop: 2,
      marginBottom: 2,
      background: "#fff",
      lineColor: "#000",
    })
  }, [hasValidShipmentNumber, shipmentNumber])

  if (!hasValidShipmentNumber) {
    return (
      <div className="shipping-label" dir="rtl" style={{
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "0.45mm solid #000",
        background: "#fff",
        color: "#000",
        fontFamily: "Arial, sans-serif",
        fontSize: "12pt",
        fontWeight: 900,
        overflow: "hidden",
      }}>
        رقم الشحنة غير متوفر لهذا الطلب
      </div>
    )
  }

  return (
    <div
      className="shipping-label"
      dir="rtl"
      data-shipment-number={shipmentNumber}
      data-barcode-value={shipmentNumber}
      data-qr-value={qrValue}
      style={{
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        boxSizing: "border-box",
        padding: "3mm",
        background: "#fff",
        color: "#000",
        border: "0.45mm solid #000",
        fontFamily: "Arial, 'Segoe UI', sans-serif",
        display: "grid",
        gridTemplateRows: "20mm 28mm 18mm 4.5mm",
        gap: "1.1mm",
        overflow: "hidden",
      }}
    >
      <header style={{ display: "grid", gridTemplateColumns: "91mm 1fr", gap: "1.2mm", minHeight: 0, direction: "ltr" }}>
        <div style={{
          border: "0.35mm solid #000",
          padding: "1.2mm 2mm 0.8mm",
          display: "grid",
          gridTemplateRows: "1fr auto",
          alignItems: "center",
          justifyItems: "center",
          background: "#fff",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <svg ref={barcodeRef} aria-label={`CODE128 ${shipmentNumber}`} style={{ width: "100%", maxHeight: "14.5mm", display: "block" }} />
          <NoWrap value={shipmentNumber} size="12pt" weight={900} mono />
        </div>

        <div style={{
          border: "0.35mm solid #000",
          padding: "1.2mm",
          display: "grid",
          gridTemplateRows: "1fr auto",
          alignItems: "center",
          justifyItems: "center",
          textAlign: "center",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <img
            src={companyLogo.src}
            alt="ShipFlow"
            style={{ maxWidth: "23mm", maxHeight: "10mm", objectFit: "contain" }}
            onError={(event) => { event.currentTarget.style.display = "none" }}
          />
          <div style={{ display: "grid", gap: "0.5mm", width: "100%" }}>
            <strong style={{ fontSize: "8.5pt", lineHeight: 1 }}>ShipFlow</strong>
            <NoWrap value={routeCode(zoneName)} size="9pt" weight={900} />
          </div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "31mm 24mm 23mm 1fr", gap: "1.2mm", minHeight: 0, direction: "ltr" }}>
        <div style={{
          border: "0.35mm solid #000",
          padding: "1.2mm",
          display: "grid",
          gridTemplateRows: "1fr auto",
          alignItems: "center",
          justifyItems: "center",
          background: "#fff",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <div className="qr" style={{
            width: "28mm",
            height: "28mm",
            padding: "1.4mm",
            background: "#fff",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <QRCodeSVG value={qrValue} size={120} level="H" includeMargin style={{ width: "100%", height: "100%" }} />
          </div>
          <span style={{ fontSize: "6.4pt", fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>امسح للتتبع</span>
        </div>

        <div dir="rtl" style={{
          border: "0.35mm solid #000",
          padding: "1.7mm 1.5mm",
          display: "grid",
          alignContent: "center",
          justifyItems: "center",
          background: "#111",
          color: "#fff",
          textAlign: "center",
          overflow: "hidden",
        }}>
          <span style={{ fontSize: "7pt", fontWeight: 800 }}>COD</span>
          <strong style={{ fontSize: "15pt", lineHeight: 1.05 }}>ج.م {cod}</strong>
        </div>

        <div dir="rtl" style={{
          border: "0.35mm solid #000",
          padding: "1.5mm",
          display: "grid",
          gap: "1mm",
          alignContent: "center",
          textAlign: "center",
          overflow: "hidden",
        }}>
          <span style={{ fontSize: "6.8pt", fontWeight: 800, color: "#555" }}>نوع التوصيل</span>
          <strong style={{ fontSize: "12pt", lineHeight: 1.05 }}>{deliveryType}</strong>
          <span style={{ fontSize: "6.8pt", fontWeight: 800, color: "#555" }}>Route</span>
          <NoWrap value={routeCode(zoneName)} size="8.5pt" weight={900} />
        </div>

        <div dir="rtl" style={{
          border: "0.35mm solid #000",
          padding: "1.4mm 1.6mm",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: "0.8mm",
          minWidth: 0,
          overflow: "hidden",
        }}>
          <span style={{ fontSize: "6.8pt", fontWeight: 900, color: "#555" }}>المستلم / Receiver</span>
          <strong style={{ fontSize: "13pt", ...textClamp(1) }}>{receiverName}</strong>
          <div style={{ display: "grid", gap: "0.5mm", minWidth: 0 }}>
            <NoWrap value={receiverPhone} size="8.5pt" weight={900} />
            <div style={{ fontSize: "7.2pt", fontWeight: 700, ...textClamp(2) }}>{receiverAddress}</div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2mm", minHeight: 0, direction: "rtl" }}>
        <Section title="المرسل / Merchant">
          <Field label="التاجر"><span style={textClamp(1)}>{merchantName}</span></Field>
          <Field label="الهاتف"><NoWrap value={merchantPhone} size="7.2pt" weight={800} /></Field>
          <Field label="الاستلام"><span style={textClamp(1)}>{pickupAddress}</span></Field>
        </Section>

        <Section title="بيانات الشحنة">
          <Field label="الحالة"><span style={textClamp(1)}>{status}</span></Field>
          <Field label="التحصيل"><span style={textClamp(1)}>{collectionStatus}</span></Field>
          <Field label="الوصف"><span style={textClamp(1)}>{packageDescription}</span></Field>
        </Section>
      </section>

      <footer style={{
        border: "0.35mm solid #000",
        display: "grid",
        gridTemplateColumns: "34mm 34mm 1fr",
        alignItems: "center",
        gap: "1.5mm",
        padding: "0 1.5mm",
        fontSize: "6.5pt",
        fontWeight: 900,
        minHeight: 0,
        overflow: "hidden",
        direction: "rtl",
      }}>
        <span style={{ ...noWrapStyle, direction: "rtl" }}>التاريخ: <NoWrap value={createdAt} size="6.5pt" weight={900} /></span>
        <span style={textClamp(1)}>المنطقة: {zoneName}</span>
        <span style={textClamp(1)}>ملاحظات: {notes}</span>
      </footer>
    </div>
  )
}
