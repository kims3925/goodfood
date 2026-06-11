/**
 * 소스 모니터 영속화 서비스 (B2B 공급몰 전환 STEP 2-2)
 *
 * WholesaleWatchAgent(재크롤·감지)가 감지한 결과를 DB 에 영속화한다:
 * - SourceSnapshot: 매 점검 스냅샷 (상태 + 감지 근거)
 * - Product.sourceStatus / soldOutAt: 사유 보존 (isActive=false 와 별도)
 * - PriceHistory + 가격정책 적용은 price-policy.service.ts 위임
 * - 관리자 인박스 알림 (notification.service 재사용)
 *
 * 에이전트와 분리한 이유: 감지(Playwright)와 반영(DB)을 분리해 테스트 가능하게,
 * 추후 오픈 API 웹훅(product.soldout / product.price_changed)도 이 지점에서 발행.
 */

import prisma from '@bandauto/db'
import { createInfoNotification } from '@/services/notification.service'
import { handlePriceChange, type PriceChangeResult } from './price-policy.service'

export type DetectedStatus = 'ACTIVE' | 'SOLDOUT' | 'POST_DELETED' | 'PRICE_CHANGED'

export interface SnapshotInput {
  productId: number
  collectedPostId: number
  status: DetectedStatus
  wholesalePrice?: number | null
  /** 감지 근거 (품절 문구, 본문 발췌 등) */
  rawText?: string | null
}

/** 매 점검마다 스냅샷 기록 */
export async function recordSourceSnapshot(input: SnapshotInput): Promise<void> {
  try {
    await prisma.sourceSnapshot.create({
      data: {
        productId: input.productId,
        collectedPostId: input.collectedPostId,
        status: input.status,
        wholesalePrice: input.wholesalePrice ?? null,
        rawText: input.rawText?.slice(0, 2000) ?? null,
      },
    })
  } catch (e: any) {
    // 스냅샷 기록 실패는 모니터링을 막지 않음 (DB 마이그레이션 미적용 환경 포함)
    console.warn('[SourceMonitor] 스냅샷 기록 실패:', e?.message)
  }
}

/** 품절/삭제 확정 — 상태 사유 보존 + 알림 (isActive 비활성은 에이전트가 수행) */
export async function markSourceUnavailable(params: {
  userId: number
  productId: number
  productName: string
  status: 'SOLDOUT' | 'POST_DELETED'
  channelName?: string
}): Promise<void> {
  const { userId, productId, productName, status, channelName } = params

  await prisma.product.update({
    where: { id: productId },
    data: {
      sourceStatus: status,
      ...(status === 'SOLDOUT' ? { soldOutAt: new Date() } : {}),
    },
  }).catch((e: any) => console.warn('[SourceMonitor] sourceStatus 갱신 실패:', e?.message))

  await createInfoNotification(
    userId,
    status === 'SOLDOUT' ? '도매 원본 품절 감지' : '도매 원본 게시물 삭제 감지',
    `"${productName}"${channelName ? ` (${channelName})` : ''} — 발행물이 자동 비활성화되었습니다.`,
    `/sourcing/product/detail/${productId}`
  )
}

/** 가격 변동 — PriceHistory 기록 + 정책 적용 + 알림 */
export async function reportPriceChange(params: {
  userId: number
  productId: number
  productName: string
  newWholesalePrice: number
}): Promise<PriceChangeResult | null> {
  const { userId, productId, productName, newWholesalePrice } = params
  try {
    const result = await handlePriceChange({ userId, productId, newWholesalePrice })

    const fmt = (n: number | null) => (n != null ? `${n.toLocaleString('ko-KR')}원` : '?')
    await createInfoNotification(
      userId,
      result.applied ? '도매가 변동 — 판매가 자동 갱신됨' : '도매가 변동 감지',
      `"${productName}" 도매가 ${fmt(result.oldWholesalePrice)} → ${fmt(result.newWholesalePrice)}` +
        (result.applied ? `, 판매가 ${fmt(result.oldPrice)} → ${fmt(result.newPrice)} (마진율 유지)` : ' — 판매가는 변경되지 않았습니다 (NOTIFY_ONLY).'),
      `/sourcing/product/detail/${productId}`
    )
    return result
  } catch (e: any) {
    console.error('[SourceMonitor] 가격 변동 처리 실패:', e?.message)
    return null
  }
}
