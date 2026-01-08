'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Package, ChevronRight, Calendar, CreditCard } from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  hasReview: boolean
  product: {
    id: number
    name: string
    thumbnailUrl: string | null
  } | null
}

interface Order {
  id: number
  orderNumber: string
  status: string
  totalAmount: number
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  items: OrderItem[]
  hasWritableReview: boolean
  isGuestOrder?: boolean
  payment: {
    status: string
    method: string
    approvedAt: string | null
  } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusLabels: Record<string, string> = {
  PENDING: '결제대기',
  PAID: '결제완료',
  PREPARING: '상품준비중',
  SHIPPED: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소됨',
  REFUNDED: '환불됨',
}

const statusColors: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PAID: 'text-blue-600 bg-blue-50',
  PREPARING: 'text-indigo-600 bg-indigo-50',
  SHIPPED: 'text-purple-600 bg-purple-50',
  DELIVERED: 'text-green-600 bg-green-50',
  CANCELLED: 'text-gray-600 bg-gray-50',
  REFUNDED: 'text-red-600 bg-red-50',
}

export default function OrdersPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { getPath, getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedStatus) params.set('status', selectedStatus)
      params.set('page', currentPage.toString())
      params.set('limit', '10')

      const response = await fetch(getApiPath(`/api/mypage/orders?${params}`))
      const data = await response.json()

      if (data.success) {
        setOrders(data.orders)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [getApiPath, selectedStatus, currentPage])

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.push(getPath('/auth/login?callbackUrl=/mypage/orders'))
      return
    }
    fetchOrders()
  }, [session, sessionStatus, selectedStatus, currentPage, fetchOrders, router, getPath])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원'
  }

  const handleStatusFilter = (status: string | null) => {
    setSelectedStatus(status)
    setCurrentPage(1)
  }

  if (sessionStatus === 'loading' || (loading && orders.length === 0)) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
        <p className="mt-4 text-gray-600">주문 내역을 불러오는 중...</p>
      </div>
    )
  }

  return (
    <>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">주문내역</h1>
        <p className="text-gray-600">주문하신 상품의 배송 현황을 확인하실 수 있습니다</p>
      </div>

      {/* 필터 */}
      <div className="grid grid-cols-3 gap-2 mb-6 md:flex md:flex-wrap">
        <button
          onClick={() => handleStatusFilter(null)}
          className={`px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
            selectedStatus === null
              ? 'text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selectedStatus === null ? { backgroundColor: primaryColor } : {}}
        >
          전체
        </button>
        {Object.entries(statusLabels).map(([status, label]) => (
          <button
            key={status}
            onClick={() => handleStatusFilter(status)}
            className={`px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={selectedStatus === status ? { backgroundColor: primaryColor } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 로딩 오버레이 */}
      {loading && orders.length > 0 && (
        <div className="fixed inset-0 bg-white/50 z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }}></div>
        </div>
      )}

      {/* 주문 목록 */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg w-full">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            {selectedStatus ? `${statusLabels[selectedStatus]} 주문이 없습니다` : '주문 내역이 없습니다'}
          </p>
          <Link
            href={getPath('/main')}
            className="inline-block px-6 py-3 text-white rounded-md hover:opacity-90 transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            쇼핑 시작하기
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                {/* 주문 헤더 */}
                <div className="bg-gray-50 px-4 lg:px-6 py-3 lg:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {formatDate(order.orderedAt)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      주문번호: <span className="font-mono">{order.orderNumber}</span>
                    </span>
                    {order.isGuestOrder && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                        비회원
                      </span>
                    )}
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
                <div className="p-4 lg:p-6">
                  <div className="space-y-4">
                    {order.items.slice(0, 2).map((item) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="relative w-16 h-16 lg:w-20 lg:h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                          {(item.thumbnailUrl || item.product?.thumbnailUrl) ? (
                            <Image
                              src={item.thumbnailUrl || item.product?.thumbnailUrl || ''}
                              alt={item.productName}
                              fill
                              sizes="80px"
                              className="object-cover"
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

                  {/* 주문 금액 */}
                  <div className="mt-6 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>상품 {order.items.reduce((sum, item) => sum + item.quantity, 0)}개</span>
                      {order.payment && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          {order.payment.method === 'CARD' ? '카드결제' :
                           order.payment.method === 'VIRTUAL_ACCOUNT' ? '가상계좌' :
                           order.payment.method}
                        </span>
                      )}
                    </div>
                    {(() => {
                      // 상품 금액 합계 계산 (각 아이템의 totalPrice 합)
                      const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
                      // 실제 할인 금액 계산 (저장된 값이 없으면 계산)
                      const actualDiscount = order.discountAmount > 0
                        ? order.discountAmount
                        : Math.max(0, itemsTotal - order.totalAmount)

                      return (
                        <div className="flex flex-col items-end gap-1">
                          {/* 할인이 있는 경우 상품금액과 할인금액 표시 */}
                          {actualDiscount > 0 && (
                            <>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>상품금액</span>
                                <span>{formatPrice(itemsTotal)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <span>묶음 할인</span>
                                <span>-{formatPrice(actualDiscount)}</span>
                              </div>
                            </>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">총 결제금액</span>
                            <span className="text-xl font-bold" style={{ color: primaryColor }}>
                              {formatPrice(order.totalAmount)}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={getPath(`/mypage/orders/${order.id}`)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-center font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      주문상세
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    {order.hasWritableReview && (
                      <Link
                        href={getPath('/mypage/reviews')}
                        className="flex-1 px-4 py-2.5 text-white rounded-md hover:opacity-90 text-center font-medium transition-colors"
                        style={{ backgroundColor: primaryColor }}
                      >
                        후기작성
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // 현재 페이지 주변 2개만 표시
                    return Math.abs(page - currentPage) <= 2 ||
                           page === 1 ||
                           page === pagination.totalPages
                  })
                  .map((page, idx, arr) => {
                    // 중간에 생략 표시
                    if (idx > 0 && page - arr[idx - 1] > 1) {
                      return (
                        <span key={`ellipsis-${page}`} className="px-2 text-gray-400">...</span>
                      )
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-md transition-colors ${
                          currentPage === page
                            ? 'text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                        style={currentPage === page ? { backgroundColor: primaryColor } : {}}
                      >
                        {page}
                      </button>
                    )
                  })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
