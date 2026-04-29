"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import api from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Search,
  ShieldAlert,
  Truck,
  User,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

type UserRow = {
  id: string
  name: string
  email: string
  phone?: string
  role: "ADMIN" | "CLIENT" | "DRIVER"
  isActive: boolean
  createdAt: string
  _count: { clientOrders: number; driverOrders: number }
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const copy = {
  ar: {
    title: "إدارة المستخدمين",
    subtitle: "أدر حسابات العملاء والسائقين والمشرفين.",
    addUser: "إضافة مستخدم",
    exportExcel: "تصدير Excel",
    search: "ابحث بالاسم أو البريد أو الهاتف...",
    all: "الكل",
    clients: "العملاء",
    drivers: "السائقون",
    admins: "المشرفون",
    name: "الاسم",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    role: "الدور",
    orders: "الطلبات",
    status: "الحالة",
    actions: "الإجراءات",
    active: "نشط",
    disabled: "معطل",
    edit: "تعديل",
    disable: "تعطيل",
    enable: "تفعيل",
    noUsers: "لا يوجد مستخدمون",
    loadingError: "فشل تحميل المستخدمين",
    created: "تم إنشاء المستخدم",
    createError: "فشل إنشاء المستخدم",
    statusEnabled: "تم تفعيل الحساب",
    statusDisabled: "تم تعطيل الحساب",
    statusError: "فشل تغيير الحالة",
    updated: "تم التحديث",
    updateError: "فشل التحديث",
    addTitle: "إضافة مستخدم جديد",
    addDescription: "أنشئ حسابا جديدا في النظام",
    editTitle: "تعديل بيانات المستخدم",
    fullName: "الاسم الكامل",
    password: "كلمة المرور",
    create: "إنشاء المستخدم",
    save: "حفظ التغييرات",
    passwordPlaceholder: "6 أحرف على الأقل",
    phonePlaceholder: "01012345678",
    page: "صفحة",
    of: "من",
    result: "نتيجة",
    previous: "السابق",
    next: "التالي",
    admin: "مشرف",
    driver: "سائق",
    client: "عميل",
  },
  en: {
    title: "User Management",
    subtitle: "Manage client, driver, and admin accounts.",
    addUser: "Add User",
    exportExcel: "Export Excel",
    search: "Search by name, email, or phone...",
    all: "All",
    clients: "Clients",
    drivers: "Drivers",
    admins: "Admins",
    name: "Name",
    email: "Email",
    phone: "Phone",
    role: "Role",
    orders: "Orders",
    status: "Status",
    actions: "Actions",
    active: "Active",
    disabled: "Disabled",
    edit: "Edit",
    disable: "Disable",
    enable: "Enable",
    noUsers: "No users found",
    loadingError: "Failed to load users",
    created: "User created",
    createError: "Failed to create user",
    statusEnabled: "Account enabled",
    statusDisabled: "Account disabled",
    statusError: "Failed to change status",
    updated: "Updated",
    updateError: "Failed to update",
    addTitle: "Add New User",
    addDescription: "Create a new account in the system",
    editTitle: "Edit User",
    fullName: "Full Name",
    password: "Password",
    create: "Create User",
    save: "Save Changes",
    passwordPlaceholder: "At least 6 characters",
    phonePlaceholder: "01012345678",
    page: "Page",
    of: "of",
    result: "results",
    previous: "Previous",
    next: "Next",
    admin: "Admin",
    driver: "Driver",
    client: "Client",
  },
}

function roleText(role: string, t: typeof copy.ar) {
  if (role === "ADMIN") return t.admin
  if (role === "DRIVER") return t.driver
  return t.client
}

function RolePill({ role, labels }: { role: string; labels: typeof copy.ar }) {
  if (role === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
        <ShieldAlert className="h-3 w-3" /> {labels.admin}
      </span>
    )
  }
  if (role === "DRIVER") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
        <Truck className="h-3 w-3" /> {labels.driver}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
      <User className="h-3 w-3" /> {labels.client}
    </span>
  )
}

