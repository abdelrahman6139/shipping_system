"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import api from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import { useLocale, useTranslations } from "next-intl"
import { formatMoney, type ChartLocale } from "@/lib/chart-format"
import {
  MapPin, Package, Truck, Zap, Clock,
  DollarSign, ArrowRight, CheckCircle, Info, Loader2,
  User, Phone, Building2,
} from "lucide-react"

/* ── Delivery type config ─────────────── */
const DELIVERY_TYPES = [
  {
    value: "STANDARD",
    labelKey: "delivery.STANDARD.label",
    sublabelKey: "delivery.STANDARD.sublabel",
    icon: Truck,
    selectedColor: "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    value: "EXPRESS",
    labelKey: "delivery.EXPRESS.label",
    sublabelKey: "delivery.EXPRESS.sublabel",
    icon: Zap,
    selectedColor: "border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-900/30",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    value: "SAME_DAY",
    labelKey: "delivery.SAME_DAY.label",
    sublabelKey: "delivery.SAME_DAY.sublabel",
    icon: Clock,
    selectedColor: "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-900/30",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
]

const ADDONS = [
  { id: "fragile_package", amount: 15 },
  { id: "express_handling", amount: 20 },
  { id: "return_service", amount: 25 },
]

const EGYPTIAN_PHONE_RE = /^(\+20|0020|0)?1[0125]\d{8}$/

type PriceBreakdown = {
  itemPrice: number
  deliveryFee: number
  addonsTotal: number
  grandTotal: number
}

function StepHeader({ number, title }: { number: number; title: string }) {
  return (
    <CardTitle className="text-base flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
        {number}
      </span>
      {title}
    </CardTitle>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

export default function NewOrderPage() {
  const router = useRouter()
  const { localizedPath } = useLanguage()
  const t = useTranslations("NewOrder")
  const locale = useLocale() as ChartLocale
  const [isSubmitting, setIsSubmitting]       = useState(false)
  const [isPricing, setIsPricing]             = useState(false)
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null)
  const [priceBreakdown, setPriceBreakdown]   = useState<PriceBreakdown | null>(null)
  const [regions, setRegions]                 = useState<any[]>([])
  const [zonesLoading, setZonesLoading]       = useState(true)
  const [selectedRegionId, setSelectedRegionId]   = useState("")
  const [selectedSubAreaId, setSelectedSubAreaId] = useState("")
  const [selectedAddons, setSelectedAddons]   = useState<string[]>([])
  const [errors, setErrors]                   = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    recipientName:      "",
    recipientPhone:     "",
    destination:        "",
    pickupAddress:      "",
    packageDescription: "",
    notes:              "",
    deliveryType:       "STANDARD",
    itemPrice:          "",
  })

  /* ── Derived ── */
  const selectedRegion  = regions.find((r: any) => r.id === selectedRegionId)
  const subAreas: any[] = selectedRegion?.children || []
  const effectiveZoneId = subAreas.length > 0 ? selectedSubAreaId : selectedRegionId
  const selectedZoneObj: any = subAreas.length > 0
    ? subAreas.find((s: any) => s.id === selectedSubAreaId)
    : selectedRegion
  const selectedAddonRows = ADDONS
    .filter(addon => selectedAddons.includes(addon.id))
    .map(({ id, amount }) => ({ name: t(`addons.${id}`), amount }))
  const itemPriceNumber = Number(form.itemPrice)
  const canCalculate = !!effectiveZoneId && Number.isFinite(itemPriceNumber) && itemPriceNumber > 0
  const money = (value: unknown) => formatMoney(value, locale)

  /* ── Load zones ── */
  useEffect(() => {
    api.get("/zones/tree")
      .then(({ data }) => {
        const list = data.zones || []
        setRegions(list)
        if (list.length > 0) {
          setSelectedRegionId(list[0].id)
          if (list[0].children?.length > 0) setSelectedSubAreaId(list[0].children[0].id)
        }
      })
      .catch(() => toast.error(t("errors.loadZones")))
      .finally(() => setZonesLoading(false))
  }, [t])

  const resetPricing = () => {
    setCalculatedPrice(null)
    setPriceBreakdown(null)
  }

  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    if (field === "deliveryType" || field === "itemPrice") resetPricing()
    setErrors(e => ({ ...e, [field]: "" }))
  }

  const toggleAddon = (addonId: string) => {
    setSelectedAddons(current =>
      current.includes(addonId) ? current.filter(id => id !== addonId) : [...current, addonId]
    )
    resetPricing()
  }

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId)
    resetPricing()
    setErrors(e => ({ ...e, zoneId: "" }))
    const region = regions.find((r: any) => r.id === regionId)
    setSelectedSubAreaId(region?.children?.length > 0 ? region.children[0].id : "")
  }

  /* ── Validation ── */
  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.recipientName.trim() || form.recipientName.trim().length < 2)
      e.recipientName = t("validation.recipientName")

    const rawPhone = form.recipientPhone.replace(/\s/g, "")
    if (rawPhone && !EGYPTIAN_PHONE_RE.test(rawPhone))
      e.recipientPhone = t("validation.recipientPhone")

    if (!form.destination.trim() || form.destination.trim().length < 5)
      e.destination = t("validation.destination")
    if (!form.pickupAddress.trim() || form.pickupAddress.trim().length < 5)
      e.pickupAddress = t("validation.pickupAddress")
    if (!effectiveZoneId) e.zoneId = t("validation.zone")
    if (!Number.isFinite(itemPriceNumber) || itemPriceNumber <= 0)
      e.itemPrice = t("validation.itemPrice")
    return e
  }

  /* ── Calculate price ── */
  const handleCalculatePrice = async () => {
    if (!effectiveZoneId) {
      setErrors(e => ({ ...e, zoneId: t("validation.zone") }))
      return
    }
    if (!Number.isFinite(itemPriceNumber) || itemPriceNumber <= 0) {
      setErrors(e => ({ ...e, itemPrice: t("validation.itemPrice") }))
      return
    }
    setIsPricing(true)
    try {
      const { data } = await api.post("/orders/calculate-price", {
        deliveryType: form.deliveryType,
        zoneId:       effectiveZoneId,
        parentZoneId: selectedRegionId || undefined,
        itemPrice:    itemPriceNumber,
        addons:       selectedAddonRows,
      })
      const breakdown = {
        itemPrice:    Number(data.itemPrice || 0),
        deliveryFee:  Number(data.deliveryFee || 0),
        addonsTotal:  Number(data.addonsTotal || 0),
        grandTotal:   Number(data.grandTotal ?? data.price ?? 0),
      }
      setPriceBreakdown(breakdown)
      setCalculatedPrice(breakdown.grandTotal)
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("errors.calculatePrice"))
    } finally {
      setIsPricing(false)
    }
  }

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (calculatedPrice === null) { toast.error(t("errors.calculateFirst")); return }

    setIsSubmitting(true)
    try {
      await api.post("/orders", {
        recipientName:      form.recipientName.trim()      || undefined,
        recipientPhone:     form.recipientPhone.trim()     || undefined,
        pickupAddress:      form.pickupAddress.trim(),
        destination:        form.destination.trim(),
        packageDescription: form.packageDescription.trim() || undefined,
        notes:              form.notes.trim()              || undefined,
        deliveryType:       form.deliveryType,
        zoneId:             effectiveZoneId,
        parentZoneId:       selectedRegionId || undefined,
        itemPrice:          itemPriceNumber,
        addons:             selectedAddonRows,
      })
      toast.success(t("success.created"))
      router.push(localizedPath("/client/orders"))
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("errors.createOrder"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">

      <div className="mb-6 border-b pb-5">
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

        <div className="space-y-5">

          {/* Section 1: receiver details */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={1} title={t("sections.receiver")} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="recipientName" className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("fields.recipientName")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="recipientName"
                    placeholder={t("placeholders.recipientName")}
                    value={form.recipientName}
                    onChange={e => set("recipientName", e.target.value)}
                    className={errors.recipientName ? "border-red-500 focus-visible:ring-red-400" : ""}
                  />
                  <FieldError msg={errors.recipientName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recipientPhone" className="flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("fields.recipientPhone")}
                    <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
                  </Label>
                  <Input
                    id="recipientPhone"
                    type="tel"
                    dir="ltr"
                    placeholder="01012345678"
                    value={form.recipientPhone}
                    onChange={e => set("recipientPhone", e.target.value)}
                    className={errors.recipientPhone ? "border-red-500 focus-visible:ring-red-400" : ""}
                  />
                  <FieldError msg={errors.recipientPhone} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="destination" className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  {t("fields.destination")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="destination"
                  placeholder={t("placeholders.destination")}
                  value={form.destination}
                  onChange={e => set("destination", e.target.value)}
                  className={errors.destination ? "border-red-500 focus-visible:ring-red-400" : ""}
                />
                <FieldError msg={errors.destination} />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: pickup and package details */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={2} title={t("sections.pickupPackage")} />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="pickupAddress" className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-green-500" />
                  {t("fields.pickupAddress")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pickupAddress"
                  placeholder={t("placeholders.pickupAddress")}
                  value={form.pickupAddress}
                  onChange={e => set("pickupAddress", e.target.value)}
                  className={errors.pickupAddress ? "border-red-500 focus-visible:ring-red-400" : ""}
                />
                <FieldError msg={errors.pickupAddress} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="packageDescription" className="flex items-center gap-1.5 text-sm font-medium">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("fields.packageDescription")}
                  <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
                </Label>
                <Textarea
                  id="packageDescription"
                  placeholder={t("placeholders.packageDescription")}
                  rows={2}
                  value={form.packageDescription}
                  onChange={e => set("packageDescription", e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("fields.notes")}
                  <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder={t("placeholders.notes")}
                  rows={2}
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: product value and add-ons */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={3} title={t("sections.priceAddons")} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="itemPrice" className="flex items-center gap-1.5 text-sm font-medium">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  {t("fields.itemPrice")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="itemPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="500.00"
                  value={form.itemPrice}
                  onChange={e => set("itemPrice", e.target.value)}
                  className={errors.itemPrice ? "border-red-500 focus-visible:ring-red-400" : ""}
                />
                <FieldError msg={errors.itemPrice} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("fields.optionalAddons")}</Label>
                <div className="grid sm:grid-cols-3 gap-2">
                  {ADDONS.map(addon => {
                    const selected = selectedAddons.includes(addon.id)
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        className={`rounded-xl border p-3 text-start transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-input bg-background hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{t(`addons.${addon.id}`)}</span>
                          {selected && <CheckCircle className="h-4 w-4 shrink-0" />}
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground" dir="ltr">
                          + {money(addon.amount)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: delivery options */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={4} title={t("sections.deliveryOptions")} />
            </CardHeader>
            <CardContent className="space-y-5">

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("fields.deliverySpeed")}</Label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {DELIVERY_TYPES.map(dt => {
                    const Icon       = dt.icon
                    const isSelected = form.deliveryType === dt.value
                    return (
                      <button
                        key={dt.value}
                        type="button"
                        onClick={() => set("deliveryType", dt.value)}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-3.5 transition-all text-left ${
                          isSelected
                            ? dt.selectedColor + " ring-2 ring-offset-1 ring-primary/30"
                            : "border-border bg-background hover:border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <CheckCircle className="absolute top-2.5 right-2.5 h-4 w-4 text-primary" />
                        )}
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? "bg-white/60 dark:bg-black/20" : "bg-muted"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{t(dt.labelKey)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t(dt.sublabelKey)}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${dt.badgeColor}`}>
                          {t(dt.labelKey)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Zone selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("fields.deliveryZone")} <span className="text-red-500">*</span>
                </Label>

                {zonesLoading ? (
                  <div className="h-10 rounded-md border bg-muted animate-pulse" />
                ) : regions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-sm text-center text-muted-foreground">
                    {t("zones.none")}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">{t("zones.governorate")}</p>
                      <select
                        value={selectedRegionId}
                        onChange={e => handleRegionChange(e.target.value)}
                        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                          errors.zoneId ? "border-red-500" : "border-input"
                        }`}
                      >
                        <option value="" disabled>{t("zones.chooseGovernorate")}</option>
                        {regions.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    {subAreas.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">{t("zones.area")}</p>
                        <select
                          value={selectedSubAreaId}
                          onChange={e => {
                            setSelectedSubAreaId(e.target.value)
                            resetPricing()
                            setErrors(err => ({ ...err, zoneId: "" }))
                          }}
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            errors.zoneId ? "border-red-500" : "border-input"
                          }`}
                        >
                          <option value="" disabled>{t("zones.chooseArea")}</option>
                          {subAreas.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : selectedRegion ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">{t("zones.area")}</p>
                        <div className="flex h-10 items-center rounded-md border border-dashed bg-muted/20 px-3 text-sm text-muted-foreground">
                          {t("zones.noChildrenFallback")}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                <FieldError msg={errors.zoneId} />
              </div>

            </CardContent>
          </Card>

          {/* Mobile actions */}
          <div className="lg:hidden space-y-3 pt-1">
            {calculatedPrice === null ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleCalculatePrice}
                disabled={isPricing || !canCalculate}
              >
                {isPricing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                {isPricing ? t("actions.calculating") : t("actions.calculatePrice")}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl border bg-primary/5 p-4 text-center">
                  <p className="text-xs text-muted-foreground">{t("summary.totalCost")}</p>
                  <p className="text-3xl font-bold text-primary mt-1">{money(calculatedPrice)}</p>
                  {priceBreakdown && (
                    <div className="mt-3 space-y-1 rounded-lg bg-background/80 p-2 text-xs">
                      <div className="flex justify-between"><span>{t("summary.itemPrice")}</span><span dir="ltr">{money(priceBreakdown.itemPrice)}</span></div>
                      <div className="flex justify-between"><span>{t("summary.deliveryFee")}</span><span dir="ltr">{money(priceBreakdown.deliveryFee)}</span></div>
                      {priceBreakdown.addonsTotal > 0 && (
                        <div className="flex justify-between"><span>{t("summary.addons")}</span><span dir="ltr">{money(priceBreakdown.addonsTotal)}</span></div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                    <CheckCircle className="h-3 w-3" /> {t("summary.priceCalculated")}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={resetPricing}>
                  {t("actions.recalculate")}
                </Button>
                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isSubmitting ? t("actions.creating") : t("actions.submit")}
                </Button>
              </div>
            )}
          </div>

        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:block lg:sticky lg:top-20 space-y-4">

          <Card className="border-primary/20 overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3 border-b flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">{t("summary.title")}</span>
            </div>
            <CardContent className="pt-4 pb-4 space-y-4">

              {(form.recipientName || form.recipientPhone) && (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 border space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("summary.receiver")}</p>
                  {form.recipientName && <p className="text-sm font-semibold">{form.recipientName}</p>}
                  {form.recipientPhone && <p className="text-xs text-muted-foreground" dir="ltr">{form.recipientPhone}</p>}
                  {form.destination && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.destination}</p>}
                </div>
              )}

              <div className="space-y-2 text-sm">
                {selectedRegion && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">{t("summary.zone")}</span>
                    <span className="font-medium text-right">
                      {selectedZoneObj && selectedZoneObj.id !== selectedRegion.id
                        ? `${selectedRegion.name} / ${selectedZoneObj.name}`
                        : selectedRegion.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("summary.deliveryType")}</span>
                  <span className="font-medium">{t(DELIVERY_TYPES.find(d => d.value === form.deliveryType)?.labelKey || "delivery.STANDARD.label")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("summary.itemPrice")}</span>
                  <span className="font-medium" dir="ltr">
                    {itemPriceNumber > 0 ? money(itemPriceNumber) : "—"}
                  </span>
                </div>
                {selectedAddonRows.length > 0 && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">{t("summary.addons")}</p>
                    {selectedAddonRows.map(addon => (
                      <div key={addon.name} className="flex justify-between gap-2 text-xs">
                        <span>{addon.name}</span>
                        <span dir="ltr">{money(addon.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {calculatedPrice !== null ? (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">{t("summary.estimatedTotal")}</p>
                    <p className="text-4xl font-bold text-primary">{money(calculatedPrice)}</p>
                    {priceBreakdown && (
                      <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2 text-xs text-start">
                        <div className="flex justify-between"><span>{t("summary.itemPrice")}</span><span dir="ltr">{money(priceBreakdown.itemPrice)}</span></div>
                        <div className="flex justify-between"><span>{t("summary.deliveryFee")}</span><span dir="ltr">{money(priceBreakdown.deliveryFee)}</span></div>
                        {priceBreakdown.addonsTotal > 0 && (
                          <div className="flex justify-between"><span>{t("summary.addons")}</span><span dir="ltr">{money(priceBreakdown.addonsTotal)}</span></div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3" /> {t("summary.priceCalculated")}
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    {t("summary.calculateHint")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {calculatedPrice === null ? (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleCalculatePrice}
              disabled={isPricing || !canCalculate}
            >
              {isPricing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {isPricing ? t("actions.calculating") : t("actions.calculatePrice")}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={resetPricing}>
                {t("actions.recalculatePrice")}
              </Button>
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isSubmitting ? t("actions.creating") : t("actions.submit")}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            {t("legal")}
          </p>
        </div>

      </form>
    </div>
  )
}
