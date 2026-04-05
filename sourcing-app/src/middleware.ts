import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/modules/auth/auth.service'

// sourcing-appì ì ê·¼ ê°ë¥í ì­í 
const ALLOWED_ROLES = ['ADMIN', 'MANAGER']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ì¸ì¦ì´ íì ìë ê²½ë¡
  const publicPaths = [
    '/login',
    '/register',
    '/forbidden',
    '/create-admin',       // ê´ë¦¬ì ê³ì  ìì±
    '/api/create-admin',   // ê´ë¦¬ì ê³ì  ìì± API
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/order/webhook',  // Google Forms ì¹í
    '/api/assets/',        // ì´ë¯¸ì§ ë± ì ì  ìì°
    '/api/images/',        // ì´ë¯¸ì§ API
    '/api/cron/',          // ì¤ì¼ì¤ë¬ ë´ë¶ í¸ì¶
    '/api/extension/download', // íì¥ íë¡ê·¸ë¨ ë¤ì´ë¡ë
    '/api/health',         // í¬ì¤ì²´í¬
  ]

  // Chrome Extensionìì band-session API ì ê·¼ íì© (PUT, POST ë©ìë)
  if (pathname.includes('/band-session') && (request.method === 'PUT' || request.method === 'POST')) {
    return NextResponse.next()
  }

  // CORS preflight ìì²­ íì©
  if (request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  // ëë©íì´ì§(/)ë ê³µê°
  if (pathname === '/') {
    return NextResponse.next()
  }

  // ê³µê° ê²½ë¡ë íµê³¼
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // ì¿ í¤ìì í í° íì¸
  const token = request.cookies.get('auth-token')?.value

  // /admin/loginì ê³µê° ê²½ë¡ (ì´ëë¯¼ ì ì© ë¡ê·¸ì¸ íì´ì§)
  if (pathname === '/admin/login') {
    return NextResponse.next()
  }

  // /admin ëë /admin/* ê²½ë¡ ì²ë¦¬
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!token) {
      // ë¹ë¡ê·¸ì¸ â ì´ëë¯¼ ë¡ê·¸ì¸ íì´ì§ë¡
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const adminPayload = await verifyToken(token)

    if (!adminPayload) {
      // í í° ë¬´í¨ â ì´ëë¯¼ ë¡ê·¸ì¸ íì´ì§ë¡
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (adminPayload.role !== 'ADMIN') {
      // ADMINì´ ìë ì­í  â ì´ëë¯¼ ë¡ê·¸ì¸ íì´ì§ë¡
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // ADMIN ì­í  â /admin ì í ê²½ë¡ë©´ /admin/dashboardë¡ ë¦¬ë¤ì´ë í¸
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    // /admin/* íì ê²½ë¡ë ê·¸ëë¡ ì§í
    return NextResponse.next()
  }

  if (!token) {
    // ë¡ê·¸ì¸ì´ ì ëì´ìì¼ë©´ ë¡ê·¸ì¸ íì´ì§ë¡ ë¦¬ë¤ì´ë í¸
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // í í° ê²ì¦
  const payload = await verifyToken(token)

  if (!payload) {
    // í í°ì´ ì í¨íì§ ìì¼ë© ë¡ê·¸ì¸ íì´ì§ë¡ ë¦¬ë¤ì´ë í¸
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // sourcing-appì ADMIN ëë MANAGERë§ ì ê·¼ ê°ë¥
  if (!ALLOWED_ROLES.includes(payload.role)) {
    return NextResponse.redirect(new URL('/forbidden', request.url))
  }

  return NextResponse.next()
}

// ë¯¸ë¤ì¨ì´ë¥¼ ì ì©í  ê²½ë¡ ì¤ì 
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
}ï¿½
