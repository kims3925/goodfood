'use client'

import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'
import { useEffect, useState } from 'react'
import { useShopUrl } from '@/hooks/useShopUrl'

interface PaymentWidgetProps {
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
  customerPhone?: string
  amount: number
  tossClientKey?: string // 직접 전달 시 API 호출 스킵
  onPaymentSuccess?: (data: any) => void
  onPaymentFail?: (error: any) => void
  onPaymentCancel?: () => void
}

export default function TossPaymentWidget({
  orderId,
  orderName,
  customerEmail,
  customerName,
  customerPhone,
  amount,
  tossClientKey: propClientKey,
  onPaymentFail,
  onPaymentCancel
}: PaymentWidgetProps) {
  const { getPath, getApiPath } = useShopUrl()
  const [processing, setProcessing] = useState(false)
  const [clientKey, setClientKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // 클라이언트 키 가져오기 (prop으로 전달받으면 API 호출 스킵)
  useEffect(() => {
    // prop으로 클라이언트 키가 전달된 경우 바로 사용
    if (propClientKey) {
      console.log('[TossPayment] prop으로 전달된 클라이언트 키 사용')
      setClientKey(propClientKey)
      setReady(true)
      return
    }

    async function fetchClientKey() {
      console.log('[TossPayment] 클라이언트 키 로딩 시작')
      try {
        const response = await fetch(getApiPath('/api/shop/settings'))
        const data = await response.json()

        if (data.success && data.settings?.tossClientKey) {
          console.log('[TossPayment] 클라이언트 키 로드 성공:', data.settings.tossClientKey.substring(0, 20) + '...')
          setClientKey(data.settings.tossClientKey)
          setReady(true)
        } else {
          console.error('[TossPayment] 클라이언트 키 없음:', data)
          setError('토스 클라이언트 키가 설정되지 않았습니다')
        }
      } catch (err) {
        console.error('[TossPayment] 설정 로드 실패:', err)
        setError('설정을 불러오는데 실패했습니다')
      }
    }

    fetchClientKey()
  }, [propClientKey, getApiPath])

  // 결제 요청 (개별연동 방식 - payment() 사용)
  const handlePayment = async () => {
    if (!clientKey) {
      console.error('[TossPayment] 클라이언트 키가 없습니다')
      setError('결제 설정을 불러오는데 실패했습니다')
      return
    }

    console.log('=== 결제 요청 시작 (개별연동) ===')
    console.log('orderId:', orderId)
    console.log('orderName:', orderName)
    console.log('amount:', amount)
    console.log('customerName:', customerName)
    console.log('customerPhone:', customerPhone)

    try {
      setProcessing(true)

      // SDK 로드
      const tossPayments = await loadTossPayments(clientKey)
      console.log('[TossPayment] SDK 로드 완료')

      // customerKey 생성 (회원: 이메일 기반, 비회원: ANONYMOUS)
      const customerKey = customerEmail
        ? customerEmail.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50)
        : ANONYMOUS
      console.log('[TossPayment] customerKey:', customerKey)

      // 개별연동: payment() 객체 사용
      const payment = tossPayments.payment({ customerKey })
      console.log('[TossPayment] payment 인스턴스 생성 완료')

      // 결제창 호출 (카드 + 간편결제 통합)
      await payment.requestPayment({
        method: 'CARD', // 카드 + 간편결제 통합결제창
        amount: {
          currency: 'KRW',
          value: amount
        },
        orderId,
        orderName,
        successUrl: `${window.location.origin}${getPath('/payment/success')}`,
        failUrl: `${window.location.origin}${getPath('/payment/fail')}`,
        customerEmail,
        customerName,
        customerMobilePhone: customerPhone,
        card: {
          useEscrow: false,
          flowMode: 'DEFAULT',
          useCardPoint: false,
          useAppCardOnly: false,
        }
      })
      console.log('[TossPayment] requestPayment 호출 완료 (리다이렉트 대기)')

      // 리다이렉트 방식이므로 여기까지 도달하지 않음
    } catch (err: any) {
      console.error('=== 결제 요청 실패 ===')
      console.error('에러 코드:', err?.code)
      console.error('에러 메시지:', err?.message)
      console.error('전체 에러 객체:', err)

      // 사용자 취소 시에만 processing 해제하고 원래 화면으로
      if (err?.code === 'USER_CANCEL' || err?.code === 'PAY_PROCESS_CANCELED') {
        console.log('사용자가 결제를 취소했습니다')
        setProcessing(false)
        onPaymentCancel?.()
        return
      }

      // 다른 에러는 리다이렉트 중일 수 있으므로 processing 유지
      // 5초 후에도 리다이렉트되지 않으면 에러 처리
      console.log('5초 대기 후 에러 처리 예정')
      setTimeout(() => {
        console.log('5초 경과, 에러 처리 실행')
        setProcessing(false)
        onPaymentFail?.(err)
      }, 5000)
    }
  }

  // 에러 화면
  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm">
      {/* 결제 처리 중 오버레이 */}
      {processing && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-700 font-medium">결제 처리 중...</p>
          <p className="mt-2 text-gray-500 text-sm">잠시만 기다려주세요</p>
        </div>
      )}

      {/* 로딩 */}
      {!ready && !processing && (
        <div className="p-8 flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-600">결제 준비 중...</span>
        </div>
      )}

      {/* 주문 정보 */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="font-bold text-gray-900 text-lg mb-4">주문 정보</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">주문번호</span>
            <span className="font-mono text-gray-900">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">상품명</span>
            <span className="text-gray-900 truncate max-w-[200px]">{orderName}</span>
          </div>
          <div className="flex justify-between pt-3 border-t">
            <span className="font-medium text-base">결제 금액</span>
            <span className="text-2xl font-bold text-blue-600">{amount.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* 결제 버튼 영역 */}
      <div className="p-6">
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 text-center">
            결제하기 버튼을 누르면 토스페이먼츠 결제창이 열립니다.
          </p>
        </div>

        <button
          onClick={handlePayment}
          disabled={!ready || processing}
          className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? '결제 처리 중...' : `${amount.toLocaleString()}원 결제하기`}
        </button>
      </div>
    </div>
  )
}
