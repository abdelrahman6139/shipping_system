"use client"

import { memo, useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts"
import { formatDate, formatMoney, type ChartLocale } from "@/lib/chart-format"

export type AdminRevenuePoint = {
  date: string
  revenue: number
}

function useChartBox(minWidth = 280, minHeight = 220) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: minWidth, height: minHeight })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const rect = element.getBoundingClientRect()
      setSize({
        width: Math.max(minWidth, Math.floor(rect.width || minWidth)),
        height: Math.max(minHeight, Math.floor(rect.height || minHeight)),
      })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [minHeight, minWidth])

  return { ref, ...size }
}

function AdminRevenueChart({ data }: { data: AdminRevenuePoint[] }) {
  const locale = useLocale() as ChartLocale
  const t = useTranslations("Common")
  const { ref, width, height } = useChartBox()

  return (
    <div ref={ref} className="h-full min-h-[220px] w-full">
      <BarChart width={width} height={height} data={data}>
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatDate(value, locale)} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value, locale)} />
        <Tooltip
          cursor={{ fill: "transparent" }}
          contentStyle={{ borderRadius: "8px" }}
          formatter={(value) => [formatMoney(value, locale), t("revenue")]}
          labelFormatter={(label) => formatDate(label, locale)}
        />
        <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </div>
  )
}

export default memo(AdminRevenueChart)
