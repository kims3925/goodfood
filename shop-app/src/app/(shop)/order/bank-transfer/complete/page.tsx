'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Building2, Clock, Copy, ShoppingBag, FileText, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useShopUrl } from '@/hooks/useShopUrl'

function BankTransferCompleteContent() {
  const searchParams = useSearchParams()
  const { getPath } = useShopUrl()
  const [copied, setCopied] = useState(false)

  const orderNumber = searchParams.get('orderNumber') || ''
  const totalAmount = parseInt(searchParams.get('totalAmount') || '0')
  const bankName = searchParams.get('bankName') || ''
  const bankAccount = searchParams.get('bankAccount') || ''
  const accountHolder = searchParams.get('accountHolder') || ''
  const depositDeadline = searchParams.get('depositDeadline') || ''
  const orderedAt = searchParams.get('orderedAt') || ''
  // 비회원 관련 파라미터
  const isGuest = searchParams.get('isGuest') === 'true'
  const accessToken = searchParams.get('accessToken') || ''
  const orderId = searchParams.get('orderId') || ''

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR')
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  const copyAccountNumber = () => {
    navigator.clipboard.writeText(bankAccount)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!orderNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">주문 정보를 찾을 수 없습니다.</p>
          <Link
            href={getPath('/main')}
            className="text-[#FF6B6B] hover:underline"
          >
            쇼핑몰 홈으로 이동
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 성공 헤더 */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">주문이 완료되었습니다</h1>
            <p className="text-green-100">
              입금 확인 후 배송이 시작됩니다
            </p>
          </div>

          {/* 주문 정보 카드 */}
          <div className="bg-white rounded-b-2xl shadow-lg">
            {/* 주문번호 */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">주문번호</p>
                  <p className="font-mono text-lg font-semibold text-gray-900">{orderNumber}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(orderNumber)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="주문번호 복사"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 입금 계좌 정보 */}
            <div className="p-6 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-900">입금 계좌 안내</h2>
              </div>

              <div className="bg-white rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">은행</span>
                  <span className="font-semibold text-gray-900">{bankName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">계좌번호</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-gray-900">{bankAccount}</span>
                    <button
                      onClick={copyAccountNumber}
                      className={`px-3 py-1 text-xs rounded-lg transition-all ${
                        copied
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {copied ? '복사완료' : '복사'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">예금주</span>
                  <span className="font-semibold text-gray-900">{accountHolder}</span>
                </div>
                <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                  <span className="text-gray-500">입금 금액</span>
                  <span className="text-xl font-bold text-[#FF6B6B]">{formatPrice(totalAmount)}원</span>
                </div>
              </div>

              {/* 입금 기한 */}
              {depositDeadline && (
                <div className="mt-4 bg-blue-100 rounded-lg px-4 py-3 space-y-2">
                  {orderedAt && (
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm">주문 완료: {formatDate(orderedAt)}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-blue-800">
                    <Clock className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">
                        입금 기한: {formatDate(depositDeadline)}까지 (주문 후 3시간 이내)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 안내사항 */}
            <div className="p-6 bg-amber-50 border-b border-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 space-y-1">
                  <p className="font-medium">입금 시 주의사항</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-700">
                    <li>입금자명은 주문자명과 동일하게 해주세요</li>
                    <li>입금 기한 내 미입금 시 주문이 자동 취소됩니다</li>
                    <li>입금 확인 후 배송 준비가 시작됩니다</li>
                    <li>입금 확인은 영업일 기준 1-2일 소요될 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 비회원 주문 조회 안내 */}
            {isGuest && (
              <div className="p-6 bg-green-50 border-b border-green-100">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-2">비회원 주문 조회 안내</p>
                    <p className="text-green-700">
                      주문번호 <span className="font-mono font-semibold">{orderNumber}</span>와 휴대폰 번호로<br />
                      주문 조회 페이지에서 언제든 주문 현황을 확인하실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="p-6 space-y-3">
              <Link
                href={getPath('/main')}
                className="w-full py-4 bg-[#FF6B6B] text-white rounded-xl font-semibold text-center flex items-center justify-center gap-2 hover:bg-[#FF5252] transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                쇼핑 계속하기
              </Link>
              {isGuest ? (
                <Link
                  href={getPath(`/order/guest/${orderId}?token=${encodeURIComponent(accessToken)}`)}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  주문 상세 보기
                </Link>
              ) : (
                <Link
                  href={getPath('/mypage/orders')}
                  className="w-full py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  주문 내역 보기
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BankTransferCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BankTransferCompleteContent />
    </Suspense>
  )
}
