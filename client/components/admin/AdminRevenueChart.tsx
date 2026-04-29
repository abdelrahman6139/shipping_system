"use client"

import { memo } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export type AdminRevenuePoint = {
  name: string
  revenue: number
}

function AdminRevenueChart({ data }: { data: AdminRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `Ø¬.Ù… ${value}`} />
        <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px" }} />
        <Bar dataKey="revenue" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default memo(AdminRevenueChart)
