'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  XCircle,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Phone,
  Mail,
  Clock,
  CreditCard,
  Ban,
  Wallet,
  RefreshCcw,
  Shield,
  HelpCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react'
import {
  TOSS_ERROR_CODES,
  getErrorMessage,
  getErrorSolution,
  isRetryableError,
  isUserCancelError,
  isCardError,
  isBalanceError,
  getErrorDetails
} from '@/modules/payments/constants/toss-error-codes'

function PaymentFailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [failureInfo, setFailureInfo] = useState<{
    message: string
    code: string
    orderId: string | null
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [showFaq, setShowFaq] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const message = searchParams.get('message')
  const code = searchParams.get('code')
  const orderId = searchParams.get('orderId')

  // 주문 삭제 함수
  const deleteFailedOrder = useCallback(async (orderNumber: string) => {
    if (isDeleting) return

    try {
      setIsDeleting(true)
      console.log('결제 실패로 인한 주문 상태 업데이트:', orderNumber)

      const response = await fetch(`/api/orders/${orderNumber}/fail`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          failureCode: code,
          failureMessage: message
        })
      })

      if (response.ok) {
        setDeleteStatus('success')
        console.log('주문 상태 업데이트 완료:', orderNumber)
      } else {
        setDeleteStatus('error')
        console.warn('주문 상태 업데이트 실패')
      }
    } catch (error) {
      setDeleteStatus('error')
      console.error('주문 상태 업데이트 오류:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [code, message, isDeleting])

  useEffect(() => {
    const errorCode = code || 'UNKNOWN_ERROR'
    const errorDetails = getErrorDetails(errorCode)

    setFailureInfo({
      message: message || errorDetails.message || '결제에 실패했습니다.',
      code: errorCode,
      orderId: orderId || null
    })

    // 결제 실패 시 주문 상태 업데이트 (사용자 취소가 아닌 경우만)
    if (orderId && !isUserCancelError(errorCode)) {
      deleteFailedOrder(orderId)
    }
  }, [message, code, orderId, deleteFailedOrder])

  // 에러 코드 복사
  const copyErrorCode = async () => {
    if (!failureInfo) return
    try {
      await navigator.clipboard.writeText(`오류 코드: ${failureInfo.code}\n주문번호: ${failureInfo.orderId || '없음'}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('복사 실패:', error)
    }
  }

  // 재시도 핸들러
  const handleRetry = () => {
    if (retryCount >= 3) {
      return
    }
    setRetryCount(prev => prev + 1)
    router.back()
  }

  // 에러 타입에 따른 아이콘 선택
  const getErrorIcon = (errorCode: string) => {
    if (isUserCancelError(errorCode)) {
      return <Ban className="w-12 h-12 text-gray-500" />
    }
    if (isCardError(errorCode)) {
      return <CreditCard className="w-12 h-12 text-red-500" />
    }
    if (isBalanceError(errorCode)) {
      return <Wallet className="w-12 h-12 text-orange-500" />
    }
    return <XCircle className="w-12 h-12 text-red-600" />
  }

  // 에러 타입에 따른 배경색 선택
  const getErrorBgColor = (errorCode: string) => {
    if (isUserCancelError(errorCode)) {
      return 'bg-gradient-to-br from-gray-100 to-gray-200'
    }
    if (isCardError(errorCode)) {
      return 'bg-gradient-to-br from-red-100 to-red-200'
    }
    if (isBalanceError(errorCode)) {
      return 'bg-gradient-to-br from-orange-100 to-orange-200'
    }
    return 'bg-gradient-to-br from-red-100 to-red-200'
  }

  // 에러 타입에 따른 타이틀 색상
  const getErrorTitleColor = (errorCode: string) => {
    if (isUserCancelError(errorCode)) {
      return 'text-gray-700'
    }
    return 'text-red-700'
  }

  // 에러 타입에 따른 메인 메시지
  const getMainMessage = (errorCode: string) => {
    if (isUserCancelError(errorCode)) {
      return '결제가 취소되었습니다'
    }
    if (isCardError(errorCode)) {
      return '카드 결제에 실패했습니다'
    }
    if (isBalanceError(errorCode)) {
      return '잔액이 부족합니다'
    }
    return '결제에 실패했습니다'
  }

  if (!failureInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600 mx-auto mb-4"></div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  const errorDetails = getErrorDetails(failureInfo.code)
  const isUserCancel = isUserCancelError(failureInfo.code)
  const isRetryable = isRetryableError(failureInfo.code)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        {/* 메인 실패 카드 */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          {/* 헤더 영역 */}
          <div className={`${getErrorBgColor(failureInfo.code)} px-8 py-10 text-center`}>
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg">
              {getErrorIcon(failureInfo.code)}
            </div>
            <h1 className={`text-2xl font-bold ${getErrorTitleColor(failureInfo.code)} mb-2`}>
              {getMainMessage(failureInfo.code)}
            </h1>
            <p className="text-gray-600">
              {isUserCancel
                ? '언제든지 다시 결제를 진행하실 수 있습니다.'
                : '아래 내용을 확인하고 다시 시도해 주세요.'
              }
            </p>
          </div>

          {/* 에러 상세 정보 */}
          <div className="p-6 space-y-4">
            {/* 오류 내용 */}
            <div className={`${isUserCancel ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'} border rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 ${isUserCancel ? 'text-gray-500' : 'text-red-500'} flex-shrink-0 mt-0.5`} />
                <div>
                  <h3 className={`font-semibold ${isUserCancel ? 'text-gray-700' : 'text-red-700'} mb-1`}>
                    오류 내용
                  </h3>
                  <p className={`${isUserCancel ? 'text-gray-600' : 'text-red-600'}`}>
                    {getErrorMessage(failureInfo.code) || failureInfo.message}
                  </p>
                </div>
              </div>
            </div>

            {/* 해결 방법 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-700 mb-1">해결 방법</h3>
                  <p className="text-blue-600">
                    {getErrorSolution(failureInfo.code)}
                  </p>
                </div>
              </div>
            </div>

            {/* 주문 정보 */}
            {failureInfo.orderId && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-500">주문번호</span>
                    <p className="font-mono text-gray-900 font-medium">{failureInfo.orderId}</p>
                  </div>
                  <button
                    onClick={copyErrorCode}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="오류 정보 복사"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 오류 코드 정보 */}
            <div className="flex items-center justify-between text-sm bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Shield className="w-4 h-4" />
                <span>오류 코드: <code className="font-mono bg-white px-2 py-0.5 rounded text-gray-700">{failureInfo.code}</code></span>
              </div>
              {isRetryable && (
                <span className="flex items-center gap-1 text-green-600">
                  <RefreshCcw className="w-3 h-3" />
                  재시도 가능
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {isRetryable ? (
            <button
              onClick={handleRetry}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 font-medium"
            >
              <RotateCcw className="w-5 h-5" />
              다시 결제하기
            </button>
          ) : (
            <Link
              href="/cart"
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-center py-4 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 font-medium"
            >
              <CreditCard className="w-5 h-5" />
              장바구니로 이동
            </Link>
          )}
          <Link
            href="/main"
            className="flex-1 bg-white border-2 border-gray-200 text-gray-700 text-center py-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-md flex items-center justify-center gap-2 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            쇼핑 계속하기
          </Link>
        </div>

        {/* 자주 발생하는 결제 실패 원인 (접이식) */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              자주 발생하는 결제 실패 원인
            </h2>
            {showFaq ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showFaq && (
            <div className="px-6 pb-6 border-t border-gray-100">
              <div className="space-y-4 mt-4">
                {/* 카드 관련 */}
                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-red-50 to-transparent rounded-xl">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">카드 한도 초과</h3>
                    <p className="text-sm text-gray-600">일일/월간 사용한도나 잔액을 확인해 주세요. 카드사 앱에서 한도를 확인할 수 있습니다.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-orange-50 to-transparent rounded-xl">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">카드 정보 오류</h3>
                    <p className="text-sm text-gray-600">카드번호, 유효기간, CVC 번호를 다시 확인해 주세요. 정지된 카드는 사용할 수 없습니다.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-transparent rounded-xl">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Ban className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">결제 차단</h3>
                    <p className="text-sm text-gray-600">해외 결제 차단 또는 온라인 결제 차단이 설정되어 있을 수 있습니다. 카드사에 문의해 주세요.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-transparent rounded-xl">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <RefreshCcw className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">네트워크 오류</h3>
                    <p className="text-sm text-gray-600">인터넷 연결 상태를 확인하고 다시 시도해 주세요. 일시적인 오류일 수 있습니다.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 고객센터 안내 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-500" />
            고객센터 안내
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a
              href="tel:1588-1234"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">전화문의</p>
                <p className="font-semibold text-gray-900">1588-1234</p>
              </div>
            </a>

            <a
              href="mailto:support@abcpharm.net"
              className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">이메일</p>
                <p className="font-semibold text-gray-900 text-sm">문의하기</p>
              </div>
            </a>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">운영시간</p>
                <p className="font-semibold text-gray-900 text-sm">09:00-18:00</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p className="text-sm text-yellow-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                문의 시 <strong>오류 코드({failureInfo.code})</strong>를 함께 알려주시면 더 빠른 도움을 받을 수 있습니다.
              </span>
            </p>
          </div>
        </div>

        {/* 토스페이먼츠 고객센터 링크 */}
        <div className="text-center mb-8">
          <a
            href="https://www.tosspayments.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span>결제 서비스 관련 문의는 토스페이먼츠 고객센터를 이용해 주세요</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* 에러 코드별 상세 설명 (개발자 모드) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-900 rounded-2xl p-6 text-white mb-6">
            <h3 className="text-sm font-mono text-gray-400 mb-3">Developer Info</h3>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify({
                code: failureInfo.code,
                message: failureInfo.message,
                orderId: failureInfo.orderId,
                errorDetails: {
                  ...errorDetails,
                },
                isRetryable,
                isUserCancel,
                isCardError: isCardError(failureInfo.code),
                isBalanceError: isBalanceError(failureInfo.code),
              }, null, 2)}
            </pre>
          </div>
        )}

      </div>

      {/* 로딩 오버레이 */}
      {isDeleting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600 text-sm">주문 정보 처리 중...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 로딩 폴백
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600 mx-auto mb-4"></div>
        <p className="text-gray-500">결제 정보 확인 중...</p>
      </div>
    </div>
  )
}

// 메인 페이지 컴포넌트 with Suspense
export default function PaymentFailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentFailContent />
    </Suspense>
  )
}
