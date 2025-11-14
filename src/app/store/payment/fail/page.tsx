'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { XCircle, ArrowLeft, RotateCcw, AlertTriangle } from 'lucide-react'

export default function PaymentFailPage() {
  const searchParams = useSearchParams()
  const [failureInfo, setFailureInfo] = useState<any>(null)

  const message = searchParams.get('message')
  const code = searchParams.get('code')
  const orderId = searchParams.get('orderId')

  useEffect(() => {
    setFailureInfo({
      message: message || '결제에 실패했습니다.',
      code: code || 'UNKNOWN_ERROR',
      orderId: orderId || null
    })
  }, [message, code, orderId])

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'PAY_PROCESS_CANCELED':
        return '사용자가 결제를 취소했습니다.'
      case 'PAY_PROCESS_ABORTED':
        return '결제가 중단되었습니다.'
      case 'REJECT_CARD_COMPANY':
        return '카드사에서 결제를 거부했습니다.'
      case 'INSUFFICIENT_BALANCE':
        return '잔액이 부족합니다.'
      case 'INVALID_CARD_EXPIRATION':
        return '카드 유효기간이 잘못되었습니다.'
      case 'INVALID_STOPPED_CARD':
        return '정지된 카드입니다.'
      case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
        return '일일 결제 한도를 초과했습니다.'
      case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT':
        return '할부가 지원되지 않는 카드입니다.'
      case 'INVALID_CARD_INSTALLMENT_PLAN':
        return '잘못된 할부 개월 수입니다.'
      case 'NOT_FOUND_TERMINAL_ID':
        return '터미널 ID를 찾을 수 없습니다.'
      case 'INVALID_AUTHORIZE_AUTH':
        return '유효하지 않은 인증입니다.'
      case 'INVALID_CARD_LOST_OR_STOLEN':
        return '분실 또는 도난 카드입니다.'
      case 'RESTRICTED_TRANSFER_ACCOUNT':
        return '이체 제한 계좌입니다.'
      case 'INVALID_ACCOUNT_INFO_RE_INPUT':
        return '계좌 정보를 다시 입력해 주세요.'
      case 'OTHER_DEFINITION_ERROR':
        return '기타 오류가 발생했습니다.'
      default:
        return failureInfo?.message || '알 수 없는 오류가 발생했습니다.'
    }
  }

  const getSolutionMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'PAY_PROCESS_CANCELED':
        return '다시 결제를 진행해 주세요.'
      case 'REJECT_CARD_COMPANY':
      case 'INSUFFICIENT_BALANCE':
        return '다른 결제 수단을 이용하거나 카드사에 문의해 주세요.'
      case 'INVALID_CARD_EXPIRATION':
      case 'INVALID_STOPPED_CARD':
        return '카드 정보를 확인하고 다른 카드를 이용해 주세요.'
      case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
        return '내일 다시 시도하거나 다른 카드를 이용해 주세요.'
      case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT':
        return '일시불로 결제하거나 다른 카드를 이용해 주세요.'
      default:
        return '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.'
    }
  }

  if (!failureInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 실패 메시지 */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">결제에 실패했습니다</h1>
              <p className="text-gray-600 mb-6">아래 내용을 확인하고 다시 시도해 주세요.</p>
            </div>
          </div>

          {/* 오류 정보 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              오류 정보
            </h2>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-800 mb-2">오류 내용</h3>
                <p className="text-red-700">{getErrorMessage(failureInfo.code)}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">해결 방법</h3>
                <p className="text-blue-700">{getSolutionMessage(failureInfo.code)}</p>
              </div>

              {failureInfo.orderId && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-800 mb-2">주문 정보</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">주문번호:</span>
                    <span className="font-mono text-gray-900">{failureInfo.orderId}</span>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 bg-gray-50 rounded p-3">
                <p className="mb-1"><strong>오류 코드:</strong> {failureInfo.code}</p>
                <p>이 정보는 고객센터 문의 시 도움이 됩니다.</p>
              </div>
            </div>
          </div>

          {/* 자주 발생하는 결제 실패 원인 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">자주 발생하는 결제 실패 원인</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">카드 한도 초과</p>
                  <p className="text-gray-600">일일/월간 사용한도나 잔액을 확인해 주세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">카드 정보 오류</p>
                  <p className="text-gray-600">카드번호, 유효기간, CVC 번호를 다시 확인해 주세요.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">해외 결제 차단</p>
                  <p className="text-gray-600">카드사에서 해외 결제를 차단한 경우입니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-900">네트워크 오류</p>
                  <p className="text-gray-600">인터넷 연결 상태를 확인하고 다시 시도해 주세요.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 고객센터 안내 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">고객센터 안내</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">전화번호:</span>
                  <span className="text-gray-900 font-medium">1588-1234</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">운영시간:</span>
                  <span className="text-gray-900">평일 09:00 - 18:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">이메일:</span>
                  <span className="text-gray-900">support@bandauto.com</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                문의 시 오류 코드({failureInfo.code})를 함께 알려주시면 더 빠른 도움을 받을 수 있습니다.
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-blue-600 text-white text-center py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              다시 결제하기
            </button>
            <Link
              href="/store"
              className="flex-1 border border-gray-300 text-gray-700 text-center py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              쇼핑몰 홈으로
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}