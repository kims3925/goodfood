'use client'

/**
 * OptimizedImage Component
 * Next.js Image 컴포넌트를 래핑하여 에러 처리, 플레이스홀더, Cloudinary CDN 최적화 제공
 */

import Image, { ImageProps } from 'next/image'
import { useState, useCallback, useMemo } from 'react'
import { getCloudinaryUrl, getProductImageUrl } from '@/lib/cloudinary'

// 기본 플레이스홀더 이미지 (1x1 투명 픽셀)
const PLACEHOLDER_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAJpAN4pokyXwAAAABJRU5ErkJggg=='

// 기본 폴백 이미지
const DEFAULT_FALLBACK = '/images/placeholder.png'

// Cloudinary 사용 여부 (환경변수로 설정)
const USE_CLOUDINARY = !!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string
  showPlaceholder?: boolean
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  showPlaceholder = true,
  className,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(fallbackSrc)
    }
  }, [hasError, fallbackSrc])

  // src가 없거나 빈 문자열인 경우 폴백 사용
  const imageSrc = imgSrc || fallbackSrc

  return (
    <Image
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      placeholder={showPlaceholder ? 'blur' : 'empty'}
      blurDataURL={showPlaceholder ? PLACEHOLDER_BLUR : undefined}
      {...props}
    />
  )
}

/**
 * 상품 이미지용 컴포넌트
 * 상품 목록, 상세, 장바구니 등에서 사용
 * Cloudinary CDN을 통한 자동 최적화 지원
 */
interface ProductImageProps {
  src: string | null | undefined
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
  sizes?: string
  /** Cloudinary 이미지 크기 프리셋 */
  imageSize?: 'thumbnail' | 'card' | 'detail' | 'full'
}

export function ProductImage({
  src,
  alt,
  width = 300,
  height = 300,
  className = '',
  priority = false,
  fill = false,
  sizes,
  imageSize = 'card',
}: ProductImageProps) {
  // Cloudinary URL로 변환 (설정된 경우)
  const optimizedSrc = useMemo(() => {
    if (!src) return DEFAULT_FALLBACK
    if (USE_CLOUDINARY) {
      return getProductImageUrl(src, imageSize)
    }
    return src
  }, [src, imageSize])

  const [imgSrc, setImgSrc] = useState(optimizedSrc)
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(DEFAULT_FALLBACK)
    }
  }, [hasError])

  if (fill) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
        placeholder="blur"
        blurDataURL={PLACEHOLDER_BLUR}
        priority={priority}
        fill
        sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
        style={{ objectFit: 'cover' }}
        loading={priority ? 'eager' : 'lazy'}
      />
    )
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      placeholder="blur"
      blurDataURL={PLACEHOLDER_BLUR}
      priority={priority}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
    />
  )
}

/**
 * 아바타/프로필 이미지용 컴포넌트
 */
interface AvatarImageProps {
  src: string | null | undefined
  alt: string
  size?: number
  className?: string
}

export function AvatarImage({
  src,
  alt,
  size = 40,
  className = '',
}: AvatarImageProps) {
  const [imgSrc, setImgSrc] = useState(src || '/images/default-avatar.png')
  const [hasError, setHasError] = useState(false)

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
      setImgSrc('/images/default-avatar.png')
    }
  }, [hasError])

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={handleError}
    />
  )
}

export default OptimizedImage
