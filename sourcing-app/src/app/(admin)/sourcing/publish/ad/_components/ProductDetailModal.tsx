'use client'

import { X, ExternalLink } from 'lucide-react'

interface Props {
  productId: number | null
  onClose: () => void
}

/**
 * 상품 상세 페이지(`/sourcing/product/detail/[id]`)를 iframe으로 띄우는 팝업.
 * 발행 흐름을 끊지 않고 상품 정보를 빠르게 확인할 수 있게 한다.
 */
export default function ProductDetailModal({ productId, onClose }: Props) {
  if (productId == null) return null
  const url = `/sourcing/product/detail/${productId}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">상품 상세 #{productId}</h3>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="새 탭에서 열기"
            >
              <ExternalLink size={12} />
              새 탭
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <iframe
          key={productId}
          src={url}
          title={`상품 상세 ${productId}`}
          className="flex-1 w-full border-0 bg-gray-50"
          loading="eager"
        />
      </div>
    </div>
  )
}
