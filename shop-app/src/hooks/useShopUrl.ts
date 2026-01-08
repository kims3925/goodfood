'use client'

import { useCallback } from 'react'
import { useShop } from '@/contexts/ShopContext'

/**
 * Shop 경로 기반 URL 생성 hook
 *
 * 사용 예시:
 * const { getPath, getFullUrl } = useShopUrl()
 *
 * <Link href={getPath('/main')}>메인</Link>
 * // 결과: /shop1/main
 *
 * router.push(getPath('/cart'))
 * // 결과: /shop1/cart
 */
export function useShopUrl() {
  const { shop } = useShop()
  const slug = shop?.subdomain

  /**
   * Shop slug가 포함된 경로 반환
   * @param path 경로 (예: '/main', '/cart')
   * @returns slug가 포함된 경로 (예: '/shop1/main')
   */
  const getPath = useCallback((path: string) => {
    if (!slug) return path
    // path가 /로 시작하면 그대로, 아니면 / 추가
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `/${slug}${normalizedPath}`
  }, [slug])

  /**
   * 전체 URL 반환 (외부 링크용, 결제 콜백 등)
   * @param path 경로
   * @returns 전체 URL
   */
  const getFullUrl = useCallback((path: string) => {
    const shopDomain = process.env.NEXT_PUBLIC_SHOP_DOMAIN || 'localhost:3000'
    const protocol = shopDomain.includes('localhost') ? 'http' : 'https'
    const pathWithSlug = getPath(path)
    return `${protocol}://${shopDomain}${pathWithSlug}`
  }, [getPath])

  /**
   * API 경로 반환 (Shop slug 포함)
   * 미들웨어가 slug를 추출하여 x-shop-id 헤더를 설정함
   * @param apiPath API 경로 (예: '/api/cart')
   * @returns slug가 포함된 API 경로 (예: '/shop1/api/cart')
   */
  const getApiPath = useCallback((apiPath: string) => {
    if (!slug) return apiPath
    const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
    return `/${slug}${normalizedPath}`
  }, [slug])

  return {
    slug,
    getPath,
    getFullUrl,
    getApiPath,
  }
}

/**
 * 서버 컴포넌트에서 사용할 유틸 함수
 * headers에서 shop-slug를 가져와 경로 생성
 */
export function getShopPath(slug: string | null, path: string): string {
  if (!slug) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `/${slug}${normalizedPath}`
}
