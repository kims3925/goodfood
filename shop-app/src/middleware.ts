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
export function invalidateShopCache(subdomain: string) {
  shopCache.delete(subdomain)
}

interface ShopData {
  id: number
  subdomain: string
  name: string
  isActive: boolean
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  const pathname = url.pathname

  // 정적 파일, _next, internal API 등은 건너뜀
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/internal')
  ) {
    return NextResponse.next()
  }

  // API 요청도 Shop 헤더가 필요 (Shop별 상품/장바구니 분리)
  const isApiRequest = pathname.startsWith('/api')

  // 인증 관련 페이지는 건너뜀
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // 404 페이지는 건너뜀
  if (pathname === '/not-authorized') {
    return NextResponse.next()
  }

  // Shop 식별
  const shopInfo = await identifyShop(hostname, url.searchParams, request)

  // Shop 미식별 시 접근 불가
  if (!shopInfo.shopId) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    }
    return NextResponse.redirect(new URL('/not-authorized', request.url))
  }

  // Shop 정보를 request headers에 추가
  // 주의: HTTP 헤더는 ASCII만 지원하므로 한글 이름은 제외 (layout에서 DB 조회)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-shop-id', String(shopInfo.shopId))
  requestHeaders.set('x-shop-subdomain', shopInfo.subdomain || '')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

interface ShopIdentifyResult {
  shopId: number | null
  subdomain: string | null
  shopName: string | null
}

async function identifyShop(
  hostname: string,
  searchParams: URLSearchParams,
  request: NextRequest
): Promise<ShopIdentifyResult> {
  // 1. 개발 환경: 쿼리 파라미터 우선 (?shop=xxx)
  const queryShop = searchParams.get('shop') || searchParams.get('channel') // 하위호환
  if (queryShop) {
    const shop = await fetchShopBySubdomain(queryShop, request)
    if (shop && shop.isActive) {
      return {
        shopId: shop.id,
        subdomain: shop.subdomain,
        shopName: shop.name,
      }
    }
  }

  // 2. 서브도메인 파싱
  const subdomain = extractSubdomain(hostname)

  // 루트 도메인 접속 (서브도메인 없음)
  if (!subdomain || subdomain === 'www') {
    return { shopId: null, subdomain: null, shopName: null }
  }

  // 3. 서브도메인으로 Shop 조회
  const shop = await fetchShopBySubdomain(subdomain, request)

  if (!shop || !shop.isActive) {
    return { shopId: null, subdomain: null, shopName: null }
  }

  return {
    shopId: shop.id,
    subdomain: shop.subdomain,
    shopName: shop.name,
  }
}

function extractSubdomain(hostname: string): string | null {
  // 포트 제거
  const hostWithoutPort = hostname.replace(/:\d+$/, '')

  // localhost는 서브도메인 없음
  if (hostWithoutPort === 'localhost') {
    return null
  }

  // lvh.me 사용 (로컬 개발용)
  // 예: shop1.lvh.me:3000 -> shop1
  if (hostWithoutPort.includes('lvh.me')) {
    const parts = hostWithoutPort.split('.')
    if (parts.length >= 3 && parts[0] !== 'www') {
      return parts[0]
    }
    return null
  }

  // 프로덕션 도메인
  // 예: shop1.shop.com -> shop1
  const parts = hostWithoutPort.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0]
  }

  return null
}

async function fetchShopBySubdomain(
  subdomain: string,
  request: NextRequest
): Promise<ShopData | null> {
  // 캐시 확인
  const cached = shopCache.get(subdomain)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  try {
    // Internal API 호출
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    // lvh.me 서브도메인의 경우 lvh.me:3000으로 요청
    const baseHost = host.includes('lvh.me') ? 'lvh.me:3000' : host.replace(/^[^.]+\./, '')
    const baseUrl = `${protocol}://${baseHost}`

    const internalKey = process.env.INTERNAL_API_KEY || 'dev-internal-key'

    const res = await fetch(`${baseUrl}/api/internal/shop/${subdomain}`, {
      headers: {
        'x-internal-key': internalKey,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      shopCache.set(subdomain, { data: null, timestamp: Date.now() })
      return null
    }

    const data = await res.json()
    const shop = data.shop as ShopData | null

    // 캐시 저장
    shopCache.set(subdomain, { data: shop, timestamp: Date.now() })

    return shop
  } catch (error) {
    console.error('Failed to fetch shop:', error)
    return null
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/internal (internal APIs)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    '/((?!api/internal|_next/static|_next/image|favicon.ico|images).*)',
  ],
}
