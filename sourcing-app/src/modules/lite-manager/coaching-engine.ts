/**
 * Lite Manager — 코칭 룰 엔진 (E1+E2)
 *
 * 셀러의 현재 상태(주문 수, 업로드 수, 시각 등)를 평가해 적절한 가이드 메시지를
 * CoachingTip 으로 생성. 셀러는 /lite/dashboard 상단에서 미응답 팁을 보고
 * CTA 클릭으로 다음 행동으로 이동.
 *
 * 룰 구조:
 *  { key, evaluate(ctx) → { fired, message, ctaUrl?, cooldownHours? } }
 *
 * 트리거:
 *  - cron (매시간) — RuleScheduler 가 모든 lite 셀러에 대해 evaluate
 *  - 이벤트 기반 (Phase 3) — 주문 발생/리뷰 추가 등
 *
 * 쿨다운:
 *  - 같은 ruleKey 의 최근 CoachingTip 이 cooldownHours 이내면 skip
 *  - 셀러 피로감 차단 (문서 9장 리스크)
 */
import prisma from '@bandauto/db'

export interface CoachingContext {
  userId: number
  shopIds: number[]
  /** 평가 시점 KST hour (0-23) */
  hour: number
  /** 오늘 업로드한 ShopProduct 수 */
  todayUploads: number
  /** 오늘 받은 주문 수 (PAID+) */
  todayOrders: number
  /** 누적 주문 수 (PAID+) */
  totalOrders: number
  /** 누적 매출 합계 */
  totalRevenue: number
  /** 누적 후기 수 */
  totalReviews: number
  /** 이번 달 TOP1 매출 비율 (TOP1 매출 / 전체 매출) — 인기 상품 감지 */
  top1Share: number
  /** 이번 달 TOP1 상품명 */
  top1ProductName: string | null
}

export interface CoachingRule {
  key: string
  cooldownHours: number
  evaluate(ctx: CoachingContext): { fired: boolean; message: string; ctaUrl?: string }
}

