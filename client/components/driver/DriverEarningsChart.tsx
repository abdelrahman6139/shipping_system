"use client"

import { memo } from "react"
import { useLocale } from "next-intl"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatDate, formatMoney, type ChartLocale } from "@/lib/chart-format"

type DayChart = {
  date: string
  driverEarning: number
  orderTotal: number
}

function DriverEarningsChart({ data }: { data: DayChart[] }) {
  const locale = useLocale() as ChartLocale
  const driverShareLabel = locale === "ar" ? "حصة السائق" : "Driver share"
  const orderValueLabel = locale === "ar" ? "قيمة الطلب" : "Order value"

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(value) => formatDate(value, locale)}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => formatMoney(value, locale)} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ borderRadius: "10px", fontSize: "13px" }}
          formatter={(value, name) => [
            formatMoney(value, locale),
            name === "driverEarning" ? driverShareLabel : orderValueLabel,
          ]}
          labelFormatter={(label) => formatDate(label, locale)}
        />
        <Legend
          formatter={(value) => (value === "driverEarning" ? driverShareLabel : orderValueLabel)}
          wrapperStyle={{ fontSize: "12px" }}
        />
        <Bar dataKey="orderTotal" fill="#93c5fd" radius={[4, 4, 0, 0]} name="orderTotal" />
        <Bar dataKey="driverEarning" fill="#34d399" radius={[4, 4, 0, 0]} name="driverEarning" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default memo(DriverEarningsChart)
