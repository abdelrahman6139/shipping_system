"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import JsBarcode from "jsbarcode"
import { QRCodeSVG } from "qrcode.react"
import companyLogo from "@/app/images/logo.png"
import { useLocale, useTranslations } from "next-intl"
import { formatMoney, type ChartLocale } from "@/lib/chart-format"

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
  zone?: { id?: string; name?: string; parent?: { id?: string; name?: string } | null } | null
}

interface ShippingLabelProps {
  order: Order
}

const LABEL_WIDTH = "80mm"
const LABEL_HEIGHT = "130mm"
const SHIPMENT_NUMBER_RE = /^SHP-[A-Z0-9]{6,20}$/i
const FALLBACK = "-"

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
  lineHeight: 1.2,
})

function safe(value?: string | number | null) {
  const text = String(value ?? "").trim()
  return text || FALLBACK
}

function fmtDate(value: string | undefined, locale: ChartLocale) {
  if (!value) return FALLBACK
  return new Date(value).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

function routeCode(zoneName: string | undefined, fallback: string) {
  const name = safe(zoneName)
  if (name === FALLBACK) return fallback
  return name.replace(/\s+/g, "").slice(0, 8).toUpperCase() || fallback
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: "0.35mm solid #000",
        minHeight: 0,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div
        style={{
          background: "#111",
          color: "#fff",
          padding: "0.9mm 1.3mm",
          fontSize: "7pt",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: "1mm 1.3mm",
          display: "grid",
          gap: "0.75mm",
          fontSize: "7.2pt",
          lineHeight: 1.15,
        }}
      >
        {children}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "14mm 1fr",
        gap: "1mm",
        alignItems: "start",
        minWidth: 0,
      }}
    >
      <span style={{ color: "#555", fontWeight: 900, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ minWidth: 0, fontWeight: 800 }}>{children}</span>
    </div>
  )
}

