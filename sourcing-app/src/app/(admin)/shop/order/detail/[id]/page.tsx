'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
  FileSpreadsheet,
  Building2,
  Banknote,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

type OrderSource = 'SHOPPING_MALL' | 'GOOGLE_FORM'

interface OrderItem {
  id: number
  productName: string
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
}

interface Payment {
  id: number
  method: string
  status: string
  amount: number
  paidAt: string | null
}

interface OrderUser {
  id: number
  name: string | null
  email: string
}

interface RefundAccountInfo {
  bankName: string
  accountNumber: string
  accountHolder: string
}

interface UnifiedOrderDetail {
  id: number
  source: OrderSource
  orderNumber: string
  status: string
  statusLabel: string
  isGuestOrder?: boolean
  customerName: string
  customerPhone: string | null
  shippingAddress: ShippingAddress | null
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  paymentMethod: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: OrderItem[]
  payment: Payment | null
  user: OrderUser | null
  shopId: number | null
  shopName: string | null
  // 환불 계좌 정보 (무통장입금 취소 시)
  refundAccount: RefundAccountInfo | null
  cancelReason: string | null
  cancelledBy: string | null
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={16} /> },
  PAID: { label: '결제완료', color: 'bg-blue-100 text-blue-700', icon: <CreditCard size={16} /> },
  SHIPPED: { label: '배송중', color: 'bg-indigo-100 text-indigo-700', icon: <Truck size={16} /> },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={16} /> },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-700', icon: <XCircle size={16} /> },
  REFUNDED: { label: '환불됨', color: 'bg-purple-100 text-purple-700', icon: <XCircle size={16} /> },
  RECEIVED: { label: '수령완료', color: 'bg-teal-100 text-teal-700', icon: <CheckCircle size={16} /> },
}

// 주문 상태 흐름 정의
const ORDER_STATUS_FLOW: Record<string, { next: string | null; nextLabel: string }> = {
  PENDING: { next: 'PAID', nextLabel: '결제 확인' },
  PAID: { next: 'SHIPPED', nextLabel: '배송 시작' },
  SHIPPED: { next: 'DELIVERED', nextLabel: '배송 완료' },
  DELIVERED: { next: null, nextLabel: '' },
  CANCELLED: { next: null, nextLabel: '' },
  REFUNDED: { next: null, nextLabel: '' },
}

// 스테퍼 단계 정의
const ORDER_STEPS = [
  { key: 'PENDING', label: '주문접수', icon: Clock, dateField: 'createdAt' },
  { key: 'PAID', label: '결제완료', icon: CreditCard, dateField: 'paidAt' },
  { key: 'SHIPPED', label: '배송중', icon: Truck, dateField: 'shippedAt' },
  { key: 'DELIVERED', label: '배송완료', icon: CheckCircle, dateField: 'deliveredAt' },
] as const

// 상태를 단계 인덱스로 변환
const getStepIndex = (status: string): number => {
  switch (status) {
    case 'PENDING': return 0
    case 'PAID': return 1
    case 'SHIPPED': return 2
    case 'DELIVERED': return 3
    case 'CANCELLED':
    case 'REFUNDED':
      return -1 // 취소/환불은 별도 처리
    default: return 0
  }
}

