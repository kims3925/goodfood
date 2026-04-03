'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

interface KpiDataItem {
  agentName: string
  achievement: number
  target: number
}

interface KpiChartProps {
  data: KpiDataItem[]
}

function getBarColor(achievement: number): string {
  if (achievement >= 100) return '#22c55e' // green-500
  if (achievement >= 70) return '#eab308'  // yellow-500
  return '#ef4444'                          // red-500
}

interface TooltipPayloadItem {
  value: number
  payload: KpiDataItem
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const item = payload[0]
  return (
    <div className="bg-white border border-border rounded-lg shadow-md px-3 py-2">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-xs text-text-secondary mt-1">
        Achievement: <span className="font-medium">{item.value}%</span>
      </p>
      <p className="text-xs text-text-secondary">
        Target: {item.payload.target}
      </p>
    </div>
  )
}

export default function KpiChart({ data }: KpiChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        achievementRate: item.target > 0 ? Math.round((item.achievement / item.target) * 100) : 0,
      })),
    [data]
  )

  if (data.length === 0) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-sm p-6">
        <p className="text-sm text-text-secondary text-center">No KPI data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-4">
        Agent KPI Achievement
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="agentName"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            unit="%"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={100}
            stroke="#22c55e"
            strokeDasharray="4 4"
            label={{ value: '100%', position: 'right', fontSize: 11, fill: '#22c55e' }}
          />
          <ReferenceLine
            y={70}
            stroke="#eab308"
            strokeDasharray="4 4"
            label={{ value: '70%', position: 'right', fontSize: 11, fill: '#eab308' }}
          />
          <Bar dataKey="achievementRate" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.achievementRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
