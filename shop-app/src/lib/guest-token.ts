/**
 * 비회원 주문 접근 토큰 유틸리티
 * 주문번호 + 휴대폰번호로 검증 후 임시 토큰 발급
 */

import jwt from 'jsonwebtoken'

// JWT 시크릿 (환경변수에서 가져옴)
// 프로덕션 환경에서는 반드시 환경 변수 설정 필요
function getGuestTokenSecret(): string {
  const secret = process.env.GUEST_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('GUEST_TOKEN_SECRET or NEXTAUTH_SECRET is required in production')
  }
  return secret || 'dev-guest-order-secret-key'
}

const GUEST_TOKEN_SECRET = getGuestTokenSecret()
const TOKEN_EXPIRY = '1h' // 1시간

export interface GuestTokenPayload {
  guestOrderId: number
  phone: string
  orderNumber: string
  iat?: number
  exp?: number
}

/**
 * 비회원 접근 토큰 생성
 */
export function generateGuestAccessToken(
  guestOrderId: number,
  phone: string,
  orderNumber: string
): string {
  const payload: GuestTokenPayload = {
    guestOrderId,
    phone,
    orderNumber,
  }

  return jwt.sign(payload, GUEST_TOKEN_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  })
}

/**
 * 비회원 접근 토큰 검증
 */
export function verifyGuestAccessToken(token: string): GuestTokenPayload | null {
  try {
    const decoded = jwt.verify(token, GUEST_TOKEN_SECRET) as GuestTokenPayload
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * 요청 헤더에서 비회원 토큰 추출
 */
export function extractGuestTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null

  // Bearer 토큰 형식 확인
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}

/**
 * 토큰 만료 시간 계산 (초)
 */
export function getTokenExpirySeconds(): number {
  // 1시간 = 3600초
  return 3600
}
