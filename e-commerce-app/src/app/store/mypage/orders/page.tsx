'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Package, ChevronRight } from 'lucide-react'

interface OrderItem {
  id: number
  productName: string
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
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
  orderedAt: string
  items: OrderItem[]
}

const statusLabels: Record<string, string> = {
  PENDING: '결제대기',
  PAID: '결제완료',
  SHIPPED: '배송중',
  DELIVERED: '배송완료',
  CANCELLED: '취소됨',
  REFUNDED: '환불됨',
}

const statusColors: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PAID: 'text-blue-600 bg-blue-50',
  SHIPPED: 'text-purple-600 bg-purple-50',
  DELIVERED: 'text-green-600 bg-green-50',
  CANCELLED: 'text-gray-600 bg-gray-50',
  REFUNDED: 'text-red-600 bg-red-50',
}

export default function OrdersPage() {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchOrders()
    }
  }, [session, selectedStatus])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const url = selectedStatus
        ? `/api/mypage/orders?status=${selectedStatus}`
        : '/api/mypage/orders'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setOrders(data.orders)
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
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

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6B6B] mx-auto"></div>
          <p className="mt-4 text-gray-600">주문 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="kurly-container py-12">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">주문내역</h1>
        <p className="text-gray-600">주문하신 상품의 배송 현황을 확인하실 수 있습니다</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedStatus(null)}
          className={`px-4 py-2 rounded-full whitespace-nowrap ${
            selectedStatus === null
              ? 'bg-[#FF6B6B] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체
        </button>
        {Object.entries(statusLabels).map(([status, label]) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              selectedStatus === status
                ? 'bg-[#FF6B6B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 주문 목록 */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">주문 내역이 없습니다</p>
          <Link
            href="/store"
            className="inline-block px-6 py-3 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252]"
          >
            쇼핑 시작하기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* 주문 헤더 */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{formatDate(order.orderedAt)}</span>
                  <span className="text-sm font-medium text-gray-900">
                    주문번호: {order.orderNumber}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    statusColors[order.status] || 'text-gray-600 bg-gray-50'
                  }`}
                >
                  {statusLabels[order.status] || order.status}
                </span>
              </div>

              {/* 주문 상품 */}
              <div className="p-6">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                        {item.product?.thumbnailUrl ? (
                          <img
                            src={item.product.thumbnailUrl}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1">
                          {item.product?.name || item.productName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {formatPrice(Number(item.unitPrice))} × {item.quantity}개
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {formatPrice(Number(item.totalPrice))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 주문 금액 */}
                <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-gray-600">총 결제금액</span>
                  <span className="text-xl font-bold text-[#FF6B6B]">
                    {formatPrice(Number(order.totalAmount))}
                  </span>
                </div>

                {/* 액션 버튼 */}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/store/mypage/orders/${order.id}`}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-center"
                  >
                    주문상세
                  </Link>
                  {order.status === 'DELIVERED' && (
                    <Link
                      href={`/store/mypage/reviews/new?orderId=${order.id}`}
                      className="flex-1 px-4 py-2 bg-[#FF6B6B] text-white rounded-md hover:bg-[#FF5252] text-center"
                    >
                      후기작성
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