export default function ShippingLabel({ order }: ShippingLabelProps) {
  const t = useTranslations("ShippingLabel")
  const statusT = useTranslations("Status")
  const collectionT = useTranslations("CollectionStatus")
  const deliveryT = useTranslations("DeliveryType")
  const locale = useLocale() as ChartLocale
  const barcodeRef = useRef<SVGSVGElement>(null)
  const shipmentNumber = safe(order.shipmentNumber).toUpperCase()
  const hasValidShipmentNumber = SHIPMENT_NUMBER_RE.test(shipmentNumber)
  const receiverName = safe(order.recipientName)
  const receiverPhone = safe(order.recipientPhone)
  const receiverAddress = safe(order.destination)
  const merchantName = safe(order.client?.name)
  const merchantPhone = safe(order.client?.phone)
  const pickupAddress = safe(order.pickupAddress)
  const areaName = safe(order.zone?.name)
  const governorateName = safe(order.zone?.parent?.name)
  const zoneName = governorateName !== FALLBACK ? `${governorateName} / ${areaName}` : areaName
  const deliveryType = order.deliveryType ? deliveryT(order.deliveryType) : safe(order.deliveryType)
  const status = order.status ? statusT(order.status) : safe(order.status)
  const collectionStatus = order.collectionStatus ? collectionT(order.collectionStatus) : safe(order.collectionStatus)
  const packageDescription = safe(order.packageDescription)
  const notes = safe(order.notes)
  const createdAt = fmtDate(order.createdAt, locale)
  const grandTotal = Number(order.grandTotal ?? order.totalPrice ?? 0)
  const cod = formatMoney(grandTotal, locale)
  const itemPrice = formatMoney(order.itemPrice, locale)
  const deliveryFee = formatMoney(order.deliveryFee, locale)
  const addonsTotal = formatMoney(order.addonsTotal, locale)
  const route = routeCode(areaName, t("zoneRoute"))
  const dir = locale === "ar" ? "rtl" : "ltr"

  const qrValue = useMemo(
    () => (hasValidShipmentNumber ? `/track/${shipmentNumber}` : ""),
    [hasValidShipmentNumber, shipmentNumber]
  )

  useEffect(() => {
    if (!barcodeRef.current || !hasValidShipmentNumber) return

    JsBarcode(barcodeRef.current, shipmentNumber, {
      format: "CODE128",
      displayValue: false,
      width: 1.35,
      height: 80,
      margin: 10,
      marginTop: 4,
      marginBottom: 4,
      background: "#fff",
      lineColor: "#000",
    })
  }, [hasValidShipmentNumber, shipmentNumber])

  if (!hasValidShipmentNumber) {
    return (
      <div
        className="shipping-label"
        dir={dir}
        style={{
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
        }}
      >
        {t("missingShipmentNumber")}
      </div>
    )
  }

  return (
    <div
      className="shipping-label"
      dir={dir}
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
        lineHeight: 1.15,
        display: "grid",
        gridTemplateRows: "27mm 38mm 42mm 13mm",
        gap: "1.1mm",
        overflow: "hidden",
      }}
    >
      <header style={{ display: "grid", gridTemplateColumns: "1fr 16mm", gap: "1.2mm", minHeight: 0, direction: "ltr" }}>
        <div
          style={{
            border: "0.35mm solid #000",
            padding: "1mm 1.6mm 0.8mm",
            display: "grid",
            gridTemplateRows: "1fr auto",
            alignItems: "center",
            justifyItems: "center",
            background: "#fff",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <svg ref={barcodeRef} aria-label={`CODE128 ${shipmentNumber}`} style={{ width: "100%", maxHeight: "21mm", display: "block" }} />
          <NoWrap value={shipmentNumber} size="13pt" weight={900} mono />
        </div>

        <div
          style={{
            border: "0.35mm solid #000",
            padding: "1mm",
            display: "grid",
            gridTemplateRows: "1fr auto",
            alignItems: "center",
            justifyItems: "center",
            textAlign: "center",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <img
            src={companyLogo.src}
            alt="ShipFlow"
            style={{ maxWidth: "13mm", maxHeight: "12mm", objectFit: "contain" }}
            onError={(event) => { event.currentTarget.style.display = "none" }}
          />
          <div style={{ display: "grid", gap: "0.5mm", width: "100%" }}>
            <strong style={{ fontSize: "7.4pt", lineHeight: 1 }}>ShipFlow</strong>
            <NoWrap value={route} size="7.5pt" weight={900} />
          </div>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "36mm 1fr", gap: "1.2mm", minHeight: 0, direction: "ltr" }}>
        <div
          style={{
            border: "0.35mm solid #000",
            padding: "1mm",
            display: "grid",
            gridTemplateRows: "1fr auto",
            alignItems: "center",
            justifyItems: "center",
            background: "#fff",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            className="qr-container"
            style={{
              width: "34mm",
              height: "34mm",
              padding: "8px",
              background: "#fff",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QRCodeSVG className="qr" value={qrValue} size={130} level="H" includeMargin style={{ width: "100%", height: "100%" }} />
          </div>
          <span style={{ fontSize: "6.8pt", fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>{t("scanToTrack")}</span>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "19mm 1fr", gap: "1.2mm", minWidth: 0, overflow: "hidden" }}>
          <div
            dir="rtl"
            style={{
              border: "0.35mm solid #000",
              padding: "1.6mm 1.4mm",
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              background: "#111",
              color: "#fff",
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: "7pt", fontWeight: 800 }}>{t("cod")}</span>
            <strong style={{ fontSize: "19pt", lineHeight: 1 }}>{cod}</strong>
          </div>

          <div
            dir="rtl"
            style={{
              border: "0.35mm solid #000",
              padding: "1.3mm 1.5mm",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1mm",
              alignContent: "center",
              textAlign: "center",
              overflow: "hidden",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "6.4pt", fontWeight: 800, color: "#555" }}>{t("service")}</span>
              <strong style={{ fontSize: "9.8pt", ...textClamp(1), lineHeight: 1.05 }}>{deliveryType}</strong>
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "6.4pt", fontWeight: 800, color: "#555" }}>{t("route")}</span>
              <NoWrap value={route} size="9.2pt" weight={900} />
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateRows: "25mm 15mm", gap: "1.1mm", minHeight: 0, direction: "rtl" }}>
        <Section title={t("receiver")}>
          <div style={{ display: "grid", gap: "0.8mm", minWidth: 0 }}>
            <strong style={{ fontSize: "14pt", fontWeight: 900, ...textClamp(1) }}>{receiverName}</strong>
            <NoWrap value={receiverPhone} size="9.5pt" weight={900} />
            <div style={{ fontSize: "8.2pt", fontWeight: 800, ...textClamp(2) }}>{receiverAddress}</div>
            <Field label={t("zone")}><span style={textClamp(1)}>{zoneName}</span></Field>
          </div>
        </Section>

        <Section title={t("merchant")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 20mm", gap: "1.2mm", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <Field label={t("name")}><span style={textClamp(1)}>{merchantName}</span></Field>
              <Field label={t("pickup")}><span style={textClamp(1)}>{pickupAddress}</span></Field>
            </div>
            <NoWrap value={merchantPhone} size="7.4pt" weight={900} />
          </div>
        </Section>
      </section>

      <footer
        style={{
          border: "0.35mm solid #000",
          display: "grid",
          gridTemplateRows: "auto auto auto",
          gap: "0.45mm",
          padding: "1.2mm 1.5mm",
          fontSize: "6.7pt",
          fontWeight: 900,
          minHeight: 0,
          overflow: "hidden",
          direction: "rtl",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1mm", minWidth: 0 }}>
          <Field label={t("status")}><span style={textClamp(1)}>{status}</span></Field>
          <Field label={t("payment")}><span style={textClamp(1)}>{collectionStatus}</span></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.8mm", minWidth: 0 }}>
          <Field label={t("item")}><NoWrap value={itemPrice} size="6.5pt" weight={900} /></Field>
          <Field label={t("ship")}><NoWrap value={deliveryFee} size="6.5pt" weight={900} /></Field>
          <Field label={t("add")}><NoWrap value={addonsTotal} size="6.5pt" weight={900} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "20mm 1fr", gap: "1mm", minWidth: 0 }}>
          <NoWrap value={createdAt} size="6.8pt" weight={900} />
          <span style={textClamp(1)}>{t("footer", { packageDescription, notes })}</span>
        </div>
      </footer>
    </div>
  )
}
