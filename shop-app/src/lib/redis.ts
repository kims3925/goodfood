import { createClient, RedisClientType } from 'redis'

let redisClient: RedisClientType | null = null
let connectionFailed = false

export async function getRedisClient(): Promise<RedisClientType | null> {
  // 이전에 연결 실패했으면 재시도하지 않음
  if (connectionFailed) {
    return null
  }

  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  try {
    redisClient = createClient({ url: redisUrl })

    redisClient.on('error', () => {
      // 에러 로그 무시 (최초 1회만 출력됨)
    })

    await redisClient.connect()
    return redisClient
  } catch {
    connectionFailed = true
    console.warn('[Redis] 연결 실패 - 실시간 접속자 추적이 비활성화됩니다.')
    return null
  }
}

// Presence 관련 상수
export const PRESENCE_PREFIX = 'presence:'
export const PRESENCE_TTL = 60 // 60초 후 자동 만료

export interface VisitorInfo {
  sessionId: string
  shopSlug: string
  currentPage: string
  productId?: number
  productName?: string
  device: 'mobile' | 'desktop'
  referrer?: string
  startedAt: string
  lastActiveAt: string
  userAgent?: string
}

/**
 * 방문자 정보 저장/갱신
 */
export async function setVisitorPresence(visitor: VisitorInfo): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  try {
    const key = `${PRESENCE_PREFIX}${visitor.sessionId}`

    await client.hSet(key, {
      sessionId: visitor.sessionId,
      shopSlug: visitor.shopSlug,
      currentPage: visitor.currentPage,
      productId: visitor.productId?.toString() || '',
      productName: visitor.productName || '',
      device: visitor.device,
      referrer: visitor.referrer || '',
      startedAt: visitor.startedAt,
      lastActiveAt: visitor.lastActiveAt,
      userAgent: visitor.userAgent || '',
    })

    // TTL 설정 (heartbeat 없으면 자동 삭제)
    await client.expire(key, PRESENCE_TTL)
    return true
  } catch {
    return false
  }
}

/**
 * 방문자 정보 삭제 (명시적 이탈)
 */
export async function removeVisitorPresence(sessionId: string): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return false

  try {
    await client.del(`${PRESENCE_PREFIX}${sessionId}`)
    return true
  } catch {
    return false
  }
}

/**
 * 모든 활성 방문자 조회
 */
export async function getActiveVisitors(): Promise<VisitorInfo[]> {
  const client = await getRedisClient()
  if (!client) return []

  try {
    const keys = await client.keys(`${PRESENCE_PREFIX}*`)

    if (keys.length === 0) {
      return []
    }

    const visitors: VisitorInfo[] = []

    for (const key of keys) {
      const data = await client.hGetAll(key)
      if (data && data.sessionId) {
        visitors.push({
          sessionId: data.sessionId,
          shopSlug: data.shopSlug,
          currentPage: data.currentPage,
          productId: data.productId ? parseInt(data.productId) : undefined,
          productName: data.productName || undefined,
          device: (data.device as 'mobile' | 'desktop') || 'desktop',
          referrer: data.referrer || undefined,
          startedAt: data.startedAt,
          lastActiveAt: data.lastActiveAt,
          userAgent: data.userAgent || undefined,
        })
      }
    }

    return visitors
  } catch {
    return []
  }
}

/**
 * 활성 방문자 수 조회
 */
export async function getActiveVisitorCount(): Promise<number> {
  const client = await getRedisClient()
  if (!client) return 0

  try {
    const keys = await client.keys(`${PRESENCE_PREFIX}*`)
    return keys.length
  } catch {
    return 0
  }
}
