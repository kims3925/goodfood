'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Package,
  ArrowLeft,
  CreditCard,
  MapPin,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  User,
  FileText,
  Copy,
  Check,
  X,
  AlertTriangle,
  Building2,
  AlertCircle
} from 'lucide-react'
import { formatPhoneNumber } from '@/modules/common/utils/src/helpers/phone'
import { useShopUrl } from '@/hooks/useShopUrl'
import { useShop } from '@/contexts/ShopContext'
import toast from 'react-hot-toast'

// 취소 사유 목록
const CANCEL_REASONS = [
  { value: 'CHANGE_MIND', label: '단순 변심' },
  { value: 'WRONG_ORDER', label: '주문 실수' },
  { value: 'FOUND_CHEAPER', label: '다른 곳에서 더 저렴하게 구매' },
  { value: 'DELIVERY_DELAY', label: '배송 지연' },
  { value: 'OUT_OF_STOCK', label: '상품 품절' },
  { value: 'OTHER', label: '기타' },
]

// 은행 목록
const BANK_LIST = [
  { code: 'KB', name: 'KB국민은행' },
  { code: 'SHINHAN', name: '신한은행' },
  { code: 'WOORI', name: '우리은행' },
  { code: 'HANA', name: '하나은행' },
  { code: 'NH', name: 'NH농협은행' },
  { code: 'IBK', name: 'IBK기업은행' },
  { code: 'SC', name: 'SC제일은행' },
  { code: 'CITI', name: '한국씨티은행' },
  { code: 'KAKAO', name: '카카오뱅크' },
  { code: 'TOSS', name: '토스뱅크' },
  { code: 'KBANK', name: '케이뱅크' },
  { code: 'POST', name: '우체국' },
  { code: 'SUHYUP', name: '수협은행' },
  { code: 'BUSAN', name: '부산은행' },
  { code: 'DAEGU', name: '대구은행' },
  { code: 'KWANGJU', name: '광주은행' },
  { code: 'JEONBUK', name: '전북은행' },
  { code: 'JEJU', name: '제주은행' },
  { code: 'KYONGNAM', name: '경남은행' },
  { code: 'SAEMAUL', name: '새마을금고' },
  { code: 'SHINHYUP', name: '신협' },
]

// 취소 가능한 상태
const CANCELLABLE_STATUSES = ['PENDING', 'PAID']

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

interface Payment {
  id: number
  paymentKey: string
  status: string
  method: string
  amount: number
  cardCompany: string | null
  cardNumber: string | null
  installmentMonth: number | null
  virtualAccountNumber: string | null
  virtualAccountBank: string | null
  virtualAccountDueDate: string | null
  approvedAt: string | null
}

interface BankTransferInfo {
  bankName: string
  bankAccount: string
  accountHolder: string
  depositDeadline: string
}

interface ShippingAddress {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
}

interface Order {
  id: number
  orderNumber: string
  status: string
  isGuestOrder?: boolean
  shippingAddress: ShippingAddress | null
  subtotalAmount: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  orderedAt: string
  paidAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  customer: {
    name: string
    email: string | null
    phone: string | null
  }
  items: OrderItem[]
  hasWritableReview: boolean
  payment: Payment | null
  bankTransferInfo: BankTransferInfo | null
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
  PENDING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  PAID: 'text-blue-600 bg-blue-50 border-blue-200',
  PREPARING: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  SHIPPED: 'text-purple-600 bg-purple-50 border-purple-200',
  DELIVERED: 'text-green-600 bg-green-50 border-green-200',
  CANCELLED: 'text-gray-600 bg-gray-50 border-gray-200',
  REFUNDED: 'text-red-600 bg-red-50 border-red-200',
}

const paymentMethodLabels: Record<string, string> = {
  CARD: '신용/체크카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  TRANSFER: '계좌이체',
  MOBILE: '휴대폰 결제',
  CULTURE_GIFT: '문화상품권',
  BOOK_GIFT: '도서문화상품권',
  GAME_GIFT: '게임문화상품권',
  BANK_TRANSFER: '무통장입금',
}

