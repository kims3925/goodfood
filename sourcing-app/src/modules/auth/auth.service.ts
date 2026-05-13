import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.')
}

/**
 * 쿠키 이름 정책 (admin/manager 세션 분리)
 * - ADMIN: 'auth-token-admin'
 * - MANAGER/USER 등: 'auth-token-manager'
 * - 'auth-token': 옛 쿠키명 (마이그레이션 폴백)
 *
 * 같은 브라우저에서 admin 과 manager 가 동시에 다른 탭에서 로그인해도
 * 세로 분리된 쿠키를 사용하므로 한 쪽 세션이 사라지지 않는다.
 */
const TOKEN_NAME_ADMIN = 'auth-token-admin'
const TOKEN_NAME_MANAGER = 'auth-token-manager'
const TOKEN_NAME_LEGACY = 'auth-token'

export type AuthRole = 'USER' | 'MANAGER' | 'ADMIN'

/**
 * role 에 따라 사용할 쿠키 이름 반환
 */
export function getTokenNameForRole(role: AuthRole): string {
  return role === 'ADMIN' ? TOKEN_NAME_ADMIN : TOKEN_NAME_MANAGER
}

/**
 * 요청 경로(pathname)에 따라 우선 시도할 쿠키 이름 반환.
 * - /admin/* 경로 → admin 쿠키 우선
 * - 그 외 → manager 쿠키 우선
 */
export function getPreferredTokenNameForPath(pathname: string): string {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return TOKEN_NAME_ADMIN
  }
  return TOKEN_NAME_MANAGER
}

/**
 * 분리된 쿠키 이름 상수들 (외부 사용 가능)
 */
export const AUTH_COOKIE_NAMES = {
  ADMIN: TOKEN_NAME_ADMIN,
  MANAGER: TOKEN_NAME_MANAGER,
  LEGACY: TOKEN_NAME_LEGACY,
} as const

// jose는 Uint8Array 시크릿을 사용합니다
const secret = new TextEncoder().encode(JWT_SECRET)

export interface TokenPayload {
  userId: number
  email: string
  role: AuthRole
}

/**
 * 비밀번호 해싱
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * JWT 토큰 생성
 */
export async function createToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

/**
 * JWT 토큰 검증
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as TokenPayload
  } catch (error) {
    return null
  }
}

/**
 * 쿠키에서 토큰 가져오기.
 * admin/manager/legacy 순으로 시도하여 첫 유효한 값을 반환.
 *
 * @param preferAdmin true 면 admin 쿠키를 먼저 시도. 기본 false (manager 먼저).
 */
export async function getTokenFromCookies(preferAdmin = false): Promise<string | null> {
  const cookieStore = await cookies()
  const order = preferAdmin
    ? [TOKEN_NAME_ADMIN, TOKEN_NAME_MANAGER, TOKEN_NAME_LEGACY]
    : [TOKEN_NAME_MANAGER, TOKEN_NAME_ADMIN, TOKEN_NAME_LEGACY]
  for (const name of order) {
    const v = cookieStore.get(name)?.value
    if (v) return v
  }
  return null
}

/**
 * 현재 로그인한 사용자 정보 가져오기.
 * 양쪽 쿠키를 모두 시도해서 먼저 valid 한 토큰의 payload 를 반환.
 *
 * @param preferAdmin true 면 admin 쿠키를 먼저 검사. 기본 false.
 */
export async function getCurrentUser(preferAdmin = false): Promise<TokenPayload | null> {
  const cookieStore = await cookies()
  const order = preferAdmin
    ? [TOKEN_NAME_ADMIN, TOKEN_NAME_MANAGER, TOKEN_NAME_LEGACY]
    : [TOKEN_NAME_MANAGER, TOKEN_NAME_ADMIN, TOKEN_NAME_LEGACY]
  for (const name of order) {
    const token = cookieStore.get(name)?.value
    if (!token) continue
    const payload = await verifyToken(token)
    if (payload) return payload
  }
  return null
}

/**
 * 쿠키에 토큰 설정. role 에 맞는 쿠키명을 사용한다.
 */
export async function setAuthCookie(token: string, role: AuthRole) {
  const cookieStore = await cookies()
  cookieStore.set(getTokenNameForRole(role), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })
}

/**
 * 쿠키에서 토큰 삭제 (로그아웃).
 * admin/manager/legacy 세 쿠키를 모두 삭제하여
 * 어느 세션에서 로그아웃하더라도 잔여 쿠키가 남지 않도록 한다.
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(TOKEN_NAME_ADMIN)
  cookieStore.delete(TOKEN_NAME_MANAGER)
  cookieStore.delete(TOKEN_NAME_LEGACY)
}
