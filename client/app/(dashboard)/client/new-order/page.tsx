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
  MapPin, Package, Ruler, Truck, Zap, Clock,
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
    multiplier: "×1.0",
  },
  {
    value: "EXPRESS",
    label: "توصيل سريع",
    sublabel: "خلال 1–2 يوم",
    icon: Zap,
    selectedColor: "border-orange-500 bg-orange-50 dark:border-orange-400 dark:bg-orange-900/30",
    badgeColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    multiplier: "×1.5",
  },
  {
    value: "SAME_DAY",
    label: "نفس اليوم",
    sublabel: "الحد الأقصى 6 ساعات",
    icon: Clock,
    selectedColor: "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-900/30",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    multiplier: "×2.0",
  },
]

/* ── Step header component ─────────────── */
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

/* ── Field error ─────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

/* ════════════════════════════════════════ */
export default function NewOrderPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPricing, setIsPricing] = useState(false)
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null)
  const [regions, setRegions] = useState<any[]>([])
  const [zonesLoading, setZonesLoading] = useState(true)
  const [selectedRegionId, setSelectedRegionId] = useState("")
  const [selectedSubAreaId, setSelectedSubAreaId] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    recipientName: "",
    recipientPhone: "",
    destination: "",
    pickupAddress: "",
    packageDescription: "",
    notes: "",
    weight: "",
    length: "",
    width: "",
    height: "",
    deliveryType: "STANDARD",
  })

  /* ── Derived ── */
  const selectedRegion = regions.find((r: any) => r.id === selectedRegionId)
  const subAreas: any[] = selectedRegion?.children || []
  const effectiveZoneId = subAreas.length > 0 ? selectedSubAreaId : selectedRegionId
  const selectedZoneObj: any = subAreas.length > 0
    ? subAreas.find((s: any) => s.id === selectedSubAreaId)
    : selectedRegion
  const canCalculate = !!(form.weight && form.length && form.width && form.height && effectiveZoneId)

  /* ── Load regions ── */
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

  /* ── Helpers ── */
  const set = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    if (["weight", "length", "width", "height", "deliveryType"].includes(field)) setCalculatedPrice(null)
    setErrors(e => ({ ...e, [field]: "" }))
  }

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId)
    setCalculatedPrice(null)
    setErrors(e => ({ ...e, zoneId: "" }))
    const region = regions.find((r: any) => r.id === regionId)
    setSelectedSubAreaId(region?.children?.length > 0 ? region.children[0].id : "")
  }

  /* ── Validation ── */
  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.recipientName.trim() || form.recipientName.trim().length < 2)
      e.recipientName = "أدخل اسم المستلم (حرفان على الأقل)"
    const phone = form.recipientPhone.replace(/[\s\-]/g, "")
    if (!phone || !/^[0-9+]{8,15}$/.test(phone))
      e.recipientPhone = "أدخل رقم هاتف صحيح"
    if (!form.destination.trim() || form.destination.trim().length < 5)
      e.destination = "أدخل عنوان التسليم (5 أحرف على الأقل)"
    if (!form.pickupAddress.trim() || form.pickupAddress.trim().length < 5)
      e.pickupAddress = "أدخل عنوان الاستلام (5 أحرف على الأقل)"
    if (!form.packageDescription.trim() || form.packageDescription.trim().length < 3)
      e.packageDescription = "أدخل وصفاً للمحتويات"
    if (!form.weight || Number(form.weight) <= 0) e.weight = "مطلوب"
    if (!form.length || Number(form.length) <= 0) e.length = "مطلوب"
    if (!form.width  || Number(form.width)  <= 0) e.width  = "مطلوب"
    if (!form.height || Number(form.height) <= 0) e.height = "مطلوب"
    if (!effectiveZoneId) e.zoneId = "اختر منطقة التوصيل"
    return e
  }

  /* ── Calculate price ── */
  const handleCalculatePrice = async () => {
    const pricingErrs: Record<string, string> = {}
    if (!form.weight || Number(form.weight) <= 0) pricingErrs.weight = "مطلوب"
    if (!form.length || Number(form.length) <= 0) pricingErrs.length = "مطلوب"
    if (!form.width  || Number(form.width)  <= 0) pricingErrs.width  = "مطلوب"
    if (!form.height || Number(form.height) <= 0) pricingErrs.height = "مطلوب"
    if (!effectiveZoneId) pricingErrs.zoneId = "اختر منطقة التوصيل"
    if (Object.keys(pricingErrs).length > 0) { setErrors(pricingErrs); return }

    setIsPricing(true)
    try {
      const { data } = await api.post("/orders/calculate-price", {
        weight: Number(form.weight),
        length: Number(form.length),
        width: Number(form.width),
        height: Number(form.height),
        deliveryType: form.deliveryType,
        zoneId: effectiveZoneId,
      })
      setCalculatedPrice(data.price)
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
        recipientName: form.recipientName.trim(),
        recipientPhone: form.recipientPhone.trim(),
        pickupAddress: form.pickupAddress.trim(),
        destination: form.destination.trim(),
        packageDescription: form.packageDescription.trim(),
        notes: form.notes.trim() || undefined,
        weight: Number(form.weight),
        length: Number(form.length),
        width: Number(form.width),
        height: Number(form.height),
        deliveryType: form.deliveryType,
        zoneId: effectiveZoneId,
      })
      toast.success("تم إنشاء الطلب بنجاح!")
      router.push("/client/orders")
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل إنشاء الطلب")
    } finally {
      setIsSubmitting(false)
    }
  }

  /* ════════════════════════════════════════ */
  return (
    <div className="max-w-5xl mx-auto pb-10">

      {/* Page header */}
      <div className="mb-6 border-b pb-5">
        <h2 className="text-2xl font-bold tracking-tight">إنشاء طلب شحن جديد</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          أدخل بيانات المستلم وتفاصيل الطرد، ثم احتسب السعر قبل الإرسال.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* === Left column — form sections === */}
        <div className="space-y-5">

          {/* Section 1: Recipient */}
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
                    رقم هاتف المستلم <span className="text-red-500">*</span>
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

          {/* Section 2: Pickup & Package */}
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
                  وصف محتويات الطرد <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="packageDescription"
                  placeholder="مثال: جهاز لابتوب Dell (قابل للكسر)، كتابان دراسيان..."
                  rows={2}
                  value={form.packageDescription}
                  onChange={e => set("packageDescription", e.target.value)}
                  className={`resize-none ${errors.packageDescription ? "border-red-500 focus-visible:ring-red-400" : ""}`}
                />
                <FieldError msg={errors.packageDescription} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                  الوزن والأبعاد <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: "weight", label: "الوزن (كغ)", step: "0.1", placeholder: "2.5" },
                    { id: "length", label: "الطول (سم)", step: "1",   placeholder: "30" },
                    { id: "width",  label: "العرض (سم)", step: "1",   placeholder: "20" },
                    { id: "height", label: "الارتفاع (سم)", step: "1", placeholder: "15" },
                  ].map(f => (
                    <div key={f.id} className="space-y-1">
                      <Label htmlFor={f.id} className="text-xs text-muted-foreground">{f.label}</Label>
                      <Input
                        id={f.id}
                        type="number"
                        step={f.step}
                        min="0.1"
                        placeholder={f.placeholder}
                        value={(form as any)[f.id]}
                        onChange={e => set(f.id, e.target.value)}
                        className={errors[f.id] ? "border-red-500" : ""}
                      />
                      {errors[f.id] && <p className="text-[10px] text-red-500 mt-0.5">{errors[f.id]}</p>}
                    </div>
                  ))}
                </div>
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

          {/* Section 3: Delivery options */}
          <Card>
            <CardHeader className="pb-3">
              <StepHeader number={3} title="خيارات التوصيل" />
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Delivery type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">سرعة التوصيل</Label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {DELIVERY_TYPES.map(dt => {
                    const Icon = dt.icon
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
                          {dt.multiplier}
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
                          <option key={r.id} value={r.id}>
                            {r.name} — ج.م {Number(r.basePrice).toFixed(2)}
                          </option>
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
                            setCalculatedPrice(null)
                            setErrors(err => ({ ...err, zoneId: "" }))
                          }}
                          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            errors.zoneId ? "border-red-500" : "border-input"
                          }`}
                        >
                          <option value="" disabled>اختر الحي...</option>
                          {subAreas.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — ج.م {Number(s.basePrice).toFixed(2)}
                            </option>
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

          {/* Mobile-only action area */}
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
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                    <CheckCircle className="h-3 w-3" /> السعر محتسب
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setCalculatedPrice(null)}
                >
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

        {/* === Right column — sticky summary (desktop) === */}
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
                  {form.recipientName && (
                    <p className="text-sm font-semibold">{form.recipientName}</p>
                  )}
                  {form.recipientPhone && (
                    <p className="text-xs text-muted-foreground" dir="ltr">{form.recipientPhone}</p>
                  )}
                  {form.destination && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.destination}</p>
                  )}
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
                {form.weight && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الوزن</span>
                    <span>{form.weight} كغ</span>
                  </div>
                )}
                {form.length && form.width && form.height && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الأبعاد</span>
                    <span dir="ltr">{form.length}×{form.width}×{form.height} cm</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                {calculatedPrice !== null ? (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-muted-foreground">إجمالي التكلفة المقدرة</p>
                    <p className="text-4xl font-bold text-primary">ج.م {calculatedPrice.toFixed(2)}</p>
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3" /> السعر محتسب
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    أدخل الأبعاد واختر المنطقة ثم اضغط احتساب السعر
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setCalculatedPrice(null)}
              >
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
