import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.')
}
const TOKEN_NAME = 'auth-token'

// jose는 Uint8Array 시크릿을 사용합니다
const secret = new TextEncoder().encode(JWT_SECRET)

export interface TokenPayload {
  userId: number
  email: string
  role: 'USER' | 'MANAGER' | 'ADMIN'
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
 * 쿠키에서 토큰 가져오기
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(TOKEN_NAME)?.value || null
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getTokenFromCookies()
  if (!token) return null
  return await verifyToken(token)
}

/**
 * 쿠키에 토큰 설정
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })
}

/**
 * 쿠키에서 토큰 삭제 (로그아웃)
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(TOKEN_NAME)
}
