/**
 * 인기상품 순위 산출 서비스
 *
 * 참조: BandAuto_데이터활용_1일3회공지_개발계획서_v2.docx §3.2, §4.2
 *
 * popularity_score = (최근 30일 판매횟수 × 40%)
 *                  + (마진률 × 30%)
 *                  + (시즘성 지수 × 30%)
 *
 * 각 지표는 0~100 으로 정규화하여 가중합. 산식의 최종 결과도 0~100 범위.
 *
 * - 최근 30일 판매횟수 = LegacyOrder 에서 상품명 토큰 LIKE 매칭한 행 count
 * - 마진률            = 매칭된 LegacyOrder 의 (sale - cost) / sale × 100 의 평균
 * - 시즘성 지수       = 현재 ISO 주차의 매칭 평균건수 / 연간 평균 매칭건수 × 50 (캡 100)
 *
 * 모든 지표가 0 이거나 LegacyOrder 가 없는 상품은 점수 0 으로 후순위.
 * 매칭 키워드는 productName 의 첫 의미있는 토큰(2자+, 불용어 제외) 1~2개.
 */

import prisma, { ChannelKind } from '@bandauto/db'

// ─── 인터페이스 ───────────────────────────────────────
export interface PopularityFilters {
  /** 대상 사용자 — 멀티테넌트 격리 */
  userId: number
  /** 소매밴드 ID 필터 (빈 배열/undefined = 전체) */
  retailChannelIds?: number[]
  /** 도매방 출처 ID 필터 (빈 배열/undefined = 전체). Product.channelId 기준. */
  sourceChannelIds?: number[]
  /** 카테고리 코드 필터 (빈 배열/undefined = 전체). SEA/AGR/... */
  categoryCodes?: string[]
}

export interface PopularProduct {
  productId: number
  productName: string
  categoryId: string | null
  /** 0~100 종합 점수 */
  score: number
  /** 점수 산출 내역 (디버그/투명성) */
  breakdown: {
    salesCount30d: number
    marginRate: number
    seasonalIndex: number
  }
  /** 매칭 사용된 키워드 */
  matchedKeyword: string
  /** ChannelProduct 등록된 발행 채널 ID 들 */
  channelIds: number[]
  /** 표시용 가격 (Product.price, 변형이 있으면 첫 variant) */
  price: number | null
  thumbnailUrl: string | null
}

// ─── 키워드 추출 ───────────────────────────────────────
// 자주 등장하는 불용어/단위어 — 이 토큰들로 LIKE 검색하면 너무 광범위
const STOP_TOKENS = new Set([
  '원', '세트', '박스', '키로', 'kg', 'KG', '미', '마리', '개', '입', '봉', '팩',
  '리터', '리', '병', '캔', '한', '두', '세', '네', '5kg', '1kg', '2kg', '3kg',
  '오늘', '특가', '신선', '국내산', '국산', '수입', '냉동', '활', '생물',
  '추천', '인기', '베스트', '한정',
])

/**
 * 상품명에서 LIKE 검색용 키워드(가장 의미있는 명사) 추출.
 * 예: "제주 은갈치 1.5kg 35,000원" → "은갈치"
 *     "포천이동갈비 2.5Kg 20대" → "포천이동갈비"
 *     "꽃게 5kg 4미" → "꽃게"
 */
export function extractKeyword(productName: string): string {
  if (!productName) return ''
  // 한글/영문/숫자 외 제거
  const cleaned = productName.replace(/[^가-힯ㄱ-ㆎa-zA-Z0-9\s]/g, ' ')
  const tokens = cleaned.split(/\s+/).filter(Boolean)

  // 우선순위: 2자 이상 한글 단어 중 stopword 가 아닌 것
  for (const t of tokens) {
    if (t.length >= 2 && !STOP_TOKENS.has(t) && /[가-힯]/.test(t)) {
      // 숫자만 또는 영문만은 제외
      if (!/^\d+$/.test(t) && !/^[a-zA-Z]+$/.test(t)) {
        // 무게/수량 단위가 붙은 토큰 ("5키로" 등) 도 제외
        if (!/^\d+(kg|키로|미|개|봉|팩|박스|세트|마리)$/i.test(t)) {
          return t
        }
      }
    }
  }
  // 폴백: 가장 긴 토큰
  if (tokens.length === 0) return productName.slice(0, 10)
  return tokens.reduce((a, b) => (a.length >= b.length ? a : b))
}

