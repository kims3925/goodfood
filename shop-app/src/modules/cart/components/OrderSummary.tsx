'use client'

import Link from 'next/link'

interface OrderSummaryProps {
  subtotal: number
  discount?: number
  onCheckout?: () => void
}

export default function OrderSummary({
  subtotal,
  discount = 0,
  onCheckout,
}: OrderSummaryProps) {
  const formatPrice = (value: number) => {
    return value.toLocaleString('ko-KR')
  }

  const total = subtotal - discount

  return (
    <div className="order-summary">
      <h3 className="text-lg font-bold text-gray-900 mb-4">주문 요약</h3>

      {/* Summary Rows */}
      <div className="order-summary-row">
        <span className="text-gray-600">상품금액</span>
        <span className="font-medium text-gray-900">{formatPrice(subtotal)}원</span>
      </div>

      <div className="order-summary-row">
        <span className="text-gray-600">배송비</span>
        <span className="font-medium text-primary-600">포함</span>
      </div>

      {discount > 0 && (
        <div className="order-summary-row">
          <span className="text-gray-600">할인금액</span>
          <span className="font-medium text-sale">-{formatPrice(discount)}원</span>
        </div>
      )}

      {/* Total */}
      <div className="order-summary-total">
        <span>결제예정금액</span>
        <span className="text-primary-600">{formatPrice(total)}원</span>
      </div>

      {/* Checkout Button */}
      <div className="mt-6 space-y-3">
        {onCheckout ? (
          <button
            onClick={onCheckout}
            className="btn-primary btn-lg w-full"
          >
            주문하기
          </button>
        ) : (
          <Link href="/checkout" className="btn-primary btn-lg w-full block text-center">
            주문하기
          </Link>
        )}

        <Link
          href="/"
          className="btn-secondary btn-md w-full block text-center"
        >
          쇼핑 계속하기
        </Link>
      </div>

      {/* Notice */}
      <p className="mt-4 text-xs text-gray-500 text-center">
        주문 내용을 확인하였으며, 결제에 동의합니다.
      </p>
    </div>
  )
}
