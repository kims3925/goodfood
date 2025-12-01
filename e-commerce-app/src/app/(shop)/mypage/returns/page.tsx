'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RotateCcw, Package, Calendar, CreditCard, ChevronRight } from 'lucide-react'

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface CancelledOrder {
  id: number
  orderNumber: string
  status: string
  totalAmount: number
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  cancelReason: string | null
  cancelledBy: string | null
  orderedAt: string
  cancelledAt: string | null
  items: OrderItem[]
  payment: {
    status: string
    method: string
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, string> = {
  CANCELLED: '취소완료',
  REFUNDED: '환불완료',
}

const statusColors: Record<string, string> = {
  CANCELLED: 'text-gray-600 bg-gray-100',
  REFUNDED: 'text-red-600 bg-red-50',
}

export default function ReturnsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<CancelledOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.push('/auth/login?callbackUrl=/mypage/returns')
      return
    }
    fetchCancelledOrders()
  }, [session, sessionStatus, selectedType, currentPage])

  const fetchCancelledOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedType) params.set('type', selectedType)
      params.set('page', currentPage.toString())
      params.set('limit', '10')

      const response = await fetch(`/api/mypage/returns?${params}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.orders)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch cancelled orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

  const handleTypeFilter = (type: string | null) => {
    setSelectedType(type)
    setCurrentPage(1)
  }

  if (sessionStatus === 'loading' || (loading && orders.length === 0)) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
          <p className="mt-4 text-gray-600">취소/반품 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">취소/반품 내역</h1>
        <p className="text-gray-600">취소 및 환불 처리된 주문을 확인하실 수 있습니다</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => handleTypeFilter(null)}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
            selectedType === null
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => handleTypeFilter('CANCELLED')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
            selectedType === 'CANCELLED'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          취소
        </button>
        <button
          onClick={() => handleTypeFilter('REFUNDED')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
            selectedType === 'REFUNDED'
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          환불
        </button>
      </div>

      {/* 로딩 오버레이 */}
      {loading && orders.length > 0 && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]"></div>
        </div>
      )}

      {/* 취소/반품 목록 */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <RotateCcw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            {selectedType
              ? `${statusLabels[selectedType]} 내역이 없습니다`
              : '취소/반품 내역이 없습니다'}
          </p>
          <Link
            href="/mypage/orders"
            className="inline-block px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] transition-colors"
          >
            주문 내역 보기
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 주문 헤더 */}
                <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(order.cancelledAt || order.orderedAt)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      주문번호: <span className="font-mono">{order.orderNumber}</span>
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${
                      statusColors[order.status] || 'text-gray-600 bg-gray-50'
                    }`}
                  >
                    {statusLabels[order.status] || order.status}
                  </span>
                </div>

                {/* 주문 상품 */}
                <div className="p-6">
                  <div className="space-y-4">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
                            {item.productName}
                          </h3>
                          {item.optionSummary && (
                            <p className="text-sm text-gray-500 mb-1">{item.optionSummary}</p>
                          )}
                          <p className="text-sm text-gray-600">
                            {formatPrice(item.unitPrice)} x {item.quantity}개
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-gray-900">
                            {formatPrice(item.totalPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-sm text-gray-500 text-center py-2">
                        외 {order.items.length - 2}개 상품
                      </p>
                    )}
                  </div>

                  {/* 취소 사유 */}
                  {order.cancelReason && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-700">취소 사유:</span>{' '}
                        {order.cancelReason}
                      </p>
                    </div>
                  )}

                  {/* 금액 정보 */}
                  <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>상품 {order.items.reduce((sum, item) => sum + item.quantity, 0)}개</span>
                      {order.payment && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          {order.payment.method === 'CARD'
                            ? '카드결제'
                            : order.payment.method === 'VIRTUAL_ACCOUNT'
                              ? '가상계좌'
                              : order.payment.method}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">
                        {order.status === 'CANCELLED' ? '취소금액' : '환불금액'}
                      </span>
                      <span className="text-xl font-bold text-[#FF6B6B]">
                        {formatPrice(order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="mt-4">
                    <Link
                      href={`/mypage/orders/${order.id}`}
                      className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-center font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      주문 상세보기
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      Math.abs(page - currentPage) <= 2 ||
                      page === 1 ||
                      page === pagination.totalPages
                    )
                  })
                  .map((page, idx, arr) => {
                    if (idx > 0 && page - arr[idx - 1] > 1) {
                      return (
                        <span key={`ellipsis-${page}`} className="px-2 text-gray-400">
                          ...
                        </span>
                      )
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-md transition-colors ${
                          currentPage === page
                            ? 'bg-[#FF6B6B] text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
