import { NextRequest, NextResponse } from 'next/server'

// 채널 정보 인메모리 캐시 (1분 TTL - 채널 삭제 시 빠른 반영을 위해)
const channelCache = new Map<string, { data: ChannelData | null; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1분 (삭제된 채널 빠른 반영)

// 캐시 무효화를 위한 전역 참조
declare global {
  var channelCacheRef: Map<string, { data: ChannelData | null; timestamp: number }> | null
}
global.channelCacheRef = channelCache

// 캐시 무효화 함수 (외부에서 호출 가능)
export function invalidateChannelCache(subdomain: string) {
  channelCache.delete(subdomain)
}

interface ChannelData {
  id: number
  subdomain: string
  name: string
  displayName: string | null
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

  // API 요청도 채널 헤더가 필요 (채널별 상품/장바구니 분리)
  const isApiRequest = pathname.startsWith('/api')

  // 채널 선택 페이지는 채널 식별 없이 접근 가능
  if (pathname === '/channel-select') {
    return NextResponse.next()
  }

  // 채널 식별
  const channelInfo = await identifyChannel(hostname, url.searchParams, request)

  // 채널 미식별 시 채널 선택 페이지로 리다이렉트
  if (!channelInfo.channelId) {
    // 루트 페이지 접근 시에만 리다이렉트
    if (pathname === '/' || pathname === '/main') {
      return NextResponse.redirect(new URL('/channel-select', request.url))
    }
    // 그 외 페이지는 일단 접근 허용 (개발 편의를 위해)
    return NextResponse.next()
  }

  // 채널 정보를 request headers에 추가
  // 주의: HTTP 헤더는 ASCII만 지원하므로 한글 이름은 제외 (layout에서 DB 조회)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-channel-id', String(channelInfo.channelId))
  requestHeaders.set('x-channel-subdomain', channelInfo.subdomain || '')

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

interface ChannelIdentifyResult {
  channelId: number | null
  subdomain: string | null
  channelName: string | null
}

async function identifyChannel(
  hostname: string,
  searchParams: URLSearchParams,
  request: NextRequest
): Promise<ChannelIdentifyResult> {
  // 1. 개발 환경: 쿼리 파라미터 우선 (?channel=xxx)
  const queryChannel = searchParams.get('channel')
  if (queryChannel) {
    const channel = await fetchChannelBySubdomain(queryChannel, request)
    if (channel && channel.isActive) {
      return {
        channelId: channel.id,
        subdomain: channel.subdomain,
        channelName: channel.displayName || channel.name,
      }
    }
  }

  // 2. 서브도메인 파싱
  const subdomain = extractSubdomain(hostname)

  // 루트 도메인 접속 (서브도메인 없음)
  if (!subdomain || subdomain === 'www') {
    return { channelId: null, subdomain: null, channelName: null }
  }

  // 3. 서브도메인으로 채널 조회
  const channel = await fetchChannelBySubdomain(subdomain, request)

  if (!channel || !channel.isActive) {
    return { channelId: null, subdomain: null, channelName: null }
  }

  return {
    channelId: channel.id,
    subdomain: channel.subdomain,
    channelName: channel.displayName || channel.name,
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
  // 예: channel1.lvh.me:3000 -> channel1
  if (hostWithoutPort.includes('lvh.me')) {
    const parts = hostWithoutPort.split('.')
    if (parts.length >= 3 && parts[0] !== 'www') {
      return parts[0]
    }
    return null
  }

  // 프로덕션 도메인
  // 예: channel1.shop.com -> channel1
  const parts = hostWithoutPort.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0]
  }

  return null
}

async function fetchChannelBySubdomain(
  subdomain: string,
  request: NextRequest
): Promise<ChannelData | null> {
  // 캐시 확인
  const cached = channelCache.get(subdomain)
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

    const res = await fetch(`${baseUrl}/api/internal/channel/${subdomain}`, {
      headers: {
        'x-internal-key': internalKey,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      channelCache.set(subdomain, { data: null, timestamp: Date.now() })
      return null
    }

    const data = await res.json()
    const channel = data.channel as ChannelData | null

    // 캐시 저장
    channelCache.set(subdomain, { data: channel, timestamp: Date.now() })

    return channel
  } catch (error) {
    console.error('Failed to fetch channel:', error)
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
