'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Package, Clock, ArrowLeft } from 'lucide-react'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [paymentInfo, setPaymentInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  useEffect(() => {
    if (paymentKey && orderId && amount) {
      confirmPayment()
    } else {
      setError('결제 정보가 누락되었습니다.')
      setIsLoading(false)
    }
  }, [paymentKey, orderId, amount])

  const confirmPayment = async () => {
    try {
      setIsLoading(true)

      // 토스페이먼츠 결제 승인 API 호출
      const response = await fetch('/api/payments/confirm', {
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

        // 주문 정보 추가 조회
        const orderResponse = await fetch(`/api/orders?orderNumber=${orderId}`)
        const orderData = await orderResponse.json()

        if (orderData.success) {
          setPaymentInfo({
            ...data.payment,
            order: orderData.order
          })
        }
      } else {
        setError(data.error || '결제 승인에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('결제 승인 오류:', error)
      setError('결제 승인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">결제를 확인하고 있습니다...</p>
            <p className="text-sm text-gray-500 mt-2">잠시만 기다려 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">결제 확인 실패</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <Link
                href="/store"
                className="block w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                쇼핑몰 홈으로
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 성공 메시지 */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">결제가 완료되었습니다!</h1>
              <p className="text-gray-600 mb-6">주문해 주셔서 감사합니다.</p>

              {paymentInfo?.order && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-blue-800 font-medium">
                    {paymentInfo.order.customer?.name}님의 주문이 접수되었습니다.
                  </p>
                  <p className="text-blue-600 text-sm mt-1">
                    주문 확인 후 2-3일 내에 배송 시작됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 주문 정보 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">주문 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">주문번호</span>
                <span className="font-mono text-gray-900">{paymentInfo?.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">상품명</span>
                <span className="text-gray-900">{paymentInfo?.orderName}</span>
              </div>
              {paymentInfo?.order && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수량</span>
                    <span className="text-gray-900">{paymentInfo.order.quantity}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">상품금액</span>
                    <span className="text-gray-900">{formatPrice(paymentInfo.order.subtotal)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">배송비</span>
                    <span className="text-gray-900">
                      {paymentInfo.order.shippingFee > 0 ? `${formatPrice(paymentInfo.order.shippingFee)}원` : '무료'}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">총 결제금액</span>
                  <span className="text-blue-600 font-bold text-lg">{formatPrice(paymentInfo?.totalAmount)}원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 결제 정보 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">결제 정보</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">결제방법</span>
                <span className="text-gray-900">{paymentInfo?.method || '토스페이먼츠'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">결제일시</span>
                <span className="text-gray-900">
                  {paymentInfo?.approvedAt ? formatDate(paymentInfo.approvedAt) : '처리중'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">결제상태</span>
                <span className="text-green-600 font-medium">완료</span>
              </div>
            </div>
          </div>

          {/* 배송 안내 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              배송 안내
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 text-sm font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">주문 확인</p>
                  <p className="text-sm text-gray-600">주문이 접수되어 확인 중입니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 text-sm font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">상품 준비</p>
                  <p className="text-sm text-gray-600">도매업체에서 상품을 준비합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 text-sm font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">배송 시작</p>
                  <p className="text-sm text-gray-600">2-3일 내 배송 시작 예정입니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/store"
              className="flex-1 bg-gray-600 text-white text-center py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              계속 쇼핑하기
            </Link>
            {paymentInfo?.order && (
              <Link
                href={`/store/orders/${paymentInfo.order.id}`}
                className="flex-1 border border-gray-300 text-gray-700 text-center py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                주문 상세보기
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}