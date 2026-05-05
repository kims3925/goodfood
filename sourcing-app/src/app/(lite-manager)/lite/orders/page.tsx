/**
 * Lite Orders — 주문 리스트 (F2) 실구현
 * - 마스킹된 구매자 정보 표시 (서버에서 마스킹 적용)
 * - 시간순 정렬, 상태별 필터
 * - 자동 발주 호출 금지 (조회만, F6 발주 트리거는 별도 버튼)
 */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface OrderItem {
  productName: string
  optionSummary: string | null
  quantity: number
  unitPrice: string | number
}

interface Order {
  id: number
  orderNumber: string
  status: string
  totalAmount: string | number
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  shop: { id: number | undefined; name: string | undefined; subdomain: string | undefined }
  items: OrderItem[]
  buyer: { name: string; phone: string; address: string }
}

const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'pending', label: '결제 대기' },
  { value: 'paid', label: '결제 완료' },
  { value: 'preparing', label: '발주 중' },
  { value: 'shipped', label: '배송 중' },
  { value: 'delivered', label: '배송 완료' },
  { value: 'cancelled', label: '취소' },
] as const

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: '결제 대기', className: 'bg-gray-100 text-gray-700' },
  PAID: { label: '결제 완료', className: 'bg-blue-100 text-blue-700' },
  PREPARING: { label: '발주 중', className: 'bg-yellow-100 text-yellow-800' },
  SHIPPED: { label: '배송 중', className: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: '배송 완료', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소', className: 'bg-red-100 text-red-700' },
}

function formatPrice(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('ko-KR')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LiteOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const qs = new URLSearchParams()
    if (statusFilter) qs.set('status', statusFilter)
    qs.set('limit', '50')

    fetch(`/api/lite/orders?${qs.toString()}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setOrders(data.data.orders || [])
          setTotal(data.data.total || 0)
          setEmptyMessage(data.data.message || null)
        } else {
          setError(data.error || '주문 조회 실패')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || '네트워크 오류')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [statusFilter])

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주문</h1>
          <p className="text-sm text-gray-600 mt-1">
            실시간 알림으로 새 주문이 들어오는 순간 확인하세요. 발주는 직접 버튼을 눌러 시작합니다.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              await fetch('/api/lite/events/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ mock: true }),
              })
            } catch (err) {
              console.error('test emit failed', err)
            }
          }}
          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
          title="가짜 주문 이벤트 emit — 토스트/사운드 검증용"
        >
          🔔 알림 테스트
        </button>
      </header>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-500">
          {loading ? '로딩 중...' : `총 ${total.toLocaleString('ko-KR')}건`}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="text-sm font-semibold text-red-900">조회 오류</div>
          <div className="text-xs text-red-700 mt-1">{error}</div>
        </div>
      )}

      {!loading && orders.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-12 text-center">
          <div className="text-4xl mb-2">📬</div>
          <div className="text-sm font-medium text-gray-900">아직 주문이 없습니다</div>
          <div className="text-xs text-gray-500 mt-1">
            {emptyMessage || '마이샵에서 상품을 업로드하면 여기에 실시간으로 표시됩니다'}
          </div>
          <Link
            href="/lite/myshop"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            마이샵으로 가기
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => {
            const badge = STATUS_BADGE[order.status] || { label: order.status, className: 'bg-gray-100 text-gray-700' }
            return (
              <article
                key={order.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-500">#{order.orderNumber}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{formatDate(order.orderedAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ₩{formatPrice(order.totalAmount)}
                    </div>
                    {order.shop?.name && (
                      <div className="text-xs text-gray-500 mt-0.5">{order.shop.name}</div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <div className="space-y-1">
                    {order.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex-1 truncate text-gray-700">
                          {item.productName}
                          {item.optionSummary && (
                            <span className="text-gray-400 ml-1">({item.optionSummary})</span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">×{item.quantity}</div>
                        <div className="text-gray-700 text-xs font-medium w-20 text-right">
                          ₩{formatPrice(item.unitPrice)}
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <div className="text-xs text-gray-400">
                        외 {order.items.length - 3}건
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span>👤 {order.buyer.name}</span>
                  <span>📞 {order.buyer.phone}</span>
                  {order.buyer.address && <span>📍 {order.buyer.address}</span>}
                  <div className="ml-auto flex items-center gap-2">
                    {(order.status === 'PAID' || order.status === 'PREPARING') && (
                      <button
                        disabled
                        title="Phase 2 — F6 발주 트리거 활성화 예정"
                        className="px-3 py-1 bg-gray-100 text-gray-400 rounded text-xs cursor-not-allowed"
                      >
                        🛒 발주 요청 (Phase 2)
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Tip title="🔔 실시간 알림 (Phase 1 곧 활성화)">
          주문 발생 시 토스트 + 사운드. SSE 인프라(B1) 추가 후 즉시 동작.
        </Tip>
        <Tip title="🛡️ 개인정보 자동 마스킹">
          이름은 첫글자+**, 연락처는 끝 4자리만, 주소는 시/구까지만 — 셀러도 안전.
        </Tip>
      </div>
    </div>
  )
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
      <div className="text-sm font-semibold text-blue-900">{title}</div>
      <div className="text-xs text-blue-700 mt-1 leading-relaxed">{children}</div>
    </div>
  )
}
