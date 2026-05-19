'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Building2,
  Banknote,
  Trash2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import { formatPhoneNumber } from '@/modules/utils/phoneUtils'
import Loading from '@/components/ui/Loading'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import OrderTextCopyButton from '@/components/order/OrderTextCopyButton'

type OrderSource = 'SHOPPING_MALL' | 'GOOGLE_FORM'

interface ChannelInfo {
  id: number
  kind: 'WHOLESALE' | 'RETAIL'
  platform: 'BAND' | 'NAVER_CAFE' | 'ALIEXPRESS' | 'SMARTSTORE' | 'COUPANG' | 'CUSTOM'
  name: string
}

interface OrderItem {
  id: number
  productName: string
  sourceProductName?: string | null
  optionSummary: string | null
  thumbnailUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  // 배송비 및 합배송 정보
  shippingFee: number
  bundleShippingType: 'NONE' | 'INCLUDED' | 'SEPARATE'
  bundleMaxQty: number
  // 도매처(소싱 출처) 정보
  channel: ChannelInfo | null
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
  preparingAt: string | null
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
  // 도매 발주 상태
  wholesaleOrderStatus: string | null
  wholesaleChannelId: number | null
  wholesaleOrderedAt: string | null
}

import { CHANNEL_PLATFORM_CONFIG } from '@/lib/channel-utils'

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: '결제대기', color: 'bg-yellow-100 text-yellow-700', icon: <Clock size={16} /> },
  PAID: { label: '결제완료', color: 'bg-blue-100 text-blue-700', icon: <CreditCard size={16} /> },
  PREPARING: { label: '상품준비중', color: 'bg-orange-100 text-orange-700', icon: <Package size={16} /> },
  SHIPPED: { label: '배송중', color: 'bg-indigo-100 text-indigo-700', icon: <Truck size={16} /> },
  DELIVERED: { label: '배송완료', color: 'bg-green-100 text-green-700', icon: <CheckCircle size={16} /> },
  CANCELLED: { label: '취소됨', color: 'bg-red-100 text-red-700', icon: <XCircle size={16} /> },
  REFUNDED: { label: '환불됨', color: 'bg-purple-100 text-purple-700', icon: <XCircle size={16} /> },
  RECEIVED: { label: '수령완료', color: 'bg-teal-100 text-teal-700', icon: <CheckCircle size={16} /> },
}

// 주문 상태 흐름 정의
const ORDER_STATUS_FLOW: Record<string, { next: string | null; nextLabel: string }> = {
  PENDING: { next: 'PAID', nextLabel: '결제 확인' },
  PAID: { next: 'PREPARING', nextLabel: '상품 준비' },
  PREPARING: { next: 'SHIPPED', nextLabel: '배송 시작' },
  SHIPPED: { next: 'DELIVERED', nextLabel: '배송 완료' },
  DELIVERED: { next: null, nextLabel: '' },
  CANCELLED: { next: null, nextLabel: '' },
  REFUNDED: { next: null, nextLabel: '' },
}

// 스테퍼 단계 정의
const ORDER_STEPS = [
  { key: 'PENDING', label: '주문접수', icon: Clock, dateField: 'createdAt' },
  { key: 'PAID', label: '결제완료', icon: CreditCard, dateField: 'paidAt' },
  { key: 'PREPARING', label: '상품준비', icon: Package, dateField: 'preparingAt' },
  { key: 'SHIPPED', label: '배송중', icon: Truck, dateField: 'shippedAt' },
  { key: 'DELIVERED', label: '배송완료', icon: CheckCircle, dateField: 'deliveredAt' },
] as const

