'use client'

import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ExternalLink } from 'lucide-react'
import ImageWithFallback from './ImageWithFallback'

interface GalleryImage {
  id: number
  url: string
  sortOrder?: number
}

interface ImageGalleryProps {
  images: GalleryImage[]
  showThumbnails?: boolean
  enableLightbox?: boolean
  gridCols?: 2 | 3 | 4
  aspectRatio?: 'square' | 'video' | 'auto'
  thumbnailSize?: 'sm' | 'md' | 'lg'
}

export default function ImageGallery({
  images,
  showThumbnails = true,
  enableLightbox = true,
  gridCols = 4,
  aspectRatio = 'square',
  thumbnailSize = 'md',
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const sortedImages = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sortedImages.length - 1))
  }, [sortedImages.length])

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < sortedImages.length - 1 ? prev + 1 : 0))
  }, [sortedImages.length])

  const openLightbox = (index: number) => {
    if (enableLightbox) {
      setSelectedIndex(index)
      setLightboxOpen(true)
    }
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'Escape') closeLightbox()
    },
    [handlePrev, handleNext]
  )

  if (!images || images.length === 0) {
    return null
  }

  const getGridClass = () => {
    switch (gridCols) {
      case 2:
        return 'grid-cols-2'
      case 3:
        return 'grid-cols-2 md:grid-cols-3'
      case 4:
      default:
        return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    }
  }

  const getAspectClass = () => {
    switch (aspectRatio) {
      case 'video':
        return 'aspect-video'
      case 'auto':
        return ''
      case 'square':
      default:
        return 'aspect-square'
    }
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

  return (
    <>
      {/* 그리드 갤러리 */}
      <div className={`grid ${getGridClass()} gap-4`}>
        {sortedImages.map((image, index) => (
          <div
            key={image.id}
            className={`relative group ${getAspectClass()} rounded-lg overflow-hidden bg-gray-100 cursor-pointer`}
            onClick={() => openLightbox(index)}
          >
            <ImageWithFallback
              src={image.url}
              alt={`이미지 ${index + 1}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {/* 호버 오버레이 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <ZoomIn
                size={24}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
            {/* 이미지 번호 */}
            {sortedImages.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 라이트박스 */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {/* 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={closeLightbox}
          >
            <X size={28} />
          </button>

          {/* 원본 보기 버튼 */}
          <a
            href={sortedImages[selectedIndex]?.url}
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
              src={sortedImages[selectedIndex]?.url}
              alt={`이미지 ${selectedIndex + 1}`}
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

          {/* 썸네일 */}
          {showThumbnails && sortedImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-4 py-2 bg-black/50 rounded-lg">
              {sortedImages.map((image, index) => (
                <button
                  key={image.id}
                  className={`${getThumbnailSizeClass()} rounded overflow-hidden border-2 transition-colors ${
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

          {/* 이미지 카운터 */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {selectedIndex + 1} / {sortedImages.length}
          </div>
        </div>
      )}
    </>
  )
}
