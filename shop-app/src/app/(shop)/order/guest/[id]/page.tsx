'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Building2,
  AlertCircle,
  Copy,
  ShoppingBag,
  Phone,
  User,
} from 'lucide-react'

// 주문 상태 매핑
const orderStatusMap: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: '결제 대기', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PAID: { label: '결제 완료', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  PREPARING: { label: '상품 준비중', color: 'bg-purple-100 text-purple-800', icon: Package },
  SHIPPING: { label: '배송중', color: 'bg-cyan-100 text-cyan-800', icon: Truck },
  DELIVERED: { label: '배송 완료', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  CANCELLED: { label: '주문 취소', color: 'bg-red-100 text-red-800', icon: XCircle },
  REFUND_REQUESTED: { label: '환불 요청', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  REFUNDED: { label: '환불 완료', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
}

interface GuestOrderDetail {
  id: number
  orderNumber: string
  status: string
  customer: {
    name: string
    phone: string
    email: string | null
  }
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    postalCode: string
    address: string
    addressDetail: string | null
    deliveryMemo: string | null
  } | null
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: Array<{
    id: number
    productName: string
    optionSummary: string | null
    thumbnailUrl: string | null
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  payment: {
    status: string
    method: string
    amount: number
    paidAt: string | null
  } | null
  bankTransferInfo: {
    bankName: string
    bankAccount: string
    accountHolder: string
    depositDeadline: string
  } | null
}

function GuestOrderDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = params.id as string
  const token = searchParams.get('token') || ''

  const [order, setOrder] = useState<GuestOrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    if (orderId && token) {
      fetchOrderDetail()
    } else if (!token) {
      setError('인증 토큰이 없습니다. 주문 조회 페이지에서 다시 조회해주세요.')
      setIsLoading(false)
    }
  }, [orderId, token])

  const fetchOrderDetail = async () => {
    try {
      setIsLoading(true)
      setError('')

      const response = await fetch(`/api/guest-orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setOrder(data.order)
      } else {
        setError(data.error || '주문 정보를 불러올 수 없습니다')
      }
    } catch (err) {
      console.error('Order fetch error:', err)
      setError('주문 정보를 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return price?.toLocaleString('ko-KR') || '0'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const copyAccountNumber = () => {
    if (order?.bankTransferInfo?.bankAccount) {
      navigator.clipboard.writeText(order.bankTransferInfo.bankAccount)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      alert('취소 사유를 입력해주세요')
      return
    }

    try {
      setIsCancelling(true)

      const response = await fetch(`/api/guest-orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      })

      const data = await response.json()

      if (data.success) {
        alert('주문이 취소되었습니다')
        setShowCancelModal(false)
        fetchOrderDetail() // 새로고침
      } else {
        alert(data.error || '주문 취소에 실패했습니다')
      }
    } catch (err) {
      console.error('Cancel error:', err)
      alert('주문 취소 중 오류가 발생했습니다')
    } finally {
      setIsCancelling(false)
    }
  }

  const statusInfo = order ? orderStatusMap[order.status] || orderStatusMap.PENDING : null
  const StatusIcon = statusInfo?.icon || Clock

  // 취소 가능 여부
  const canCancel = order && ['PENDING', 'PAID'].includes(order.status) && !order.shippedAt

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">주문 조회 실패</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/order/lookup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B6B] text-white rounded-lg font-medium hover:bg-[#FF5252] transition-colors"
          >
            주문 조회 페이지로 이동
          </Link>
        </div>
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/order/lookup"
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">주문 상세</h1>
          </div>

          {/* 주문 상태 카드 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${statusInfo?.color?.split(' ')[0]}`}>
                  <StatusIcon className={`w-5 h-5 ${statusInfo?.color?.split(' ')[1]}`} />
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo?.color}`}>
                    {statusInfo?.label}
                  </span>
                </div>
              </div>
              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  주문 취소
                </button>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">주문번호</span>
                  <p className="font-mono font-medium text-gray-900 mt-1">{order.orderNumber}</p>
                </div>
                <div>
                  <span className="text-gray-500">주문일시</span>
                  <p className="font-medium text-gray-900 mt-1">{formatDate(order.orderedAt)}</p>
                </div>
              </div>
            </div>

            {/* 취소된 경우 취소 정보 */}
            {order.status === 'CANCELLED' && order.cancelledAt && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">
                  <strong>취소일:</strong> {formatDate(order.cancelledAt)}
                </p>
                {order.cancelReason && (
                  <p className="text-sm text-red-700 mt-1">
                    <strong>취소 사유:</strong> {order.cancelReason}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 무통장입금 정보 (결제 대기 상태일 때) */}
          {order.status === 'PENDING' && order.bankTransferInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-900">입금 계좌 안내</h2>
              </div>

              <div className="bg-white rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">은행</span>
                  <span className="font-semibold text-gray-900">{order.bankTransferInfo.bankName}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-900">{order.bankTransferInfo.bankAccount}</span>
                    <button
                      onClick={copyAccountNumber}
                      className={`px-2 py-1 text-xs rounded transition-all ${
                        copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {copied ? '복사됨' : '복사'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">예금주</span>
                  <span className="font-semibold text-gray-900">{order.bankTransferInfo.accountHolder}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500">입금 금액</span>
                  <span className="text-lg font-bold text-[#FF6B6B]">{formatPrice(order.totalAmount)}원</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-blue-700 bg-blue-100 rounded-lg px-4 py-3">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">입금 기한</p>
                  <p className="text-xs">{formatDate(order.bankTransferInfo.depositDeadline)}까지</p>
                </div>
              </div>
            </div>
          )}

          {/* 주문 상품 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              주문 상품 ({order.items.length}개)
            </h2>

            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <img
                    src={item.thumbnailUrl || '/placeholder.jpg'}
                    alt={item.productName}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{item.productName}</h3>
                    {item.optionSummary && (
                      <p className="text-xs text-gray-500 mt-1">{item.optionSummary}</p>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-500">수량: {item.quantity}개</span>
                      <span className="font-semibold text-[#FF6B6B]">
                        {formatPrice(item.totalPrice)}원
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 주문자 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              주문자 정보
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="text-gray-500 w-24">이름</span>
                <span className="text-gray-900">{order.customer.name}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-24">연락처</span>
                <span className="text-gray-900">{order.customer.phone}</span>
              </div>
              {order.customer.email && (
                <div className="flex">
                  <span className="text-gray-500 w-24">이메일</span>
                  <span className="text-gray-900">{order.customer.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* 배송지 정보 */}
          {order.shippingAddress && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-600" />
                배송지 정보
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-gray-500 w-24">받는 분</span>
                  <span className="text-gray-900">{order.shippingAddress.recipientName}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">연락처</span>
                  <span className="text-gray-900">{order.shippingAddress.recipientPhone}</span>
                </div>
                <div className="flex">
                  <span className="text-gray-500 w-24">주소</span>
                  <span className="text-gray-900">
                    ({order.shippingAddress.postalCode}) {order.shippingAddress.address}
                    {order.shippingAddress.addressDetail && ` ${order.shippingAddress.addressDetail}`}
                  </span>
                </div>
                {order.shippingAddress.deliveryMemo && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">배송메모</span>
                    <span className="text-gray-900">{order.shippingAddress.deliveryMemo}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 결제 정보 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              결제 정보
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상품금액</span>
                <span className="text-gray-900">{formatPrice(order.subtotalAmount)}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">배송비</span>
                <span className={order.shippingFee === 0 ? 'text-[#FF6B6B]' : 'text-gray-900'}>
                  {order.shippingFee > 0 ? `${formatPrice(order.shippingFee)}원` : '무료'}
                </span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">할인금액</span>
                  <span className="text-red-500">-{formatPrice(order.discountAmount)}원</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="font-medium text-gray-900">총 결제금액</span>
                <span className="text-xl font-bold text-gray-900">{formatPrice(order.totalAmount)}원</span>
              </div>
              {order.payment && (
                <div className="pt-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>결제수단: </span>
                  <span className="text-gray-900">
                    {order.payment.method === 'BANK_TRANSFER' ? '무통장입금' : '카드결제'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="space-y-3">
            <Link
              href="/main"
              className="w-full py-4 bg-[#FF6B6B] text-white rounded-lg font-semibold text-center flex items-center justify-center gap-2 hover:bg-[#FF5252] transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              쇼핑 계속하기
            </Link>
            <Link
              href="/order/lookup"
              className="w-full py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold text-center flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
            >
              다른 주문 조회하기
            </Link>
          </div>
        </div>
      </div>

      {/* 주문 취소 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">주문 취소</h3>
            <p className="text-sm text-gray-600 mb-4">
              주문을 취소하시겠습니까? 취소 후에는 복구할 수 없습니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                취소 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="취소 사유를 입력해주세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6B6B] focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:bg-gray-300"
              >
                {isCancelling ? '취소 중...' : '주문 취소'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuestOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <GuestOrderDetailContent />
    </Suspense>
  )
}
