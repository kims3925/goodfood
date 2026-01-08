'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Search,
  Package,
  AlertCircle,
  Phone,
  User,
  ChevronRight,
  Calendar,
  CreditCard,
} from 'lucide-react'
import { useShopUrl } from '@/hooks/useShopUrl'

// 주문 상태 라벨
const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: '결제완료', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: '상품준비중', color: 'bg-purple-100 text-purple-800' },
  SHIPPED: { label: '배송중', color: 'bg-indigo-100 text-indigo-800' },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: '취소됨', color: 'bg-gray-100 text-gray-800' },
}

interface OrderItem {
  id: number
  orderNumber: string
  status: string
  representativeItem: {
    name: string
    thumbnailUrl: string | null
    itemCount: number
  }
  totalAmount: number
  orderedAt: string
  paymentStatus: string | null
  paymentMethod: string | null
}

// 휴대폰 번호 포맷팅 (컴포넌트 외부에 정의하여 안정적인 참조 유지)
const formatPhone = (value: string) => {
  const numbers = value.replace(/[^0-9]/g, '')
  if (numbers.length <= 3) return numbers
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
}

// 날짜 포맷팅
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// 가격 포맷팅
const formatPrice = (price: number) => {
  return price.toLocaleString('ko-KR') + '원'
}

export default function FindOrdersPage() {
  const router = useRouter()
  const { getPath, getApiPath } = useShopUrl()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [orders, setOrders] = useState<OrderItem[] | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
  }, [])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setOrders(null)

    if (!phone.trim()) {
      setError('휴대폰 번호를 입력해주세요')
      return
    }

    if (!name.trim()) {
      setError('주문자 이름을 입력해주세요')
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch(getApiPath('/api/guest-orders/find-by-phone'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone.replace(/-/g, ''),
          name: name.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOrders(data.orders)
      } else {
        setError(data.error || '주문을 찾을 수 없습니다')
      }
    } catch (err) {
      console.error('Order search error:', err)
      setError('주문 조회 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [phone, name, getApiPath])

  const handleOrderClick = useCallback(async (order: OrderItem) => {
    try {
      setSelectedOrderId(order.id)

      // lookup API로 토큰 발급 (주문번호만으로 조회)
      const response = await fetch(getApiPath('/api/guest-orders/lookup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
        }),
      })

      const data = await response.json()

      if (data.success) {
        router.push(getPath(`/order/guest/${order.id}?token=${encodeURIComponent(data.accessToken)}`))
      } else {
        setError('주문 상세 조회에 실패했습니다')
        setSelectedOrderId(null)
      }
    } catch (err) {
      console.error('Order detail error:', err)
      setError('주문 상세 조회 중 오류가 발생했습니다')
      setSelectedOrderId(null)
    }
  }, [getApiPath, getPath, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href={getPath('/order/lookup')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">주문 내역 찾기</h1>
          </div>

          {/* 검색 폼 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start gap-3 mb-6">
              <Package className="w-6 h-6 text-[#FF6B6B] flex-shrink-0" />
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">주문번호를 모르시나요?</h2>
                <p className="text-sm text-gray-600">
                  휴대폰 번호와 주문자 이름으로 최근 90일 내 주문을 찾을 수 있습니다.
                </p>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* 검색 폼 */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  휴대폰 번호
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                  maxLength={13}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  주문자 이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#FF6B6B] text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#FF5252] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    주문 찾기
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 검색 결과 */}
          {orders && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">
                  검색 결과 ({orders.length}건)
                </h3>
              </div>

              {orders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>조회된 주문이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const statusInfo = ORDER_STATUS_LABELS[order.status] || {
                      label: order.status,
                      color: 'bg-gray-100 text-gray-800',
                    }
                    const isSelecting = selectedOrderId === order.id

                    return (
                      <button
                        key={order.id}
                        onClick={() => handleOrderClick(order)}
                        disabled={isSelecting}
                        className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                      >
                        {/* 상품 이미지 */}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {order.representativeItem.thumbnailUrl ? (
                            <Image
                              src={order.representativeItem.thumbnailUrl}
                              alt={order.representativeItem.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        </div>

                        {/* 주문 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 truncate">
                            {order.representativeItem.name}
                            {order.representativeItem.itemCount > 1 && (
                              <span className="text-gray-500 font-normal">
                                {' '}외 {order.representativeItem.itemCount - 1}건
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(order.orderedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5" />
                              {formatPrice(order.totalAmount)}
                            </span>
                          </div>
                        </div>

                        {/* 화살표 또는 로딩 */}
                        <div className="flex-shrink-0">
                          {isSelecting ? (
                            <div className="w-5 h-5 border-2 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 주문번호로 조회 안내 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">주문번호를 알고 계신가요?</p>
            <Link
              href={getPath('/order/lookup')}
              className="text-[#FF6B6B] text-sm font-medium hover:underline"
            >
              주문번호로 바로 조회하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
