'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageIcon, Package } from 'lucide-react'

interface ImageWithFallbackProps {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  className?: string
  fallbackClassName?: string
  fallbackIcon?: 'image' | 'package'
  priority?: boolean
  quality?: number
  onClick?: () => void
}

export default function ImageWithFallback({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes,
  className = '',
  fallbackClassName = '',
  fallbackIcon = 'image',
  priority = false,
  quality = 75,
  onClick,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  // 이미지가 없거나 에러가 발생한 경우 fallback 표시
  if (!src || hasError) {
    const FallbackIcon = fallbackIcon === 'package' ? Package : ImageIcon
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 ${fallbackClassName || className}`}
        onClick={onClick}
      >
        <FallbackIcon size={24} className="text-gray-400" />
      </div>
    )
  }

  // 외부 URL인지 확인 (http:// 또는 https://로 시작)
  const isExternalUrl = src.startsWith('http://') || src.startsWith('https://')

  // 외부 URL인 경우 일반 img 태그 사용
  if (isExternalUrl) {
    return (
      <div className={`relative ${fill ? 'w-full h-full' : ''}`} onClick={onClick}>
        {isLoading && (
          <div className={`absolute inset-0 bg-gray-100 animate-pulse ${className}`} />
        )}
        <img
          src={src}
          alt={alt}
          className={className}
          onError={handleError}
          onLoad={handleLoad}
          style={fill ? { objectFit: 'cover', width: '100%', height: '100%' } : undefined}
        />
      </div>
    )
  }

  // 내부 URL인 경우 Next.js Image 컴포넌트 사용
  if (fill) {
    return (
      <div className="relative w-full h-full" onClick={onClick}>
        {isLoading && (
          <div className={`absolute inset-0 bg-gray-100 animate-pulse ${className}`} />
        )}
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes || '(max-width: 768px) 100vw, 50vw'}
          className={className}
          onError={handleError}
          onLoad={handleLoad}
          priority={priority}
          quality={quality}
        />
      </div>
    )
  }

  return (
    <div className="relative" onClick={onClick}>
      {isLoading && (
        <div
          className={`absolute inset-0 bg-gray-100 animate-pulse ${className}`}
          style={{ width, height }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={width || 100}
        height={height || 100}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        priority={priority}
        quality={quality}
      />
    </div>
  )
}
