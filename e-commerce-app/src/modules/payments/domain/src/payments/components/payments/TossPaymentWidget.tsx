'use client'

/**
 * TossPaymentWidget - 토스페이먼츠 결제위젯 v2
 *
 * 공식 문서 기반 구현:
 * - https://docs.tosspayments.com/sdk/v2/js
 * - https://docs.tosspayments.com/guides/v2/payment-widget
 * - https://docs.tosspayments.com/blog/react-use-effect
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  getErrorMessage,
  getErrorSolution,
  isRetryableError,
  isUserCancelError,
  TOSS_ERROR_CODES
} from '../../constants/toss-error-codes'

// 토스페이먼츠 SDK v2 타입 정의
declare global {
  interface Window {
    TossPayments: (clientKey: string) => TossPaymentsInstance
  }
}

interface TossPaymentsInstance {
  widgets: (options: { customerKey: string }) => WidgetsInstance
}

// 위젯 객체 타입 (destroy 메서드 포함)
interface PaymentMethodWidget {
  destroy: () => Promise<void>
}

interface AgreementWidget {
  destroy: () => Promise<void>
  on: (event: string, callback: (status: { agreedRequiredTerms: boolean }) => void) => void
}

interface WidgetsInstance {
  setAmount: (amount: { currency: string; value: number }) => Promise<void>
  renderPaymentMethods: (options: {
    selector: string
    variantKey?: string
  }) => Promise<PaymentMethodWidget>
  renderAgreement: (options: {
    selector: string
    variantKey?: string
  }) => Promise<AgreementWidget>
  requestPayment: (options: {
    orderId: string
    orderName: string
    successUrl: string
    failUrl: string
    customerEmail?: string
    customerName?: string
    customerMobilePhone?: string
  }) => Promise<void>
}

interface PaymentWidgetProps {
  orderId: string
  orderName: string
  customerEmail?: string
  customerName?: string
  customerPhone?: string
  amount: number
  onPaymentSuccess?: (data: PaymentSuccessData) => void
  onPaymentFail?: (error: PaymentError) => void
  onPaymentCancel?: () => void
}

interface PaymentSuccessData {
  paymentKey: string
  orderId: string
  amount: number
}

interface PaymentError {
  code: string
  message: string
  orderId?: string
}

type WidgetStatus = 'loading' | 'ready' | 'error' | 'processing'

// SDK 스크립트 로드 상태 관리
let sdkLoadPromise: Promise<void> | null = null

/**
 * Toss SDK v2 스크립트를 로드합니다.
 * 한 번만 로드되며, 이후 호출은 기존 Promise를 반환합니다.
 */
