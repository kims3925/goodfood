'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, Building, Smartphone, Wallet, AlertCircle } from 'lucide-react'

interface TossPaymentWidgetProps {
  orderId: string
  orderName: string
  customerName: string
  customerEmail?: string
  amount: number
  onPaymentSuccess?: (payment: any) => void
  onPaymentFail?: (error: any) => void
}

type PaymentMethod = 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE'

export default function TossPaymentWidget({
  orderId,
  orderName,
  customerName,
  customerEmail,
  amount,
  onPaymentSuccess,
  onPaymentFail,
}: TossPaymentWidgetProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CARD')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const widgetRef = useRef<any>(null)

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR')
  }

  const paymentMethods = [
    { id: 'CARD', name: '신용/체크카드', icon: CreditCard, description: '일시불 및 할부 결제' },
    { id: 'VIRTUAL_ACCOUNT', name: '가상계좌', icon: Building, description: '무통장 입금' },
    { id: 'TRANSFER', name: '계좌이체', icon: Wallet, description: '실시간 계좌이체' },
    { id: 'MOBILE', name: '휴대폰결제', icon: Smartphone, description: '통신사 소액결제' },
  ]

  useEffect(() => {
    // Toss Payments SDK 로드
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment-widget'
    script.async = true

    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).PaymentWidget) {
        const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'
        const customerKey = `customer_${Date.now()}`

        widgetRef.current = (window as any).PaymentWidget(clientKey, customerKey)
      }
    }

    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const handlePayment = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // 실제 결제 요청
      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          orderName,
          amount,
          paymentMethod: selectedMethod,
          customerName,
          customerEmail,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Toss Payments 결제 위젯 호출
        if (widgetRef.current) {
          await widgetRef.current.requestPayment({
            orderId,
            orderName,
            amount,
            customerName,
            customerEmail: customerEmail || undefined,
            successUrl: `${window.location.origin}/store/payment/success`,
            failUrl: `${window.location.origin}/store/payment/fail`,
          })
        } else {
          // 테스트 모드: SDK가 로드되지 않은 경우
          // 바로 성공 페이지로 이동
          window.location.href = `/store/payment/success?orderId=${orderId}&paymentKey=test_${Date.now()}&amount=${amount}`
        }
      } else {
        throw new Error(data.error || '결제 준비 중 오류가 발생했습니다.')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || '결제 처리 중 오류가 발생했습니다.')
      onPaymentFail?.(err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 결제 금액 */}
      <div className="text-center mb-6 pb-6 border-b">
        <p className="text-sm text-gray-500 mb-1">결제 금액</p>
        <p className="text-3xl font-bold text-blue-600">{formatPrice(amount)}원</p>
      </div>

      {/* 결제 수단 선택 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">결제 수단 선택</h3>
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map((method) => {
            const Icon = method.icon
            const isSelected = selectedMethod === method.id

            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-6 h-6 mx-auto mb-2 ${
                  isSelected ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  isSelected ? 'text-blue-600' : 'text-gray-700'
                }`}>
                  {method.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 주문 정보 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">주문 정보</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">주문번호</span>
            <span className="text-gray-900">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">상품명</span>
            <span className="text-gray-900 truncate max-w-[200px]">{orderName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">주문자</span>
            <span className="text-gray-900">{customerName}</span>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 결제 버튼 */}
      <button
        onClick={handlePayment}
        disabled={isProcessing}
        className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            결제 처리중...
          </span>
        ) : (
          `${formatPrice(amount)}원 결제하기`
        )}
      </button>

      {/* 안내 문구 */}
      <p className="mt-4 text-xs text-gray-500 text-center">
        결제 버튼을 클릭하시면 결제 대행사 페이지로 이동합니다.
      </p>
    </div>
  )
}
