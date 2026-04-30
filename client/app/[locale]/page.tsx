"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { useLanguage } from "@/context/LanguageContext"

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { localizedPath, t } = useLanguage()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push(localizedPath("/login"))
      } else if (user.role === "ADMIN") {
        router.push(localizedPath("/admin"))
      } else if (user.role === "DRIVER") {
        router.push(localizedPath("/driver"))
      } else {
        router.push(localizedPath("/client"))
      }
    }
  }, [user, isLoading, localizedPath, router])

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium">{t("loading")}</p>
      </div>
    </div>
  )
}
