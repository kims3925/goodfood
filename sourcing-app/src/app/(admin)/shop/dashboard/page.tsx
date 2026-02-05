'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  Percent,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import Card from '@/components/ui/Card'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// 기간 필터 타입
type PeriodFilter = 'today' | '7days' | '30days' | 'custom'

// 날짜 포맷 (YYYY-MM-DD)
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// 오늘 날짜
const getToday = () => new Date()

// N일 전 날짜
const getDaysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// API 응답 타입
interface DashboardData {
  stats: {
    revenue: { value: number; change: number }
    orders: { value: number; change: number }
    customers: { value: number; change: number }
    marginRate: { value: number; change: number }
    totalMargin: { value: number; change: number }
  }
  revenueChart: { date: string; amount: number }[]
  orderStatusChart: { name: string; value: number; color: string }[]
  recentOrders: {
    id: number
    orderNumber: string
    customer: string
    amount: number
    status: string
    time: string
    isGuest?: boolean
  }[]
  topProducts: {
    rank: number
    name: string
    sales: number
    revenue: number
    thumbnailUrl: string | null
  }[]
  shopRevenue: {
    id: number
    name: string
    revenue: number
    percentage: number
    color: string
  }[]
}

// 금액 포맷
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

// 상태 배지
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    PENDING: { label: '결제대기', className: 'bg-yellow-100 text-yellow-700' },
    PAID: { label: '결제완료', className: 'bg-indigo-100 text-indigo-700' },
    PREPARING: { label: '상품준비중', className: 'bg-purple-100 text-purple-700' },
    SHIPPED: { label: '배송중', className: 'bg-blue-100 text-blue-700' },
    DELIVERED: { label: '배송완료', className: 'bg-emerald-100 text-emerald-700' },
    CANCELLED: { label: '취소', className: 'bg-red-100 text-red-700' },
    REFUNDED: { label: '환불', className: 'bg-gray-100 text-gray-700' },
  }
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>
}

// KPI 카드 컴포넌트
interface KPICardProps {
  title: string
  value: string
  change: number
  icon: React.ReactNode
  gradient: string
}

const KPICard = ({ title, value, change, icon, gradient }: KPICardProps) => {
  const isPositive = change >= 0
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${gradient}`}
    >
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-white/10" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-white/10" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="rounded-xl bg-white/20 p-2 sm:p-3 backdrop-blur-sm">
            {icon}
          </div>
          <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
            isPositive ? 'bg-white/20' : 'bg-red-500/30'
          }`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change)}%
          </div>
        </div>

        <div className="mt-3 sm:mt-4">
          <p className="text-xs sm:text-sm font-medium text-white/80">{title}</p>
          <p className="mt-1 text-lg sm:text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  )
}

// 빈 상태 컴포넌트
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
    <AlertCircle size={32} className="mb-2" />
    <p className="text-sm">{message}</p>
  </div>
)

