'use client'

import { useEffect, useRef, useState } from 'react'

// 토스페이먼츠 SDK v2 타입 정의
declare global {
  interface Window {
    TossPayments: any
  }
}

interface PaymentWidgetProps {
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
  amount: number
  onPaymentSuccess?: (payment: any) => void
  onPaymentFail?: (error: any) => void
}

export default function TossPaymentWidget({
  orderId,
  orderName,
  customerEmail,
  customerName,
  amount,
  onPaymentSuccess,
  onPaymentFail
}: PaymentWidgetProps) {
  const paymentMethodRef = useRef<HTMLDivElement>(null)
  const agreementRef = useRef<HTMLDivElement>(null)
  const [tossPayments, setTossPayments] = useState<any>(null)
  const [widgets, setWidgets] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Mock TossPayments 생성 (개발 환경용)
  const createMockTossPayments = () => {
    if (typeof window !== 'undefined') {
      (window as any).TossPayments = (clientKey: string) => ({
        widgets: (config: any) => {
          let currentAmount = 0

          return {
            setAmount: async (amount: any) => {
              console.log('Mock: setAmount', amount)
              currentAmount = amount.value || amount
              return Promise.resolve()
            },
            renderPaymentMethods: async (config: any) => {
              console.log('Mock: renderPaymentMethods', config)
              const element = document.querySelector(config.selector)
              if (element) {
                element.innerHTML = `
                  <div class="mock-payment-methods" style="padding: 20px; border: 2px dashed #ccc; text-align: center;">
                    <h3>개발 모드: 결제 수단 선택</h3>
                    <div style="margin: 10px 0;">
                      <input type="radio" id="card" name="payment" checked>
                      <label for="card">신용카드</label>
                    </div>
                    <div style="margin: 10px 0;">
                      <input type="radio" id="transfer" name="payment">
                      <label for="transfer">계좌이체</label>
                    </div>
                  </div>
                `
              }
              return Promise.resolve()
            },
            renderAgreement: async (config: any) => {
              console.log('Mock: renderAgreement', config)
              const element = document.querySelector(config.selector)
              if (element) {
                element.innerHTML = `
                  <div class="mock-agreement" style="padding: 10px; border: 1px solid #ccc;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                      <input type="checkbox" style="margin-right: 8px;" checked>
                      <span style="font-size: 14px;">결제 약관에 동의합니다 (개발 모드)</span>
                    </label>
                  </div>
                `
              }
              return Promise.resolve()
            },
            requestPayment: async (config: any) => {
              console.log('Mock: requestPayment', config)
              const confirmed = confirm(`개발 모드: 결제를 진행하시겠습니까?\n\n주문번호: ${config.orderId}\n주문명: ${config.orderName}\n금액: ${currentAmount.toLocaleString()}원`)
              if (confirmed) {
                // 개발 모드에서는 성공 페이지로 이동 (실제 amount 값 전달)
                window.location.href = config.successUrl + `?paymentKey=mock_payment_${Date.now()}&orderId=${config.orderId}&amount=${currentAmount}`
              } else {
                throw new Error('사용자가 결제를 취소했습니다.')
              }
            }
          }
        }
      })
      console.log('Mock TossPayments SDK 생성 완료')
    }
  }

  useEffect(() => {
    initializePaymentWidget()
  }, [])

  const initializePaymentWidget = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // 토스페이먼츠 SDK v2 스크립트 로드
      await loadTossPaymentsSDK()

      // 토스페이먼츠 결제위젯 클라이언트 키 가져오기
      const response = await fetch('/api/shop/settings')
      const data = await response.json()

      if (!data.success || !data.settings?.tossClientKey) {
        throw new Error('토스페이먼츠 결제위젯 클라이언트 키가 설정되지 않았습니다.')
      }

      const clientKey = data.settings.tossClientKey

      // 결제위젯 클라이언트 키 형식 확인
      if (!clientKey.startsWith('test_gck_') && !clientKey.startsWith('live_gck_')) {
        throw new Error('올바른 토스페이먼츠 결제위젯 클라이언트 키 형식이 아닙니다.')
      }

      // 토스페이먼츠 v2 초기화
      const tossPayments = window.TossPayments(clientKey)
      setTossPayments(tossPayments)

      // 고유 customerKey 생성 (토스페이먼츠 권장사항 적용)
      // 실제 환경에서는 로그인한 사용자 ID나 세션 기반 고유값 사용
      let customerKey = customerEmail || 'ANONYMOUS'

      // customerKey는 영문, 숫자, 특수문자(-,_)만 사용 가능
      customerKey = customerKey.replace(/[^a-zA-Z0-9\-_]/g, '_')

      console.log('토스페이먼츠 v2 초기화:', {
        clientKey: clientKey.substring(0, 20) + '...',
        customerKey,
        amount
      })

      // 위젯 초기화
      const widgets = tossPayments.widgets({
        customerKey: customerKey
      })
      setWidgets(widgets)

      // 결제 금액 설정
      await widgets.setAmount({
        value: amount,
        currency: 'KRW'
      })

      // 결제수단 UI 렌더링
      await widgets.renderPaymentMethods({
        selector: '#payment-method',
        variantKey: 'DEFAULT'
      })

      // 약관 UI 렌더링
      await widgets.renderAgreement({
        selector: '#agreement'
      })

      setIsLoading(false)
    } catch (err: any) {
      console.error('Payment Widget v2 초기화 실패:', err)

      // HTTP 로컈호스트 환경에서는 친화적인 메시지 표시
      if (window.location.protocol === 'http:' && window.location.hostname === 'localhost') {
        setError('개발 모드: 토스페이먼츠 SDK 로드 실패. Mock 결제 시스템을 사용합니다.')
      } else {
        setError(err.message || '결제 위젯 로드에 실패했습니다.')
      }
      setIsLoading(false)
    }
  }

  // 토스페이먼츠 SDK v2 스크립트 로드
  const loadTossPaymentsSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.TossPayments) {
        console.log('토스페이먼츠 SDK 이미 로드됨')
        resolve()
        return
      }

      console.log('토스페이먼츠 SDK 로드 시작...')
      const script = document.createElement('script')
      script.src = 'https://js.tosspayments.com/v2'
      script.async = true
      script.defer = true

      script.onload = () => {
        console.log('토스페이먼츠 SDK 로드 성공')
        // SDK 로드 후 약간의 대기 시간 추가
        setTimeout(() => {
          if (window.TossPayments) {
            resolve()
          } else {
            reject(new Error('토스페이먼츠 SDK 로드되었으나 TossPayments 객체를 찾을 수 없음'))
          }
        }, 100)
      }

      script.onerror = (error) => {
        console.error('토스페이먼츠 SDK 로드 오류:', error)
        console.log('현재 URL:', window.location.href)
        console.log('현재 프로토콜:', window.location.protocol)

        // 개발 환경에서 HTTP로 실행 중이고 SDK 로드가 실패한 경우 Mock 사용
        if (window.location.protocol === 'http:' && window.location.hostname === 'localhost') {
          console.warn('HTTP 로컈 환경에서 Mock TossPayments SDK 사용')
          createMockTossPayments()
          resolve()
        } else {
          reject(new Error(`토스페이먼츠 SDK 로드 실패. HTTPS 환경이 필요할 수 있습니다. (현재: ${window.location.protocol})`))
        }
      }

      document.head.appendChild(script)
    })
  }

  const handlePayment = async () => {
    if (!widgets) {
      alert('결제 위젯이 로드되지 않았습니다.')
      return
    }

    try {
      // 토스페이먼츠 v2 결제 요청
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/store/payment/success`,
        failUrl: `${window.location.origin}/store/payment/fail`,
        // v2에서는 고객 정보를 여기서 직접 전달하지 않음
        // customerKey로 이미 식별됨
      })
    } catch (error: any) {
      console.error('결제 요청 실패:', error)

      if (onPaymentFail) {
        onPaymentFail(error)
      } else {
        alert(`결제 실패: ${error.message || '알 수 없는 오류'}`)
      }
    }
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-red-800 font-medium">결제 위젯 오류</span>
        </div>
        <p className="text-red-700 text-sm mt-1">{error}</p>
        <button
          onClick={initializePaymentWidget}
          className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-8">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">결제 위젯을 로드하는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* 주문 정보 요약 */}
      <div className="p-4 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-2">주문 정보</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">주문번호:</span>
            <span className="font-mono text-gray-900">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">상품명:</span>
            <span className="text-gray-900 truncate ml-2">{orderName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">결제금액:</span>
            <span className="font-semibold text-blue-600">{amount.toLocaleString()}원</span>
          </div>
          {customerName && (
            <div className="flex justify-between">
              <span className="text-gray-600">주문자:</span>
              <span className="text-gray-900">{customerName}</span>
            </div>
          )}
        </div>
      </div>

      {/* 토스페이먼츠 결제 위젯 v2 */}
      <div className="p-4">
        <div id="payment-method" ref={paymentMethodRef}></div>
        <div id="agreement" ref={agreementRef} className="mt-4"></div>

        {/* 결제하기 버튼 */}
        <button
          onClick={handlePayment}
          className="w-full mt-6 bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
        >
          {amount.toLocaleString()}원 결제하기
        </button>
      </div>

      {/* 안내사항 */}
      <div className="px-4 pb-4">
        <div className="bg-gray-50 rounded p-3 text-xs text-gray-600">
          <p className="mb-1">• 토스페이먼츠를 통해 안전하게 결제됩니다.</p>
          <p className="mb-1">• 결제 완료 후 주문 확인 메시지를 보내드립니다.</p>
          <p>• 문의사항은 고객센터로 연락해 주세요.</p>
        </div>
      </div>
    </div>
  )
}