export default function OrderDetailPage() {
  const { data: session, status: sessionStatus } = useSession()
  const params = useParams()
  const router = useRouter()
  const { getPath, getApiPath } = useShopUrl()
  const { shop } = useShop()
  const primaryColor = shop?.theme?.primaryColor || '#FF6B6B'
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [bankAccountCopied, setBankAccountCopied] = useState(false)

  // 취소 모달 상태
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // 환불 계좌 상태 (무통장입금용)
  const [refundBankName, setRefundBankName] = useState('')
  const [refundAccountNumber, setRefundAccountNumber] = useState('')
  const [refundAccountHolder, setRefundAccountHolder] = useState('')

  const orderId = params.id as string

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(getApiPath(`/api/mypage/orders/${orderId}`))
      const data = await response.json()

      if (data.success) {
        setOrder(data.order)
      } else {
        setError(data.error || '주문을 불러오는데 실패했습니다')
      }
    } catch (err) {
      console.error('Failed to fetch order:', err)
      setError('주문을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [getApiPath, orderId])

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session) {
      router.push(getPath('/auth/login?callbackUrl=/mypage/orders'))
      return
    }
    fetchOrder()
  }, [session, sessionStatus, orderId, fetchOrder, router, getPath])

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

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        return true
      }
      // Fallback for non-secure contexts (HTTP)
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      return success
    } catch (error) {
      console.error('Failed to copy:', error)
      return false
    }
  }

  const copyOrderNumber = async () => {
    if (order?.orderNumber) {
      const success = await copyToClipboard(order.orderNumber)
      if (success) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const copyBankAccount = async () => {
    if (order?.bankTransferInfo?.bankAccount) {
      const success = await copyToClipboard(order.bankTransferInfo.bankAccount)
      if (success) {
        setBankAccountCopied(true)
        setTimeout(() => setBankAccountCopied(false), 2000)
      }
    }
  }

  // 취소 모달 열기
  const openCancelModal = () => {
    setCancelReason('')
    setCustomReason('')
    setCancelModalOpen(true)
  }

  // 취소 모달 닫기
  const closeCancelModal = () => {
    setCancelModalOpen(false)
    setCancelReason('')
    setCustomReason('')
    setRefundBankName('')
    setRefundAccountNumber('')
    setRefundAccountHolder('')
  }

  // 무통장입금/가상계좌 결제 여부 확인
  const isVirtualAccountPayment = order?.payment?.method === 'VIRTUAL_ACCOUNT' || order?.payment?.method === 'BANK_TRANSFER'
  const needsRefundAccount = isVirtualAccountPayment && order?.status === 'PAID'

  // 주문 취소 처리
  const handleCancelOrder = async () => {
    if (!order || !cancelReason) {
      return
    }

    if (cancelReason === 'OTHER' && !customReason.trim()) {
      return
    }

    // 무통장입금 환불 계좌 검증
    if (needsRefundAccount) {
      if (!refundBankName || !refundAccountNumber.trim() || !refundAccountHolder.trim()) {
        toast.error('환불 계좌 정보를 모두 입력해주세요.')
        return
      }
    }

    try {
      setCancelLoading(true)

      const requestBody: any = {
        reason: cancelReason,
        customReason: cancelReason === 'OTHER' ? customReason : undefined,
      }

      // 무통장입금 환불 계좌 정보 추가
      if (needsRefundAccount) {
        requestBody.refundAccount = {
          bankName: refundBankName,
          accountNumber: refundAccountNumber.trim(),
          accountHolder: refundAccountHolder.trim(),
        }
      }

      const response = await fetch(getApiPath(`/api/orders/${order.id}/cancel`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        closeCancelModal()
        fetchOrder() // 주문 정보 새로고침
      } else {
        toast.error(data.error || '주문 취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 취소 오류:', error)
      toast.error('주문 취소 중 오류가 발생했습니다.')
    } finally {
      setCancelLoading(false)
    }
  }

  // 배송 진행 상태 계산
  const getDeliverySteps = () => {
    // 상품준비중: PREPARING, SHIPPED, DELIVERED 상태이면 완료
    const preparingCompleted = order?.status === 'PREPARING' || order?.status === 'SHIPPED' || order?.status === 'DELIVERED'

    const steps = [
      { key: 'ordered', label: '주문접수', date: order?.orderedAt, completed: true },
      { key: 'paid', label: '결제완료', date: order?.paidAt, completed: !!order?.paidAt },
      { key: 'preparing', label: '상품준비', date: null, completed: preparingCompleted },
      { key: 'shipped', label: '배송중', date: order?.shippedAt, completed: !!order?.shippedAt },
      { key: 'delivered', label: '배송완료', date: order?.deliveredAt, completed: !!order?.deliveredAt },
    ]
    return steps
  }

  if (loading) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: primaryColor }}></div>
          <p className="mt-4 text-gray-600">주문 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="kurly-container py-12">
        <div className="text-center py-20 bg-gray-50 rounded-lg">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error || '주문을 찾을 수 없습니다'}</p>
          <Link
            href={getPath('/mypage/orders')}
            className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-md hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            <ArrowLeft className="w-4 h-4" />
            주문 목록으로
          </Link>
        </div>
      </div>
    )
  }

  const deliverySteps = getDeliverySteps()
  const isCancelled = order.status === 'CANCELLED' || order.status === 'REFUNDED'

  return (
    <div className="kurly-container py-8">
      {/* 뒤로가기 */}
      <Link
        href={getPath('/mypage/orders')}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        주문 목록
      </Link>

      {/* 헤더 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">주문 상세</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[order.status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                {statusLabels[order.status] || order.status}
              </span>
              {order.isGuestOrder && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                  비회원
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="font-mono">{order.orderNumber}</span>
              <button
                onClick={copyOrderNumber}
                className="p-1 hover:bg-gray-100 rounded"
                title="주문번호 복사"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            주문일시: {formatDate(order.orderedAt)}
          </div>
        </div>
      </div>

      {/* 무통장입금 정보 (PENDING 상태이고 BANK_TRANSFER인 경우) */}
      {order.bankTransferInfo && order.status === 'PENDING' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            입금 계좌 안내
          </h2>

          <div className="bg-white rounded-lg p-5 shadow-sm mb-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">은행</span>
                <span className="font-semibold text-gray-900">{order.bankTransferInfo.bankName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">계좌번호</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-gray-900">{order.bankTransferInfo.bankAccount}</span>
                  <button
                    onClick={copyBankAccount}
                    className={`px-3 py-1 text-xs rounded-lg transition-all ${
                      bankAccountCopied
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {bankAccountCopied ? '복사완료' : '복사'}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">예금주</span>
                <span className="font-semibold text-gray-900">{order.bankTransferInfo.accountHolder}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-gray-500 text-sm">입금 금액</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* 입금 기한 */}
          <div className="flex items-center gap-2 text-blue-700 bg-blue-100 rounded-lg px-4 py-3 mb-4">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">입금 기한</p>
              <p className="text-xs">{formatDate(order.bankTransferInfo.depositDeadline)}까지</p>
            </div>
          </div>

          {/* 안내사항 */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-medium text-amber-800">입금 시 주의사항</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>입금자명은 주문자명과 동일하게 해주세요</li>
                  <li>입금 기한 내 미입금 시 주문이 자동 취소됩니다</li>
                  <li>입금 확인은 영업일 기준 1-2일 소요될 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 배송 진행 상태 (취소되지 않은 경우) */}
      {!isCancelled && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Truck className="w-5 h-5" style={{ color: primaryColor }} />
            배송 현황
          </h2>
          <div className="relative max-w-2xl mx-auto">
            {/* Progress Line */}
            <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-200">
              <div
                className="absolute top-0 left-0 h-full transition-all"
                style={{
                  width: `${(deliverySteps.filter(s => s.completed).length - 1) / (deliverySteps.length - 1) * 100}%`,
                  backgroundColor: primaryColor
                }}
              ></div>
            </div>

            <div className="relative flex justify-between">
              {deliverySteps.map((step, index) => (
                <div key={step.key} className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center z-10 ${
                      step.completed
                        ? 'text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                    style={step.completed ? { backgroundColor: primaryColor } : {}}
                  >
                    {step.completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="text-lg font-bold">{index + 1}</span>
                    )}
                  </div>
                  <p className={`mt-3 text-sm font-medium ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const d = new Date(step.date)
                        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                      })()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 주문 상품 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 주문 상품 목록 */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: primaryColor }} />
              주문 상품 ({order.items.length}개)
            </h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="relative w-24 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {item.thumbnailUrl ? (
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.productName}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                      {item.productName}
                    </h3>
                    {item.optionSummary && (
                      <p className="text-sm text-gray-500 mb-2">{item.optionSummary}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">
                        {formatPrice(item.unitPrice)} x {item.quantity}개
                      </p>
                      <p className="font-bold text-gray-900">
                        {formatPrice(item.totalPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 배송지 정보 */}
          {order.shippingAddress && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                배송지 정보
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600">받는 분</p>
                    <p className="font-medium text-gray-900">{order.shippingAddress.recipientName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600">연락처</p>
                    <p className="font-medium text-gray-900">{formatPhoneNumber(order.shippingAddress.recipientPhone)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-600">주소</p>
                    <p className="font-medium text-gray-900">
                      [{order.shippingAddress.postalCode}] {order.shippingAddress.address}
                      {order.shippingAddress.addressDetail && ` ${order.shippingAddress.addressDetail}`}
                    </p>
                  </div>
                </div>
                {order.shippingAddress.deliveryMemo && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-600">배송 메모</p>
                      <p className="font-medium text-gray-900">{order.shippingAddress.deliveryMemo}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 결제 정보 */}
        <div className="space-y-6">
          {/* 결제 금액 */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: primaryColor }} />
              결제 금액
            </h2>
            {(() => {
              // 상품 금액 합계 계산 (각 아이템의 totalPrice 합)
              const itemsTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0)
              // 실제 할인 금액 계산 (저장된 값이 없으면 계산)
              const actualDiscount = order.discountAmount > 0
                ? order.discountAmount
                : Math.max(0, itemsTotal - order.totalAmount)

              return (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">상품 금액</span>
                    <span className="text-gray-900">{formatPrice(itemsTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">배송비</span>
                    <span className={order.shippingFee === 0 ? 'text-green-600' : 'text-gray-900'}>
                      {order.shippingFee === 0 ? '무료' : formatPrice(order.shippingFee)}
                    </span>
                  </div>
                  {actualDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">묶음 할인</span>
                      <span className="text-green-600">-{formatPrice(actualDiscount)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-200 flex justify-between">
                    <span className="font-bold text-gray-900">총 결제금액</span>
                    <span className="text-xl font-bold" style={{ color: primaryColor }}>{formatPrice(order.totalAmount)}</span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* 결제 정보 */}
          {order.payment && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" style={{ color: primaryColor }} />
                결제 정보
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">결제 수단</span>
                  <span className="font-medium text-gray-900">
                    {paymentMethodLabels[order.payment.method] || order.payment.method}
                  </span>
                </div>
                {order.payment.cardCompany && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">카드사</span>
                    <span className="text-gray-900">{order.payment.cardCompany}</span>
                  </div>
                )}
                {order.payment.cardNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">카드번호</span>
                    <span className="font-mono text-gray-900">{order.payment.cardNumber}</span>
                  </div>
                )}
                {order.payment.installmentMonth && order.payment.installmentMonth > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">할부</span>
                    <span className="text-gray-900">{order.payment.installmentMonth}개월</span>
                  </div>
                )}
                {order.payment.virtualAccountBank && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">입금 은행</span>
                      <span className="text-gray-900">{order.payment.virtualAccountBank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">계좌번호</span>
                      <span className="font-mono text-gray-900">{order.payment.virtualAccountNumber}</span>
                    </div>
                    {order.payment.virtualAccountDueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">입금 기한</span>
                        <span className="text-red-600 font-medium">
                          {formatDate(order.payment.virtualAccountDueDate)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {order.payment.approvedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">결제 일시</span>
                    <span className="text-gray-900">{formatDate(order.payment.approvedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 주문자 정보 */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" style={{ color: primaryColor }} />
              주문자 정보
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900">{order.customer.name}</span>
              </div>
              {order.customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{formatPhoneNumber(order.customer.phone)}</span>
                </div>
              )}
              {order.customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{order.customer.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-3">
            {order.hasWritableReview && (
              <Link
                href={getPath('/mypage/reviews')}
                className="block w-full px-4 py-3 text-white text-center rounded-lg font-medium hover:opacity-90 transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                후기 작성하기
              </Link>
            )}
            {CANCELLABLE_STATUSES.includes(order.status) && (
              <button
                className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
                onClick={openCancelModal}
              >
                주문 취소
              </button>
            )}

          </div>
        </div>
      </div>

      {/* 취소 모달 */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-gray-900">주문 취소</h3>
              </div>
              <button
                onClick={closeCancelModal}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-4 space-y-4">
              <p className="text-gray-600 text-sm">
                주문번호 <span className="font-mono font-medium">{order.orderNumber}</span>을 취소하시겠습니까?
              </p>

              {order.payment && order.status === 'PAID' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-700 text-sm">
                    결제된 금액은 결제 수단에 따라 3~5영업일 내에 환불됩니다.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  취소 사유 <span className="text-red-500">*</span>
                </label>
                <select
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">취소 사유를 선택해주세요</option>
                  {CANCEL_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {cancelReason === 'OTHER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상세 사유 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="취소 사유를 입력해주세요"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
              )}

              {/* 무통장입금 환불 계좌 입력 */}
              {needsRefundAccount && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-800 mb-2">
                    <Building2 className="w-4 h-4" />
                    <p className="text-sm font-medium">환불 계좌 정보</p>
                  </div>
                  <p className="text-xs text-blue-600 mb-3">
                    무통장입금 환불을 위해 계좌 정보를 입력해주세요.
                  </p>

                  <div>
                    <label htmlFor="refund-bank" className="block text-xs font-medium text-gray-700 mb-1">
                      은행 선택 <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="refund-bank"
                      value={refundBankName}
                      onChange={(e) => setRefundBankName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">은행을 선택해주세요</option>
                      {BANK_LIST.map((bank) => (
                        <option key={bank.code} value={bank.name}>
                          {bank.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      계좌번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={refundAccountNumber}
                      onChange={(e) => setRefundAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
                      placeholder="'-' 없이 숫자만 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      예금주 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={refundAccountHolder}
                      onChange={(e) => setRefundAccountHolder(e.target.value)}
                      placeholder="예금주명 입력"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button
                onClick={closeCancelModal}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                닫기
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelLoading || !cancelReason || (needsRefundAccount && (!refundBankName || !refundAccountNumber || !refundAccountHolder))}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    처리 중...
                  </span>
                ) : (
                  '주문 취소'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