// 상태를 단계 인덱스로 변환
const getStepIndex = (status: string): number => {
  switch (status) {
    case 'PENDING': return 0
    case 'PAID': return 1
    case 'PREPARING': return 2
    case 'SHIPPED': return 3
    case 'DELIVERED': return 4
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  const loadOrder = useCallback(async () => {
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
  }, [orderNumber, source])

  useEffect(() => {
    if (orderNumber) {
      loadOrder()
    }
  }, [orderNumber, loadOrder])

  const handleStatusChange = (newStatus: string) => {
    if (!order) return
    setPendingStatus(newStatus)
    if (newStatus === 'CANCELLED') {
      setShowCancelConfirm(true)
    } else {
      setShowStatusConfirm(true)
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
      setShowStatusConfirm(false)
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

  // 외부 주문 판별 (주문번호가 'x'로 시작)
  const isExternalOrder = (orderNumber: string) => {
    return orderNumber.toLowerCase().startsWith('x')
  }

  // 외부 주문 삭제
  const handleDeleteExternalOrder = async () => {
    if (!order) return

    setShowDeleteConfirm(false)
    setIsUpdating(true)

    try {
      const endpoint = order.isGuestOrder
        ? `/api/order/external/guest/${order.id}`
        : `/api/order/external/member/${order.id}`

      const res = await fetch(endpoint, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (data.success) {
        toast.success('주문이 삭제되었습니다.')
        router.push('/shop/order/list')
      } else {
        toast.error(data.error || '주문 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 삭제 실패:', error)
      toast.error('주문 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" onClick={() => router.push('/shop/order/list')} className="flex-shrink-0">
              <ArrowLeft size={20} />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">주문 상세</h1>
                {order.isGuestOrder && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                    비회원
                  </span>
                )}
                {isExternalOrder(order.orderNumber) && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 whitespace-nowrap">
                    외부 주문
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 font-mono truncate">{order.orderNumber}</p>
            </div>
          </div>
          {isExternalOrder(order.orderNumber) && (
            <Button
              variant="danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isUpdating}
              className="self-end sm:self-auto"
            >
              <Trash2 size={16} />
              삭제
            </Button>
          )}
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
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* 1줄: 소매처 배지 (Shop) */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-100 text-blue-700">
                <Store size={14} className="sm:w-4 sm:h-4" />
                {order.shopName || '쇼핑몰 주문'}
              </span>
              {/* 2줄: 도매처 배지 (Channel, WHOLESALE) - 첫 번째 상품 기준 */}
              {order.items[0]?.channel?.kind === 'WHOLESALE' && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium ${
                  CHANNEL_PLATFORM_CONFIG[order.items[0].channel.platform]?.bgColor || 'bg-gray-100'
                } ${CHANNEL_PLATFORM_CONFIG[order.items[0].channel.platform]?.color || 'text-gray-700'}`}>
                  <Package size={14} className="sm:w-4 sm:h-4" />
                  {order.items[0].channel.name}
                  <span className="text-xs opacity-75">(도매)</span>
                </span>
              )}
              {/* 상태 배지 */}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium ${status.color}`}>
                {status.icon}
                {order.statusLabel || status.label}
              </span>
              {/* 결제 방식 배지 */}
              {isBankTransfer && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-amber-100 text-amber-700">
                  <Building2 size={14} className="sm:w-4 sm:h-4" />
                  무통장입금
                </span>
              )}
              {order.paymentMethod === 'CARD' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-indigo-100 text-indigo-700">
                  <CreditCard size={14} className="sm:w-4 sm:h-4" />
                  카드결제
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
            <div className="p-4 sm:p-6">
                {/* 스테퍼 - 모바일: 세로, 데스크탑: 가로 */}
                {/* 모바일 스테퍼 (세로) */}
                <div className="flex flex-col gap-2 mb-6 sm:hidden">
                  {ORDER_STEPS.map((step, index) => {
                    const currentIndex = getStepIndex(order.status)
                    const isCompleted = index < currentIndex
                    const isCurrent = index === currentIndex
                    const StepIcon = step.icon
                    const dateValue = order[step.dateField as keyof UnifiedOrderDetail] as string | null

                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                              ? 'bg-blue-500 text-white ring-2 ring-blue-100'
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {isCompleted ? <CheckCircle size={18} /> : <StepIcon size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-gray-500">{dateValue ? formatDate(dateValue) : '-'}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 데스크탑 스테퍼 (가로) */}
                <div className="hidden sm:flex items-center justify-center mb-8 max-w-4xl mx-auto">
                  {ORDER_STEPS.map((step, index) => {
                    const currentIndex = getStepIndex(order.status)
                    const isCompleted = index < currentIndex
                    const isCurrent = index === currentIndex
                    const StepIcon = step.icon
                    const dateValue = order[step.dateField as keyof UnifiedOrderDetail] as string | null

                    return (
                      <div key={step.key} className={`flex items-center ${index < ORDER_STEPS.length - 1 ? 'flex-1' : ''}`}>
                        {/* 스텝 아이콘 & 라벨 */}
                        <div className="flex flex-col items-center min-w-[80px] md:min-w-[100px]">
                          <div
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
                              isCompleted
                                ? 'bg-green-500 text-white'
                                : isCurrent
                                ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                                : 'bg-gray-200 text-gray-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle size={20} className="md:w-6 md:h-6" />
                            ) : (
                              <StepIcon size={20} className="md:w-6 md:h-6" />
                            )}
                          </div>
                          <p
                            className={`mt-2 text-xs md:text-sm font-medium ${
                              isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                            }`}
                          >
                            {step.label}
                          </p>
                          <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
                            {dateValue ? formatDate(dateValue) : '-'}
                          </p>
                        </div>

                        {/* 연결선 */}
                        {index < ORDER_STEPS.length - 1 && (
                          <div
                            className={`flex-1 h-1 mx-2 md:mx-4 rounded ${
                              index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 액션 버튼 */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-gray-100">
                  {ORDER_STATUS_FLOW[order.status]?.next && (
                    <Button
                      variant="primary"
                      onClick={() => handleStatusChange(ORDER_STATUS_FLOW[order.status].next!)}
                      disabled={isUpdating}
                      size="lg"
                    >
                      {order.status === 'PENDING' && <CreditCard size={18} />}
                      {order.status === 'PAID' && <Package size={18} />}
                      {order.status === 'PREPARING' && <Truck size={18} />}
                      {order.status === 'SHIPPED' && <CheckCircle size={18} />}
                      {ORDER_STATUS_FLOW[order.status].nextLabel}
                    </Button>
                  )}
                  {['PENDING', 'PAID', 'PREPARING'].includes(order.status) && (
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => setShowRestoreConfirm(true)}
                    disabled={isUpdating}
                  >
                    <CreditCard size={16} />
                    입금 확인 (주문 복구)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleStatusChange('REFUNDED')}
                    disabled={isUpdating}
                  >
                    <CheckCircle size={16} />
                    환불 완료 처리
                  </Button>
                </div>
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
                  <div key={item.id} className="p-3 sm:p-4">
                    {/* 모바일: 세로 레이아웃 */}
                    <div className="flex gap-3 sm:hidden">
                      {/* 상품 이미지 */}
                      {item.thumbnailUrl ? (
                        <Image
                          src={item.thumbnailUrl}
                          alt={item.productName}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ImageOff size={20} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{item.productName}</h3>
                        {item.channel && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${CHANNEL_PLATFORM_CONFIG[item.channel.platform]?.bgColor || 'bg-gray-100'} ${CHANNEL_PLATFORM_CONFIG[item.channel.platform]?.color || 'text-gray-700'}`}>
                              <Store size={10} />
                              {item.channel.name}
                            </span>
                          </div>
                        )}
                        {item.optionSummary && (
                          <p className="text-xs text-gray-500">{item.optionSummary}</p>
                        )}
                      </div>
                    </div>
                    {/* 모바일: 가격 정보 */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 sm:hidden">
                      <span className="text-xs text-gray-500">
                        {formatPrice(item.unitPrice)} × {item.quantity}개
                        {item.shippingFee > 0 && (
                          <span className="ml-1 text-orange-600">+배송비 {formatPrice(item.shippingFee)}</span>
                        )}
                      </span>
                      <span className="font-bold text-gray-900">{formatPrice(item.totalPrice)}</span>
                    </div>

                    {/* 데스크탑: 가로 레이아웃 */}
                    <div className="hidden sm:flex gap-4">
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
                        {/* 도매처(소싱 출처) 뱃지 */}
                        {item.channel && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_PLATFORM_CONFIG[item.channel.platform]?.bgColor || 'bg-gray-100'} ${CHANNEL_PLATFORM_CONFIG[item.channel.platform]?.color || 'text-gray-700'}`}>
                              <Store size={12} />
                              {item.channel.name}
                            </span>
                            {item.channel.kind === 'WHOLESALE' && (
                              <span className="text-xs text-gray-400">도매</span>
                            )}
                          </div>
                        )}
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
                        {/* 배송비 정보 */}
                        {item.shippingFee > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            배송비 {formatPrice(item.shippingFee)}
                            {item.bundleMaxQty > 1 && (
                              <span className="ml-1">
                                ({item.bundleMaxQty}개 합배송)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
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

            {/* 텍스트 복사 (발주용) */}
            {isShoppingMall && (
              <OrderTextCopyButton
                orderNumber={order.orderNumber}
                items={order.items}
                shippingAddress={order.shippingAddress}
                orderStatus={order.status}
                customerName={order.customerName}
                customerPhone={order.customerPhone ?? undefined}
                retailChannelNames={(order as any).retailChannelNames}
                orderSubtotal={(order as any).subtotalAmount}
                orderTotal={(order as any).totalAmount}
                orderDiscount={(order as any).discountAmount}
              />
            )}

            {/* 발주 상태 표시 */}
            {order.wholesaleOrderStatus && (
              <div className={`rounded-lg p-3 border ${
                order.wholesaleOrderStatus === 'ORDERED' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className={
                    order.wholesaleOrderStatus === 'ORDERED' ? 'text-green-600' : 'text-blue-600'
                  } />
                  <span className="text-sm font-medium text-gray-900">
                    {order.wholesaleOrderStatus === 'ORDERED' ? '도매 발주 완료' : '도매처 확인'}
                  </span>
                  {order.wholesaleOrderedAt && (
                    <span className="text-xs text-gray-500">
                      {formatDate(order.wholesaleOrderedAt)}
                    </span>
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
              {(() => {
                // 상품 금액 합계 계산 (각 아이템의 totalPrice 합)
                const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
                // 실제 할인 금액 계산 (저장된 값이 없으면 계산)
                const actualDiscount = order.discountAmount > 0
                  ? order.discountAmount
                  : Math.max(0, itemsTotal - order.totalAmount)

                return (
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">상품 금액</span>
                      <span className="font-medium">{formatPrice(itemsTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">배송비</span>
                      {order.shippingFee > 0 ? (
                        <span className="font-medium">{formatPrice(order.shippingFee)}</span>
                      ) : (
                        <span className="font-medium text-green-600">무료</span>
                      )}
                    </div>
                    {actualDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>묶음 할인</span>
                        <span>-{formatPrice(actualDiscount)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-3 flex justify-between">
                      <span className="font-semibold text-gray-900">총 결제금액</span>
                      <span className="text-xl font-bold text-blue-600">{formatPrice(order.totalAmount)}</span>
                    </div>
                  </div>
                )
              })()}
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

      {/* 외부 주문 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteExternalOrder}
        title="외부 주문 삭제"
        message="이 외부 주문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
        isLoading={isUpdating}
      />

      {/* 주문 복구 확인 모달 */}
      <ConfirmModal
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={() => {
          setShowRestoreConfirm(false)
          confirmStatusChange('PREPARING')
        }}
        title="입금 확인 및 주문 복구"
        message="취소된 주문을 복구하고 상품 준비 상태로 변경하시겠습니까? 입금이 확인된 경우에만 진행해주세요."
        confirmText="입금 확인 및 복구"
        cancelText="취소"
        variant="info"
        isLoading={isUpdating}
      />

      {/* 상태 변경 확인 모달 */}
      <ConfirmModal
        isOpen={showStatusConfirm}
        onClose={() => {
          setShowStatusConfirm(false)
          setPendingStatus(null)
        }}
        onConfirm={() => confirmStatusChange()}
        title="주문 상태 변경"
        message={`주문 상태를 "${pendingStatus ? ORDER_STATUS_FLOW[order?.status || '']?.nextLabel || '변경' : ''}"(으)로 변경하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="확인"
        cancelText="취소"
        variant="info"
        isLoading={isUpdating}
      />
    </div>
  )
}
