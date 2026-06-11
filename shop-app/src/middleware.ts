import { NextRequest, NextResponse } from 'next/server'

// Shop 정보 인메모리 캐시 (1분 TTL - 삭제 시 빠른 반영을 위해)
const shopCache = new Map<string, { data: ShopData | null; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1분 (삭제된 Shop 빠른 반영)

// 캐시 무효화를 위한 전역 참조
declare global {
  var shopCacheRef: Map<string, { data: ShopData | null; timestamp: number }> | null
}
global.shopCacheRef = shopCache

// 캐시 무효화 함수 (외부에서 호출 가능)
export function invalidateShopCache(slug: string) {
  shopCache.delete(slug)
}

interface ShopData {
  id: number
  subdomain: string // DB 필드명은 유지 (slug로 사용)
  name: string
  isActive: boolean
  coverUrl?: string | null
  theme?: {
    primaryColor?: string | null
    secondaryColor?: string | null
    logoUrl?: string | null
    faviconUrl?: string | null
    bannerUrl?: string | null
  } | null
}

// Shop slug로 시작하지 않는 시스템 경로들
const SYSTEM_PATHS = [
  '/api',
  '/auth',
  '/_next',
  '/images',
  '/favicon',
]

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // 정적 파일, _next 등은 건너뜀
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Internal API는 건너뜀
  if (pathname.startsWith('/api/internal')) {
    return NextResponse.next()
  }

  // Health Check API는 건너뜀
  if (pathname === '/api/health') {
    return NextResponse.next()
  }

  // NextAuth API는 shop context 없이도 허용
  // NextAuth 콜백 URL은 /api/auth/... 형태로 고정되어 있음
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // 경로에서 Shop slug 추출
  const { slug, actualPath } = extractShopSlug(pathname)

  // API 요청 처리 (slug가 있는 경우)
  // /shop1/api/... → slug=shop1, actualPath=/api/...
  const isApiRequest = actualPath.startsWith('/api')

  // 인증 관련 페이지 (slug 컨텍스트 내에서)
  // /shop1/auth/... → slug=shop1, actualPath=/auth/...
  if (actualPath.startsWith('/auth') || actualPath.startsWith('/api/auth')) {
    if (!slug) {
      return new NextResponse('Shop not found', { status: 404 })
    }
    // Shop 정보 조회
    const shop = await fetchShopBySlug(slug, request)
    if (!shop || !shop.isActive) {
      return new NextResponse('Shop not found', { status: 404 })
    }

    // URL rewrite + 헤더 추가
    url.pathname = actualPath
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-shop-id', String(shop.id))
    requestHeaders.set('x-shop-slug', shop.subdomain)

    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    })
  }

  // Shop slug가 없으면 루트 페이지 (Shop 선택 페이지 또는 404)
  if (!slug) {
    // 개발 환경: 쿼리 파라미터로 Shop 지정 (?shop=xxx)
    const queryShop = url.searchParams.get('shop')
    if (queryShop) {
      const shop = await fetchShopBySlug(queryShop, request)
      if (shop && shop.isActive) {
        // 해당 Shop으로 리다이렉트
        url.pathname = `/${shop.subdomain}${pathname === '/' ? '/main' : pathname}`
        url.searchParams.delete('shop')
        return NextResponse.redirect(url)
      }
    }
    // 기본 샵 리다이렉트 (2026-06-11): 단일샵 도메인(굿푸드몰 goodshop.hublink.im) 운영용.
    // DEFAULT_SHOP_SLUG 환경변수가 설정되어 있으면 루트 접속 시 해당 샵으로 이동.
    const defaultSlug = process.env.DEFAULT_SHOP_SLUG
    if (defaultSlug) {
      const shop = await fetchShopBySlug(defaultSlug, request)
      if (shop && shop.isActive) {
        url.pathname = `/${shop.subdomain}${pathname === '/' ? '/main' : pathname}`
        return NextResponse.redirect(url)
      }
    }
    return new NextResponse('Shop not found. Please access via shop URL like /your-shop/main', { status: 404 })
  }

  // Shop 정보 조회
  const shop = await fetchShopBySlug(slug, request)

  // Shop 미식별 시 접근 불가
  if (!shop || !shop.isActive) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    return new NextResponse('Shop not found', { status: 404 })
  }

  // /shop1 접속 시 /shop1/main으로 리다이렉트
  if (actualPath === '/') {
    url.pathname = `/${slug}/main`
    return NextResponse.redirect(url)
  }

  // URL rewrite: /shop1/main → /main (내부적으로)
  url.pathname = actualPath

  // Shop 정보를 request headers에 추가
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-shop-id', String(shop.id))
  requestHeaders.set('x-shop-slug', shop.subdomain)

  return NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  })
}

interface ExtractResult {
  slug: string | null
  actualPath: string
}

function extractShopSlug(pathname: string): ExtractResult {
  // /로 시작하면 첫 번째 / 제거 후 분리
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return { slug: null, actualPath: '/' }
  }

  const firstSegment = segments[0]

  // 시스템 경로인 경우 slug 없음
  if (SYSTEM_PATHS.some(path => pathname.startsWith(path))) {
    return { slug: null, actualPath: pathname }
  }

  // 첫 번째 세그먼트가 slug
  const slug = firstSegment
  const remainingPath = '/' + segments.slice(1).join('/')

  return {
    slug,
    actualPath: remainingPath || '/main', // 기본 경로는 /main
  }
}

async function fetchShopBySlug(
  slug: string,
  request: NextRequest
): Promise<ShopData | null> {
  // 캐시 확인
  const cached = shopCache.get(slug)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    // Internal API 호출
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    const internalKey = process.env.INTERNAL_API_KEY || 'dev-internal-key'

    const res = await fetch(`${baseUrl}/api/internal/shop/${slug}`, {
      headers: {
        'x-internal-key': internalKey,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      shopCache.set(slug, { data: null, timestamp: Date.now() })
      return null
    }

    const data = await res.json()
    const shop = data.shop as ShopData | null

    // 캐시 저장
    shopCache.set(slug, { data: shop, t