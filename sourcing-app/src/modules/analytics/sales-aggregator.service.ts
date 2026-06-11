/**
 * 판매 집계 서비스 (B2B 공급몰 전환 STEP 5-1)
 *
 * OrderItem(소매 + B2B + B2B_API)을 일 단위로 집계해 ProductSalesDaily 에 적재.
 * - 집계 대상: 결제 확정 주문 (paidAt 존재 또는 status PAID/PREPARING/SHIPPED/DELIVERED)
 * - 집계 기준일: Order.paidAt ?? orderedAt 의 KST 날짜
 * - idempotent: (productId, date, orderType) upsert — 같은 날 재실행 안전
 *
 * 추천 스코어 (STEP 5-2):
 *   score = 판매량(7일 ×3 가중 + 30일) + 신상품 부스트 − 품절 페널티
 *   (조회 인기도 popularity 와의 결합은 노출부에서 선택적으로 수행)
 */

import prisma from '@bandauto/db'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 자정(Date-only, UTC 저장용) */
function kstDateOnly(d: Date): Date {
  const kst = new Date(d.getTime() + KST_OFFSET_MS)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
}

export interface AggregateResult {
  daysProcessed: number
  rowsUpserted: number
  ordersScanned: number
}

/**
 * 최근 N일(기본 2: 어제+오늘) 판매를 재집계.
 * 일배치(매일 06시 AnalystAgent)와 수동 트리거 양쪽에서 호출.
 */
export async function aggregateRecentSales(days: number = 2): Promise<AggregateResult> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // 결제 확정 주문의 아이템 조회 (소매/B2B 모두)
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { paidAt: { gte: since } },
        {
          orderedAt: { gte: since },
          status: { in: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'] },
        },
        // B2B_API 발주는 무통장 PENDING 이라 paidAt 이 없을 수 있음 — 접수 기준 집계
        { orderedAt: { gte: since }, orderType: 'B2B_API' } as any,
      ],
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
    },
    select: {
      id: true,
      paidAt: true,
      orderedAt: true,
      orderType: true,
      items: {
        select: {
          quantity: true,
          totalPrice: true,
          variant: { select: { productId: true } },
          shopProduct: { select: { productId: true } },
        },
      },
    } as any,
  })

  // (productId, dateISO, orderType) → { qty, revenue }
  const buckets = new Map<string, { productId: number; date: Date; orderType: string; qty: number; revenue: number }>()

  for (const order of orders as any[]) {
    const baseDate = kstDateOnly(order.paidAt ?? order.orderedAt)
    const orderType = order.orderType || 'RETAIL'
    for (const item of order.items) {
      const productId: number | null = item.variant?.productId ?? item.shopProduct?.productId ?? null
      if (!productId) continue
      const key = `${productId}|${baseDate.toISOString()}|${orderType}`
      const bucket = buckets.get(key) ?? { productId, date: baseDate, orderType, qty: 0, revenue: 0 }
      bucket.qty += item.quantity
      bucket.revenue += Number(item.totalPrice)
      buckets.set(key, bucket)
    }
  }

  let rowsUpserted = 0
  for (const b of buckets.values()) {
    await prisma.productSalesDaily.upsert({
      where: {
        productId_date_orderType: { productId: b.productId, date: b.date, orderType: b.orderType },
      },
      update: { qty: b.qty, revenue: b.revenue },
      create: { productId: b.productId, date: b.date, orderType: b.orderType, qty: b.qty, revenue: b.revenue },
    })
    rowsUpserted++
  }

  console.log(`[SalesAggregator] ${days}일 재집계 완료 — 주문 ${orders.length}건 → ${rowsUpserted}행 upsert`)
  return { daysProcessed: days, rowsUpserted, ordersScanned: orders.length }
}

export interface SalesScoreRow {
  productId: number
  qty7d: number
  qty30d: number
  score: number
}

const NEW_PRODUCT_BOOST = 5 // 생성 7일 이내
const SOLDOUT_PENALTY = 1000 // 품절은 사실상 제외

/**
 * 판매 스코어 산출 — 7일 판매량 ×3 + 30일 판매량 + 신상품 부스트 − 품절 페널티.
 * userId 지정 시 해당 테넌트 상품만.
 */
export async function getSalesScores(options?: { userId?: number; limit?: number }): Promise<SalesScoreRow[]> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const rows = await prisma.productSalesDaily.groupBy({
    by: ['productId'],
    where: { date: { gte: since30 } },
    _sum: { qty: true },
  })
  const rows7 = await prisma.productSalesDaily.groupBy({
    by: ['productId'],
    where: { date: { gte: since7 } },
    _sum: { qty: true },
  })
  const qty7Map = new Map(rows7.map((r) => [r.productId, r._sum.qty ?? 0]))

  const productIds = rows.map((r) => r.productId)
  if (productIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      deletedAt: null,
      ...(options?.userId ? { userId: options.userId } : {}),
    },
    select: { id: true, createdAt: true, sourceStatus: true, isActive: true },
  })
  const productById = new Map(products.map((p) => [p.id, p]))
  const newCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

  const scores: SalesScoreRow[] = []
  for (const r of rows) {
    const p = productById.get(r.productId)
    if (!p) continue // 테넌트 필터/삭제 제외
    const qty30 = r._sum.qty ?? 0
    const qty7 = qty7Map.get(r.productId) ?? 0
    let score = qty7 * 3 + qty30
    if (p.createdAt.getTime() >= newCutoff) score += NEW_PRODUCT_BOOST
    if (p.sourceStatus === 'SOLDOUT' || p.sourceStatus === 'POST_DELETED' || !p.isActive) score -= SOLDOUT_PENALTY
    scores.push({ productId: r.productId, qty7d: qty7, qty30d: qty30, score })
  }

  scores.sort((a, b) => b.score - a.score)
  return options?.limit ? scores.slice(0, options.limit) : scores
}