// ─────────────────────────────────────────────────────────────
// 기본 룰 10종 (E2)
// ─────────────────────────────────────────────────────────────
export const RULES: CoachingRule[] = [
  // 1) 오전 9시 + 오늘 업로드 0개 → 업로드 권유
  {
    key: 'morning_upload',
    cooldownHours: 12,
    evaluate(ctx) {
      if (ctx.hour < 9 || ctx.hour > 11) return { fired: false, message: '' }
      if (ctx.todayUploads > 0) return { fired: false, message: '' }
      return {
        fired: true,
        message: '☀️ 좋은 아침! 오늘은 아직 업로드한 상품이 없어요. 추천 풀에서 3~5개를 골라보세요.',
        ctaUrl: '/lite/myshop',
      }
    },
  },

  // 2) 첫 주문 후 30분 — 두 번째 행동 유도
  {
    key: 'after_first_order',
    cooldownHours: 24 * 7, // 일주일에 한 번
    evaluate(ctx) {
      if (ctx.totalOrders !== 1) return { fired: false, message: '' }
      return {
        fired: true,
        message: '🎉 첫 판매 축하해요! 이 흐름을 살리려면 같은 카테고리 상품을 2~3개 더 올려보세요.',
        ctaUrl: '/lite/myshop',
      }
    },
  },

  // 3) 인기 상품 감지 — TOP1 이 전체 매출의 50% 이상
  {
    key: 'hot_product',
    cooldownHours: 24,
    evaluate(ctx) {
      if (!ctx.top1ProductName || ctx.top1Share < 0.5) return { fired: false, message: '' }
      return {
        fired: true,
        message: `🔥 "${ctx.top1ProductName}" 상품이 매출의 ${Math.round(ctx.top1Share * 100)}% 를 차지해요. 비슷한 상품을 추가로 올려보세요.`,
        ctaUrl: '/lite/myshop',
      }
    },
  },

  // 4) 후기 0개 + 판매 5건+
  {
    key: 'no_review_5_sales',
    cooldownHours: 48,
    evaluate(ctx) {
      if (ctx.totalOrders < 5 || ctx.totalReviews > 0) return { fired: false, message: '' }
      return {
        fired: true,
        message: `📝 ${ctx.totalOrders}건 판매했는데 아직 후기가 없어요. 구매 고객에게 후기 요청 메시지를 보내볼까요?`,
        ctaUrl: '/lite/orders',
      }
    },
  },

  // 5) 매출 5만원 첫 돌파
  {
    key: 'revenue_50k',
    cooldownHours: 24 * 30, // 한 달에 한 번
    evaluate(ctx) {
      if (ctx.totalRevenue < 50_000) return { fired: false, message: '' }
      return {
        fired: true,
        message: `💰 누적 매출 ${Math.round(ctx.totalRevenue / 1000)}천원 돌파! 첫 달성 축하드려요. 미션 페이지에서 배지를 확인하세요.`,
        ctaUrl: '/lite/missions',
      }
    },
  },

  // 6) 점심시간(12-14) + 오늘 주문 없음 → 액션 유도
  {
    key: 'lunch_no_order',
    cooldownHours: 12,
    evaluate(ctx) {
      if (ctx.hour < 12 || ctx.hour > 14) return { fired: false, message: '' }
      if (ctx.todayOrders > 0) return { fired: false, message: '' }
      if (ctx.todayUploads === 0) return { fired: false, message: '' } // 업로드 안 한 사람은 morning_upload 가 처리
      return {
        fired: true,
        message: '🍽️ 점심시간이에요. 카톡/밴드에 마이샵 링크를 한 번 더 공유해보면 어떨까요?',
        ctaUrl: '/lite/myshop',
      }
    },
  },

  // 7) 저녁시간(19-21) + 오늘 매출 0
  {
    key: 'evening_no_revenue',
    cooldownHours: 12,
    evaluate(ctx) {
      if (ctx.hour < 19 || ctx.hour > 21) return { fired: false, message: '' }
      if (ctx.todayOrders > 0) return { fired: false, message: '' }
      return {
        fired: true,
        message: '🌆 오늘은 저녁까지 주문이 없네요. 내일 아침에 새로운 상품으로 다시 시도해봐요!',
        ctaUrl: '/lite/myshop',
      }
    },
  },

  // 8) 누적 주문 3건 → 미션 안내
  {
    key: 'three_orders_mission',
    cooldownHours: 24 * 7,
    evaluate(ctx) {
      if (ctx.totalOrders !== 3) return { fired: false, message: '' }
      return {
        fired: true,
        message: '🏅 누적 3건! 미션 페이지에서 배지를 확인하세요. 다음 미션은 10만원 매출이에요.',
        ctaUrl: '/lite/missions',
      }
    },
  },

  // 9) 누적 매출 10만원 — Pro 트리거 사전 안내
  {
    key: 'revenue_100k_pro_hint',
    cooldownHours: 24 * 30,
    evaluate(ctx) {
      if (ctx.totalRevenue < 100_000) return { fired: false, message: '' }
      return {
        fired: true,
        message: '🚀 누적 매출 10만원 돌파! 자동화 도구 (Pro 매니저) 7일 무료 체험권을 받을 자격이 있어요.',
        ctaUrl: '/lite/missions',
      }
    },
  },

  // 10) 매출 리포트 카드 공유 권유
  {
    key: 'share_report',
    cooldownHours: 24,
    evaluate(ctx) {
      if (ctx.todayOrders === 0) return { fired: false, message: '' }
      if (ctx.hour < 17) return { fired: false, message: '' }
      return {
        fired: true,
        message: '🎴 오늘 매출이 발생했어요! 수익 리포트 카드를 카톡/밴드에 공유해보세요.',
        ctaUrl: '/lite/report',
      }
    },
  },
]

