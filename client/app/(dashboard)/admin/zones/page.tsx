"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import api from "@/lib/api"
import {
  MapPin, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Settings2, Save, AlertTriangle, Building2
} from "lucide-react"
import { toast } from "sonner"

/* ── Types ──────────────────────────────────────────────── */
type PricingRule = {
  id: string
  pricePerKg: number
  standardMultiplier: number
  expressMultiplier: number
  sameDayMultiplier: number
  driverPayout?: number | null
}
type SubArea = {
  id: string
  name: string
  description?: string
  basePrice: number
  pricingRule?: PricingRule
}
type Region = {
  id: string
  name: string
  description?: string
  basePrice: number
  pricingRule?: PricingRule
  children: SubArea[]
}

const EMPTY_PRICING = { pricePerKg: "1.0", standardMultiplier: "1.0", expressMultiplier: "1.5", sameDayMultiplier: "2.0", driverPayout: "" }

/* ── Component ───────────────────────────────────────────── */
export default function AdminZonesPage() {
  const [regions, setRegions] = useState<Region[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  /* Add region */
  const [addRegionOpen, setAddRegionOpen] = useState(false)
  const [addRegionForm, setAddRegionForm] = useState({ name: "", description: "", basePrice: "0" })
  const [addRegionLoading, setAddRegionLoading] = useState(false)

  /* Add sub-area */
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [addSubParent, setAddSubParent] = useState<Region | null>(null)
  const [addSubForm, setAddSubForm] = useState({ name: "", description: "", basePrice: "0" })
  const [addSubLoading, setAddSubLoading] = useState(false)

  /* Edit zone */
  const [editOpen, setEditOpen] = useState(false)
  const [editZone, setEditZone] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: "", description: "", basePrice: "" })
  const [editLoading, setEditLoading] = useState(false)

  /* Pricing dialog */
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingZone, setPricingZone] = useState<any>(null)
  const [pricingForm, setPricingForm] = useState(EMPTY_PRICING)
  const [pricingLoading, setPricingLoading] = useState(false)

  /* Delete */
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  /* ── Fetch ── */
  const fetchRegions = useCallback(async () => {
    try {
      const { data } = await api.get("/zones/tree")
      setRegions(data.zones || [])
    } catch {
      toast.error("فشل تحميل المناطق")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchRegions() }, [fetchRegions])

  /* ── Toggle expand ── */
  const toggle = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /* ── Add region ── */
  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddRegionLoading(true)
    try {
      await api.post("/zones", { name: addRegionForm.name, description: addRegionForm.description || undefined, basePrice: Number(addRegionForm.basePrice) })
      toast.success("تم إنشاء المحافظة")
      setAddRegionOpen(false)
      setAddRegionForm({ name: "", description: "", basePrice: "0" })
      fetchRegions()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل الإنشاء") }
    finally { setAddRegionLoading(false) }
  }

  /* ── Add sub-area ── */
  const openAddSub = (region: Region) => {
    setAddSubParent(region)
    setAddSubForm({ name: "", description: "", basePrice: String(region.basePrice) })
    setAddSubOpen(true)
  }
  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addSubParent) return
    setAddSubLoading(true)
    try {
      await api.post("/zones", { name: addSubForm.name, description: addSubForm.description || undefined, basePrice: Number(addSubForm.basePrice), parentId: addSubParent.id })
      toast.success("تم إضافة المنطقة الفرعية")
      setAddSubOpen(false)
      setExpandedIds(prev => new Set(Array.from(prev).concat(addSubParent.id)))
      fetchRegions()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل الإضافة") }
    finally { setAddSubLoading(false) }
  }

  /* ── Edit ── */
  const openEdit = (z: any) => {
    setEditZone(z)
    setEditForm({ name: z.name, description: z.description || "", basePrice: String(z.basePrice) })
    setEditOpen(true)
  }
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editZone) return
    setEditLoading(true)
    try {
      await api.put(`/zones/${editZone.id}`, { name: editForm.name, description: editForm.description || undefined, basePrice: Number(editForm.basePrice) })
      toast.success("تم التحديث")
      setEditOpen(false)
      fetchRegions()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل التحديث") }
    finally { setEditLoading(false) }
  }

  /* ── Pricing ── */
  const openPricing = (z: any) => {
    setPricingZone(z)
    if (z.pricingRule) {
      setPricingForm({
        pricePerKg: String(z.pricingRule.pricePerKg),
        standardMultiplier: String(z.pricingRule.standardMultiplier),
        expressMultiplier: String(z.pricingRule.expressMultiplier),
        sameDayMultiplier: String(z.pricingRule.sameDayMultiplier),
        driverPayout: z.pricingRule.driverPayout != null ? String(z.pricingRule.driverPayout) : "",
      })
    } else {
      setPricingForm(EMPTY_PRICING)
    }
    setPricingOpen(true)
  }
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pricingZone) return
    setPricingLoading(true)
    try {
      await api.post("/pricing-rules", {
        zoneId: pricingZone.id,
        pricePerKg: Number(pricingForm.pricePerKg),
        standardMultiplier: Number(pricingForm.standardMultiplier),
        expressMultiplier: Number(pricingForm.expressMultiplier),
        sameDayMultiplier: Number(pricingForm.sameDayMultiplier),
        driverPayout: pricingForm.driverPayout !== "" ? Number(pricingForm.driverPayout) : null,
      })
      toast.success("تم حفظ التسعير")
      setPricingOpen(false)
      fetchRegions()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل الحفظ") }
    finally { setPricingLoading(false) }
  }

  /* ── Delete ── */
  const openDelete = (z: any) => { setDeleteTarget(z); setDeleteOpen(true) }
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/zones/${deleteTarget.id}`)
      toast.success("تم الحذف")
      setDeleteOpen(false)
      fetchRegions()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل الحذف، قد تكون المنطقة مرتبطة بطلبات") }
    finally { setDeleteLoading(false) }
  }

  /* ── Sub-area row ── */
  const SubAreaRow = ({ sub }: { sub: SubArea }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b last:border-0 bg-background hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0 ml-1" />
        <div className="min-w-0">
          <p className="font-medium text-sm">{sub.name}</p>
          {sub.description && <p className="text-xs text-muted-foreground truncate">{sub.description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mr-auto">
        <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0">
          ج.م {Number(sub.basePrice).toFixed(2)}
        </span>
        {sub.pricingRule ? (
          <>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              عادي ×{sub.pricingRule.standardMultiplier}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              سريع ×{sub.pricingRule.expressMultiplier}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              نفس اليوم ×{sub.pricingRule.sameDayMultiplier}
            </Badge>
            {sub.pricingRule.driverPayout != null && (
              <                Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                ج.م {sub.pricingRule.driverPayout}
              </Badge>
            )}
          </>
        ) : (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-amber-600 border-amber-400">
            بدون تسعير
          </Badge>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => openPricing(sub)} title="تعديل التسعير">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)} title="تعديل الاسم/السعر">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => openDelete(sub)} title="حذف">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">المناطق والتسعير</h2>
          <p className="text-muted-foreground">أدر المحافظات والمناطق الفرعية وقواعد التسعير لكل منطقة.</p>
        </div>
        <Button onClick={() => setAddRegionOpen(true)} className="gap-2 w-full sm:w-auto shrink-0">
          <Plus className="h-4 w-4" /> إضافة محافظة
        </Button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : regions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">لا توجد مناطق بعد</h3>
            <p className="text-muted-foreground text-sm mb-4">ابدأ بإضافة محافظة مثل القاهرة أو الإسكندرية.</p>
            <Button onClick={() => setAddRegionOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> أضف أول محافظة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {regions.map(region => {
            const expanded = expandedIds.has(region.id)
            return (
              <Card key={region.id} className="overflow-hidden">
                {/* Region header */}
                <CardHeader className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                    {/* Expand toggle + name */}
                    <button
                      type="button"
                      onClick={() => toggle(region.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{region.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {region.children.length} منطقة
                          </Badge>
                        </div>
                        {region.description && (
                          <p className="text-xs text-muted-foreground truncate">{region.description}</p>
                        )}
                      </div>
                      {expanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>

                    {/* Price + actions */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {region.pricingRule ? (
                        <div className="flex gap-1.5">
                          <Badge className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">عادي ×{region.pricingRule.standardMultiplier}</Badge>
                          <Badge className="text-[10px] h-5 px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-0">سريع ×{region.pricingRule.expressMultiplier}</Badge>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-amber-600 border-amber-400">بدون تسعير افتراضي</Badge>
                      )}
                      <span className="font-bold text-green-600 dark:text-green-400 text-sm shrink-0">
                        ج.م {Number(region.basePrice).toFixed(2)}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openAddSub(region)}>
                          <Plus className="h-3 w-3" /> حي / منطقة
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30" onClick={() => openPricing(region)} title="تسعير المحافظة">
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(region)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => openDelete(region)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {/* Sub-areas */}
                {expanded && (
                  <div className="border-t">
                    {region.children.length === 0 ? (
                      <div className="px-6 py-6 text-center text-sm text-muted-foreground">
                        <MapPin className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        لا توجد مناطق فرعية — أضف حياً أو منطقة داخل {region.name}.
                      </div>
                    ) : (
                      <div>
                        {/* Column headers — hide on small screens */}
                        <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider border-b">
                          <span className="flex-1">المنطقة / الحي</span>
                          <span>السعر الأساسي</span>
                          <span>معاملات التوصيل</span>
                          <span className="w-24 text-right">إجراءات</span>
                        </div>
                        {region.children.map(sub => <SubAreaRow key={sub.id} sub={sub} />)}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Add Region Dialog ── */}
      <Dialog open={addRegionOpen} onOpenChange={setAddRegionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> إضافة محافظة جديدة</DialogTitle>
            <DialogDescription>مثال: القاهرة، الإسكندرية، الجيزة</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddRegion} className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم المحافظة *</Label>
              <Input required placeholder="مثال: القاهرة" value={addRegionForm.name} onChange={e => setAddRegionForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>وصف (اختياري)</Label>
              <Input placeholder="وصف مختصر عن المنطقة" value={addRegionForm.description} onChange={e => setAddRegionForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>السعر الأساسي الافتراضي ($)</Label>
              <Input type="number" min="0" step="0.5" required value={addRegionForm.basePrice} onChange={e => setAddRegionForm(f => ({ ...f, basePrice: e.target.value }))} />
              <p className="text-xs text-muted-foreground">يُستخدم للمناطق التي لا تملك سعراً خاصاً.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRegionOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={addRegionLoading}>{addRegionLoading ? "جاري الإنشاء..." : "إنشاء المحافظة"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Sub-Area Dialog ── */}
      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> إضافة منطقة فرعية</DialogTitle>
            <DialogDescription>إضافة حي أو منطقة داخل {addSubParent?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSub} className="space-y-4">
            <div className="space-y-1.5">
              <Label>اسم الحي / المنطقة *</Label>
              <Input required placeholder="مثال: المعادي، وسط البلد، المنتزه" value={addSubForm.name} onChange={e => setAddSubForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>وصف (اختياري)</Label>
              <Input placeholder="وصف مختصر" value={addSubForm.description} onChange={e => setAddSubForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>السعر الأساسي ($)</Label>
              <Input type="number" min="0" step="0.5" required value={addSubForm.basePrice} onChange={e => setAddSubForm(f => ({ ...f, basePrice: e.target.value }))} />
              <p className="text-xs text-muted-foreground">السعر قبل تطبيق معاملات الوزن ونوع التوصيل.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddSubOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={addSubLoading}>{addSubLoading ? "جاري الإضافة..." : "إضافة المنطقة"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل البيانات</DialogTitle>
            <DialogDescription>{editZone?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف اختياري" />
            </div>
            <div className="space-y-1.5">
              <Label>السعر الأساسي ($)</Label>
              <Input type="number" min="0" step="0.5" required value={editForm.basePrice} onChange={e => setEditForm(f => ({ ...f, basePrice: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={editLoading}>{editLoading ? "جاري الحفظ..." : "حفظ التغييرات"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Pricing Dialog ── */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> تسعير: {pricingZone?.name}</DialogTitle>
            <DialogDescription>
              السعر النهائي = (السعر الأساسي + الوزن × سعر الكيلو) × معامل نوع التوصيل
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePricing} className="space-y-5">
            <div className="space-y-1.5">
              <Label>سعر الكيلوجرام الواحد ($)</Label>
              <Input type="number" min="0" step="0.1" required value={pricingForm.pricePerKg} onChange={e => setPricingForm(f => ({ ...f, pricePerKg: e.target.value }))} />
            </div>
            <div className="space-y-3">
              <Label>معاملات نوع التوصيل</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">توصيل عادي</p>
                  <p className="text-[10px] text-muted-foreground mb-1">3-5 أيام</p>
                  <Input type="number" min="0.1" step="0.1" required value={pricingForm.standardMultiplier} onChange={e => setPricingForm(f => ({ ...f, standardMultiplier: e.target.value }))} className="h-8 text-center text-sm" />
                </div>
                <div className="space-y-1.5 bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">توصيل سريع</p>
                  <p className="text-[10px] text-muted-foreground mb-1">1-2 يوم</p>
                  <Input type="number" min="0.1" step="0.1" required value={pricingForm.expressMultiplier} onChange={e => setPricingForm(f => ({ ...f, expressMultiplier: e.target.value }))} className="h-8 text-center text-sm" />
                </div>
                <div className="space-y-1.5 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">نفس اليوم</p>
                  <p className="text-[10px] text-muted-foreground mb-1">حتى 6 ساعات</p>
                  <Input type="number" min="0.1" step="0.1" required value={pricingForm.sameDayMultiplier} onChange={e => setPricingForm(f => ({ ...f, sameDayMultiplier: e.target.value }))} className="h-8 text-center text-sm" />
                </div>
              </div>
            </div>

            {/* Formula preview */}
            {pricingZone && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1 border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">مثال على حساب السعر (وزن 5 كغ):</p>
                {["standardMultiplier", "expressMultiplier", "sameDayMultiplier"].map((key, i) => {
                  const labels = ["عادي", "سريع", "نفس اليوم"]
                  const base = Number(pricingZone.basePrice)
                  const perKg = Number(pricingForm.pricePerKg)
                  const mult = Number((pricingForm as any)[key]) || 1
                  const price = (base + 5 * perKg) * mult
                  return (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{labels[i]}</span>
                      <span className="font-semibold">ج.م {isNaN(price) ? "0.00" : price.toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Driver payout */}
            <div className="space-y-1.5">
              <Label>حصة السائق الثابتة ($) — اختياري</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                placeholder="مثال: 30"
                value={pricingForm.driverPayout}
                onChange={e => setPricingForm(f => ({ ...f, driverPayout: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                إذا حُدِّدت، ستُطبَّق لجميع السائقين في هذه المنطقة بدلاً من عمولتهم الشخصية.
              </p>
            </div>

            {/* Driver / Company split preview */}
            {pricingForm.driverPayout !== "" && (() => {
              const base = Number(pricingZone?.basePrice ?? 0)
              const perKg = Number(pricingForm.pricePerKg)
              const standardMult = Number(pricingForm.standardMultiplier) || 1
              const examplePrice = (base + 5 * perKg) * standardMult
              const dPayout = Number(pricingForm.driverPayout)
              const company = examplePrice - dPayout
              return (
                <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 p-3 space-y-2 text-sm">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">معاينة التوزيع (توصيل عادي، وزن 5 كغ):</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">إجمالي الطلب</span>
                    <span className="font-bold">ج.م {isNaN(examplePrice) ? "0.00" : examplePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-700 dark:text-green-400">
                    <span>حصة السائق</span>
                    <span className="font-bold">ج.م {isNaN(dPayout) ? "0.00" : dPayout.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-700 dark:text-blue-400 border-t pt-1">
                    <span>ربح الشركة</span>
                    <span className="font-bold">ج.م {isNaN(company) ? "0.00" : company.toFixed(2)}</span>
                  </div>
                </div>
              )
            })()}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPricingOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={pricingLoading} className="gap-2">
                <Save className="h-4 w-4" />{pricingLoading ? "جاري الحفظ..." : "حفظ التسعير"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف <strong>&quot;{deleteTarget?.name}&quot;</strong>؟<br />
              سيتم حذف جميع المناطق الفرعية المرتبطة بها أيضاً. لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setDeleteOpen(false)} className="flex-1">إلغاء</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading} className="flex-1">
                {deleteLoading ? "جاري الحذف..." : "حذف نهائياً"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}