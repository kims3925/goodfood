import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, AUTH_COOKIE_NAMES } from '@/modules/auth/auth.service'

// sourcing-app에 접근 가능한 역할
const ALLOWED_ROLES = ['ADMIN', 'MANAGER']

/**
 * 요청에서 토큰을 추출한다.
 *
 * - admin path (/admin/*) → admin 쿠키 우선, manager → legacy 순으로 폴백
 * - 그 외 path → manager 쿠키 우선, admin → legacy 순으로 폴백
 *
 * 분리 쿠키가 도입되기 전 발급된 'auth-token' 도 폴백으로 인정.
 */
function readAuthToken(request: NextRequest, preferAdmin: boolean): string | null {
  const order = preferAdmin
    ? [AUTH_COOKIE_NAMES.ADMIN, AUTH_COOKIE_NAMES.MANAGER, AUTH_COOKIE_NAMES.LEGACY]
    : [AUTH_COOKIE_NAMES.MANAGER, AUTH_COOKIE_NAMES.ADMIN, AUTH_COOKIE_NAMES.LEGACY]
  for (const name of order) {
    const v = request.cookies.get(name)?.value
    if (v) return v
  }
  return null
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 인증이 필요 없는 경로
  const publicPaths = [
    '/login',
    '/register',
    '/seller/register',     // 셀러 통합 가입 (회원가입 + 쇼핑몰 발행)
    '/forbidden',
    '/create-admin',       // 관리자 계정 생성
    '/api/create-admin',   // 관리자 계정 생성 API
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/seller/register', // 셀러 통합 가입 API
    '/api/order/webhook',  // Google Forms 웹훅
    '/api/assets/',        // 이미지 등 정적 자산
    '/api/images/',        // 이미지 API
    '/api/cron/',          // 스케줄러 내부 호출
    '/api/extension/download', // 확장 프로그램 다운로드
    '/api/health',         // 헬스체크
  ]

  // Chrome Extension에서 band-session API 접근 허용 (PUT, POST 메서드)
  if (pathname.includes('/band-session') && (request.method === 'PUT' || request.method === 'POST')) {
    return NextResponse.next()
  }

  // CORS preflight 요청 허용
  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  // 랜딩페이지(/)는 공개
  if (pathname === '/') {
    return NextResponse.next()
  }

  // 공개 경로는 통과
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // /admin/login은 공개 경로 (어드민 전용 로그인 페이지)
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // path 에 따른 쿠키 우선순위 결정
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const token = readAuthToken(request, /* preferAdmin */ isAdminPath)

  // /admin 또는 /admin/* 경로 처리
  if (isAdminPath) {
    if (!token) {
      // 비로그인 → 어드민 로그인 페이지로
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const adminPayload = await verifyToken(token)

    if (!adminPayload) {
      // 토큰 무효 → 어드민 로그인 페이지로
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (adminPayload.role !== 'ADMIN') {
      // ADMIN이 아닌 역할 → 어드민 로그인 페이지로
      // (manager 쿠키가 폴백으로 매칭됐지만 role 이 ADMIN 이 아닌 경우)
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // ADMIN 역할 → /admin 정확 경로면 /admin/dashboard로 리다이렉트
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    // /admin/* 하위 경로는 그대로 진행
    return NextResponse.next()
  }

  // 매니저 관리(매니저 목록/추가)는 어드민 고유 기능 — 매니저가 직접 URL 로 접근해도 차단.
  // (어드민 패널의 /admin/users/* 로 일원화. /sourcing/user/profile 은 매니저 본인용이라 제외)
  if (pathname.startsWith('/sourcing/user/list') || pathname.startsWith('/sourcing/user/invite')) {
    const adminToken = readAuthToken(request, /* preferAdmin */ true)
    const adminOnlyPayload = adminToken ? await verifyToken(adminToken) : null
    if (!adminOnlyPayload || adminOnlyPayload.role !== 'ADMIN') {
      // 매니저/비인가 → 매니저 대시보드로 되돌림
      return NextResponse.redirect(new URL('/sourcing/dashboard', request.url))
    }
    return NextResponse.next()
  }

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

  // SNSAUTO Lite Manager (체험용 7일) — /lite/* 는 모든 인증 사용자 접근 허용
  // mode='lite' 인 셀러도 사용 가능 (USER role 포함). 정식 매니저 패널과 별개 트리.
  if (pathname.startsWith('/lite')) {
    return NextResponse.next()
  }

  // sourcing-app은 ADMIN 또는 MANAGER만 접근 가능
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
