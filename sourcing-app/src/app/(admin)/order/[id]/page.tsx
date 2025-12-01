'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  MapPin,
  Phone,
  User,
  Calendar,
  Store,
  AlertCircle,
  ImageOff,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: string
  totalPrice: string
  productPublish: {
    id: number
    product: {
      id: number
      name: string
      thumbnailUrl: string | null
      price: number | null
    }
    retailBand: {
      id: number
      name: string
      coverUrl: string | null
    }
  } | null
}

interface Payment {
  id: number
  method: string
  status: string
  amount: string
  paidAt: string | null
}

interface OrderUser {
  id: number
  name: string | null
  email: string
}

interface Order {
  id: number
  orderNumber: string
  status: string
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
  subtotalAmount: string
  shippingFee: string
  discountAmount: string
  totalAmount: string
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
  payment: Payment | null
  user: OrderUser
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '대기중', color: 'bg-gray-100 text-gray-700', icon: <Clock size={16} /> },
  PAID: { label: '결제완료', color: 'bg-yellow-100 text-yellow-700', icon: <CreditCard size={16} /> },
  SHIPPED: { label: '배송중', color: 'bg-blue-100 text-blue-700', icon: <Truck size={16} /> },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={16} /> },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-700', icon: <XCircle size={16} /> },
  REFUNDED: { label: '환불됨', color: 'bg-purple-100 text-purple-700', icon: <XCircle size={16} /> },
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const toast = useToast()
  const orderId = parseInt(params.id as string)

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      loadOrder()
    }
  }, [orderId])

  const loadOrder = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/order/${orderId}`)
      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || '주문을 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('주문 로드 실패:', err)
      setError('주문을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (!order) return
    if (newStatus === 'CANCELLED') {
      setPendingStatus(newStatus)
      setShowCancelConfirm(true)
    } else {
      confirmStatusChange(newStatus)
    }
  }

  const confirmStatusChange = async (newStatus?: string) => {
    const statusToUpdate = newStatus || pendingStatus
    if (!order || !statusToUpdate) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/order/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusToUpdate }),
      })

      const data = await response.json()
      if (data.success) {
        const statusLabels: Record<string, string> = {
          SHIPPED: '배송 시작',
          DELIVERED: '배송 완료',
          CANCELLED: '주문 취소',
        }
        toast.success(`${statusLabels[statusToUpdate] || '상태 변경'}되었습니다.`)
        loadOrder()
      } else {
        toast.error(data.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 변경 실패:', error)
      toast.error('상태 변경에 실패했습니다.')
    } finally {
      setIsUpdating(false)
      setShowCancelConfirm(false)
      setPendingStatus(null)
    }
  }

  const formatPrice = (price: string | number | null) => {
    if (!price) return '0원'
    const num = typeof price === 'string' ? parseFloat(price) : price
    return `${num.toLocaleString()}원`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <AlertCircle className="text-red-500" size={48} />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">주문을 찾을 수 없습니다</h3>
                <p className="text-gray-600">{error}</p>
              </div>
              <Button variant="primary" onClick={() => router.push('/settlement/list')}>
                정산 관리로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const status = statusConfig[order.status] || statusConfig.PENDING

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
        </div>

        {/* 주문 정보 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User size={20} />
              주문 정보
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">이름</p>
                <p className="font-medium text-gray-900">{order.user.name || '이름없음'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">계정</p>
                <p className="font-medium text-gray-900">{order.user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">주문번호</p>
                <p className="font-medium font-mono text-gray-900">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">주문일</p>
                <p className="font-medium text-gray-900">{formatDate(order.orderedAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">상태</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                  {status.icon}
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 주문 상품 + 배송 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 주문 상품 목록 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package size={20} />
                  주문 상품 ({order.items.length}개)
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="p-4 flex gap-4">
                    {/* 상품 이미지 */}
                    {item.thumbnailUrl || item.productPublish?.product?.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl || item.productPublish?.product?.thumbnailUrl || ''}
                        alt={item.productName}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageOff size={24} className="text-gray-400" />
                      </div>
                    )}

                    {/* 상품 정보 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">{item.productName}</h3>
                      {item.optionSummary && (
                        <p className="text-sm text-gray-500 mb-1">{item.optionSummary}</p>
                      )}
                      {item.productPublish?.retailBand && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Store size={12} />
                          <span>{item.productPublish.retailBand.name}</span>
                        </div>
                      )}
                    </div>

                    {/* 수량 및 가격 */}
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium text-gray-900">{formatPrice(item.totalPrice)}</p>
                      <p className="text-sm text-gray-500">
                        {formatPrice(item.unitPrice)} x {item.quantity}개
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Truck size={20} />
                  배송 정보
                </h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <User size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">수령인</p>
                      <p className="font-medium text-gray-900">{order.recipientName}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">연락처</p>
                      <p className="font-medium text-gray-900">{order.recipientPhone}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">배송지</p>
                    <p className="font-medium text-gray-900">
                      [{order.postalCode}] {order.address}
                      {order.addressDetail && ` ${order.addressDetail}`}
                    </p>
                  </div>
                </div>
                {order.deliveryMemo && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">배송 메모</p>
                    <p className="text-gray-900">{order.deliveryMemo}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 주문 타임라인 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar size={20} />
                  주문 진행 상황
                </h2>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.orderedAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Clock size={16} className={order.orderedAt ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">주문 접수</p>
                      <p className="text-sm text-gray-500">{formatDate(order.orderedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.paidAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CreditCard size={16} className={order.paidAt ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">결제 완료</p>
                      <p className="text-sm text-gray-500">{formatDate(order.paidAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.shippedAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Truck size={16} className={order.shippedAt ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">배송 시작</p>
                      <p className="text-sm text-gray-500">{formatDate(order.shippedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.deliveredAt ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CheckCircle size={16} className={order.deliveredAt ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">배송 완료</p>
                      <p className="text-sm text-gray-500">{formatDate(order.deliveredAt)}</p>
                    </div>
                  </div>
                  {order.cancelledAt && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100">
                        <XCircle size={16} className="text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-red-600">주문 취소</p>
                        <p className="text-sm text-gray-500">{formatDate(order.cancelledAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 결제 정보 + 상태 변경 */}
          <div className="space-y-6">
            {/* 결제 정보 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard size={20} />
                  결제 정보
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">상품 금액</span>
                  <span className="font-medium">{formatPrice(order.subtotalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">배송비</span>
                  <span className="font-medium">{formatPrice(order.shippingFee)}</span>
                </div>
                {parseFloat(order.discountAmount) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>할인</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">총 결제금액</span>
                  <span className="text-xl font-bold text-blue-600">{formatPrice(order.totalAmount)}</span>
                </div>
                {order.payment && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-500">결제 수단: {order.payment.method}</p>
                    <p className="text-sm text-gray-500">결제 상태: {order.payment.status}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 상태 변경 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">주문 상태 변경</h2>
              </div>
              <div className="p-4 space-y-2">
                {order.status === 'PAID' && (
                  <Button
                    variant="primary"
                    onClick={() => handleStatusChange('SHIPPED')}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <Truck size={16} />
                    배송 시작
                  </Button>
                )}
                {order.status === 'SHIPPED' && (
                  <Button
                    variant="primary"
                    onClick={() => handleStatusChange('DELIVERED')}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <CheckCircle size={16} />
                    배송 완료
                  </Button>
                )}
                {['PENDING', 'PAID'].includes(order.status) && (
                  <Button
                    variant="danger"
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <XCircle size={16} />
                    주문 취소
                  </Button>
                )}
                {order.status === 'DELIVERED' && (
                  <p className="text-center text-sm text-gray-500 py-2">
                    배송이 완료된 주문입니다.
                  </p>
                )}
                {order.status === 'CANCELLED' && (
                  <p className="text-center text-sm text-red-500 py-2">
                    취소된 주문입니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 주문 취소 확인 모달 */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => {
          setShowCancelConfirm(false)
          setPendingStatus(null)
        }}
        onConfirm={() => confirmStatusChange()}
        title="주문 취소"
        message="주문을 취소하시겠습니까?"
        confirmText="취소"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  )
}
