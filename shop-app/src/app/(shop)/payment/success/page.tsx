'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  Package,
  Clock,
  ArrowLeft,
  CreditCard,
  MapPin,
  Truck,
  FileText,
  Copy,
  Check
} from 'lucide-react'

interface PaymentInfo {
  paymentKey: string
  orderId: string
  amount: number
  method: string
  methodLabel: string
  status: string
  approvedAt: string
  card?: {
    company: string
    number: string
    installmentPlanMonths: number
  }
  virtualAccount?: {
    accountNumber: string
    bank: string
    dueDate: string
  }
}

interface OrderInfo {
  id: number
  orderNumber: string
  status: string
  customer: {
    name: string
    email: string
    phone: string
  }
  quantity: number
  subtotal: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
}

type PageStatus = 'loading' | 'success' | 'error'

// 이미 처리됨/처리 중 에러 코드들 (성공으로 처리)
const ALREADY_PROCESSED_ERRORS = [
  'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING', // 기존 요청을 처리중
  'ALREADY_PROCESSED_PAYMENT', // 이미 처리된 결제
  'ALREADY_APPROVED', // 이미 승인된 결제
  'ALREADY_PROCESSING', // 서버에서 이미 처리 중
]

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isGuestOrder, setIsGuestOrder] = useState(false)
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null)

  // 중복 처리 방지를 위한 ref
  const isProcessingRef = useRef(false)
  const hasProcessedRef = useRef(false)

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  // 결제 확인 함수
  const confirmPayment = async (retry = 0): Promise<boolean> => {
    try {
      // 비회원 주문 여부 확인 (GORD- prefix)
      const isGuest = orderId?.startsWith('GORD-') || false
      setIsGuestOrder(isGuest)

      // 회원/비회원에 따라 다른 API 호출
      const confirmApiUrl = isGuest ? '/api/guest-payments/confirm' : '/api/payments/confirm'

      const response = await fetch(confirmApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: parseInt(amount!)
        })
      })

      const data = await response.json()

      if (data.success) {
        setPaymentInfo(data.payment)
        setOrderInfo(data.order)
        // 비회원인 경우 accessToken 저장
        if (isGuest && data.accessToken) {
          setGuestAccessToken(data.accessToken)
        }
        return true
      }

      // "이미 처리됨" 에러는 성공으로 처리
      const errorCode = data.error?.code
      if (ALREADY_PROCESSED_ERRORS.includes(errorCode)) {
        console.log('결제가 이미 처리되었습니다:', errorCode)
        // 결제 상태 조회해서 정보 가져오기
        const statusResult = await fetchPaymentStatus()
        return statusResult
      }

      throw new Error(data.error?.message || '결제 승인에 실패했습니다.')
    } catch (error: any) {
      console.error(`결제 승인 시도 ${retry + 1} 실패:`, error)
      throw error
    }
  }

  // 결제 상태 조회 (이미 처리된 결제 정보 가져오기)
  const fetchPaymentStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/payments/status?orderId=${orderId}`)
      const data = await response.json()

      if (data.success && data.payment) {
        setPaymentInfo(data.payment)
        setOrderInfo(data.order)
        return true
      }

      // 상태 조회 실패해도 토스가 successUrl로 보냈으므로 기본 성공 처리
      setPaymentInfo({
        paymentKey: paymentKey!,
        orderId: orderId!,
        amount: parseInt(amount!),
        method: 'CARD',
        methodLabel: '카드',
        status: 'DONE',
        approvedAt: new Date().toISOString()
      })
      return true
    } catch (error) {
      console.error('결제 상태 조회 실패:', error)
      // 조회 실패해도 토스가 successUrl로 보냈으므로 기본 성공 처리
      setPaymentInfo({
        paymentKey: paymentKey!,
        orderId: orderId!,
        amount: parseInt(amount!),
        method: 'CARD',
        methodLabel: '카드',
        status: 'DONE',
        approvedAt: new Date().toISOString()
      })
      return true
    }
  }

  // 메인 처리 로직
  const processPayment = async () => {
    // 이미 처리 중이거나 처리 완료된 경우 중복 실행 방지
    if (isProcessingRef.current || hasProcessedRef.current) {
      console.log('결제 처리 중복 호출 방지됨')
      return
    }

    isProcessingRef.current = true

    try {
      // 첫 번째 시도 - 재시도 없이 한 번만 호출
      const success = await confirmPayment(0)
      if (success) {
        hasProcessedRef.current = true
        setStatus('success')
        return
      }
    } catch (error: any) {
      console.error('결제 승인 실패:', error)

      // "이미 처리됨" 에러는 상태 조회로 처리
      const errorCode = error?.code || error?.message
      if (ALREADY_PROCESSED_ERRORS.some(code => errorCode?.includes(code))) {
        console.log('이미 처리된 결제, 상태 조회 시도')
        const statusResult = await fetchPaymentStatus()
        if (statusResult) {
          hasProcessedRef.current = true
          setStatus('success')
          return
        }
      }
    }

    // 실패 시 상태 조회로 한번 더 시도
    console.log('confirmPayment 실패, 결제 상태 조회 시도')
    const statusResult = await fetchPaymentStatus()
    if (statusResult) {
      hasProcessedRef.current = true
      setStatus('success')
    } else {
      setError('결제 확인에 실패했습니다. 주문 내역에서 확인해주세요.')
      setStatus('error')
    }

    isProcessingRef.current = false
  }

  useEffect(() => {
    // 이미 처리 완료된 경우 실행 안함
    if (hasProcessedRef.current) return

    // 파라미터가 모두 있으면 결제 확인 진행
    if (paymentKey && orderId && amount) {
      processPayment()
    } else {
      // 파라미터 없으면 에러
      const timer = setTimeout(() => {
        if (!paymentKey || !orderId || !amount) {
          setError('결제 정보가 누락되었습니다.')
          setStatus('error')
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatPrice = (price: number) => {
    return price.toLocaleString()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const copyOrderNumber = async () => {
    if (paymentInfo?.orderId) {
      await navigator.clipboard.writeText(paymentInfo.orderId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 로딩 화면
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 확인 중</h2>
            <p className="text-gray-500 text-center">
              결제 승인을 처리하고 있습니다.<br />
              잠시만 기다려 주세요.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>토스페이먼츠 연동 중...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 에러 화면
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">결제 확인 실패</h2>
            <p className="text-gray-500 text-center mb-6">{error}</p>
            <div className="w-full space-y-3">
              <Link
                href="/main"
                className="block w-full bg-gray-900 text-white text-center py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                쇼핑몰 홈으로
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="w-full border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 성공 화면
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* 성공 헤더 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">결제가 완료되었습니다!</h1>
            <p className="text-green-100">주문해 주셔서 감사합니다.</p>
          </div>

          {/* 고객 환영 메시지 */}
          <div className="p-6 bg-green-50 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-900">
                  {orderInfo?.customer?.name}님의 주문이 접수되었습니다
                </p>
                <p className="text-sm text-green-700 mt-0.5">
                  주문 확인 후 2~3일 내에 배송이 시작됩니다
                </p>
              </div>
            </div>
          </div>

          {/* 주문번호 */}
          <div className="p-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm text-gray-500 mb-1">주문번호</p>
                <p className="font-mono font-bold text-gray-900 text-lg">{paymentInfo?.orderId}</p>
              </div>
              <button
                onClick={copyOrderNumber}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="주문번호 복사"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 주문 상세 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">주문 상세</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">상품 수량</span>
              <span className="font-semibold text-gray-900">{orderInfo?.quantity}개</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">상품 금액</span>
              <span className="text-gray-900">{formatPrice(orderInfo?.subtotal || 0)}원</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">배송비</span>
              <span className={orderInfo?.shippingFee === 0 ? 'text-green-600 font-medium' : 'text-gray-900'}>
                {orderInfo?.shippingFee === 0 ? '무료' : `${formatPrice(orderInfo?.shippingFee || 0)}원`}
              </span>
            </div>
            {(orderInfo?.discountAmount || 0) > 0 && (
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">할인 금액</span>
                <span className="text-red-600">-{formatPrice(orderInfo?.discountAmount || 0)}원</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-3">
              <span className="text-lg font-bold text-gray-900">총 결제금액</span>
              <span className="text-2xl font-bold text-blue-600">{formatPrice(paymentInfo?.amount || 0)}원</span>
            </div>
          </div>
        </div>

        {/* 결제 정보 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">결제 정보</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">결제 수단</span>
              <span className="font-semibold text-gray-900">{paymentInfo?.methodLabel}</span>
            </div>

            {/* 카드 결제인 경우 */}
            {paymentInfo?.card && (
              <>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">카드사</span>
                  <span className="text-gray-900">{paymentInfo.card.company}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">카드번호</span>
                  <span className="font-mono text-gray-900">{paymentInfo.card.number}</span>
                </div>
                {paymentInfo.card.installmentPlanMonths > 0 && (
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600">할부</span>
                    <span className="text-gray-900">{paymentInfo.card.installmentPlanMonths}개월</span>
                  </div>
                )}
              </>
            )}

            {/* 가상계좌인 경우 */}
            {paymentInfo?.virtualAccount && (
              <>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">은행</span>
                  <span className="text-gray-900">{paymentInfo.virtualAccount.bank}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">계좌번호</span>
                  <span className="font-mono text-gray-900">{paymentInfo.virtualAccount.accountNumber}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-600">입금 기한</span>
                  <span className="text-red-600 font-medium">
                    {formatDate(paymentInfo.virtualAccount.dueDate)}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">결제일시</span>
              <span className="text-gray-900">
                {paymentInfo?.approvedAt ? formatDate(paymentInfo.approvedAt) : '처리중'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">결제상태</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                완료
              </span>
            </div>
          </div>
        </div>

        {/* 배송 진행 상태 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">배송 안내</h2>
          </div>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200"></div>
            <div className="absolute left-6 top-8 h-8 w-0.5 bg-blue-500"></div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-lg shadow-blue-200">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div className="pt-2">
                  <p className="font-bold text-gray-900">주문 접수</p>
                  <p className="text-sm text-gray-500 mt-0.5">결제가 완료되어 주문이 접수되었습니다</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <span className="text-gray-500 font-bold">2</span>
                </div>
                <div className="pt-2">
                  <p className="font-medium text-gray-900">상품 준비</p>
                  <p className="text-sm text-gray-500 mt-0.5">판매자가 상품을 준비합니다</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 z-10">
                  <span className="text-gray-500 font-bold">3</span>
                </div>
                <div className="pt-2">
                  <p className="font-medium text-gray-900">배송 시작</p>
                  <p className="text-sm text-gray-500 mt-0.5">2~3일 내 배송이 시작됩니다</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/main"
            className="flex-1 bg-gray-900 text-white text-center py-4 rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            계속 쇼핑하기
          </Link>
          {isGuestOrder ? (
            <Link
              href={
                guestAccessToken && orderInfo?.id
                  ? `/order/guest/${orderInfo.id}?token=${encodeURIComponent(guestAccessToken)}`
                  : `/order/lookup?orderNumber=${paymentInfo?.orderId || ''}`
              }
              className="flex-1 border-2 border-gray-200 text-gray-700 text-center py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-5 h-5" />
              주문 상세 보기
            </Link>
          ) : (
            <Link
              href="/mypage/orders"
              className="flex-1 border-2 border-gray-200 text-gray-700 text-center py-4 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Clock className="w-5 h-5" />
              주문 내역 보기
            </Link>
          )}
        </div>

        {/* 고객센터 안내 */}
        <div className="mt-6 p-4 bg-gray-100 rounded-xl">
          <p className="text-sm text-gray-600 text-center">
            문의사항이 있으시면 고객센터 <span className="font-bold text-gray-900">1588-1234</span>로 연락해 주세요
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}