export default function UnifiedOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const toast = useToast()

  const orderNumber = params.id as string
  const source = (searchParams.get('source') || 'SHOPPING_MALL') as OrderSource

  const [order, setOrder] = useState<UnifiedOrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  useEffect(() => {
    if (orderNumber) {
      loadOrder()
    }
  }, [orderNumber, source])

  const loadOrder = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/order/unified/${orderNumber}?source=${source}`)
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
      const response = await fetch(`/api/order/unified/${orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: order.source,
          status: statusToUpdate
        }),
      })

      const data = await response.json()
      if (data.success) {
        const statusLabels: Record<string, string> = {
          PAID: '결제 확인',
          PREPARING: '상품 준비',
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

  const formatPrice = (price: number | null) => {
    if (!price) return '0원'
    return `${price.toLocaleString()}원`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
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
              <Button variant="primary" onClick={() => router.push('/shop/order/list')}>
                주문 목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const status = statusConfig[order.status] || statusConfig.PENDING
  const isShoppingMall = order.source === 'SHOPPING_MALL'
  const isBankTransfer = order.paymentMethod === 'BANK_TRANSFER'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/shop/order/list')}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
              {order.isGuestOrder && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                  비회원
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-mono">{order.orderNumber}</p>
          </div>
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
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* 출처 배지 - 쇼핑몰명이 있으면 쇼핑몰명만 표시 */}
              {isShoppingMall ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                  <Store size={16} />
                  {order.shopName || '쇼핑몰 주문'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
                  <FileSpreadsheet size={16} />
                  밴드 주문
                </span>
              )}
              {/* 상태 배지 */}
              <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${status.color}`}>
                {status.icon}
                {order.statusLabel || status.label}
              </span>
              {/* 무통장입금 배지 */}
              {isBankTransfer && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                  <Building2 size={16} />
                  무통장입금
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">고객명</p>
                <p className="font-medium text-gray-900">{order.customerName}</p>
              </div>
              {order.customerPhone && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">연락처</p>
                  <p className="font-medium text-gray-900">{formatPhoneNumber(order.customerPhone)}</p>
                </div>
              )}
              {order.user && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">계정</p>
                  <p className="font-medium text-gray-900">{order.user.email}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-1">주문일</p>
                <p className="font-medium text-gray-900">{formatDate(order.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 주문 진행 상황 스테퍼 - 옵션 비교 */}
        {isShoppingMall && !['CANCELLED', 'REFUNDED'].includes(order.status) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="p-6">
                {/* 스테퍼 */}
                <div className="flex items-center justify-center mb-8 max-w-4xl mx-auto">
                  {ORDER_STEPS.map((step, index) => {
                    const currentIndex = getStepIndex(order.status)
                    const isCompleted = index < currentIndex
                    const isCurrent = index === currentIndex
                    const StepIcon = step.icon
                    const dateValue = order[step.dateField as keyof UnifiedOrderDetail] as string | null

                    return (
                      <div key={step.key} className={`flex items-center ${index < ORDER_STEPS.length - 1 ? 'flex-1' : ''}`}>
                        {/* 스텝 아이콘 & 라벨 */}
                        <div className="flex flex-col items-center min-w-[100px]">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                              isCompleted
                                ? 'bg-green-500 text-white'
                                : isCurrent
                                ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle size={24} />
                            ) : (
                              <StepIcon size={24} />
                            )}
                          </div>
                          <p
                            className={`mt-2 text-sm font-medium ${
                              isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {dateValue ? formatDate(dateValue) : '-'}
                          </p>
                        </div>

                        {/* 연결선 */}
                        {index < ORDER_STEPS.length - 1 && (
                          <div
                            className={`flex-1 h-1 mx-4 rounded ${
                              index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-100">
                  {ORDER_STATUS_FLOW[order.status]?.next && (
                    <Button
                      variant="primary"
                      onClick={() => handleStatusChange(ORDER_STATUS_FLOW[order.status].next!)}
                      disabled={isUpdating}
                      size="lg"
                    >
                      {order.status === 'PENDING' && <CreditCard size={18} />}
                      {order.status === 'PAID' && <Truck size={18} />}
                      {order.status === 'SHIPPED' && <CheckCircle size={18} />}
                      {ORDER_STATUS_FLOW[order.status].nextLabel}
                    </Button>
                  )}
                  {['PENDING', 'PAID'].includes(order.status) && (
                    <Button
                      variant="danger"
                      onClick={() => handleStatusChange('CANCELLED')}
                      disabled={isUpdating}
                    >
                      <XCircle size={18} />
                      주문 취소
                    </Button>
                  )}
                  {order.status === 'DELIVERED' && (
                    <p className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle size={18} />
                      배송이 완료되었습니다
                    </p>
                  )}
                </div>
            </div>
          </div>
        )}

        {/* 취소/환불된 주문 표시 */}
        {isShoppingMall && ['CANCELLED', 'REFUNDED'].includes(order.status) && (
          <div className={`rounded-lg p-4 border mb-6 ${
            order.status === 'CANCELLED' ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                order.status === 'CANCELLED' ? 'bg-red-100' : 'bg-purple-100'
              }`}>
                <XCircle size={20} className={order.status === 'CANCELLED' ? 'text-red-600' : 'text-purple-600'} />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${order.status === 'CANCELLED' ? 'text-red-900' : 'text-purple-900'}`}>
                  {order.status === 'CANCELLED' ? '주문이 취소되었습니다' : '환불이 완료되었습니다'}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDate(order.cancelledAt)}
                  {order.cancelledBy && ` (${order.cancelledBy === 'ADMIN' ? '관리자' : order.cancelledBy === 'USER' ? '회원' : '비회원'})`}
                </p>
                {/* 취소 사유 */}
                {order.cancelReason && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">취소 사유:</span> {order.cancelReason}
                  </p>
                )}
              </div>
              {order.status === 'CANCELLED' && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange('REFUNDED')}
                  disabled={isUpdating}
                >
                  <CheckCircle size={16} />
                  환불 완료 처리
                </Button>
              )}
            </div>

            {/* 무통장입금 환불 계좌 정보 */}
            {order.refundAccount && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <div className="flex items-start gap-3">
                  <Banknote size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 mb-2">환불 계좌 정보</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">은행: </span>
                        <span className="font-medium text-gray-900">{order.refundAccount.bankName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">계좌번호: </span>
                        <span className="font-mono font-medium text-gray-900">{order.refundAccount.accountNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">예금주: </span>
                        <span className="font-medium text-gray-900">{order.refundAccount.accountHolder}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 무통장입금 입금 확인 안내 */}
        {isShoppingMall && isBankTransfer && order.status === 'PENDING' && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-6">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">무통장입금 주문</h3>
                <p className="text-sm text-amber-700 mb-3">
                  고객이 입금을 완료했다면 아래 버튼을 눌러 입금 확인을 완료해주세요.
                </p>
                <button
                  onClick={() => handleStatusChange('PAID')}
                  disabled={isUpdating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={18} />
                  입금 확인 완료
                </button>
              </div>
            </div>
          </div>
        )}

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
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
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
            {order.shippingAddress && (
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
                        <p className="font-medium text-gray-900">{order.shippingAddress.recipientName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone size={18} className="text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">연락처</p>
                        <p className="font-medium text-gray-900">{formatPhoneNumber(order.shippingAddress.recipientPhone)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">배송지</p>
                      <p className="font-medium text-gray-900">
                        [{order.shippingAddress.postalCode}] {order.shippingAddress.address}
                        {order.shippingAddress.addressDetail && ` ${order.shippingAddress.addressDetail}`}
                      </p>
                    </div>
                  </div>
                  {order.shippingAddress.deliveryMemo && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500 mb-1">배송 메모</p>
                      <p className="text-gray-900">{order.shippingAddress.deliveryMemo}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>할인</span>
                    <span>-{formatPrice(order.discountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">총 결제금액</span>
                  <span className="text-xl font-bold text-blue-600">{formatPrice(order.totalAmount)}</span>
                </div>
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
        message="주문을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="주문 취소"
        cancelText="닫기"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  )
}
