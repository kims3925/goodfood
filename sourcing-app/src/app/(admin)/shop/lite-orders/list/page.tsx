/**
 * 어드민 — 라이트주문 통합 목록
 * 모든 라이트 셀러 쇼핑몰의 주문을 한 화면에서 관리. 쇼핑몰별 탭 전환 + 상태 필터.
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, ShoppingBag, Filter, ExternalLink } from 'lucide-react'

interface ShopAgg {
  id: number
  name: string
  subdomain: string
  sellerEmail: string
  sellerName: string | null
  orderCount: number
  totalRevenue: number
}

interface OrderRow {
  id: number
  source: 'MEMBER' | 'GUEST'
  shopId: number
  shopName: string
  shopSubdomain: string
  sellerEmail: string
  orderNumber: string
  productSummary: string
  itemCount: number
  totalAmount: number
  status: string
  recipientName: string | null
  recipientPhone: string | null
  orderedAt: string
}

const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'PAID', label: '결제완료' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'SHIPPED', label: '배송중' },
  { value: 'DELIVERED', label: '배송완료' },
  { value: 'CANCELLED', label: '취소' },
]

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-yellow-100 text-yellow-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
  PENDING: 'bg-orange-100 text-orange-700',
}

function formatPrice(n: number) {
  return Math.round(n).toLocaleString('ko-KR')
}

export default function LiteOrdersListPage() {
  const [shops, setShops] = useState<ShopAgg[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeShopId, setActiveShopId] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [days, setDays] = useState(30)

  async function load() {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (activeShopId) qs.set('shopId', String(activeShopId))
      if (status) qs.set('status', status)
      qs.set('days', String(days))
      const res = await fetch(`/api/admin/lite/orders?${qs.toString()}`, {
        credentials: 'include',
      }).then((r) => r.json())
      if (res.success) {
        setShops(res.data.shops || [])
        setOrders(res.data.orders || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [activeShopId, status, days])

  const filteredOrders = activeShopId ? orders.filter((o) => o.shopId === activeShopId) : orders
  const totalRevenue = filteredOrders.reduce((s, o) => s + o.totalAmount, 0)

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          라이트주문
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          라이트 셀러 쇼핑몰의 모든 주문을 한 곳에서 모니터링합니다.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label="활성 쇼핑몰" value={`${shops.length}개`} />
        <SummaryCard label="주문 건수" value={`${filteredOrders.length}건`} />
        <SummaryCard label="총 매출" value={`₩${formatPrice(totalRevenue)}`} highlight />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setActiveShopId(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            activeShopId === null
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
          }`}
        >
          전체 ({shops.reduce((s, x) => s + x.orderCount, 0)})
        </button>
        {shops.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveShopId(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
              activeShopId === s.id
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
            title={s.sellerEmail}
          >
            <ShoppingBag className="w-3 h-3" />
            {s.name} ({s.orderCount})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1 text-sm">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm"
        >
          <option value={7}>최근 7일</option>
          <option value={30}>최근 30일</option>
          <option value={90}>최근 90일</option>
          <option value={365}>1년</option>
        </select>
      </div>

      {loading && <div className="text-center text-gray-500 py-12">로딩 중...</div>}

      {!loading && filteredOrders.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
          주문 내역이 없습니다
        </div>
      )}

      {!loading && filteredOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium text-gray-700">
                <th className="px-3 py-2">주문번호</th>
                <th className="px-3 py-2">쇼핑몰</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">수령인</th>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2 text-right">금액</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">주문일시</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={`${o.source}-${o.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{o.orderNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.shopName}</div>
                    <div className="text-xs text-gray-500">/{o.shopSubdomain}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        o.source === 'MEMBER'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {o.source === 'MEMBER' ? '회원' : '비회원'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div>{o.recipientName || '-'}</div>
                    <div className="text-xs text-gray-500">{o.recipientPhone || ''}</div>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={o.productSummary}>
                    {o.productSummary}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    ₩{formatPrice(o.totalAmount)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(o.orderedAt).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-4 border ${
        highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="text-xs text-gray-600">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          highlight ? 'text-blue-700' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
