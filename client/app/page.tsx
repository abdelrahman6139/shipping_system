"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
      } else {
        if (user.role === "ADMIN") router.push("/admin")
        else if (user.role === "DRIVER") router.push("/driver")
        else router.push("/client")
      }
    }
  }, [user, isLoading, router])

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <p className="text-muted-foreground font-medium">جاري تحميل نظام الشحن...</p>
      </div>
    </div>
  )
}
