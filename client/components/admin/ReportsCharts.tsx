"use client"

import { memo, useEffect, useRef, useState, type ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatDate, formatMoney, type ChartLocale } from "@/lib/chart-format"

const tooltipStyle = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: "12px",
}

function useChartBox(minWidth = 260, minHeight = 200) {
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

function ChartBox({ children }: { children: (size: { width: number; height: number }) => ReactNode }) {
  const { ref, width, height } = useChartBox()
  return (
    <div ref={ref} className="h-full min-h-[200px] w-full">
      {children({ width, height })}
    </div>
  )
}

export const PipelineAmountChart = memo(function PipelineAmountChart({ data }: { data: any[] }) {
  const locale = useLocale() as ChartLocale
  const t = useTranslations("Common")

  return (
    <ChartBox>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value, locale)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(value, locale), t("amount")]} />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
            {data.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
          </Bar>
        </BarChart>
      )}
    </ChartBox>
  )
})

export const RevenueAreaChart = memo(function RevenueAreaChart({ data }: { data: any[] }) {
  const locale = useLocale() as ChartLocale
  const t = useTranslations("Common")

  return (
    <ChartBox>
      {({ width, height }) => (
        <AreaChart width={width} height={height} data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatDate(value, locale)} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value, locale)} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: any) => [formatMoney(value, locale), t("revenue")]}
            labelFormatter={(label) => formatDate(label, locale)}
          />
          <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueFill)" />
        </AreaChart>
      )}
    </ChartBox>
  )
})

export const StatusPieChart = memo(function StatusPieChart({ data }: { data: any[] }) {
  return (
    <ChartBox>
      {({ width, height }) => (
        <PieChart width={width} height={height}>
          <Pie data={data} cx="50%" cy="45%" outerRadius={88} dataKey="value" nameKey="name" labelLine={false} fontSize={10}>
            {data.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      )}
    </ChartBox>
  )
})

export const FunnelBarChart = memo(function FunnelBarChart({ data }: { data: any[] }) {
  return (
    <ChartBox>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="stage" width={86} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
        </BarChart>
      )}
    </ChartBox>
  )
})

export const ZoneRevenueBarChart = memo(function ZoneRevenueBarChart({ data }: { data: any[] }) {
  const locale = useLocale() as ChartLocale
  const t = useTranslations("Common")

  return (
    <ChartBox>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <XAxis dataKey="zone" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatMoney(value, locale)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatMoney(value, locale), t("revenue")]} />
          <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
        </BarChart>
      )}
    </ChartBox>
  )
})

export const CancellationReturnLineChart = memo(function CancellationReturnLineChart({ data }: { data: any[] }) {
  const locale = useLocale() as ChartLocale
  const statusT = useTranslations("Status")

  return (
    <ChartBox>
      {({ width, height }) => (
        <LineChart width={width} height={height} data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatDate(value, locale)} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatDate(label, locale)} />
          <Line type="monotone" dataKey="cancelled" name={statusT("CANCELLED")} stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="returned" name={statusT("RETURNED")} stroke="#a855f7" strokeWidth={2} dot={false} />
        </LineChart>
      )}
    </ChartBox>
  )
})

export const TypeDistributionChart = memo(function TypeDistributionChart({ data }: { data: any[] }) {
  return (
    <ChartBox>
      {({ width, height }) => (
        <BarChart width={width} height={height} data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
        </BarChart>
      )}
    </ChartBox>
  )
})
