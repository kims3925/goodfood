/**
 * Rate Limiting 유틸리티
 * 메모리 기반 간단한 Rate Limiter (단일 서버용)
 * 멀티 서버 환경에서는 Redis 기반으로 교체 필요
 */

interface RateLimitRecord {
  count: number
  timestamp: number
}

// 메모리 스토어
const rateLimitStore = new Map<string, RateLimitRecord>()

// 주기적으로 만료된 레코드 정리 (메모리 누수 방지)
const CLEANUP_INTERVAL = 60 * 1000 // 1분마다
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.timestamp > windowMs) {
      rateLimitStore.delete(key)
    }
  }
}

export interface RateLimitConfig {
  // 허용 요청 수
  maxRequests: number
  // 시간 윈도우 (밀리초)
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // 리셋까지 남은 시간 (초)
}

/**
 * Rate Limit 체크
 * @param identifier 식별자 (IP 주소, 사용자 ID 등)
 * @param config Rate Limit 설정
 * @returns RateLimitResult
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { maxRequests, windowMs } = config
  const now = Date.now()

  // 만료된 레코드 정리
  cleanup(windowMs)

  const record = rateLimitStore.get(identifier)

  // 레코드가 없거나 윈도우가 지났으면 새로 시작
  if (!record || now - record.timestamp > windowMs) {
    rateLimitStore.set(identifier, { count: 1, timestamp: now })
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.ceil(windowMs / 1000),
    }
  }

  // 요청 수 증가
  record.count++

  // 제한 초과 체크
  const remaining = Math.max(0, maxRequests - record.count)
  const reset = Math.ceil((windowMs - (now - record.timestamp)) / 1000)

  if (record.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset,
    }
  }

  return {
    success: true,
    limit: maxRequests,
    remaining,
    reset,
  }
}

/**
 * 프리셋 Rate Limit 설정
 */
export const RATE_LIMIT_PRESETS = {
  // 로그인: 1분당 5회
  login: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  // 회원가입: 1시간당 3회
  signup: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  },
  // 이메일 중복 체크: 1분당 10회
  checkEmail: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  // 비밀번호 재설정: 1시간당 3회
  passwordReset: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  },
  // 일반 API: 1분당 60회
  api: {
    maxRequests: 60,
    windowMs: 60 * 1000,
  },
} as const

/**
 * IP 주소 추출 헬퍼
 */
export function getClientIp(headers: Headers): string {
  // Vercel/Cloudflare 등 프록시 환경
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Cloudflare
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // 기본값
  return 'unknown'
}

/**
 * Rate Limit 미들웨어 헬퍼
 * API Route에서 사용
 */
export function rateLimitMiddleware(
  headers: Headers,
  preset: keyof typeof RATE_LIMIT_PRESETS
): RateLimitResult {
  const ip = getClientIp(headers)
  const config = RATE_LIMIT_PRESETS[preset]
  return checkRateLimit(`${preset}:${ip}`, config)
}
