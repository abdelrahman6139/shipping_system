"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"
import { QRCodeSVG } from "qrcode.react"

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

interface ShippingLabelProps {
  order: Order
}

/* ─────────────── Helpers ─────────────── */
const DELIVERY_AR: Record<string, string> = {
  STANDARD: "عادي",
  EXPRESS:  "سريع",
  SAME_DAY: "نفس اليوم",
}

/** Short ID used as barcode value */
const shortId = (id: string) => id.replace(/-/g, "").slice(0, 12).toUpperCase()

/** Zone code shown top-left (e.g. "D-06") */
const zoneCode = (zone?: { name?: string } | null) => {
  if (!zone?.name) return "—"
  const parts = zone.name.split(" ")
  return parts.length >= 2
    ? `${parts[0][0].toUpperCase()}-${parts.slice(1).join("").slice(0, 4)}`
    : zone.name.slice(0, 5).toUpperCase()
}

/* ═══════════════════════════════════════════ COMPONENT ════════════════════════════════════════ */
export default function ShippingLabel({ order }: ShippingLabelProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const barValue   = shortId(order.id)

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, barValue, {
        format:      "CODE128",
        displayValue: true,
        fontSize:    9,
        height:      28,
        margin:      0,
        background:  "transparent",
        lineColor:   "#000",
        textMargin:  2,
        fontOptions: "bold",
      })
    }
  }, [barValue])

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—"

  const qrData = JSON.stringify({
    id:        order.id,
    ref:       barValue,
    dest:      order.destination,
    recipient: order.recipientName,
    phone:     order.recipientPhone,
    total:     order.totalPrice,
    status:    order.status,
  })

  return (
    /*
      Outer wrapper: exactly 8×13 cm — used both for on-screen preview and @page print rules.
      The id="shipping-label" is targeted by the print CSS injected in the page.
    */
    <div
      id="shipping-label"
      dir="rtl"
      style={{
        width:       "8cm",
        minHeight:   "13cm",
        fontFamily:  "'Cairo', 'Segoe UI', Arial, sans-serif",
        background:  "#fff",
        color:       "#000",
        border:      "1.5px solid #000",
        padding:     "0",
        boxSizing:   "border-box",
        fontSize:    "8pt",
        display:     "flex",
        flexDirection: "column",
        overflow:    "hidden",
      }}
    >

      {/* ── TOP HEADER: Logo | Zone | Barcode ── */}
      <div style={{
        display:       "flex",
        alignItems:    "stretch",
        borderBottom:  "1.5px solid #000",
        minHeight:     "1.8cm",
      }}>
        {/* Logo block */}
        <div style={{
          flex:           "0 0 2.2cm",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          borderLeft:     "1px solid #000",
          padding:        "4px 6px",
          background:     "#000",
          color:          "#fff",
        }}>
          <span style={{ fontSize: "13pt", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1 }}>
            شحن
          </span>
          <span style={{ fontSize: "7pt", fontWeight: 500, letterSpacing: "1px", marginTop: 2 }}>
            SHIPPING
          </span>
        </div>

        {/* Zone code */}
        <div style={{
          flex:           "0 0 1.6cm",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          borderLeft:     "1px solid #000",
          background:     "#f5f5f5",
        }}>
          <span style={{ fontSize: "17pt", fontWeight: 900, letterSpacing: "-0.5px" }}>
            {zoneCode(order.zone)}
          </span>
        </div>

        {/* Barcode */}
        <div style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "4px 6px",
        }}>
          <svg ref={barcodeRef} style={{ maxWidth: "100%", height: "auto" }} />
        </div>
      </div>

      {/* ── DELIVERY TYPE | COD | QR ── */}
      <div style={{
        display:       "flex",
        alignItems:    "stretch",
        borderBottom:  "1px solid #000",
        minHeight:     "1.2cm",
      }}>
        {/* Delivery type */}
        <div style={{
          flex:           "0 0 2.2cm",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          borderLeft:     "1px solid #000",
          background:     "#000",
          color:          "#fff",
          fontWeight:     700,
          fontSize:       "10pt",
          letterSpacing:  "0.5px",
        }}>
          {DELIVERY_AR[order.deliveryType || "STANDARD"] || order.deliveryType}
        </div>

        {/* COD + Amount */}
        <div style={{
          flex:           "0 0 2.4cm",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          borderLeft:     "1px solid #000",
          padding:        "4px",
        }}>
          <span style={{ fontSize: "7pt", color: "#555", fontWeight: 600 }}>COD / نقدي</span>
          <span style={{ fontSize: "12pt", fontWeight: 900, marginTop: 1 }}>
            {order.totalPrice?.toFixed(0) ?? "—"}
          </span>
          <span style={{ fontSize: "7pt", color: "#555" }}>ج.م</span>
        </div>

        {/* QR Code */}
        <div style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "4px",
        }}>
          <QRCodeSVG value={qrData} size={64} level="M" />
        </div>
      </div>

      {/* ── PIECES + OPEN ALLOWED ── */}
      <div style={{
        display:       "flex",
        borderBottom:  "1px solid #000",
        minHeight:     "0.7cm",
        fontSize:      "7.5pt",
      }}>
        <div style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          gap:            6,
          padding:        "3px 8px",
          borderLeft:     "1px solid #000",
        }}>
          <span style={{ color: "#666" }}>عدد القطع:</span>
          <span style={{ fontWeight: 700 }}>1</span>
        </div>
        <div style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          gap:            6,
          padding:        "3px 8px",
        }}>
          <span style={{ color: "#666" }}>السماح بفتح الشحنة:</span>
          <span style={{ fontWeight: 700 }}>نعم</span>
        </div>
      </div>

      {/* ── ADDRESSES ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #000" }}>
        {/* From (sender) */}
        <div style={{
          flex:          1,
          padding:       "5px 8px",
          borderLeft:    "1px solid #000",
        }}>
          <div style={{ fontSize: "7pt", color: "#888", fontWeight: 600, marginBottom: 3, borderBottom: "0.5px solid #ddd", paddingBottom: 2 }}>
            من / From
          </div>
          <p style={{ fontWeight: 700, fontSize: "8pt", marginBottom: 2 }}>{order.client?.name || "—"}</p>
          <p style={{ color: "#444", fontSize: "7.5pt", direction: "ltr" }}>{order.client?.phone || "—"}</p>
          <p style={{ color: "#555", fontSize: "7pt", marginTop: 2 }}>{order.pickupAddress || "—"}</p>
        </div>

        {/* To (recipient) */}
        <div style={{ flex: 1, padding: "5px 8px" }}>
          <div style={{ fontSize: "7pt", color: "#888", fontWeight: 600, marginBottom: 3, borderBottom: "0.5px solid #ddd", paddingBottom: 2 }}>
            إلى / To
          </div>
          <p style={{ fontWeight: 700, fontSize: "8pt", marginBottom: 2 }}>{order.recipientName || "—"}</p>
          <p style={{ color: "#444", fontSize: "7.5pt", direction: "ltr" }}>{order.recipientPhone || "—"}</p>
        </div>
      </div>

      {/* ── DESTINATION DETAIL ── */}
      <div style={{ padding: "5px 8px", borderBottom: "1px solid #000" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
          <span style={{ color: "#666", fontSize: "7.5pt", minWidth: "1.4cm" }}>المدينة:</span>
          <span style={{ fontWeight: 600, fontSize: "7.5pt" }}>{order.zone?.name?.split("-")[0] || "—"}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ color: "#666", fontSize: "7.5pt", minWidth: "1.4cm" }}>العنوان:</span>
          <span style={{ fontWeight: 600, fontSize: "7.5pt", lineHeight: 1.4 }}>{order.destination || "—"}</span>
        </div>
      </div>

      {/* ── PACKAGE DIMENSIONS ── */}
      <div style={{
        display:      "flex",
        borderBottom: "1px solid #000",
        minHeight:    "0.75cm",
        fontSize:     "7.5pt",
      }}>
        {[
          { label: "الوزن", value: order.weight ? `${order.weight} كغ` : "—" },
          { label: "الطول", value: order.length ? `${order.length} سم` : "—" },
          { label: "العرض", value: order.width  ? `${order.width} سم`  : "—" },
          { label: "الارتفاع", value: order.height ? `${order.height} سم` : "—" },
        ].map((f, i, arr) => (
          <div key={f.label} style={{
            flex:        1,
            display:     "flex",
            flexDirection: "column",
            alignItems:  "center",
            justifyContent: "center",
            padding:     "3px 4px",
            borderLeft:  i < arr.length - 1 ? "1px solid #000" : undefined,
          }}>
            <span style={{ color: "#888", fontSize: "6.5pt" }}>{f.label}</span>
            <span style={{ fontWeight: 700 }}>{f.value}</span>
          </div>
        ))}
      </div>

      {/* ── DESCRIPTION ── */}
      <div style={{ padding: "4px 8px", borderBottom: "1px solid #000", minHeight: "0.9cm" }}>
        <span style={{ color: "#666", fontSize: "7pt" }}>وصف الشحنة: </span>
        <span style={{ fontSize: "7.5pt", fontWeight: 600 }}>{order.packageDescription || "—"}</span>
      </div>

      {/* ── NOTES ── */}
      <div style={{ padding: "4px 8px", borderBottom: "1px solid #000", minHeight: "0.8cm" }}>
        <span style={{ color: "#666", fontSize: "7pt" }}>ملاحظات: </span>
        <span style={{ fontSize: "7.5pt" }}>{order.notes || "—"}</span>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        display:         "flex",
        justifyContent:  "space-between",
        alignItems:      "center",
        padding:         "4px 8px",
        marginTop:       "auto",
        borderTop:       "1.5px solid #000",
        background:      "#f9f9f9",
        fontSize:        "6.5pt",
        color:           "#555",
        flexWrap:        "wrap",
        gap:             4,
      }}>
        <div>
          <span style={{ color: "#888" }}>Order Ref: </span>
          <span style={{ fontWeight: 700, fontFamily: "monospace" }}>#{barValue}</span>
        </div>
        <div>
          <span style={{ color: "#888" }}>المنطقة: </span>
          <span style={{ fontWeight: 700 }}>{order.zone?.name || "—"}</span>
        </div>
        <div>
          <span style={{ color: "#888" }}>Created At: </span>
          <span style={{ fontWeight: 700 }}>{fmtDate(order.createdAt)}</span>
        </div>
      </div>

    </div>
  )
}
