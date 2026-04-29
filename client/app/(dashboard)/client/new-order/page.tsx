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
import {
  MapPin, Package, Truck, Zap, Clock,
  DollarSign, ArrowRight, CheckCircle, Info, Loader2,
  User, Phone, Building2,
} from "lucide-react"

/* ── Delivery type config ─────────────── */
const DELIVERY_TYPES = [
  {
    value: "STANDARD",
    label: "توصيل عادي",
    sublabel: "3–5 أيام عمل",
    icon: Truck,
    selectedColor: "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    value: "EXPRESS",
    label: "توصيل سريع",
    sublabel: "خلال 1–2 يوم",
    icon: Zap,
    selectedColor: "border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-900/30",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    value: "SAME_DAY",
    label: "نفس اليوم",
    sublabel: "الحد الأقصى 6 ساعات",
    icon: Clock,
    selectedColor: "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-900/30",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
]

const ADDONS = [
  { id: "fragile_package", name: "تغليف قابل للكسر", amount: 15 },
  { id: "express_handling", name: "مناولة سريعة", amount: 20 },
  { id: "return_service", name: "خدمة إرجاع", amount: 25 },
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
    .map(({ name, amount }) => ({ name, amount }))
  const itemPriceNumber = Number(form.itemPrice)
  const canCalculate = !!effectiveZoneId && Number.isFinite(itemPriceNumber) && itemPriceNumber > 0

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
      .catch(() => toast.error("فشل تحميل المناطق"))
      .finally(() => setZonesLoading(false))
  }, [])

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
      e.recipientName = "أدخل اسم المستلم (حرفان على الأقل)"

    const rawPhone = form.recipientPhone.replace(/\s/g, "")
    if (rawPhone && !EGYPTIAN_PHONE_RE.test(rawPhone))
      e.recipientPhone = "رقم الهاتف غير صحيح — أدخل رقم مصري (مثال: 01012345678)"

    if (!form.destination.trim() || form.destination.trim().length < 5)
      e.destination = "أدخل عنوان التسليم (5 أحرف على الأقل)"
    if (!form.pickupAddress.trim() || form.pickupAddress.trim().length < 5)
      e.pickupAddress = "أدخل عنوان الاستلام (5 أحرف على الأقل)"
    if (!effectiveZoneId) e.zoneId = "اختر منطقة التوصيل"
    if (!Number.isFinite(itemPriceNumber) || itemPriceNumber <= 0)
      e.itemPrice = "أدخل سعر المنتج بقيمة أكبر من صفر"
    return e
  }

  /* ── Calculate price ── */
  const handleCalculatePrice = async () => {
    if (!effectiveZoneId) {
      setErrors(e => ({ ...e, zoneId: "اختر منطقة التوصيل" }))
      return
    }
    if (!Number.isFinite(itemPriceNumber) || itemPriceNumber <= 0) {
      setErrors(e => ({ ...e, itemPrice: "أدخل سعر المنتج بقيمة أكبر من صفر" }))
      return
    }
    setIsPricing(true)
    try {
      const { data } = await api.post("/orders/calculate-price", {
        deliveryType: form.deliveryType,
        zoneId:       effectiveZoneId,
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
      toast.error(err.response?.data?.error || "فشل احتساب السعر — تأكد من وجود قاعدة تسعير للمنطقة")
    } finally {
      setIsPricing(false)
    }
  }

  /* ── Submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    if (calculatedPrice === null) { toast.error("يرجى احتساب السعر أولاً"); return }

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
        itemPrice:          itemPriceNumber,
        addons:             selectedAddonRows,
      })
      toast.success("تم إنشاء الطلب بنجاح!")
      router.push("/client/orders")
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل إنشاء الطلب")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">

      <div className="mb-6 border-b pb-5">
        <h2 className="text-2xl font-bold tracking-tight">إنشاء طلب شحن جديد</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          أدخل بيانات المستلم وعنوان التسليم، ثم احتسب السعر قبل الإرسال.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

        <div className="space-y-5">

          {/* Section 1: بيانات المستلم */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={1} title="بيانات المستلم" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="recipientName" className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    اسم المستلم <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="recipientName"
                    placeholder="مثال: أحمد محمد"
                    value={form.recipientName}
                    onChange={e => set("recipientName", e.target.value)}
                    className={errors.recipientName ? "border-red-500 focus-visible:ring-red-400" : ""}
                  />
                  <FieldError msg={errors.recipientName} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recipientPhone" className="flex items-center gap-1.5 text-sm font-medium">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    رقم هاتف المستلم
                    <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
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
                  عنوان التسليم <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="destination"
                  placeholder="مثال: شارع التحرير، بجوار البنك الأهلي، الدور الثاني، شقة 5"
                  value={form.destination}
                  onChange={e => set("destination", e.target.value)}
                  className={errors.destination ? "border-red-500 focus-visible:ring-red-400" : ""}
                />
                <FieldError msg={errors.destination} />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: عنوان الاستلام والطرد */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={2} title="عنوان الاستلام وتفاصيل الطرد" />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="pickupAddress" className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 text-green-500" />
                  عنوان الاستلام <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pickupAddress"
                  placeholder="مثال: حي المعادي، شارع 9، المبنى رقم 4"
                  value={form.pickupAddress}
                  onChange={e => set("pickupAddress", e.target.value)}
                  className={errors.pickupAddress ? "border-red-500 focus-visible:ring-red-400" : ""}
                />
                <FieldError msg={errors.pickupAddress} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="packageDescription" className="flex items-center gap-1.5 text-sm font-medium">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  وصف محتويات الطرد
                  <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
                </Label>
                <Textarea
                  id="packageDescription"
                  placeholder="مثال: جهاز لابتوب Dell (قابل للكسر)، كتابان دراسيان..."
                  rows={2}
                  value={form.packageDescription}
                  onChange={e => set("packageDescription", e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  ملاحظات للسائق
                  <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="مثال: اتصل قبل الوصول بـ 15 دقيقة — لا تدق الجرس..."
                  rows={2}
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: قيمة المنتج والإضافات */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={3} title="قيمة المنتج والإضافات" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="itemPrice" className="flex items-center gap-1.5 text-sm font-medium">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  سعر المنتج <span className="text-red-500">*</span>
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
                <Label className="text-sm font-medium">إضافات اختيارية</Label>
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
                          <span className="text-sm font-semibold">{addon.name}</span>
                          {selected && <CheckCircle className="h-4 w-4 shrink-0" />}
                        </div>
                        <span className="mt-1 block text-xs text-muted-foreground" dir="ltr">
                          + EGP {addon.amount.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: خيارات التوصيل */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={4} title="خيارات التوصيل" />
            </CardHeader>
            <CardContent className="space-y-5">

              <div className="space-y-2">
                <Label className="text-sm font-medium">سرعة التوصيل</Label>
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
                          <p className="font-semibold text-sm leading-tight">{dt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{dt.sublabel}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${dt.badgeColor}`}>
                          {dt.label}
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
                  منطقة التوصيل <span className="text-red-500">*</span>
                </Label>

                {zonesLoading ? (
                  <div className="h-10 rounded-md border bg-muted animate-pulse" />
                ) : regions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-5 text-sm text-center text-muted-foreground">
                    لا توجد مناطق مضافة بعد — تواصل مع الإدارة
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">المحافظة</p>
                      <select
                        value={selectedRegionId}
                        onChange={e => handleRegionChange(e.target.value)}
                        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                          errors.zoneId ? "border-red-500" : "border-input"
                        }`}
                      >
                        <option value="" disabled>اختر المحافظة...</option>
                        {regions.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    {subAreas.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">الحي / المنطقة</p>
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
                          <option value="" disabled>اختر الحي...</option>
                          {subAreas.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : selectedRegion ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">الحي / المنطقة</p>
                        <div className="flex h-10 items-center rounded-md border border-dashed bg-muted/20 px-3 text-sm text-muted-foreground">
                          يُطبَّق تسعير المحافظة مباشرةً
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
                {isPricing ? "جاري الاحتساب..." : "احتساب السعر"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl border bg-primary/5 p-4 text-center">
                  <p className="text-xs text-muted-foreground">إجمالي التكلفة</p>
                  <p className="text-3xl font-bold text-primary mt-1">ج.م {calculatedPrice.toFixed(2)}</p>
                  {priceBreakdown && (
                    <div className="mt-3 space-y-1 rounded-lg bg-background/80 p-2 text-xs">
                      <div className="flex justify-between"><span>سعر المنتج</span><span dir="ltr">EGP {priceBreakdown.itemPrice.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>الشحن</span><span dir="ltr">EGP {priceBreakdown.deliveryFee.toFixed(2)}</span></div>
                      {priceBreakdown.addonsTotal > 0 && (
                        <div className="flex justify-between"><span>الإضافات</span><span dir="ltr">EGP {priceBreakdown.addonsTotal.toFixed(2)}</span></div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                    <CheckCircle className="h-3 w-3" /> السعر محتسب
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={resetPricing}>
                  إعادة الاحتساب
                </Button>
                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {isSubmitting ? "جاري الإنشاء..." : "تأكيد وإرسال الطلب"}
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
              <span className="font-semibold text-sm">ملخص الطلب</span>
            </div>
            <CardContent className="pt-4 pb-4 space-y-4">

              {(form.recipientName || form.recipientPhone) && (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 border space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">المستلم</p>
                  {form.recipientName && <p className="text-sm font-semibold">{form.recipientName}</p>}
                  {form.recipientPhone && <p className="text-xs text-muted-foreground" dir="ltr">{form.recipientPhone}</p>}
                  {form.destination && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.destination}</p>}
                </div>
              )}

              <div className="space-y-2 text-sm">
                {selectedRegion && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">المنطقة</span>
                    <span className="font-medium text-right">
                      {selectedZoneObj && selectedZoneObj.id !== selectedRegion.id
                        ? `${selectedRegion.name} / ${selectedZoneObj.name}`
                        : selectedRegion.name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">نوع التوصيل</span>
                  <span className="font-medium">{DELIVERY_TYPES.find(d => d.value === form.deliveryType)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">سعر المنتج</span>
                  <span className="font-medium" dir="ltr">
                    {itemPriceNumber > 0 ? `EGP ${itemPriceNumber.toFixed(2)}` : "—"}
                  </span>
                </div>
                {selectedAddonRows.length > 0 && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">الإضافات</p>
                    {selectedAddonRows.map(addon => (
                      <div key={addon.name} className="flex justify-between gap-2 text-xs">
                        <span>{addon.name}</span>
                        <span dir="ltr">EGP {addon.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {calculatedPrice !== null ? (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">إجمالي التكلفة المقدرة</p>
                    <p className="text-4xl font-bold text-primary">ج.م {calculatedPrice.toFixed(2)}</p>
                    {priceBreakdown && (
                      <div className="mt-3 space-y-1 rounded-lg bg-muted/40 p-2 text-xs text-start">
                        <div className="flex justify-between"><span>سعر المنتج</span><span dir="ltr">EGP {priceBreakdown.itemPrice.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>الشحن</span><span dir="ltr">EGP {priceBreakdown.deliveryFee.toFixed(2)}</span></div>
                        {priceBreakdown.addonsTotal > 0 && (
                          <div className="flex justify-between"><span>الإضافات</span><span dir="ltr">EGP {priceBreakdown.addonsTotal.toFixed(2)}</span></div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3" /> السعر محتسب
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    اختر المنطقة ونوع التوصيل ثم اضغط احتساب السعر
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
              {isPricing ? "جاري الاحتساب..." : "احتساب السعر"}
            </Button>
          ) : (
            <div className="space-y-2">
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={resetPricing}>
                إعادة احتساب السعر
              </Button>
              <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {isSubmitting ? "جاري الإنشاء..." : "تأكيد وإرسال الطلب"}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            بالإرسال توافق على شروط الخدمة وسياسة التوصيل.
          </p>
        </div>

      </form>
    </div>
  )
}
