import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/modules/auth/auth.service'

// sourcing-app에 접근 가능한 역할
const ALLOWED_ROLES = ['ADMIN', 'MANAGER']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 인증이 필요 없는 경로
  const publicPaths = [
    '/login',
    '/forbidden',
    '/create-admin',       // 관리자 계정 생성
    '/api/create-admin',   // 관리자 계정 생성 API
    '/api/auth/login',
    '/api/auth/logout',
    '/api/order/webhook',  // Google Forms 웹훅
    '/api/assets/',        // 이미지 등 정적 자산
    '/api/images/',        // 이미지 API
    '/api/cron/',          // 스케줄러 내부 호출
    '/api/extension/download', // 확장 프로그램 다운로드
  ]

  // Chrome Extension에서 band-session API 접근 허용 (PUT, POST 메서드)
  if (pathname.includes('/band-session') && (request.method === 'PUT' || request.method === 'POST')) {
    return NextResponse.next()
  }

  // CORS preflight 요청 허용
  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  // 공개 경로는 통과
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 쿠키에서 토큰 확인
  const token = request.cookies.get('auth-token')?.value

  if (!token) {
    // 로그인이 안 되어있으면 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 토큰 검증
  const payload = await verifyToken(token)

  if (!payload) {
    // 토큰이 유효하지 않으면 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // sourcing-app은 ADMIN 또는 SOURCING_USER만 접근 가능
  if (!ALLOWED_ROLES.includes(payload.role)) {
    return NextResponse.redirect(new URL('/forbidden', request.url))
  }

  return NextResponse.next()
}

// 미들웨어를 적용할 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