function errorMessage(error: any, fallback: string) {
  const raw = error?.response?.data?.error
  if (typeof raw === "string") return raw
  if (Array.isArray(raw)) return raw[0]?.message || fallback
  return fallback
}

export default function AdminUsersPage() {
  const { language, dir } = useLanguage()
  const t = copy[language]

  const [users, setUsers] = useState<UserRow[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
  const [isLoading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", password: "", role: "CLIENT" })

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" })

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (roleFilter !== "ALL") params.role = roleFilter
      if (debouncedSearch) params.search = debouncedSearch
      const { data } = await api.get("/users", { params })
      setUsers(data.users || [])
      setPagination(data.pagination || { page, limit: 20, total: 0, totalPages: 1, hasNext: false, hasPrev: false })
    } catch {
      toast.error(t.loadingError)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, roleFilter, t.loadingError])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filters = useMemo(() => [
    { value: "ALL", label: t.all },
    { value: "CLIENT", label: t.clients },
    { value: "DRIVER", label: t.drivers },
    { value: "ADMIN", label: t.admins },
  ], [t])

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault()
    setAddLoading(true)
    try {
      await api.post("/users", addForm)
      toast.success(t.created)
      setAddOpen(false)
      setAddForm({ name: "", email: "", phone: "", password: "", role: "CLIENT" })
      fetchUsers()
    } catch (error: any) {
      toast.error(errorMessage(error, t.createError))
    } finally {
      setAddLoading(false)
    }
  }

  const toggleStatus = async (user: UserRow) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive })
      toast.success(user.isActive ? t.statusDisabled : t.statusEnabled)
      fetchUsers()
    } catch {
      toast.error(t.statusError)
    }
  }

  const openEdit = (user: UserRow) => {
    setEditUser(user)
    setEditForm({ name: user.name, email: user.email, phone: user.phone || "" })
    setEditOpen(true)
  }

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editUser) return
    setEditLoading(true)
    try {
      await api.put(`/users/${editUser.id}`, editForm)
      toast.success(t.updated)
      setEditOpen(false)
      fetchUsers()
    } catch (error: any) {
      toast.error(errorMessage(error, t.updateError))
    } finally {
      setEditLoading(false)
    }
  }

  const orderCount = (user: UserRow) => user.role === "DRIVER" ? user._count.driverOrders : user._count.clientOrders

  const exportUsers = async () => {
    setExporting(true)
    try {
      const params: Record<string, string> = {}
      if (roleFilter !== "ALL") params.role = roleFilter
      if (debouncedSearch) params.search = debouncedSearch
      const res = await api.get("/admin/export/users.xlsx", { params, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a")
      a.href = url
      a.download = `users-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error(language === "ar" ? "فشل تصدير ملف Excel" : "Failed to export Excel")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10" dir={dir}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="shrink-0 gap-2" onClick={exportUsers} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t.exportExcel}
          </Button>
          <Button className="shrink-0 gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> {t.addUser}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.search}
            className="h-11 ps-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => { setRoleFilter(filter.value); setPage(1) }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                roleFilter === filter.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:border-primary/50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border shadow-sm sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">{t.name}</th>
                <th className="px-4 py-3 text-start font-medium">{t.email}</th>
                <th className="px-4 py-3 text-start font-medium">{t.phone}</th>
                <th className="px-4 py-3 text-start font-medium">{t.role}</th>
                <th className="px-4 py-3 text-start font-medium">{t.orders}</th>
                <th className="px-4 py-3 text-start font-medium">{t.status}</th>
                <th className="px-4 py-3 text-end font-medium">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse border-b">
                    {[160, 190, 120, 80, 64, 72, 120].map((width, itemIndex) => (
                      <td key={itemIndex} className="px-4 py-3">
                        <div className="h-4 rounded bg-muted" style={{ width }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground">{t.noUsers}</td>
                </tr>
              ) : users.map((user, index) => (
                <tr key={user.id} className={`border-b last:border-0 hover:bg-muted/30 ${index % 2 ? "bg-muted/10" : ""}`}>
                  <td className="px-4 py-3 font-semibold">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">{user.email}</td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">{user.phone || "-"}</td>
                  <td className="px-4 py-3"><RolePill role={user.role} labels={t} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{orderCount(user)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      user.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {user.isActive ? t.active : t.disabled}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => openEdit(user)}>
                        <Pencil className="h-3.5 w-3.5" /> {t.edit}
                      </Button>
                      <Button variant={user.isActive ? "secondary" : "default"} size="sm" className="h-8 text-xs" onClick={() => toggleStatus(user)}>
                        {user.isActive ? t.disable : t.enable}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="space-y-3 rounded-xl border p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded bg-muted" />
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">{t.noUsers}</div>
        ) : users.map((user) => (
          <div key={user.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">{user.email}</p>
                {user.phone && <p className="text-xs text-muted-foreground" dir="ltr">{user.phone}</p>}
              </div>
              <RolePill role={user.role} labels={t} />
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
              <span>{t.orders}: {orderCount(user)}</span>
              <span className={`rounded-full px-2 py-0.5 font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {user.isActive ? t.active : t.disabled}
              </span>
            </div>
            <div className="flex gap-2 border-t pt-2">
              <Button variant="outline" size="sm" className="h-8 flex-1 gap-1 text-xs" onClick={() => openEdit(user)}>
                <Pencil className="h-3.5 w-3.5" /> {t.edit}
              </Button>
              <Button variant={user.isActive ? "secondary" : "default"} size="sm" className="h-8 flex-1 text-xs" onClick={() => toggleStatus(user)}>
                {user.isActive ? t.disable : t.enable}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.page} {pagination.page} {t.of} {pagination.totalPages}
            <span className="ms-2 text-muted-foreground/60">({pagination.total} {t.result})</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
              {dir === "rtl" ? <ChevronRight className="me-1 h-4 w-4" /> : <ChevronLeft className="me-1 h-4 w-4" />}
              {t.previous}
            </Button>
            <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => setPage((value) => value + 1)}>
              {t.next}
              {dir === "rtl" ? <ChevronLeft className="ms-1 h-4 w-4" /> : <ChevronRight className="ms-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t.addTitle}</DialogTitle>
            <DialogDescription>{t.addDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.fullName}</Label>
              <Input required value={addForm.name} onChange={(event) => setAddForm({ ...addForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.email}</Label>
              <Input required type="email" dir="ltr" value={addForm.email} onChange={(event) => setAddForm({ ...addForm, email: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.phone}</Label>
              <Input dir="ltr" value={addForm.phone} onChange={(event) => setAddForm({ ...addForm, phone: event.target.value })} placeholder={t.phonePlaceholder} />
            </div>
            <div className="space-y-2">
              <Label>{t.password}</Label>
              <Input required type="password" minLength={6} value={addForm.password} onChange={(event) => setAddForm({ ...addForm, password: event.target.value })} placeholder={t.passwordPlaceholder} />
            </div>
            <div className="space-y-2">
              <Label>{t.role}</Label>
              <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={addForm.role} onChange={(event) => setAddForm({ ...addForm, role: event.target.value })}>
                <option value="CLIENT">{roleText("CLIENT", t)}</option>
                <option value="DRIVER">{roleText("DRIVER", t)}</option>
                <option value="ADMIN">{roleText("ADMIN", t)}</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addLoading} className="w-full gap-2">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{t.editTitle}</DialogTitle>
            <DialogDescription>{editUser?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.fullName}</Label>
              <Input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.email}</Label>
              <Input required type="email" dir="ltr" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.phone}</Label>
              <Input dir="ltr" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editLoading} className="w-full gap-2">
                {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {t.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
