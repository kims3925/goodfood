/**
 * Lite Manager — 미션 정의 (G3 게이미피케이션, F1)
 *
 * 5종 미션. 5개 모두 달성 시 Pro 7일 무료 체험권 자동 발급.
 * 정의는 코드에 하드코딩 + DB Mission 테이블에 idempotent seed.
 *
 * 평가 방식: 미션별 evaluate(ctx) → progress (0~targetValue)
 *  - first_sale: 누적 주문 수 (PAID+) ≥ 1
 *  - 3_sales:    하루 최대 주문 수 ≥ 3
 *  - 10man_revenue: 누적 매출 ≥ 100,000
 *  - review_5:   누적 후기 수 ≥ 5
 *  - pro_unlock: 다른 4 미션 모두 완료 시 자동 (재귀)
 */

export interface MissionDef {
  code: string
  title: string
  description: string
  targetValue: number
  rewardType: 'badge' | 'pro_trial'
  rewardValue: string
  emoji: string
  sortOrder: number
}

export const MISSIONS: MissionDef[] = [
  {
    code: 'first_sale',
    title: '첫 판매 달성',
    description: '첫 주문이 들어오면 자동 완료됩니다',
    targetValue: 1,
    rewardType: 'badge',
    rewardValue: '🎉 시작 배지',
    emoji: '🎉',
    sortOrder: 1,
  },
  {
    code: '3_sales',
    title: '3건 판매',
    description: '하루 안에 3건 이상 판매 (KST 기준)',
    targetValue: 3,
    rewardType: 'badge',
    rewardValue: '🏅 페이스메이커 배지',
    emoji: '🏅',
    sortOrder: 2,
  },
  {
    code: '10man_revenue',
    title: '10만원 매출',
    description: '누적 매출 100,000원 달성',
    targetValue: 100_000,
    rewardType: 'badge',
    rewardValue: '💰 첫 수익 배지',
    emoji: '💰',
    sortOrder: 3,
  },
  {
    code: 'review_5',
    title: '후기 5개',
    description: '구매자가 작성한 후기 5개 받기',
    targetValue: 5,
    rewardType: 'badge',
    rewardValue: '⭐ 신뢰 배지',
    emoji: '⭐',
    sortOrder: 4,
  },
  {
    code: 'pro_unlock',
    title: 'Pro 7일 체험권',
    description: '미션 4개 달성 시 Pro 7일 무료 체험권 자동 발급',
    targetValue: 4,
    rewardType: 'pro_trial',
    rewardValue: '🚀 Pro 7일 체험권',
    emoji: '🚀',
    sortOrder: 5,
  },
]

export function getMissionByCode(code: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.code === code)
}
