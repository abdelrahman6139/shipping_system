"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import { Truck, Eye, EyeOff } from "lucide-react"

const EGYPTIAN_PHONE_RE = /^(\+20|0020|0)?1[0125]\d{8}$/

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", phone: "", role: "CLIENT" })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]       = useState(false)
  const [phoneError, setPhoneError]     = useState("")
  const { register } = useAuth()
  const { localizedPath } = useLanguage()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData(f => ({ ...f, [id]: value }))
    if (id === "phone") setPhoneError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate Egyptian phone if provided
    if (formData.phone && !EGYPTIAN_PHONE_RE.test(formData.phone.replace(/\s/g, ""))) {
      setPhoneError("رقم الهاتف غير صحيح — أدخل رقم مصري (مثال: 01012345678)")
      return
    }
    setIsLoading(true)
    try {
      await register(formData)
      toast.success("تم إنشاء الحساب بنجاح")
    } catch (error: any) {
      const msg = error.response?.data?.error
      if (Array.isArray(msg)) {
        toast.error(msg.map((e: any) => e.message || e).join(" — "))
      } else {
        toast.error(msg || "فشل إنشاء الحساب")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">شركة الشحن المصرية</h1>
          <p className="text-sm text-muted-foreground mt-1">منصة إدارة الشحنات الذكية</p>
        </div>

        <div className="bg-card border rounded-2xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold">إنشاء حساب جديد</h2>
            <p className="text-sm text-muted-foreground mt-1">انضم إلى منصة الشحن الآن</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل <span className="text-red-500">*</span></Label>
              <Input id="name" placeholder="أدخل اسمك الكامل" value={formData.name} onChange={handleChange} required className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" placeholder="name@example.com" value={formData.email} onChange={handleChange} required className="h-11" dir="ltr" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                رقم الهاتف <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="01012345678"
                value={formData.phone}
                onChange={handleChange}
                className={`h-11 ${phoneError ? "border-red-500 focus-visible:ring-red-400" : ""}`}
                dir="ltr"
              />
              {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
              <p className="text-[11px] text-muted-foreground">أرقام فودافون، اورنج، اتصالات، WE فقط</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">نوع الحساب</Label>
              <select
                id="role"
                title="اختر نوع الحساب"
                value={formData.role}
                onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="CLIENT">تاجر / عميل</option>
                <option value="DRIVER">سائق / مندوب</option>
              </select>
              <p className="text-xs text-muted-foreground">حساب المدير يتم إنشاؤه من لوحة الإدارة فقط.</p>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  جاري إنشاء الحساب...
                </span>
              ) : "إنشاء حساب"}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t text-center">
            <p className="text-sm text-muted-foreground">
              لديك حساب بالفعل؟{" "}
              <Link href={localizedPath("/login")} className="text-primary font-semibold hover:underline underline-offset-4">سجّل الدخول</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