// ─────────────────────────────────────────────────────────────
// 평가 + DB 기록 (E1 코어)
// ─────────────────────────────────────────────────────────────

export async function buildCoachingContext(userId: number): Promise<CoachingContext> {
  const shops = await prisma.shop.findMany({
    where: { userId, isActive: true },
    select: { id: true },
  })
  const shopIds = shops.map((s) => s.id)

  const now = new Date()
  const kstHour = (now.getUTCHours() + 9) % 24

  if (shopIds.length === 0) {
    return {
      userId,
      shopIds: [],
      hour: kstHour,
      todayUploads: 0,
      todayOrders: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalReviews: 0,
      top1Share: 0,
      top1ProductName: null,
    }
  }

  // 오늘 KST 시작
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  kstNow.setUTCHours(0, 0, 0, 0)
  const todayStart = new Date(kstNow.getTime() - kstOffsetMs)

  // 이번 달 시작
  const monthStart = new Date(kstNow)
  monthStart.setUTCDate(1)
  const monthStartUTC = new Date(monthStart.getTime() - kstOffsetMs)

  const [todayUploads, todayOrderAgg, totalOrderAgg, totalReviews, monthOrders] = await Promise.all([
    prisma.shopProduct.count({
      where: { shopId: { in: shopIds }, deletedAt: null, publishedAt: { gte: todayStart } },
    }),
    prisma.order.aggregate({
      where: {
        shopId: { in: shopIds },
        status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as any },
        orderedAt: { gte: todayStart },
      },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: {
        shopId: { in: shopIds },
        status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as any },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    prisma.review.count({ where: { userId } }).catch(() => 0),
    prisma.order.findMany({
      where: {
        shopId: { in: shopIds },
        status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] as any },
        orderedAt: { gte: monthStartUTC },
      },
      select: {
        items: {
          select: {
            productName: true,
            unitPrice: true,
            quantity: true,
            shopProduct: { select: { product: { select: { name: true } } } },
          },
        },
      },
    }),
  ])

  // TOP1 share 계산
  const productAgg = new Map<string, number>()
  let totalRev = 0
  for (const order of monthOrders) {
    for (const item of order.items) {
      const name = item.shopProduct?.product?.name || item.productName
      const rev = Number(item.unitPrice) * item.quantity
      productAgg.set(name, (productAgg.get(name) || 0) + rev)
      totalRev += rev
    }
  }
  let top1Name: string | null = null
  let top1Rev = 0
  productAgg.forEach((rev, name) => {
    if (rev > top1Rev) {
      top1Rev = rev
      top1Name = name
    }
  })
  const top1Share = totalRev > 0 ? top1Rev / totalRev : 0

  return {
    userId,
    shopIds,
    hour: kstHour,
    todayUploads,
    todayOrders: todayOrderAgg._count.id,
    totalOrders: totalOrderAgg._count.id,
    totalRevenue: Number(totalOrderAgg._sum.totalAmount || 0),
    totalReviews,
    top1Share,
    top1ProductName: top1Name,
  }
}

/**
 * 모든 룰을 평가하고, fired+쿨다운 통과한 것만 CoachingTip 으로 INSERT
 * @returns 신규 생성된 tip 수
 */
export async function evaluateAndCreateTips(userId: number): Promise<number> {
  const ctx = await buildCoachingContext(userId)
  let created = 0

  for (const rule of RULES) {
    const result = rule.evaluate(ctx)
    if (!result.fired) continue

    // 쿨다운 체크
    const cooldownStart = new Date(Date.now() - rule.cooldownHours * 60 * 60 * 1000)
    const recent = await prisma.coachingTip.findFirst({
      where: { userId, ruleKey: rule.key, createdAt: { gte: cooldownStart } },
      select: { id: true },
    })
    if (recent) continue

    await prisma.coachingTip.create({
      data: {
        userId,
        ruleKey: rule.key,
        message: result.message,
        ctaUrl: result.ctaUrl,
        shown: false,
      },
    })
    created++
  }

  return created
}
