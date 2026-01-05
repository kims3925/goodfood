/**
 * Cloudinary 이미지 URL 생성 유틸리티
 *
 * Cloudinary fetch 기능을 사용하면 외부 이미지 URL을 Cloudinary를 통해
 * 최적화하여 제공할 수 있습니다. (업로드 없이 사용 가능)
 *
 * @see https://cloudinary.com/documentation/fetch_remote_images
 */

// 환경변수에서 Cloudinary 클라우드 이름 가져오기
// .env.local에 NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name 추가 필요
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''

interface CloudinaryOptions {
  width?: number
  height?: number
  quality?: number | 'auto'
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png'
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit'
  gravity?: 'auto' | 'face' | 'center'
}

/**
 * 외부 이미지 URL을 Cloudinary 최적화 URL로 변환
 *
 * @example
 * // 기본 사용
 * getCloudinaryUrl('https://example.com/image.jpg')
 *
 * // 옵션 지정
 * getCloudinaryUrl('https://example.com/image.jpg', {
 *   width: 400,
 *   height: 400,
 *   quality: 'auto',
 *   format: 'auto'
 * })
 */
export function getCloudinaryUrl(
  originalUrl: string,
  options: CloudinaryOptions = {}
): string {
  // Cloudinary 설정이 없으면 원본 URL 반환
  if (!CLOUD_NAME) {
    return originalUrl
  }

  // 이미 Cloudinary URL이면 그대로 반환
  if (originalUrl.includes('res.cloudinary.com')) {
    return originalUrl
  }

  // 빈 URL이나 로컬 이미지는 그대로 반환
  if (!originalUrl || originalUrl.startsWith('/') || originalUrl.startsWith('data:')) {
    return originalUrl
  }

  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'limit',
    gravity = 'auto',
  } = options

  // 변환 파라미터 생성
  const transformations: string[] = []

  if (width) transformations.push(`w_${width}`)
  if (height) transformations.push(`h_${height}`)
  if (crop) transformations.push(`c_${crop}`)
  if (gravity && (crop === 'fill' || crop === 'thumb')) {
    transformations.push(`g_${gravity}`)
  }
  transformations.push(`q_${quality}`)
  transformations.push(`f_${format}`)

  const transformString = transformations.join(',')

  // Cloudinary fetch URL 생성
  // fetch 기능: 외부 URL을 Cloudinary를 통해 제공
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformString}/${encodeURIComponent(originalUrl)}`
}

/**
 * 상품 이미지용 최적화 URL 생성
 */
export function getProductImageUrl(
  originalUrl: string,
  size: 'thumbnail' | 'card' | 'detail' | 'full' = 'card'
): string {
  const sizeConfig = {
    thumbnail: { width: 100, height: 100, crop: 'thumb' as const },
    card: { width: 400, height: 400, crop: 'limit' as const },
    detail: { width: 800, height: 800, crop: 'limit' as const },
    full: { width: 1200, height: 1200, crop: 'limit' as const },
  }

  return getCloudinaryUrl(originalUrl, {
    ...sizeConfig[size],
    quality: 'auto',
    format: 'auto',
  })
}

/**
 * 반응형 이미지 srcSet 생성
 */
export function getResponsiveSrcSet(
  originalUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280]
): string {
  if (!CLOUD_NAME) {
    return ''
  }

  return widths
    .map((w) => {
      const url = getCloudinaryUrl(originalUrl, { width: w, quality: 'auto', format: 'auto' })
      return `${url} ${w}w`
    })
    .join(', ')
}
