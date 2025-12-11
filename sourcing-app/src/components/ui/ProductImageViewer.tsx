'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, Package, X, ExternalLink } from 'lucide-react'

interface ViewerImage {
  id: number
  url: string
  sortOrder?: number
}

interface ProductImageViewerProps {
  images: ViewerImage[]
  productName?: string
  enableLightbox?: boolean
  showThumbnails?: boolean
  thumbnailSize?: 'sm' | 'md' | 'lg'
}

export default function ProductImageViewer({
  images,
  productName = '',
  enableLightbox = true,
  showThumbnails = true,
  thumbnailSize = 'md',
}: ProductImageViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [imageError, setImageError] = useState<Record<number, boolean>>({})

  const sortedImages = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1))
  }, [sortedImages.length])

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0))
  }, [sortedImages.length])

  const handleImageError = (imageId: number) => {
    setImageError((prev) => ({ ...prev, [imageId]: true }))
  }

  const getThumbnailSizeClass = () => {
    switch (thumbnailSize) {
      case 'sm':
        return 'w-12 h-12'
      case 'lg':
        return 'w-20 h-20'
      case 'md':
      default:
        return 'w-16 h-16'
    }
  }

  // 이미지가 없는 경우
  if (!images || images.length === 0) {
    return (
      <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
        <Package size={48} className="text-gray-400" />
      </div>
    )
  }

  const currentImage = sortedImages[selectedIndex]

  return (
    <>
      {/* 메인 이미지 */}
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
        {imageError[currentImage?.id] ? (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={48} className="text-gray-400" />
          </div>
        ) : (
          <img
            src={currentImage?.url}
            alt={productName || `이미지 ${selectedIndex + 1}`}
            className="w-full h-full object-contain"
            onError={() => handleImageError(currentImage?.id)}
          />
        )}

        {/* 이미지 번호 표시 */}
        {sortedImages.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-sm px-2 py-1 rounded-full">
            {selectedIndex + 1} / {sortedImages.length}
          </div>
        )}

        {/* 네비게이션 버튼 */}
        {sortedImages.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* 확대 버튼 */}
        {enableLightbox && (
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ZoomIn size={18} />
          </button>
        )}
      </div>

      {/* 썸네일 */}
      {showThumbnails && sortedImages.length > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              className={`flex-shrink-0 ${getThumbnailSizeClass()} rounded-lg overflow-hidden border-2 transition-colors ${
                selectedIndex === index
                  ? 'border-purple-500 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {imageError[image.id] ? (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <Package size={16} className="text-gray-400" />
                </div>
              ) : (
                <img
                  src={image.url}
                  alt={`썸네일 ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={() => handleImageError(image.id)}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 라이트박스 */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={28} />
          </button>

          {/* 원본 보기 버튼 */}
          <a
            href={currentImage?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 left-4 p-2 text-white/80 hover:text-white transition-colors flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={20} />
            <span className="text-sm">원본</span>
          </a>

          {/* 이전 버튼 */}
          {sortedImages.length > 1 && (
            <button
              className="absolute left-4 p-2 text-white/80 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
            >
              <ChevronLeft size={36} />
            </button>
          )}

          {/* 이미지 */}
          <div
            className="max-w-[90vw] max-h-[85vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage?.url}
              alt={productName || `이미지 ${selectedIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>

          {/* 다음 버튼 */}
          {sortedImages.length > 1 && (
            <button
              className="absolute right-4 p-2 text-white/80 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
            >
              <ChevronRight size={36} />
            </button>
          )}

          {/* 이미지 카운터 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {selectedIndex + 1} / {sortedImages.length}
          </div>

          {/* 썸네일 (라이트박스 내) */}
          {sortedImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4 py-2 bg-black/50 rounded-lg max-w-[90vw] overflow-x-auto">
              {sortedImages.map((image, index) => (
                <button
                  key={image.id}
                  className={`w-12 h-12 rounded overflow-hidden border-2 flex-shrink-0 transition-colors ${
                    index === selectedIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedIndex(index)
                  }}
                >
                  <img
                    src={image.url}
                    alt={`썸네일 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
