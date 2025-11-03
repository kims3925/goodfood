import { createClient, RedisClientType } from 'redis'

let client: RedisClientType | null = null

/**
 * Redis 클라이언트 초기화
 */
async function getClient(): Promise<RedisClientType> {
  if (client && client.isOpen) {
    return client
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  client = createClient({ url: redisUrl }) as RedisClientType

  client.on('error', (err) => {
    console.error('Redis 클라이언트 오류:', err)
  })

  client.on('connect', () => {
    console.log('Redis 연결 성공')
  })

  try {
    await client.connect()
    return client
  } catch (error) {
    console.error('Redis 연결 실패:', error)
    throw error
  }
}

/**
 * 캐시 조회 또는 생성 (Cache-Aside Pattern)
 *
 * @param key - 캐시 키
 * @param fetchFn - 캐시 미스 시 실행할 함수
 * @param ttlSeconds - TTL (초 단위, 기본 5분)
 */
export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  try {
    const redis = await getClient()

    // 1. 캐시에서 조회
    const cached = await redis.get(key)

    if (cached) {
      console.log(`[Cache HIT] ${key}`)
      return JSON.parse(cached)
    }

    // 2. 캐시 미스: DB에서 조회
    console.log(`[Cache MISS] ${key}`)
    const data = await fetchFn()

    // 3. 캐시 저장 (TTL 적용)
    await redis.setEx(key, ttlSeconds, JSON.stringify(data))

    return data
  } catch (error) {
    console.error(`[Cache Error] ${key}:`, error)
    // Redis 오류 시 원본 함수 실행
    return await fetchFn()
  }
}

/**
 * 캐시 무효화 (단일 키)
 */
export async function invalidateCache(key: string): Promise<void> {
  try {
    const redis = await getClient()
    await redis.del(key)
    console.log(`[Cache Invalidated] ${key}`)
  } catch (error) {
    console.error(`[Cache Invalidation Error] ${key}:`, error)
  }
}

/**
 * 캐시 무효화 (패턴 매칭)
 *
 * 예: invalidateCachePattern('products:*')
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const redis = await getClient()
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(keys)
      console.log(`[Cache Invalidated Pattern] ${pattern} (${keys.length} keys)`)
    }
  } catch (error) {
    console.error(`[Cache Pattern Invalidation Error] ${pattern}:`, error)
  }
}

/**
 * 캐시에 직접 저장
 */
export async function setCache(
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    const redis = await getClient()
    await redis.setEx(key, ttlSeconds, JSON.stringify(value))
    console.log(`[Cache SET] ${key}`)
  } catch (error) {
    console.error(`[Cache Set Error] ${key}:`, error)
  }
}

/**
 * 캐시에서 직접 조회
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getClient()
    const cached = await redis.get(key)

    if (cached) {
      console.log(`[Cache GET HIT] ${key}`)
      return JSON.parse(cached)
    }

    console.log(`[Cache GET MISS] ${key}`)
    return null
  } catch (error) {
    console.error(`[Cache Get Error] ${key}:`, error)
    return null
  }
}

/**
 * Redis 연결 종료 (앱 종료 시)
 */
export async function disconnectRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit()
    console.log('Redis 연결 종료')
  }
}

/**
 * 캐시 키 생성 헬퍼
 */
export const CacheKeys = {
  // 상품
  product: (id: string) => `product:${id}`,
  products: (page: number) => `products:page:${page}`,
  productsByCategory: (category: string, page: number) =>
    `products:category:${category}:page:${page}`,

  // 장바구니
  cart: (sessionId: string) => `cart:session:${sessionId}`,
  cartUser: (userId: string) => `cart:user:${userId}`,

  // 주문
  order: (orderNumber: string) => `order:${orderNumber}`,
  ordersByUser: (userId: string, page: number) =>
    `orders:user:${userId}:page:${page}`,

  // 쇼핑몰 설정
  shopSettings: (userId: string) => `shop:settings:${userId}`,

  // 도매밴드
  wholesaleBand: (bandKey: string) => `wholesale:band:${bandKey}`,
  collectedPosts: (bandKey: string, page: number) =>
    `collected:posts:${bandKey}:page:${page}`,
}

/**
 * TTL 상수 (초 단위)
 */
export const CacheTTL = {
  SHORT: 60,              // 1분
  MEDIUM: 300,            // 5분
  LONG: 600,              // 10분
  VERY_LONG: 1800,        // 30분
  DAY: 86400,             // 1일
}

export default {
  getCached,
  invalidateCache,
  invalidateCachePattern,
  setCache,
  getCache,
  disconnectRedis,
  CacheKeys,
  CacheTTL
}