// ─── 점수 산출 ──────────────────────────────────────────
async function computeProductPopularity(
  productId: number,
  productName: string,
  ctx: { since30d: Date; weekStart: Date; weekEnd: Date }
): Promise<PopularProduct['breakdown'] & { matchedKeyword: string }> {
  const keyword = extractKeyword(productName)
  const emptyResult = {
    salesCount30d: 0,
    marginRate: 0,
    seasonalIndex: 0,
    matchedKeyword: keyword,
  }
  if (!keyword || keyword.length < 2) {
    return emptyResult
  }

  // 1) 최근 30일 판매횟수
  const salesCount30d = await prisma.legacyOrder.count({
    where: {
      productName: { contains: keyword },
      orderDate: { gte: ctx.since30d },
    },
  })

  // 2) 마진률 — 전체 기간 매칭 행 기준 평균
  const marginAgg = await prisma.legacyOrder.aggregate({
    where: {
      productName: { contains: keyword },
      salePrice: { gt: 0 },
    },
    _avg: { salePrice: true, costPrice: true },
    _count: { _all: true },
  })
  let marginRate = 0
  if (marginAgg._count._all > 0) {
    const sale = marginAgg._avg.salePrice || 0
    const cost = marginAgg._avg.costPrice || 0
    if (sale > 0) marginRate = Math.max(0, Math.min(100, ((sale - cost) / sale) * 100))
  }

  // 3) 시즘성 지수 — 이번 주(MM-DD ± 3일)의 역대 매칭 건수가 평균 대비 어떤지
  const allMonthCount = await prisma.legacyOrder.count({
    where: { productName: { contains: keyword } },
  })
  const currentWeekCount = await prisma.legacyOrder.count({
    where: {
      productName: { contains: keyword },
      // ISO date doesn't easily filter "same week of year" in Prisma — 근사:
      // 최근 365일을 기준으로 (오늘±3일) MM-DD 매칭은 raw 가 필요해, 단순화:
      orderDate: { gte: ctx.weekStart, lte: ctx.weekEnd },
    },
  })

  let seasonalIndex = 0
  if (allMonthCount > 0) {
    // 5년 평균 1주차 = allMonthCount / 260 (대략)
    const weeklyAvg = allMonthCount / 260
    if (weeklyAvg > 0) {
      const ratio = currentWeekCount / weeklyAvg
      seasonalIndex = Math.max(0, Math.min(100, ratio * 50))
    }
  }

  return { salesCount30d, marginRate, seasonalIndex, matchedKeyword: keyword }
}

// ─── 최종 점수 정규화 ──────────────────────────────────
function normalizeScore(b: { salesCount30d: number; marginRate: number; seasonalIndex: number }): number {
  // salesCount30d 는 단순 카운트라 0~50 범위로 클램프 후 0~100 스케일
  const sales = Math.min(50, b.salesCount30d) * 2  // 0~100
  const margin = Math.max(0, Math.min(100, b.marginRate))  // 0~100
  const seasonal = Math.max(0, Math.min(100, b.seasonalIndex))  // 0~100
  const score = sales * 0.4 + margin * 0.3 + seasonal * 0.3
  return Math.round(score * 100) / 100
}

// ─── 공개 API ──────────────────────────────────────────
/**
 * 인기상품 Top N 반환.
 * - ChannelProduct(isActive + deletedAt IS NULL) 가 있는 상품만 후보
 * - filters 로 retailChannel / sourceChannel / category 좁힘
 * - LegacyOrder 매칭 결과로 점수 부여 후 내림차순 정렬
 */
export async function getPopularProducts(
  limit: number,
  filters: PopularityFilters
): Promise<PopularProduct[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || 5))

  // 1) ChannelProduct 후보 추출
  const channelProductWhere: any = {
    userId: filters.userId,
    deletedAt: null,
    isActive: true,
    product: {
      isActive: true,
      deletedAt: null,
    },
    channel: {
      kind: ChannelKind.RETAIL,
      isActive: true,
    },
  }
  if (filters.retailChannelIds && filters.retailChannelIds.length > 0) {
    channelProductWhere.channelId = { in: filters.retailChannelIds }
  }
  if (filters.categoryCodes && filters.categoryCodes.length > 0) {
    channelProductWhere.product.categoryId = { in: filters.categoryCodes }
  }
  if (filters.sourceChannelIds && filters.sourceChannelIds.length > 0) {
    channelProductWhere.product.channelId = { in: filters.sourceChannelIds }
  }

  const channelProducts = await prisma.channelProduct.findMany({
    where: channelProductWhere,
    select: {
      channelId: true,
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          price: true,
          thumbnailUrl: true,
        },
      },
    },
  })

  // productId 별 channelIds 수집
  const byProduct = new Map<number, { product: NonNullable<typeof channelProducts[number]['product']>; channelIds: Set<number> }>()
  for (const cp of channelProducts) {
    if (!cp.productId || !cp.product) continue
    const entry = byProduct.get(cp.productId)
    if (entry) {
      entry.channelIds.add(cp.channelId)
    } else {
      byProduct.set(cp.productId, { product: cp.product, channelIds: new Set([cp.channelId]) })
    }
  }

  if (byProduct.size === 0) return []

  // 2) 점수 산출 ctx
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 3)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 3)
  weekEnd.setHours(23, 59, 59, 999)

  // 3) 각 상품 점수 산출 (직렬 — 캡 50개라 부하 제한적)
  const scored: PopularProduct[] = []
  for (const [productId, entry] of byProduct) {
    const breakdown = await computeProductPopularity(productId, entry.product.name, {
      since30d, weekStart, weekEnd,
    })
    const score = normalizeScore(breakdown)
    scored.push({
      productId,
      productName: entry.product.name,
      categoryId: entry.product.categoryId,
      score,
      breakdown: {
        salesCount30d: breakdown.salesCount30d,
        marginRate: breakdown.marginRate,
        seasonalIndex: breakdown.seasonalIndex,
      },
      matchedKeyword: breakdown.matchedKeyword,
      channelIds: Array.from(entry.channelIds),
      price: entry.product.price,
      thumbnailUrl: entry.product.thumbnailUrl,
    })
  }

  // 4) 점수 내림차순 정렬 → 상위 N
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, safeLimit)
}
