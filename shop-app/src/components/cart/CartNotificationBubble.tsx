'use client'

import { useCartNotification } from '@/contexts/CartNotificationContext'
import { X } from 'lucide-react'
import Image from 'next/image'

interface CartNotificationBubbleProps {
  position?: 'top' | 'bottom'
}

export default function CartNotificationBubble({ position = 'top' }: CartNotificationBubbleProps) {
  const { isVisible, product, hideNotification } = useCartNotification()

  if (!isVisible || !product) return null

  const isBottom = position === 'bottom'

  return (
    <div className={`absolute z-50 animate-fade-in ${
      isBottom
        ? 'bottom-full left-1/2 -translate-x-1/2 mb-3 animate-slide-in-from-bottom-2'
        : 'top-full right-0 mt-2 animate-slide-in-from-top-2'
    }`}>
      {/* 말풍선 꼬리 */}
      <div className={`absolute w-4 h-4 bg-white transform rotate-45 ${
        isBottom
          ? '-bottom-2 left-1/2 -translate-x-1/2 border-r border-b border-gray-200'
          : '-top-2 right-4 border-l border-t border-gray-200'
      }`}></div>

      {/* 버블 내용 */}
      <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${
        isBottom ? 'px-4 py-2' : 'p-3 min-w-[280px] max-w-[320px]'
      }`}>
        {isBottom ? (
          // 모바일: 이미지 + 간결한 메시지
          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={product.image || '/images/placeholder.png'}
                alt={product.title}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
            <p className="text-sm text-gray-700 whitespace-nowrap">
              장바구니에 담겼습니다
            </p>
            <button
              onClick={hideNotification}
              className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          // 데스크톱: 상품 이미지 + 정보
          <div className="flex items-start gap-3">
            {/* 상품 이미지 */}
            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={product.image || '/images/placeholder.png'}
                alt={product.title}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>

            {/* 상품 정보 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                {product.title}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                장바구니에 상품을 담았습니다.
              </p>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={hideNotification}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
