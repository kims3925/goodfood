'use client'

import Link from 'next/link'

interface OrderSummaryProps {
  subtotal: number
  shippingFee: number
  discount?: number
  onCheckout?: () => void
}

export default function OrderSummary({
  subtotal,
  shippingFee,
  discount = 0,
  onCheckout,
}: OrderSummaryProps) {
  const formatPrice = (value: number) => {
    return value.toLocaleString('ko-KR')
  }

  const total = subtotal + shippingFee - discount

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
        <span className="font-medium text-gray-900">
          {shippingFee === 0 ? (
            <span className="text-primary-600">무료</span>
          ) : (
            `${formatPrice(shippingFee)}원`
          )}
        </span>
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

      {/* Free Shipping Notice */}
      {shippingFee > 0 && subtotal < 50000 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-primary-600">
              {formatPrice(50000 - subtotal)}원
            </span>{' '}
            더 구매하시면 무료배송!
          </p>
        </div>
      )}

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
