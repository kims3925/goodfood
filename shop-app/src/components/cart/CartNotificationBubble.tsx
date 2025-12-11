'use client'

import { useCartNotification } from '@/contexts/CartNotificationContext'
import { X } from 'lucide-react'
import Image from 'next/image'

export default function CartNotificationBubble() {
  const { isVisible, product, hideNotification } = useCartNotification()

  if (!isVisible || !product) return null

  return (
    <div className="absolute top-full right-0 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* 말풍선 꼬리 */}
      <div className="absolute -top-2 right-4 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>

      {/* 버블 내용 */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[280px] max-w-[320px]">
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
      </div>
    </div>
  )
}
