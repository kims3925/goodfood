'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, ShoppingBag, Package, Users, DollarSign } from 'lucide-react'

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  const stats = {
    '7d': { orders: 47, revenue: 2340000, products: 156, users: 12 },
    '30d': { orders: 189, revenue: 9800000, products: 623, users: 38 },
    '90d': { orders: 534, revenue: 28500000, products: 1847, users: 95 },
  }

  const current = stats[period]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">통계 / 분석</h1>
              <p className="text-gray-600">플랫폼 전체 운영 통계</p>
            </div>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p === '7d' ? '7일' : p === '30d' ? '30일' : '90일'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={<ShoppingBag size={20} />} label="주문 수" value={current.orders} unit="건" color="blue" />
        <KPICard icon={<DollarSign size={20} />} label="매출" value={current.revenue} unit="원" format="currency" color="green" />
        <KPICard icon={<Package size={20} />} label="수집 상품" value={current.products} unit="개" color="purple" />
        <KPICard icon={<Users size={20} />} label="신규 사용자" value={current.users} unit="명" color="indigo" />
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">일별 주문 추이</h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <BarChart3 size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Recharts 차트 연동 예정</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">파이프라인 처리량</h2>
          <div className="h-64 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-center">
              <TrendingUp size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">수집/변환/발행 일별 추이</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Shops */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">쇼핑몰별 매출 순위</h2>
        <div className="space-y-3">
          {[
            { name: '장터마켓', orders: 89, revenue: 4500000 },
            { name: '해양수산', orders: 67, revenue: 3800000 },
            { name: '농산물직거래', orders: 33, revenue: 1500000 },
          ].map((shop, idx) => (
            <div key={shop.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-gray-900">{shop.name}</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <span>{shop.orders}건</span>
                <span className="font-medium">{shop.revenue.toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, label, value, unit, format, color }: {
  icon: React.ReactNode; label: string; value: number; unit: string; format?: string; color: string
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50', green: 'bg-green-50', purple: 'bg-purple-50', indigo: 'bg-indigo-50',
  }
  const textMap: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', purple: 'text-purple-600', indigo: 'text-indigo-600',
  }
  const displayValue = format === 'currency' ? value.toLocaleString() : value.toString()

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${bgMap[color]} ${textMap[color]}`}>{icon}</div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {displayValue}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </p>
    </div>
  )
}
