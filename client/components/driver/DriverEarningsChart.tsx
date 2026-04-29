"use client"

import { memo } from "react"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type DayChart = {
  date: string
  driverEarning: number
  orderTotal: number
}

function fmt(value: number) {
  return `Ø¬.Ù… ${Number(value || 0).toFixed(2)}`
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })
}

function DriverEarningsChart({ data }: { data: DayChart[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={200}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(value) => new Date(value).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
        />
        <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `Ø¬.Ù… ${value}`} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          contentStyle={{ borderRadius: "10px", fontSize: "13px" }}
          formatter={(value, name) => [fmt(Number(value ?? 0)), name === "driverEarning" ? "Ø­ØµØ© Ø§Ù„Ø³Ø§Ø¦Ù‚" : "Ù‚ÙŠÙ…Ø© Ø§Ù„Ø·Ù„Ø¨"]}
          labelFormatter={(label) => fmtDate(String(label))}
        />
        <Legend
          formatter={(value) => value === "driverEarning" ? "Ø­ØµØ© Ø§Ù„Ø³Ø§Ø¦Ù‚" : "Ù‚ÙŠÙ…Ø© Ø§Ù„Ø·Ù„Ø¨"}
          wrapperStyle={{ fontSize: "12px" }}
        />
        <Bar dataKey="orderTotal" fill="#93c5fd" radius={[4, 4, 0, 0]} name="orderTotal" />
        <Bar dataKey="driverEarning" fill="#34d399" radius={[4, 4, 0, 0]} name="driverEarning" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default memo(DriverEarningsChart)
