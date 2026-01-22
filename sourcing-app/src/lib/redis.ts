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
      // 에러 로그 무시
    })

    await redisClient.connect()
    return redisClient
  } catch {
    connectionFailed = true
    console.warn('[Redis] 연결 실패 - 실시간 접속자 추적이 비활성화됩니다.')
    return null
  }
}

// Presence 관련 상수 (shop-app과 동일)
export const PRESENCE_PREFIX = 'presence:'

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

    // 최근 활동 순으로 정렬
    return visitors.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    )
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

/**
 * 쇼핑몰별 방문자 그룹화
 */
export async function getVisitorsByShop(): Promise<Record<string, VisitorInfo[]>> {
  const visitors = await getActiveVisitors()
  const grouped: Record<string, VisitorInfo[]> = {}

  for (const visitor of visitors) {
    if (!grouped[visitor.shopSlug]) {
      grouped[visitor.shopSlug] = []
    }
    grouped[visitor.shopSlug].push(visitor)
  }

  return grouped
}