export default function ShopDashboardPage() {
  const [period, setPeriod] = useState<PeriodFilter>('7days')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)

  // 매출 추이 차트 전용 날짜 범위
  const [chartStartDate, setChartStartDate] = useState<string>(formatDateForInput(getDaysAgo(6)))
  const [chartEndDate, setChartEndDate] = useState<string>(formatDateForInput(getToday()))
  const [isCustomDate, setIsCustomDate] = useState(false)

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      let url = `/api/dashboard/shop?period=${period}`

      // 커스텀 날짜 범위가 활성화된 경우
      if (isCustomDate && chartStartDate && chartEndDate) {
        url = `/api/dashboard/shop?period=custom&startDate=${chartStartDate}&endDate=${chartEndDate}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || '데이터를 불러오는데 실패했습니다.')
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setIsRefreshing(false)
    }
  }, [period, isCustomDate, chartStartDate, chartEndDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 기간 프리셋 선택 시
  const handlePeriodChange = (newPeriod: PeriodFilter) => {
    if (newPeriod === 'custom') {
      setIsCustomDate(true)
    } else {
      setIsCustomDate(false)
      setPeriod(newPeriod)

      // 날짜 범위도 업데이트
      const days = newPeriod === 'today' ? 0 : newPeriod === '7days' ? 6 : 29
      setChartStartDate(formatDateForInput(getDaysAgo(days)))
      setChartEndDate(formatDateForInput(getToday()))
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  // 초기 로딩: 데이터가 없고 로딩 중일 때만 전체 로딩 화면 표시
  if (!data && isRefreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (!data) return null

  const { stats, revenueChart, orderStatusChart, recentOrders, topProducts, shopRevenue } = data

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* 왼쪽: 헤더 텍스트 */}
          <div className="w-full sm:w-48">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">쇼핑몰 대시보드</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">실시간 판매 현황 및 통계</p>
          </div>

          {/* 가운데: 기간 필터 + 새로고침 */}
          <div className="flex-1 flex items-center justify-start sm:justify-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto">
            <div className="flex rounded-xl bg-gray-100 p-1">
              {[
                { value: 'today', label: '오늘' },
                { value: '7days', label: '7일' },
                { value: '30days', label: '30일' },
                { value: 'custom', label: '직접선택' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => handlePeriodChange(item.value as PeriodFilter)}
                  className={`rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium transition-all min-h-[40px] sm:min-h-[36px] whitespace-nowrap ${
                    (item.value === 'custom' && isCustomDate) || (!isCustomDate && period === item.value)
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl bg-gray-100 p-2.5 min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* 오른쪽: 균형을 위한 빈 공간 - 데스크톱만 */}
          <div className="hidden sm:block w-48" />
        </div>

        {/* 직접선택 시 날짜 선택기 표시 */}
        {isCustomDate && (
          <div className="flex justify-start sm:justify-center">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 w-full sm:w-auto">
              <Calendar size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="date"
                value={chartStartDate}
                onChange={(e) => setChartStartDate(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none w-full sm:w-32 min-h-[36px]"
              />
              <span className="text-gray-400 flex-shrink-0">~</span>
              <input
                type="date"
                value={chartEndDate}
                onChange={(e) => setChartEndDate(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none w-full sm:w-32 min-h-[36px]"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="총 매출"
          value={formatCurrency(stats.revenue.value)}
          change={stats.revenue.change}
          icon={<DollarSign size={24} />}
          gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
        />
        <KPICard
          title="마진액"
          value={formatCurrency(stats.totalMargin.value)}
          change={stats.totalMargin.change}
          icon={<TrendingUp size={24} />}
          gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
        />
        <KPICard
          title="평균 마진율"
          value={`${stats.marginRate.value}%`}
          change={stats.marginRate.change}
          icon={<Percent size={24} />}
          gradient="bg-gradient-to-br from-rose-500 to-pink-600"
        />
        <KPICard
          title="주문 수"
          value={`${stats.orders.value}건`}
          change={stats.orders.change}
          icon={<Package size={24} />}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600"
        />
        <KPICard
          title="고객 수"
          value={`${stats.customers.value}명`}
          change={stats.customers.change}
          icon={<Users size={24} />}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 매출 추이 차트 */}
        <Card className="lg:col-span-2 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">매출 추이</h3>
          </div>
          {revenueChart.length > 0 ? (
            <div style={{ width: '100%', height: '288px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 10000).toFixed(0)}만`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value) => [formatCurrency(value as number), '매출']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#6366F1"
                    strokeWidth={3}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="해당 기간에 매출 데이터가 없습니다." />
          )}
        </Card>

        {/* 주문 상태 분포 */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">주문 상태</h3>
          </div>
          {orderStatusChart.length > 0 ? (
            <>
              <div style={{ width: '100%', height: '192px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusChart}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {orderStatusChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value, name) => [`${value}건`, name as string]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {orderStatusChart.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600">{item.name}</span>
                    <span className="text-xs font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="해당 기간에 주문이 없습니다." />
          )}
        </Card>
      </div>

      {/* Data Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 최근 주문 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">최근 주문</h3>
            <a
              href="/shop/order/list"
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              전체보기 <ChevronRight size={16} />
            </a>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 sm:p-4 transition-colors hover:bg-gray-100"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full text-xs sm:text-sm font-semibold flex-shrink-0 ${
                      order.isGuest
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {order.customer}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">#{order.orderNumber}</p>
                        {order.isGuest && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600 rounded flex-shrink-0">
                            비회원
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{order.time}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(order.amount)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="주문 내역이 없습니다." />
          )}
        </Card>

        {/* 인기 상품 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">인기 상품 TOP 5</h3>
            <span className="text-sm text-gray-500">판매량 기준</span>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product) => (
                <div
                  key={product.rank}
                  className="flex items-center gap-4 rounded-xl bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                      product.rank === 1
                        ? 'bg-yellow-100 text-yellow-700'
                        : product.rank === 2
                          ? 'bg-gray-200 text-gray-700'
                          : product.rank === 3
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {product.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">판매 {product.sales}개</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="판매된 상품이 없습니다." />
          )}
        </Card>
      </div>

      {/* 쇼핑몰별 매출 */}
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">쇼핑몰별 매출 현황</h3>
          <p className="mt-1 text-sm text-gray-500">운영 중인 쇼핑몰별 매출 비교</p>
        </div>
        {shopRevenue.length > 0 ? (
          <>
            <div className="space-y-4">
              {shopRevenue.map((shop) => (
                <div key={shop.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{shop.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(shop.revenue)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {shop.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${shop.percentage}%`,
                        backgroundColor: shop.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 쇼핑몰 비율 요약 */}
            <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
              {shopRevenue.map((shop) => (
                <div key={shop.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: shop.color }} />
                  <span className="text-sm text-gray-600">{shop.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="쇼핑몰별 매출 데이터가 없습니다." />
        )}
      </Card>
    </div>
  )
}
