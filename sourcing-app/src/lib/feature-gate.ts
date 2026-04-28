/**
 * SaaS 요금제 기능 게이트 (BandAuto SaaS 종합계획서 Phase 0)
 *
 * 사용자별 SubscriptionPlan 의 features / limits 를 읽어 특정 기능 접근 여부를
 * 판정. 호출측 패턴:
 *
 *   const gate = await getFeatureGate(userId)
 *   if (!gate.hasFeature('multiShop')) throw new Error('Pro 플랜 이상 필요')
 *   if (!await gate.checkLimit('aiCallsPerMonth', 1)) throw new Error('월 AI 한도 초과')
 *
 * 구독 정보 없는 사용자(레거시/Free)는 FREE_DEFAULTS 적용.
 *
 * 미구현 (Phase 0 후속):
 *  - increment* 메서드로 UsageLog 자동 갱신 (현재는 외부에서 prisma 직접 update)
 *  - 한도 초과 시 알림 발송 (NotificationService 연결)
 */

import prisma from '@bandauto/db'

export interface PlanFeatures {
  autoPublish?: boolean       // 자동 발행 cron 사용 가능
  multiShop?: boolean         // 쇼핑몰 여러 개 운영
  customDomain?: boolean      // 커스텀 도메인 연결
  apiKey?: boolean            // 외부 API Key 발급
  whiteLabel?: boolean        // 화이트라벨 (브랜딩 제거)
  twoFactorAuth?: boolean     // 2FA
  ipWhitelist?: boolean       // IP 화이트리스트
  prioritySupport?: boolean   // 우선 지원
  [key: string]: boolean | undefined
}

export interface PlanLimits {
  channels?: number              // 등록 가능 채널 수 (-1 = 무제한)
  aiCallsPerMonth?: number       // 월간 AI 가공 한도
  publishesPerDay?: number       // 일간 발행 한도
  shopsCount?: number            // 쇼핑몰 개수
  apiCallsPerDay?: number        // 일간 API 호출
  storageMb?: number             // 누적 스토리지 MB
  teamMembers?: number           // 팀원 수
  [key: string]: number | undefined
}

export interface PlanInfo {
  slug: string
  name: string
  features: PlanFeatures
  limits: PlanLimits
}

const FREE_DEFAULTS: PlanInfo = {
  slug: 'free',
  name: 'Free',
  features: {
    autoPublish: false,
    multiShop: false,
    customDomain: false,
    apiKey: false,
    whiteLabel: false,
    twoFactorAuth: false,
    ipWhitelist: false,
    prioritySupport: false,
  },
  limits: {
    channels: 1,
    aiCallsPerMonth: 50,
    publishesPerDay: 5,
    shopsCount: 1,
    apiCallsPerDay: 100,
    storageMb: 500,
    teamMembers: 1,
  },
}

class FeatureGate {
  constructor(public readonly userId: number, public readonly plan: PlanInfo) {}

  hasFeature(key: keyof PlanFeatures): boolean {
    return this.plan.features[key as string] === true
  }

  /**
   * 한도 체크. 한도 -1 = 무제한, 미설정 = FREE_DEFAULTS 폴백.
   * @param key 한도 키 (예: 'aiCallsPerMonth')
   * @param amount 사용 예정 양 (보통 1)
   * @param currentUsage 현재 누적값 (호출측이 UsageLog 에서 조회해 전달)
   */
  isWithinLimit(key: keyof PlanLimits, amount: number, currentUsage: number): boolean {
    const limit = this.plan.limits[key as string] ?? FREE_DEFAULTS.limits[key as string]
    if (limit === undefined) return true
    if (limit === -1) return true
    return currentUsage + amount <= limit
  }

  getLimit(key: keyof PlanLimits): number {
    return (this.plan.limits[key as string] ?? FREE_DEFAULTS.limits[key as string] ?? 0) as number
  }
}

/**
 * 사용자 요금제 게이트 인스턴스 생성. 구독 미존재 시 Free 폴백.
 */
export async function getFeatureGate(userId: number): Promise<FeatureGate> {
  let plan: PlanInfo = FREE_DEFAULTS

  try {
    // SubscriptionPlan / UserSubscription 모델이 db push 되지 않은 환경 대응 — 실패 시 Free 폴백
    const sub = await (prisma as any).userSubscription?.findUnique?.({
      where: { userId },
      include: { plan: true },
    })
    if (sub?.plan && sub.status === 'ACTIVE') {
      plan = {
        slug: sub.plan.slug,
        name: sub.plan.name,
        features: parseJsonSafe(sub.plan.features) || {},
        limits: parseJsonSafe(sub.plan.limits) || {},
      }
    }
  } catch {
    // 스키마 미적용 환경 — Free 로 폴백
  }

  return new FeatureGate(userId, plan)
}

function parseJsonSafe(s: any): any {
  if (!s) return null
  if (typeof s === 'object') return s
  try {
    return JSON.parse(String(s))
  } catch {
    return null
  }
}

/**
 * 오늘 사용량 1건 증가 헬퍼. UsageLog 가 없으면 만들고, 있으면 증가.
 * 한도 초과 체크는 호출측에서 별도로 (이 함수는 단순 카운터).
 */
export async function incrementUsage(
  userId: number,
  field: 'aiCalls' | 'collections' | 'publishes' | 'apiCalls',
  amount = 1
): Promise<void> {
  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    await (prisma as any).usageLog?.upsert?.({
      where: { userId_date: { userId, date: today } },
      create: {
        userId,
        date: today,
        [field]: amount,
      },
      update: {
        [field]: { increment: amount },
      },
    })
  } catch {
    // 모델 미적용 환경 — silent fail
  }
}
