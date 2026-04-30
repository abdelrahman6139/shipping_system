"use client"

import { memo } from "react"
import { useLocale } from "next-intl"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatDate, formatMoney, type ChartLocale } from "@/lib/chart-format"

export type AdminRevenuePoint = {
  date: string
  revenue: number
}

function AdminRevenueChart({ data }: { data: AdminRevenuePoint[] }) {
  const locale = useLocale() as ChartLocale

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatDate(value, locale)} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value, locale)} />
        <Tooltip
          cursor={{ fill: "transparent" }}
          contentStyle={{ borderRadius: "8px" }}
          formatter={(value) => [formatMoney(value, locale), locale === "ar" ? "الإيراد" : "Revenue"]}
          labelFormatter={(label) => formatDate(label, locale)}
        />
        <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default memo(AdminRevenueChart)