function loadTossSDK(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise

  // 이미 로드된 경우
  if (typeof window !== 'undefined' && typeof window.TossPayments === 'function') {
    return Promise.resolve()
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    // 이미 스크립트가 있는지 확인
    const existingScript = document.querySelector(
      'script[src="https://js.tosspayments.com/v2/standard"]'
    ) as HTMLScriptElement

    if (existingScript) {
      // 스크립트가 이미 로드 완료된 경우
      if (typeof window.TossPayments === 'function') {
        resolve()
        return
      }
      // 로드 중인 경우 대기
      existingScript.addEventListener('load', () => {
        if (typeof window.TossPayments === 'function') {
          resolve()
        } else {
          reject(new Error('TossPayments SDK 로드 실패'))
        }
      })
      existingScript.addEventListener('error', () => {
        sdkLoadPromise = null
        reject(new Error('TossPayments SDK 로드 실패'))
      })
      return
    }

    // 새 스크립트 생성
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v2/standard'
    script.async = true

    script.onload = () => {
      // SDK가 준비될 때까지 대기
      const checkReady = setInterval(() => {
        if (typeof window.TossPayments === 'function') {
          clearInterval(checkReady)
          resolve()
        }
      }, 50)

      // 타임아웃 설정
      setTimeout(() => {
        clearInterval(checkReady)
        if (typeof window.TossPayments === 'function') {
          resolve()
        } else {
          reject(new Error('TossPayments SDK 초기화 타임아웃'))
        }
      }, 10000)
    }

    script.onerror = () => {
      sdkLoadPromise = null
      reject(new Error('TossPayments SDK 로드 실패'))
    }

    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

export default function TossPaymentWidget({
  orderId,
  orderName,
  customerEmail,
  customerName,
  customerPhone,
  amount,
  onPaymentSuccess,
  onPaymentFail,
  onPaymentCancel
}: PaymentWidgetProps) {
  const [widgets, setWidgets] = useState<WidgetsInstance | null>(null)
  const [status, setStatus] = useState<WidgetStatus>('loading')
  const [error, setError] = useState<PaymentError | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRY = 3

  // customerKey 안정적으로 유지 (컴포넌트 생애주기 동안 변경되지 않음)
  const customerKeyRef = useRef<string>('')
  if (!customerKeyRef.current) {
    // 비회원: ANONYMOUS, 회원: 이메일 기반 키 생성
    if (customerEmail) {
      customerKeyRef.current = customerEmail.replace(/[^a-zA-Z0-9\-_]/g, '_').substring(0, 50)
    } else {
      // 비회원 결제 - SDK에서 제공하는 ANONYMOUS 사용 권장
      customerKeyRef.current = `GUEST_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    }
  }

  // 마운트 상태 추적
  const isMountedRef = useRef(true)
  // 초기화 진행 중 플래그 (중복 초기화 방지)
  const isInitializingRef = useRef(false)
  // 렌더링된 위젯 인스턴스 저장 (cleanup 시 destroy 호출용)
  const paymentMethodWidgetRef = useRef<PaymentMethodWidget | null>(null)
  const agreementWidgetRef = useRef<AgreementWidget | null>(null)
  // 위젯 컨테이너 고유 ID (StrictMode 중복 렌더링 방지)
  const [widgetId] = useState(() => `toss-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`)

  // 위젯 정리 함수
  const cleanupWidgets = useCallback(async () => {
    // 약관 위젯 destroy (중요: 약관 위젯은 하나만 존재할 수 있음)
    if (agreementWidgetRef.current) {
      try {
        await agreementWidgetRef.current.destroy()
      } catch (e) {
        // destroy 실패해도 계속 진행
      }
      agreementWidgetRef.current = null
    }

    // 결제수단 위젯 destroy
    if (paymentMethodWidgetRef.current) {
      try {
        await paymentMethodWidgetRef.current.destroy()
      } catch (e) {
        // destroy 실패해도 계속 진행
      }
      paymentMethodWidgetRef.current = null
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    async function initWidget() {
      // 이미 초기화 중이면 중복 실행 방지
      if (isInitializingRef.current) {
        return
      }
      isInitializingRef.current = true

      try {
        setStatus('loading')
        setError(null)

        // 기존 위젯 정리 (React StrictMode에서 두 번 실행될 때 대비)
        await cleanupWidgets()

        // 1. SDK 로드
        await loadTossSDK()
        if (!isMountedRef.current) {
          isInitializingRef.current = false
          return
        }

        // 2. 클라이언트 키 가져오기
        const response = await fetch('/api/shop/settings')
        const data = await response.json()
        if (!isMountedRef.current) {
          isInitializingRef.current = false
          return
        }

        if (!data.success || !data.settings?.tossClientKey) {
          throw new Error('토스 클라이언트 키가 설정되지 않았습니다')
        }

        const clientKey = data.settings.tossClientKey

        // 3. 토스페이먼츠 초기화
        const tossPayments = window.TossPayments(clientKey)

        // 4. 위젯 인스턴스 생성
        const widgetsInstance = tossPayments.widgets({
          customerKey: customerKeyRef.current
        })

        // 5. 결제 금액 설정 (필수: 위젯 렌더링 전에 호출)
        await widgetsInstance.setAmount({
          currency: 'KRW',
          value: amount
        })
        if (!isMountedRef.current) {
          isInitializingRef.current = false
          return
        }

        // 6. DOM 요소 준비 대기 (고유 ID 사용)
        const paymentMethodSelector = `#payment-method-${widgetId}`
        const agreementSelector = `#agreement-${widgetId}`

        await new Promise<void>((resolve, reject) => {
          let attempts = 0
          const maxAttempts = 50
          const checkDOM = setInterval(() => {
            if (!isMountedRef.current) {
              clearInterval(checkDOM)
              reject(new Error('컴포넌트가 언마운트됨'))
              return
            }
            attempts++
            const paymentEl = document.querySelector(paymentMethodSelector)
            const agreementEl = document.querySelector(agreementSelector)

            if (paymentEl && agreementEl) {
              clearInterval(checkDOM)
              resolve()
            } else if (attempts >= maxAttempts) {
              clearInterval(checkDOM)
              reject(new Error('결제 위젯 DOM 요소를 찾을 수 없습니다'))
            }
          }, 100)
        })
        if (!isMountedRef.current) {
          isInitializingRef.current = false
          return
        }

        // 7. 결제수단 위젯 렌더링 (순차적으로 실행, 고유 selector 사용)
        const paymentMethodWidget = await widgetsInstance.renderPaymentMethods({
          selector: paymentMethodSelector,
          variantKey: 'DEFAULT'
        })
        paymentMethodWidgetRef.current = paymentMethodWidget

        if (!isMountedRef.current) {
          await cleanupWidgets()
          isInitializingRef.current = false
          return
        }

        // 8. 약관 위젯 렌더링 (결제수단 위젯 후에 순차적으로, 고유 selector 사용)
        const agreementWidget = await widgetsInstance.renderAgreement({
          selector: agreementSelector,
          variantKey: 'AGREEMENT'
        })
        agreementWidgetRef.current = agreementWidget

        if (!isMountedRef.current) {
          await cleanupWidgets()
          isInitializingRef.current = false
          return
        }

        setWidgets(widgetsInstance)
        setStatus('ready')
        setRetryCount(0)
        isInitializingRef.current = false

      } catch (err: any) {
        console.error('결제 위젯 초기화 오류:', err)
        isInitializingRef.current = false
        if (isMountedRef.current) {
          setError({
            code: TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
            message: err.message || '결제 위젯 로딩 실패'
          })
          setStatus('error')
        }
      }
    }

    initWidget()

    // Cleanup: 컴포넌트 언마운트 시 위젯 정리
    return () => {
      isMountedRef.current = false
      isInitializingRef.current = false
      // 위젯 destroy 호출 (비동기지만 cleanup에서는 await 불가)
      cleanupWidgets()
    }
  }, [amount, widgetId, cleanupWidgets])

  // 위젯 재시도
  const handleRetry = async () => {
    if (retryCount >= MAX_RETRY) {
      setError({
        code: TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
        message: '최대 재시도 횟수를 초과했습니다'
      })
      return
    }

    // 기존 위젯 정리 (destroy 호출)
    await cleanupWidgets()

    setWidgets(null)
    setRetryCount(prev => prev + 1)
    setStatus('loading')
    setError(null)
    isInitializingRef.current = false

    // 약간의 딜레이 후 페이지 새로고침으로 재시도
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }

  // 결제 요청
  const handlePayment = async () => {
    if (!widgets) {
      setError({
        code: TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
        message: '결제 위젯이 로드되지 않았습니다'
      })
      return
    }

    try {
      setStatus('processing')

      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/store/payment/success`,
        failUrl: `${window.location.origin}/store/payment/fail`,
        customerEmail,
        customerName,
        customerMobilePhone: customerPhone,
      })

      // 리다이렉트 방식이므로 여기까지 도달하지 않음

    } catch (err: any) {
      console.error('결제 요청 오류:', err)
      setStatus('ready')

      const errorCode = err.code || TOSS_ERROR_CODES.UNKNOWN_ERROR
      const paymentError: PaymentError = {
        code: errorCode,
        message: err.message || getErrorMessage(errorCode),
        orderId
      }

      setError(paymentError)

      // 사용자 취소인 경우
      if (isUserCancelError(errorCode)) {
        onPaymentCancel?.()
        return
      }

      // 에러 콜백
      onPaymentFail?.(paymentError)
    }
  }

  // 에러 화면
  if (status === 'error' && error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {getErrorMessage(error.code)}
          </h3>
          <p className="text-gray-500 text-center mb-6 max-w-sm">
            {getErrorSolution(error.code)}
          </p>
          <div className="flex gap-3">
            {isRetryableError(error.code) && retryCount < MAX_RETRY && (
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                다시 시도
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              페이지 새로고침
            </button>
          </div>
          {error.code && (
            <p className="text-xs text-gray-400 mt-4">
              에러 코드: {error.code}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm">
      {/* 로딩 오버레이 */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-600 mt-4 font-medium">결제 위젯 로딩 중...</p>
          </div>
        </div>
      )}

      {/* 처리 중 오버레이 */}
      {status === 'processing' && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-20 rounded-2xl">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-100 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-600 mt-4 font-medium">결제 처리 중...</p>
          </div>
        </div>
      )}

      {/* 결제 에러 토스트 */}
      {error && status === 'ready' && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">
                {getErrorMessage(error.code)}
              </p>
              <p className="text-sm text-red-600 mt-1">
                {getErrorSolution(error.code)}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-red-400 hover:text-red-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 주문 정보 요약 */}
      <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-bold text-gray-900 text-lg">주문 정보</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">주문번호</span>
            <span className="font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">{orderId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">상품명</span>
            <span className="text-gray-900 font-medium truncate max-w-[200px]">{orderName}</span>
          </div>
          {customerName && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">주문자</span>
              <span className="text-gray-900">{customerName}</span>
            </div>
          )}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-gray-700 font-medium">결제 금액</span>
              <span className="text-2xl font-bold text-blue-600">
                {amount.toLocaleString()}
                <span className="text-base font-normal ml-1">원</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 토스페이먼츠 결제 위젯 영역 */}
      <div className="p-5">
        {/* 결제 수단 선택 위젯 - Toss SDK가 이 요소 안에 렌더링 (고유 ID 사용) */}
        <div id={`payment-method-${widgetId}`}></div>

        {/* 약관 동의 위젯 - Toss SDK가 이 요소 안에 렌더링 (고유 ID 사용) */}
        <div id={`agreement-${widgetId}`} className="mt-4"></div>

        {/* 결제하기 버튼 */}
        <button
          onClick={handlePayment}
          disabled={status !== 'ready'}
          className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-bold text-lg shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {amount.toLocaleString()}원 결제하기
        </button>
      </div>

      {/* 안내사항 */}
      <div className="px-5 pb-5">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-gray-500 space-y-1">
              <p>결제는 토스페이먼츠를 통해 안전하게 처리됩니다.</p>
              <p>결제 완료 후 주문 확인 알림을 받으실 수 있습니다.</p>
              <p>문의사항은 고객센터로 연락해 주세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
