'use client'

import { useState } from 'react'
import { ImageIcon, Package } from 'lucide-react'

interface ThumbnailImageProps {
  src: string | null | undefined
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  fallbackIcon?: 'image' | 'package'
  className?: string
  badge?: React.ReactNode
  onClick?: () => void
}

const sizeClasses = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-24 h-24',
}

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
}

export default function ThumbnailImage({
  src,
  alt = '',
  size = 'md',
  rounded = 'md',
  fallbackIcon = 'image',
  className = '',
  badge,
  onClick,
}: ThumbnailImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const sizeClass = sizeClasses[size]
  const roundedClass = roundedClasses[rounded]
  const FallbackIcon = fallbackIcon === 'package' ? Package : ImageIcon

  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  const baseClasses = `${sizeClass} ${roundedClass} flex-shrink-0 overflow-hidden ${className}`
  const clickableClasses = onClick ? 'cursor-pointer' : ''

  // 이미지가 없거나 에러가 발생한 경우
  if (!src || hasError) {
    return (
      <div
        className={`${baseClasses} ${clickableClasses} bg-gray-100 flex items-center justify-center`}
        onClick={onClick}
      >
        <FallbackIcon
          size={size === 'xs' || size === 'sm' ? 16 : size === 'md' ? 20 : 24}
          className="text-gray-400"
        />
      </div>
    )
  }

  return (
    <div className={`${baseClasses} ${clickableClasses} relative bg-gray-100`} onClick={onClick}>
      {/* 로딩 상태 */}
      {isLoading && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}

      {/* 이미지 */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={handleError}
        onLoad={handleLoad}
      />

      {/* 배지 (선택사항) */}
      {badge && (
        <div className="absolute bottom-0 right-0">{badge}</div>
      )}
    </div>
  )
}
