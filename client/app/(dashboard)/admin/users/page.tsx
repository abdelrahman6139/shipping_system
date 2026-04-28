"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import api from "@/lib/api"
import {
  Search, UserPlus, ShieldAlert, Truck, Pencil,
  Percent, DollarSign, Loader2, TrendingUp, Package,
  BarChart2, User, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

/* ─── Types ─── */
type UserRow = {
  id: string; name: string; email: string; phone?: string
  role: string; isActive: boolean; createdAt: string
  commissionType: string; commissionValue: number
  _count: { clientOrders: number; driverOrders: number }
}

/* ─── Helpers ─── */
function RolePill({ role }: { role: string }) {
  if (role === "ADMIN")  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2.5 py-1 text-xs font-semibold"><ShieldAlert className="h-3 w-3" />مشرف</span>
  if (role === "DRIVER") return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 text-xs font-semibold"><Truck className="h-3 w-3" />سائق</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400 px-2.5 py-1 text-xs font-semibold"><User className="h-3 w-3" />عميل</span>
}

function CommissionBadge({ type, value }: { type: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-semibold">
      {type === "PERCENTAGE" ? <Percent className="h-3 w-3" /> : <DollarSign className="h-3 w-3" />}
      {type === "PERCENTAGE" ? `${value}%` : `$${value}`}
    </span>
  )
}

/* ═══════════════ PAGE ══════════════ */
export default function AdminUsersPage() {
  const [users, setUsers]       = useState<UserRow[]>([])
  const [isLoading, setLoading] = useState(true)
  const [search, setSearch]     = useState("")
  const [roleFilter, setRole]   = useState("ALL")

  /* add dialog */
  const [addOpen, setAddOpen]   = useState(false)
  const [addLoading, setAddL]   = useState(false)
  const [addForm, setAddForm]   = useState({ name:"", email:"", phone:"", password:"", role:"CLIENT" })

  /* edit dialog */
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditL] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name:"", email:"", phone:"" })

  /* commission dialog */
  const [commOpen, setCommOpen] = useState(false)
  const [commLoading, setCommL] = useState(false)
  const [commUser, setCommUser] = useState<UserRow | null>(null)
  const [commType, setCommType] = useState<"PERCENTAGE"|"FIXED">("PERCENTAGE")
  const [commValue, setCommVal] = useState<number>(15)

  /* earnings dialog */
  const [earnOpen, setEarnOpen]     = useState(false)
  const [earnLoading, setEarnL]     = useState(false)
  const [earnData, setEarnData]     = useState<any>(null)
  const [earnDriver, setEarnDriver] = useState<UserRow | null>(null)

  useEffect(() => { fetchUsers() }, [])

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users")
      setUsers(data.users || [])
    } catch { toast.error("فشل تحميل المستخدمين") }
    finally { setLoading(false) }
  }

  /* ── Filtered list ── */
  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === "ALL" || u.role === roleFilter
    return matchSearch && matchRole
  })

  /* ── Add user ── */
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddL(true)
    try {
      await api.post("/users", addForm)
      toast.success("تم إنشاء المستخدم")
      setAddOpen(false)
      setAddForm({ name:"", email:"", phone:"", password:"", role:"CLIENT" })
      fetchUsers()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل إنشاء المستخدم") }
    finally { setAddL(false) }
  }

  /* ── Toggle active ── */
  const toggleStatus = async (id: string, cur: boolean) => {
    try {
      await api.put(`/users/${id}`, { isActive: !cur })
      toast.success(cur ? "تم تعطيل الحساب" : "تم تفعيل الحساب")
      fetchUsers()
    } catch { toast.error("فشل تغيير الحالة") }
  }

  /* ── Edit user ── */
  const openEdit = (u: UserRow) => {
    setEditUser(u); setEditForm({ name: u.name, email: u.email, phone: u.phone || "" }); setEditOpen(true)
  }
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editUser) return; setEditL(true)
    try {
      await api.put(`/users/${editUser.id}`, editForm)
      toast.success("تم التحديث"); setEditOpen(false); fetchUsers()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل التحديث") }
    finally { setEditL(false) }
  }

  /* ── Commission ── */
  const openComm = (u: UserRow) => {
    setCommUser(u)
    setCommType((u.commissionType as "PERCENTAGE" | "FIXED") || "PERCENTAGE")
    setCommVal(u.commissionValue ?? 15)
    setCommOpen(true)
  }
  const handleComm = async (e: React.FormEvent) => {
    e.preventDefault(); if (!commUser) return; setCommL(true)
    try {
      await api.patch(`/users/${commUser.id}/commission`, { commissionType: commType, commissionValue: commValue })
      toast.success("تم تحديث العمولة"); setCommOpen(false); fetchUsers()
    } catch (e: any) { toast.error(e.response?.data?.error || "فشل تحديث العمولة") }
    finally { setCommL(false) }
  }

  /* ── Earnings breakdown ── */
  const openEarnings = async (u: UserRow) => {
    setEarnDriver(u); setEarnOpen(true); setEarnL(true); setEarnData(null)
    try {
      const { data } = await api.get(`/users/${u.id}/earnings`)
      setEarnData(data)
    } catch { toast.error("فشل تحميل الأرباح") }
    finally { setEarnL(false) }
  }

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-0.5">أدر الحسابات وعيّن عمولات السائقين وتابع الأرباح</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> إضافة مستخدم
        </Button>
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="ابحث بالاسم أو البريد..." className="pr-10 h-11" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{v:"ALL",l:"الكل"},{v:"CLIENT",l:"العملاء"},{v:"DRIVER",l:"السائقون"},{v:"ADMIN",l:"المشرفون"}].map(r => (
            <button key={r.v} onClick={() => setRole(r.v)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                roleFilter === r.v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:border-primary/50"
              }`}>
              {r.l}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 border-b">
            <tr className="text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 text-right font-medium">المستخدم</th>
              <th className="px-4 py-3 text-right font-medium">الهاتف</th>
              <th className="px-4 py-3 text-right font-medium">الدور</th>
              <th className="px-4 py-3 text-right font-medium">العمولة</th>
              <th className="px-4 py-3 text-right font-medium">الطلبات</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
              <th className="px-4 py-3 text-right font-medium">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-36 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-6 w-16 bg-muted rounded-full" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-14 bg-muted rounded-full" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-10 bg-muted rounded" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-12 bg-muted rounded-full" /></td>
                  <td className="px-4 py-3"><div className="h-8 w-20 bg-muted rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-muted-foreground">لا يوجد مستخدمون</td></tr>
            ) : filtered.map((u, idx) => (
              <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground" dir="ltr">{u.phone || "—"}</td>
                <td className="px-4 py-3"><RolePill role={u.role} /></td>
                <td className="px-4 py-3">
                  {u.role === "DRIVER"
                    ? <CommissionBadge type={u.commissionType} value={u.commissionValue} />
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {u.role === "DRIVER" ? u._count.driverOrders : u._count.clientOrders}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    u.isActive
                      ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {u.isActive ? "نشط" : "معطّل"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1 flex-wrap">
                    <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" /> تعديل
                    </Button>
                    {u.role === "DRIVER" && (
                      <>
                        <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => openComm(u)}>
                          <Percent className="h-3.5 w-3.5" /> العمولة
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs text-primary border-primary/30 hover:bg-primary/5" onClick={() => openEarnings(u)}>
                          <BarChart2 className="h-3.5 w-3.5" /> الأرباح
                        </Button>
                      </>
                    )}
                    <Button variant={u.isActive ? "secondary" : "default"} size="sm" className="h-8 px-2 text-xs" onClick={() => toggleStatus(u.id, u.isActive)}>
                      {u.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          [...Array(3)].map((_,i) => <div key={i} className="rounded-xl border p-4 animate-pulse space-y-3"><div className="h-4 w-36 bg-muted rounded" /><div className="h-4 w-24 bg-muted rounded" /></div>)
        ) : filtered.map(u => (
          <div key={u.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                {u.phone && <p className="text-xs text-muted-foreground" dir="ltr">{u.phone}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <RolePill role={u.role} />
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {u.isActive ? "نشط" : "معطّل"}
                </span>
              </div>
            </div>
            {u.role === "DRIVER" && (
              <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                <span>العمولة:</span>
                <CommissionBadge type={u.commissionType} value={u.commissionValue} />
                <span className="mr-auto">{u._count.driverOrders} طلب</span>
              </div>
            )}
            <div className="flex gap-2 flex-wrap border-t pt-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs flex-1" onClick={() => openEdit(u)}>
                <Pencil className="h-3.5 w-3.5" /> تعديل
              </Button>
              {u.role === "DRIVER" && (
                <>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-emerald-600 border-emerald-200" onClick={() => openComm(u)}>
                    <Percent className="h-3.5 w-3.5" /> العمولة
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-primary border-primary/30" onClick={() => openEarnings(u)}>
                    <BarChart2 className="h-3.5 w-3.5" /> الأرباح
                  </Button>
                </>
              )}
              <Button variant={u.isActive ? "secondary" : "default"} size="sm" className="h-8 text-xs" onClick={() => toggleStatus(u.id, u.isActive)}>
                {u.isActive ? "تعطيل" : "تفعيل"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ══════ ADD USER DIALOG ══════ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مستخدم جديد</DialogTitle>
            <DialogDescription>أنشئ حساباً جديداً في النظام</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="الاسم" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input required type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={addForm.phone} onChange={e => setAddForm({...addForm, phone: e.target.value})} placeholder="05xxxxxxxx" />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <Input required type="password" minLength={6} value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} placeholder="6 أحرف على الأقل" />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={addForm.role} onChange={e => setAddForm({...addForm, role: e.target.value})}>
                <option value="CLIENT">عميل</option>
                <option value="DRIVER">سائق</option>
                <option value="ADMIN">مشرف</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addLoading} className="w-full gap-2">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                إنشاء المستخدم
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ EDIT USER DIALOG ══════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>{editUser?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input required type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editLoading} className="w-full gap-2">
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ COMMISSION DIALOG ══════ */}
      <Dialog open={commOpen} onOpenChange={setCommOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-emerald-600" /> ضبط عمولة السائق
            </DialogTitle>
            <DialogDescription>{commUser?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleComm} className="space-y-5">

            {/* Type toggle */}
            <div className="space-y-2">
              <Label>نوع العمولة</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setCommType("PERCENTAGE")}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    commType === "PERCENTAGE" ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:border-primary/40"
                  }`}>
                  <Percent className="h-4 w-4" /> نسبة مئوية
                </button>
                <button type="button"
                  onClick={() => setCommType("FIXED")}
                  className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                    commType === "FIXED" ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:border-primary/40"
                  }`}>
                  <DollarSign className="h-4 w-4" /> مبلغ ثابت
                </button>
              </div>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label>{commType === "PERCENTAGE" ? "النسبة (%)" : "المبلغ الثابت ($)"}</Label>
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {commType === "PERCENTAGE" ? "%" : "$"}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={commType === "PERCENTAGE" ? 100 : 9999}
                  step={0.5}
                  className="pr-8"
                  value={commValue}
                  onChange={e => setCommVal(parseFloat(e.target.value) || 0)}
                />
              </div>
              {/* Preview */}
              <div className="rounded-lg bg-muted/50 border p-3 text-xs space-y-1">
                <p className="font-medium text-muted-foreground">مثال — طلب بقيمة $600:</p>
                <div className="flex justify-between">
                  <span className="text-blue-600 dark:text-blue-400">حصة السائق</span>
                  <span className="font-bold">
                    ${commType === "PERCENTAGE"
                      ? (600 * commValue / 100).toFixed(2)
                      : commValue.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-600 dark:text-emerald-400">حصة الشركة</span>
                  <span className="font-bold">
                    ${commType === "PERCENTAGE"
                      ? (600 - 600 * commValue / 100).toFixed(2)
                      : (600 - commValue).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={commLoading} className="w-full gap-2">
                {commLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Percent className="h-4 w-4" />}
                حفظ العمولة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ EARNINGS DIALOG ══════ */}
      <Dialog open={earnOpen} onOpenChange={setEarnOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> سجل أرباح السائق
            </DialogTitle>
            <DialogDescription>{earnDriver?.name}</DialogDescription>
          </DialogHeader>

          {earnLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : earnData ? (
            <div className="space-y-4">
              {/* Totals */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/30 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">إجمالي الطلبات</p>
                  <p className="text-xl font-bold">${earnData.totals.orderTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">حصة السائق</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">${earnData.totals.driverTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">حصة الشركة</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">${earnData.totals.companyTotal.toFixed(2)}</p>
                </div>
              </div>

              {/* Commission info */}
              <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">نوع العمولة الحالية</span>
                <CommissionBadge type={earnData.driver.commissionType} value={earnData.driver.commissionValue} />
              </div>

              {/* Earnings list */}
              {earnData.earnings.length === 0 ? (
                <div className="py-10 text-center">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground/25 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد أرباح مسجّلة بعد</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    آخر {earnData.earnings.length} طلبات مُسلَّمة
                  </p>
                  {earnData.earnings.map((e: any) => (
                    <div key={e.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 text-sm hover:bg-muted/20 transition-colors">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">#{e.order?.id?.slice(0,8).toUpperCase()}</p>
                        <p className="font-medium truncate">{e.order?.destination || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(e.date).toLocaleDateString("ar-EG", { year:"numeric", month:"short", day:"numeric" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs text-muted-foreground">إجمالي الطلب</p>
                        <p className="font-semibold">${e.orderTotal.toFixed(2)}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-blue-600">سائق: ${e.amount.toFixed(2)}</span>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="text-emerald-600">شركة: ${e.companyProfit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
