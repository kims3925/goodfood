'use client'

/**
 * OptimizedImage Component
 * Next.js Image 컴포넌트를 래핑하여 에러 처리 및 플레이스홀더 기능 제공
 */

import Image, { ImageProps } from 'next/image'
import { useState, useCallback, useEffect } from 'react'

// 기본 플레이스홀더 이미지 (1x1 투명 픽셀)
const PLACEHOLDER_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAJpAN4pokyXwAAAABJRU5ErkJggg=='

// 기본 폴백 이미지
const DEFAULT_FALLBACK = '/images/placeholder.png'

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

  // src props 변경 시 상태 동기화
  useEffect(() => {
    setImgSrc(src)
    setHasError(false)
  }, [src])

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
}: ProductImageProps) {
  const [imgSrc, setImgSrc] = useState(src || DEFAULT_FALLBACK)
  const [hasError, setHasError] = useState(false)

  // src 변경 시 상태 동기화
  useEffect(() => {
    setImgSrc(src || DEFAULT_FALLBACK)
    setHasError(false)
  }, [src])

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
        sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
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
  const defaultAvatar = '/images/default-avatar.png'
  const [imgSrc, setImgSrc] = useState(src || defaultAvatar)
  const [hasError, setHasError] = useState(false)

  // src props 변경 시 상태 동기화
  useEffect(() => {
    setImgSrc(src || defaultAvatar)
    setHasError(false)
  }, [src])

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(defaultAvatar)
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
