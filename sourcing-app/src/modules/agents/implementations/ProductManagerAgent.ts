/**
 * ProductManagerAgent — 상품담당 에이전트
 *
 * 역할:
 *  1. 발행된 상품(쇼핑몰 + 소매밴드)의 가격정책 준수 여부 검증
 *  2. 상품 이미지에 가격 텍스트가 포함되어 있는지 Gemini Vision으로 탐지
 *  3. 위반 상품을 삭제하고 가격정책 재적용 후 재발행
 *
 * 구독 이벤트:
 *  - product.audit.requested   : 수동 감사 트리거
 *  - product.published         : 발행 직후 자동 검증
 *  - schedule.product.audit    : 주기적 전체 감사 (cron)
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { GeminiClient, type AiImagePart } from '@/modules/transformation/ai.client'
import { AiProvider } from '@bandauto/db'

// ─── 감사 결과 타입 ───

export interface PriceViolation {
  productId: number
  productName: string
  channelId: number | null
  channelName: string | null
  variantId: number
  optionSummary: string | null
  wholesalePrice: number
  actualPrice: number
  expectedPrice: number
  violationType: 'WRONG_MARGIN' | 'NO_MARGIN_APPLIED' | 'EXCEEDS_POLICY_LIMIT'
  policyName: string
}

export interface ImageViolation {
  productId: number
  productName: string
  imageId: number
  imageUrl: string
  detectedText: string
}

export interface AuditResult {
  audited: number
  priceViolations: PriceViolation[]
  imageViolations: ImageViolation[]
  deleted: number[]
  republished: number[]
  skipped: number[]
  errors: { productId: number; error: string }[]
}

export interface SourceChangeResult {
  productId: number
  productName: string
  channelId: number | null
  changeType: 'PRICE_CHANGED' | 'POSSIBLY_SOLD_OUT' | 'SPEC_CHANGED' | 'OK'
  storedPrice: number | null
  detectedPrice: number | null
  detail: string
}

// ─── 가격정책 파서 ───

interface ParsedPolicyRule {
  minWholesale: number
  maxWholesale: number | null  // null = 상한 없음 (이상)
  margin: number
  marginType: 'fixed' | 'percent'
  perBracket?: number  // 동적 구간 추가 마진 (예: 1만원마다 +1,000원)
  bracketSize?: number // 동적 구간 크기 (예: 10,000원)
}

/**
 * 채널 가격정책 content 문자열에서 마진 규칙을 파싱합니다.
 *
 * 실제 DB 저장 형식 (마크다운 테이블):
 *   | 1원 ~ 19,900원       | +4,000원 |
 *   | 19,901원 ~ 29,900원  | +5,000원 |
 *   | 99,901원 이상        | +13,000원~ (1만원 구간마다 +1,000원 추가) |
 *
 * 특수 케이스:
 *  - 킹도매방: "판매가 그대로" → 마진 0, 모든 구간 커버
 *  - 초록이네: +0원 마진 구간 포함 (마진 없이 도매가 = 판매가)
 *  - 하위 호환: 화살표 포맷 "X ~ Y원 → +Z원"도 지원
 */
function parsePricingPolicyRules(content: string): ParsedPolicyRule[] {
  const rules: ParsedPolicyRule[] = []

  // ── 특수: 킹도매방 "판매가 그대로" = 마진 0, 전 구간 적용 ──
  if (/판매가\s*그대로/.test(content)) {
    rules.push({ minWholesale: 0, maxWholesale: null, margin: 0, marginType: 'fixed' })
    return rules
  }

  // ── 마크다운 테이블 범위 행: | X원 ~ Y원 | +Z원 | ──
  // 예: | 1원 ~ 19,900원 | +4,000원 |  /  | 1원 ~ 19,900원 | +0원 |
  const tableRangePattern =
    /\|\s*(\d[\d,]*)\s*원?\s*[~～]\s*(\d[\d,]*)\s*원?\s*\|\s*\+\s*(\d[\d,]*)\s*원/g
  let match: RegExpExecArray | null
  while ((match = tableRangePattern.exec(content)) !== null) {
    rules.push({
      minWholesale: parseKoreanNumber(match[1]),
      maxWholesale: parseKoreanNumber(match[2]),
      margin: parseKoreanNumber(match[3]),
      marginType: 'fixed',
    })
  }

  // ── 마크다운 테이블 개방형 마지막 행: | X원 이상 | +Y원~ (N만원 구간마다 +Z원 추가) | ──
  // 예: | 99,901원 이상 | +13,000원~ (1만원 구간마다 +1,000원 추가) |
  const tableOpenPattern =
    /\|\s*(\d[\d,]*)\s*원?\s*이상\s*\|\s*\+\s*(\d[\d,]*)\s*원/g
  while ((match = tableOpenPattern.exec(content)) !== null) {
    const min = parseKoreanNumber(match[1])
    // 이미 범위 규칙에서 동일 시작값을 커버하지 않는 경우만 추가
    if (!rules.some((r) => r.minWholesale === min && r.maxWholesale === null)) {
      const rule: ParsedPolicyRule = {
        minWholesale: min,
        maxWholesale: null,
        margin: parseKoreanNumber(match[2]),
        marginType: 'fixed',
      }
      // 동적 구간 추가 마진 파싱: "(X만원 구간마다 +Y원 추가)"
      const dynMatch = content
        .slice(match.index)
        .match(/(\d+)\s*만원\s*구간마다\s*\+\s*(\d[\d,]*)\s*원\s*추가/)
      if (dynMatch) {
        rule.bracketSize = parseInt(dynMatch[1], 10) * 10000
        rule.perBracket = parseKoreanNumber(dynMatch[2])
      }
      rules.push(rule)
    }
  }

  // ── 하위 호환: 화살표 포맷 "X ~ Y원 → +Z원" ──
  const arrowPattern =
    /(\d[\d,]*)\s*[~～]\s*(\d[\d,]*)\s*원?\s*(?:→|->)\s*\+\s*(\d[\d,]*)\s*원/g
  while ((match = arrowPattern.exec(content)) !== null) {
    const min = parseKoreanNumber(match[1])
    const max = parseKoreanNumber(match[2])
    if (!rules.some((r) => r.minWholesale === min && r.maxWholesale === max)) {
      rules.push({ minWholesale: min, maxWholesale: max, margin: parseKoreanNumber(match[3]), marginType: 'fixed' })
    }
  }

  // ── 퍼센트 마진: "X원 이상 → +Y%" ──
  const percentPattern = /(\d[\d,]*)\s*원?\s*이상\s*(?:→|->)\s*\+\s*(\d+)\s*%/g
  while ((match = percentPattern.exec(content)) !== null) {
    const min = parseKoreanNumber(match[1])
    if (!rules.some((r) => r.minWholesale === min && r.maxWholesale === null)) {
      rules.push({ minWholesale: min, maxWholesale: null, margin: parseInt(match[2], 10), marginType: 'percent' })
    }
  }

  return rules
}

function parseKoreanNumber(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10) || 0
}

/**
 * 기준가(도매가 또는 도매가+배송비)에 해당하는 정책 기준 판매가를 계산합니다.
 *
 * @param basePrice - 마진 계산 기준가 (배송비 별도이면 도매가+배송비 합산값)
 * @param rules     - parsePricingPolicyRules() 결과
 * @param excludeAbove - 이 금액 이상이면 소싱 제외 (null 반환)
 * @returns 기대 판매가, 또는 null (제외 대상 / 매칭 규칙 없음)
 */
function calcExpectedPrice(
  basePrice: number,
  rules: ParsedPolicyRule[],
  excludeAbove?: number
): number | null {
  // 제외 조건 (예: 40,000원 이상 제외)
  if (excludeAbove !== undefined && basePrice >= excludeAbove) return null

  // 범위 정렬 (오름차순) 후 매칭
  const sorted = [...rules].sort((a, b) => a.minWholesale - b.minWholesale)

  for (const rule of sorted) {
    const inRange =
      basePrice >= rule.minWholesale &&
      (rule.maxWholesale === null || basePrice <= rule.maxWholesale)

    if (!inRange) continue

    if (rule.marginType === 'percent') {
      return Math.round(basePrice * (1 + rule.margin / 100))
    }

    // 고정 마진
    if (rule.maxWholesale === null && rule.perBracket && rule.bracketSize) {
      // 동적 구간: 99,901원 이상, 1만원마다 +1,000원 추가
      // 예) basePrice=110,000 → 기본구간 이후 (110,000 - 99,901) / 10,000 = 1구간 → +13,000+1,000=14,000
      const extraBrackets = Math.floor((basePrice - rule.minWholesale) / rule.bracketSize)
      return basePrice + rule.margin + extraBrackets * rule.perBracket
    }

    return basePrice + rule.margin
  }
  return null
}

// ─── 가격 제외 조건 추출 (40,000원 이상 제외 등) ───
function parseExcludeAbove(content: string): number | undefined {
  const match = content.match(/(\d[\d,]*)\s*원?\s*이상\s*제외/)
  if (match) return parseKoreanNumber(match[1])
  return undefined
}

// ─── 허용 오차: 반올림 등으로 ±100원 이내는 정상 처리 ───
const PRICE_TOLERANCE = 100

// ─── Agent 본체 ───

export class ProductManagerAgent extends AgentBase {
  readonly name = 'product-manager'
  readonly layer = AgentLayer.SOURCING

  private geminiClient: GeminiClient | null = null

  getSubscribedEvents(): string[] {
    return [
      'product.audit.requested',       // 수동 감사 트리거
      'product.published',              // 발행 직후 자동 검증
      'schedule.product.audit',         // 가격정책 주기 감사 (cron)
      'schedule.product.source.watch',  // 원본 변동 주기 감시 (cron, 1시간)
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      if (event.type === 'schedule.product.source.watch') {
        // 원본 도매밴드 변동 감시 (1시간 주기)
        const sourceResults = await this.runSourceWatch({ autoFix: true })
        return {
          success: true,
          data: sourceResults as unknown as Record<string, unknown>,
          duration: Date.now() - start,
        }
      }

      let result: AuditResult

      if (event.type === 'product.published') {
        // 단일 상품 즉시 검증
        const productId = event.data.productId as number
        result = await this.auditProducts([productId], { autoFix: false })
      } else {
        // 전체 감사 (수동 or 스케줄)
        const userId = event.data.userId as number | undefined
        const autoFix = (event.data.autoFix as boolean) ?? false
        result = await this.runFullAudit({ userId, autoFix })
      }

      await this.recordKpi('audit_total', result.audited)
      await this.recordKpi('price_violations', result.priceViolations.length)
      await this.recordKpi('image_violations', result.imageViolations.length)
      await this.recordKpi('auto_deleted', result.deleted.length)

      return {
        success: true,
        data: result as unknown as Record<string, unknown>,
        duration: Date.now() - start,
      }
    } catch (error: any) {
      await this.log('ERROR', `감사 중 오류 발생: ${error.message}`)
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───
  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 감사 + 원본 변동 감시 시작')
    // 가격정책 감사
    await this.runFullAudit({ autoFix: true })
    // 원본 도매밴드 변동 감시
    await this.runSourceWatch({ autoFix: true })
  }

  /**
   * 발행 상품 전체에 대해 원본 도매밴드 변동을 감시합니다.
   */
  async runSourceWatch(options: { autoFix?: boolean; limit?: number } = {}): Promise<SourceChangeResult[]> {
    const { autoFix = false, limit = 200 } = options

    await this.log('INFO', '원본 변동 감시 실행', { autoFix, limit })

    const publishedProducts = await prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        channelId: { not: null }, // 도매채널 정보 있는 상품만
        OR: [
          { channelProducts: { some: { deletedAt: null, postKey: { not: null } } } },
          { shopProducts: { some: { deletedAt: null } } },
        ],
      },
      select: {
        id: true,
        name: true,
        channelId: true,
        wholesalePrice: true,
        shippingFee: true,
      },
      take: limit,
      orderBy: { updatedAt: 'asc' }, // 오래된 것부터 감시
    })

    return this.checkSourceProductChanges(publishedProducts, { autoFix })
  }

  // ══════════════════════════════════════════════════
  //  PUBLIC SKILL: 전체 감사
  // ══════════════════════════════════════════════════

  async runFullAudit(options: {
    userId?: number
    autoFix?: boolean
    limit?: number
  } = {}): Promise<AuditResult> {
    const { userId, autoFix = false, limit = 200 } = options

    await this.log('INFO', '전체 감사 시작', { userId, autoFix })

    // 발행된 상품 조회 (쇼핑몰 or 소매밴드에 발행된 것)
    const publishedProducts = await prisma.product.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(userId ? { userId } : {}),
        OR: [
          { channelProducts: { some: { deletedAt: null, postKey: { not: null } } } },
          { shopProducts: { some: { deletedAt: null } } },
        ],
      },
      include: {
        variants: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 5 },
        channel: { include: { pricingPolicies: { where: { isActive: true }, take: 1 } } },
        channelProducts: { where: { deletedAt: null }, include: { channel: true } },
        shopProducts: { where: { deletedAt: null } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    return this.auditProducts(
      publishedProducts.map((p) => p.id),
      { autoFix, preloaded: publishedProducts }
    )
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 가격정책 검증 (도매밴드 채널별 독립 적용)
  // ══════════════════════════════════════════════════

  /**
   * 발행 상품들을 대상으로 가격정책 위반 여부를 검사합니다.
   *
   * 핵심 원칙:
   *  - 가격정책은 상품의 소싱 출처인 **도매밴드 채널(product.channelId)** 기준으로 적용
   *  - 도매밴드마다 서로 다른 마진 규칙을 가지므로 채널별로 PricingPolicy를 별도 로드
   *  - 소매채널(ChannelProduct)의 정책은 검증 기준으로 사용하지 않음
   *
   * 도매밴드별 가격정책 요약 (2026-04 기준 실서버):
   *  - 킹도매방       : 마진 0, 도매가 = 판매가 (배송비 별도이면 +배송비)
   *  - 가족도매방     : 도매가 구간별 마진, 40,000원 이상 제외
   *                     1~19,900→+4,000 / 19,901~29,900→+5,000 / 29,901~39,900→+6,000
   *  - 폐쇄몰VIP도매  : 도매가 구간별 마진, 100,000원 이상 동적 구간
   *                     1~19,900→+4,000 / … / 89,901~99,900→+12,000 / 99,901+→+13,000~(1만원마다+1,000)
   *  - SD푸드         : 폐쇄몰VIP도매와 동일 마진 구조
   *  - 초록이네       : 최소 마진, 40,000원 이상 제외
   *                     1~19,900→+0 / 19,901~29,900→+1,000 / 29,901~39,900→+2,000
   *  - 나은 상품 공급방: 폐쇄몰VIP도매와 동일 마진 구조
   *
   * 검증 흐름:
   *  1. products를 도매채널 ID 기준으로 그룹핑
   *  2. 각 도매채널의 활성 PricingPolicy 일괄 로드 (DB에 없으면 스킵)
   *  3. PricingPolicy.content 파싱 → 마진 규칙 추출 (마크다운 테이블 + 화살표 포맷 지원)
   *  4. 기준가 계산: Case A(무료/포함 = 도매가) / Case B(배송비 별도 = 도매가+배송비) 동시 시도
   *  5. variant.price와 비교 → 허용 오차(±100원) 초과 시 위반 기록
   */
  async validateProductPricing(products: any[]): Promise<PriceViolation[]> {
    const violations: PriceViolation[] = []

    // ─── Step 1: 도매채널 ID 목록 수집 ───
    const wholesaleChannelIds = [
      ...new Set(
        products
          .map((p) => p.channelId as number | null)
          .filter((id): id is number => id !== null && id !== undefined)
      ),
    ]

    if (wholesaleChannelIds.length === 0) {
      await this.log('WARN', '도매채널이 없는 상품만 존재 — 가격정책 검증 불가')
      return violations
    }

    // ─── Step 2: 도매채널별 활성 PricingPolicy 일괄 로드 ───
    // 채널당 여러 정책이 있을 수 있으나, 동시에 활성(isActive=true)인 정책 1개 기준 적용
    // (복수 정책이 있으면 가장 최근에 생성된 정책 우선)
    const policies = await prisma.pricingPolicy.findMany({
      where: {
        channelId: { in: wholesaleChannelIds },
        isActive: true,
        channel: {
          kind: 'WHOLESALE', // 도매채널 정책만 조회 (소매채널 혼입 방지)
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // channelId → 정책 맵 (채널당 첫 번째 = 가장 최신 정책만 사용)
    const policyByChannelId = new Map<number, typeof policies[number]>()
    for (const policy of policies) {
      if (!policyByChannelId.has(policy.channelId)) {
        policyByChannelId.set(policy.channelId, policy)
      }
    }

    await this.log(
      'INFO',
      `도매채널 ${wholesaleChannelIds.length}개 중 가격정책 보유 ${policyByChannelId.size}개 채널`,
      { channelIds: wholesaleChannelIds, policiedChannelIds: [...policyByChannelId.keys()] }
    )

    // ─── Step 3~5: 상품별 검증 ───
    for (const product of products) {
      const wholesaleChannelId = product.channelId as number | null

      if (!wholesaleChannelId) {
        // 도매채널 정보 없는 상품 → 검증 불가, 경고 로그만 기록
        await this.log('WARN', `상품 ${product.id}(${product.name})에 도매채널 정보 없음 — 가격정책 검증 스킵`)
        continue
      }

      const policy = policyByChannelId.get(wholesaleChannelId)

      if (!policy) {
        // 해당 도매채널에 등록된 활성 정책 없음 → 검증 불가
        await this.log(
          'WARN',
          `도매채널 ${wholesaleChannelId}에 활성 가격정책 없음 — 상품 ${product.id} 검증 스킵`
        )
        continue
      }

      // 채널별 마진 규칙 파싱
      const rules = parsePricingPolicyRules(policy.content)
      if (rules.length === 0) {
        await this.log('WARN', `채널 ${wholesaleChannelId} 정책(${policy.name}) 파싱 결과 규칙 없음`)
        continue
      }

      // 제외 조건 파싱 (예: "40,000원 이상 제외")
      const excludeAbove = parseExcludeAbove(policy.content)

      // 상품 단위 배송비 (배송비 별도 상품은 도매가+배송비 합산이 마진 기준가)
      const productShippingFee = Number((product as any).shippingFee ?? 0)

      // variant 단위 가격 검증
      for (const variant of product.variants ?? []) {
        const wholesale = Number(variant.wholesalePrice ?? 0)
        const actual = Number(variant.price ?? 0)

        if (!wholesale || !actual) continue

        // ── 기준가 계산: 두 케이스 모두 시도 ──
        // Case A: 무료배송/배송비 포함 → 기준가 = 도매가
        // Case B: 배송비 별도          → 기준가 = 도매가 + 배송비
        const basePriceA = wholesale
        const basePriceB = productShippingFee > 0 ? wholesale + productShippingFee : null

        const expectedA = calcExpectedPrice(basePriceA, rules, excludeAbove)
        const expectedB = basePriceB !== null ? calcExpectedPrice(basePriceB, rules, excludeAbove) : null

        // 두 케이스 모두 제외 조건이면 소싱 대상 외 → 스킵
        if (expectedA === null && expectedB === null) continue

        // 둘 중 하나라도 허용 오차 내에 맞으면 정상
        const withinTolerance = (exp: number | null) =>
          exp !== null && Math.abs(actual - exp) <= PRICE_TOLERANCE

        if (withinTolerance(expectedA) || withinTolerance(expectedB)) continue

        // 위반: 더 근접한 expected 값을 대표값으로 기록
        const bestExpected =
          expectedA !== null && expectedB !== null
            ? Math.abs(actual - expectedA) <= Math.abs(actual - expectedB) ? expectedA : expectedB
            : (expectedA ?? expectedB!)

        const violationType: PriceViolation['violationType'] =
          actual === wholesale ? 'NO_MARGIN_APPLIED' : 'WRONG_MARGIN'

        violations.push({
          productId: product.id,
          productName: product.name,
          channelId: wholesaleChannelId,
          channelName: product.channel?.name ?? `채널 ${wholesaleChannelId}`,
          variantId: variant.id,
          optionSummary: variant.optionSummary ?? null,
          wholesalePrice: wholesale,
          actualPrice: actual,
          expectedPrice: bestExpected,
          violationType,
          policyName: policy.name,
        })
      }
    }

    if (violations.length > 0) {
      await this.log('WARN', `가격정책 위반 ${violations.length}건 감지`, {
        byChannel: Object.fromEntries(
          wholesaleChannelIds.map((cid) => [
            cid,
            violations.filter((v) => v.channelId === cid).length,
          ])
        ),
      })
    }

    return violations
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 이미지 가격 텍스트 감지 (Gemini Vision)
  // ══════════════════════════════════════════════════

  /**
   * 상품 이미지들을 Gemini Vision으로 분석하여
   * 가격 텍스트(숫자+원/₩/￦)가 포함된 이미지를 탐지합니다.
   */
  async detectPriceInImages(products: any[]): Promise<ImageViolation[]> {
    const client = await this.getGeminiClient()
    if (!client) {
      await this.log('WARN', 'Gemini API 키 없음 — 이미지 감지 건너뜀')
      return []
    }

    const violations: ImageViolation[] = []

    for (const product of products) {
      const images: { id: number; url: string }[] = product.images ?? []
      if (images.length === 0) continue

      // 이미지 최대 3장까지만 분석 (비용/속도 최적화)
      const toAnalyze = images.slice(0, 3)

      for (const img of toAnalyze) {
        try {
          const imagePart = await this.fetchImageAsBase64(img.url)
          if (!imagePart) continue

          const prompt = `이 이미지를 분석해주세요.
다음 항목만 짧게 답해주세요:
1. 이미지에 가격(숫자 + 원, ₩, ￦, 원화 표시)이 텍스트로 적혀 있습니까? (예/아니오)
2. 적혀 있다면 감지된 가격 텍스트를 그대로 알려주세요.

형식:
가격텍스트포함: 예|아니오
감지된텍스트: (없으면 "없음")`

          const response = await client.generateContentWithImages(prompt, [imagePart])
          const text = response.content

          const hasPrice = text.includes('가격텍스트포함: 예')
          if (hasPrice) {
            const detectedMatch = text.match(/감지된텍스트:\s*(.+)/)
            const detectedText = detectedMatch?.[1]?.trim() ?? '(알 수 없음)'

            violations.push({
              productId: product.id,
              productName: product.name,
              imageId: img.id,
              imageUrl: img.url,
              detectedText,
            })

            await this.log('WARN', `이미지 가격 감지: 상품 ${product.id}`, {
              imageUrl: img.url,
              detectedText,
            })
          }
        } catch (err: any) {
          await this.log('WARN', `이미지 분석 실패 (상품 ${product.id}, 이미지 ${img.id}): ${err.message}`)
        }
      }
    }

    return violations
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 삭제 & 재발행
  // ══════════════════════════════════════════════════

  /**
   * 위반 상품을 소매밴드/쇼핑몰에서 삭제합니다.
   * - ChannelProduct.deletedAt 소프트삭제 + Band 게시물 삭제 이벤트 발행
   * - ShopProduct.deletedAt 소프트삭제
   * 실제 밴드 게시물 삭제는 BandAutomation 에이전트에 이벤트로 위임합니다.
   */
  async deletePublishedProduct(productId: number): Promise<{ deleted: boolean; error?: string }> {
    try {
      const now = new Date()

      // 소매밴드 ChannelProduct 소프트삭제
      const channelProducts = await prisma.channelProduct.findMany({
        where: { productId, deletedAt: null },
      })

      for (const cp of channelProducts) {
        await prisma.channelProduct.update({
          where: { id: cp.id },
          data: { deletedAt: now, isActive: false },
        })

        // 밴드 게시물 삭제 이벤트 발행 (BandAutomation이 처리)
        if (cp.postKey) {
          await this.emitEvent(
            'band.post.delete.requested',
            { channelId: cp.channelId, postKey: cp.postKey, productId },
            'HIGH'
          )
        }
      }

      // 쇼핑몰 ShopProduct 소프트삭제
      await prisma.shopProduct.updateMany({
        where: { productId, deletedAt: null },
        data: { deletedAt: now },
      })

      await this.log('INFO', `상품 ${productId} 발행 취소 완료`)
      return { deleted: true }
    } catch (err: any) {
      await this.log('ERROR', `상품 ${productId} 삭제 실패: ${err.message}`)
      return { deleted: false, error: err.message }
    }
  }

  /**
   * 삭제된 상품을 재변환 + 재발행 대기 상태로 전환합니다.
   * 실제 재발행은 소싱 파이프라인이 처리하도록 이벤트 발행.
   */
  async requestRepublish(productId: number, userId: number): Promise<void> {
    // Product를 '재발행 대기' 상태로 표시 (isActive=true, channelProduct 초기화)
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: true },
    })

    // 재변환 + 재발행 이벤트
    await this.emitEvent(
      'product.republish.requested',
      { productId, userId, reason: 'price_policy_violation' },
      'HIGH'
    )

    await this.log('INFO', `상품 ${productId} 재발행 요청 완료`)
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 원본 도매밴드 변동사항 모니터링
  // ══════════════════════════════════════════════════

  /**
   * 발행된 상품의 원본 도매밴드 포스트를 DB에서 역추적하여
   * 품절/가격변경/스펙변경 여부를 감지합니다.
   *
   * 작동 원리:
   *  - Product.channelId(도매채널) + Product.name 기반으로
   *    CollectedPost 테이블에서 최근 30일 내 유사 포스트를 조회
   *  - 최근 포스트가 없으면 → 품절 또는 게시물 삭제 가능성
   *  - 최근 포스트의 가격 정보가 DB의 wholesalePrice와 다르면 → 가격 변경
   *  - 최근 포스트의 상품명이 크게 달라지면 → 스펙/상품 변경
   *
   * 주의: Product.channelId는 소싱 원본 도매채널(WHOLESALE)만 가리킴
   *       소매채널(ChannelProduct.channelId)과 혼동하지 않도록 주의
   *
   * 조치:
   *  - POSSIBLY_SOLD_OUT → 발행 취소(소프트삭제) + 알림 이벤트
   *  - PRICE_CHANGED     → product.source.price.changed 이벤트 발행
   *                         (CommanderAgent → AI 재가공 → 재발행 파이프라인)
   *  - SPEC_CHANGED      → product.source.spec.changed 이벤트 발행
   */
  async checkSourceProductChanges(
    products: any[],
    options: { autoFix?: boolean; staleDaysThreshold?: number } = {}
  ): Promise<SourceChangeResult[]> {
    const { autoFix = false, staleDaysThreshold = 30 } = options
    const results: SourceChangeResult[] = []

    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - staleDaysThreshold)

    await this.log('INFO', `원본 변동 감시 시작: 상품 ${products.length}개 / 기준일 ${staleDaysThreshold}일`, {
      productCount: products.length,
      staleDaysThreshold,
    })

    for (const product of products) {
      const channelId = product.channelId as number | null
      if (!channelId) {
        results.push({
          productId: product.id,
          productName: product.name,
          channelId: null,
          changeType: 'OK',
          storedPrice: null,
          detectedPrice: null,
          detail: '도매채널 정보 없음 — 건너뜀',
        })
        continue
      }

      try {
        // ── 같은 채널에서 유사 상품명 포스트 최근 순 조회 ──
        // 제목에 상품명 키워드(앞 10자)가 포함되거나 externalId로 역추적
        const nameKeyword = product.name.slice(0, 20).trim()

        const recentPosts = await prisma.collectedPost.findMany({
          where: {
            channelId,
            deletedAt: null,
            OR: [
              { title: { contains: nameKeyword } },
              { content: { contains: nameKeyword } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
          },
        })

        // ── Case 1: 최근 포스트 아예 없음 → 품절/삭제 가능성 ──
        if (recentPosts.length === 0) {
          // 마지막으로 해당 채널에서 수집된 날짜 확인
          const latestPost = await prisma.collectedPost.findFirst({
            where: { channelId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })

          const daysSinceLastCollection = latestPost
            ? Math.floor((Date.now() - latestPost.createdAt.getTime()) / 86_400_000)
            : Infinity

          if (daysSinceLastCollection > staleDaysThreshold) {
            // 채널 자체를 오래 수집 안 함 → 데이터 부족으로 판단 불가
            results.push({
              productId: product.id,
              productName: product.name,
              channelId,
              changeType: 'OK',
              storedPrice: null,
              detectedPrice: null,
              detail: `채널 마지막 수집 ${daysSinceLastCollection}일 전 — 데이터 부족, 건너뜀`,
            })
            continue
          }

          // 채널은 최근 수집했는데 이 상품이 없음 → 품절 가능성 높음
          await this.log('WARN', `상품 ${product.id}(${product.name}) 원본 포스트 미발견 — 품절/삭제 의심`, {
            channelId,
            nameKeyword,
          })

          results.push({
            productId: product.id,
            productName: product.name,
            channelId,
            changeType: 'POSSIBLY_SOLD_OUT',
            storedPrice: Number(product.wholesalePrice ?? 0),
            detectedPrice: null,
            detail: `최근 ${staleDaysThreshold}일 내 원본 포스트 없음 (채널은 최근 수집 완료)`,
          })

          if (autoFix) {
            await this.deletePublishedProduct(product.id)
            await this.emitEvent(
              'product.source.sold_out',
              { productId: product.id, channelId, reason: 'source_post_not_found' },
              'HIGH'
            )
          } else {
            await this.emitEvent(
              'product.source.possibly_sold_out',
              { productId: product.id, channelId, productName: product.name },
              'NORMAL'
            )
          }
          continue
        }

        // ── Case 2: 포스트 발견 — 가격 변동 감지 ──
        const latestPost = recentPosts[0]
        const detectedPrice = this.extractPriceFromPostContent(latestPost.content)
        const storedPrice = Number(product.wholesalePrice ?? 0)

        if (detectedPrice !== null && storedPrice > 0) {
          const priceDiff = Math.abs(detectedPrice - storedPrice)
          const priceDiffPct = (priceDiff / storedPrice) * 100

          if (priceDiffPct > 5) {
            // 5% 이상 가격 차이 → 가격 변동 감지
            await this.log('WARN', `상품 ${product.id} 가격 변동 감지: ${storedPrice}원 → ${detectedPrice}원`, {
              channelId,
              priceDiffPct: priceDiffPct.toFixed(1),
            })

            results.push({
              productId: product.id,
              productName: product.name,
              channelId,
              changeType: 'PRICE_CHANGED',
              storedPrice,
              detectedPrice,
              detail: `저장가 ${storedPrice}원 → 감지가 ${detectedPrice}원 (${priceDiffPct.toFixed(1)}% 차이)`,
            })

            await this.emitEvent(
              'product.source.price.changed',
              {
                productId: product.id,
                channelId,
                storedPrice,
                detectedPrice,
                sourcePostId: latestPost.id,
              },
              'HIGH'
            )
            continue
          }
        }

        // ── Case 3: 상품명 변동 감지 ──
        const titleSimilarity = this.calcTitleSimilarity(product.name, latestPost.title)
        if (titleSimilarity < 0.5) {
          await this.log('INFO', `상품 ${product.id} 스펙 변동 의심: "${product.name}" vs "${latestPost.title}"`, {
            similarity: titleSimilarity,
          })

          results.push({
            productId: product.id,
            productName: product.name,
            channelId,
            changeType: 'SPEC_CHANGED',
            storedPrice,
            detectedPrice,
            detail: `제목 유사도 ${(titleSimilarity * 100).toFixed(0)}% — 스펙 변경 가능성`,
          })

          await this.emitEvent(
            'product.source.spec.changed',
            {
              productId: product.id,
              channelId,
              storedName: product.name,
              detectedTitle: latestPost.title,
              sourcePostId: latestPost.id,
            },
            'NORMAL'
          )
          continue
        }

        // ── 정상 ──
        results.push({
          productId: product.id,
          productName: product.name,
          channelId,
          changeType: 'OK',
          storedPrice,
          detectedPrice,
          detail: '원본 포스트 확인, 변동 없음',
        })
      } catch (err: any) {
        await this.log('ERROR', `상품 ${product.id} 원본 감시 오류: ${err.message}`)
        results.push({
          productId: product.id,
          productName: product.name,
          channelId,
          changeType: 'OK',
          storedPrice: null,
          detectedPrice: null,
          detail: `오류: ${err.message}`,
        })
      }
    }

    const byType = results.reduce(
      (acc, r) => {
        acc[r.changeType] = (acc[r.changeType] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    await this.log('INFO', '원본 변동 감시 완료', {
      total: results.length,
      ...byType,
    })

    await this.recordKpi('source_check_total', results.length)
    await this.recordKpi('source_sold_out', byType['POSSIBLY_SOLD_OUT'] ?? 0)
    await this.recordKpi('source_price_changed', byType['PRICE_CHANGED'] ?? 0)
    await this.recordKpi('source_spec_changed', byType['SPEC_CHANGED'] ?? 0)

    return results
  }

  /**
   * 포스트 본문에서 가격 정보를 추출합니다.
   * "25,000원", "25000원", "₩25,000" 형태 지원
   */
  private extractPriceFromPostContent(content: string): number | null {
    // 여러 숫자+원 패턴 중 첫 번째 유효한 가격 반환
    const patterns = [
      /₩\s*([\d,]+)/,
      /([\d,]+)\s*원/,
    ]
    for (const pat of patterns) {
      const m = content.match(pat)
      if (m) {
        const val = parseInt(m[1].replace(/,/g, ''), 10)
        // 합리적 가격 범위 (1,000원 ~ 10,000,000원)
        if (val >= 1000 && val <= 10_000_000) return val
      }
    }
    return null
  }

  /**
   * 두 제목 문자열의 유사도를 0~1 범위로 계산합니다.
   * 한글 단어 단위 겹침 비율로 단순 계산.
   */
  private calcTitleSimilarity(a: string, b: string): number {
    const tokenize = (s: string) =>
      s.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter((t) => t.length > 1)
    const tokensA = new Set(tokenize(a))
    const tokensB = new Set(tokenize(b))
    if (tokensA.size === 0 || tokensB.size === 0) return 0
    let common = 0
    for (const t of tokensA) {
      if (tokensB.has(t)) common++
    }
    return common / Math.max(tokensA.size, tokensB.size)
  }

  // ══════════════════════════════════════════════════
  //  통합 감사 실행
  // ══════════════════════════════════════════════════

  async auditProducts(
    productIds: number[],
    options: {
      autoFix?: boolean
      preloaded?: any[]
    } = {}
  ): Promise<AuditResult> {
    const { autoFix = false, preloaded } = options

    const result: AuditResult = {
      audited: productIds.length,
      priceViolations: [],
      imageViolations: [],
      deleted: [],
      republished: [],
      skipped: [],
      errors: [],
    }

    if (productIds.length === 0) return result

    // 상품 로드 (미리 로드된 경우 재사용)
    let products = preloaded ?? []
    if (products.length === 0) {
      products = await prisma.product.findMany({
        where: { id: { in: productIds }, deletedAt: null },
        include: {
          variants: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 5 },
          channel: { include: { pricingPolicies: { where: { isActive: true }, take: 1 } } },
          channelProducts: {
            where: { deletedAt: null },
            include: {
              channel: { include: { pricingPolicies: { where: { isActive: true }, take: 1 } } },
            },
          },
          shopProducts: { where: { deletedAt: null } },
        },
      })
    }

    // 가격정책 검증
    result.priceViolations = await this.validateProductPricing(products)

    // 이미지 가격 텍스트 감지
    result.imageViolations = await this.detectPriceInImages(products)

    // 위반 상품 집합
    const violatingIds = new Set([
      ...result.priceViolations.map((v) => v.productId),
      ...result.imageViolations.map((v) => v.productId),
    ])

    if (autoFix && violatingIds.size > 0) {
      for (const productId of violatingIds) {
        const product = products.find((p: any) => p.id === productId)
        if (!product) {
          result.skipped.push(productId)
          continue
        }

        // 삭제
        const deleteResult = await this.deletePublishedProduct(productId)
        if (!deleteResult.deleted) {
          result.errors.push({ productId, error: deleteResult.error ?? '삭제 실패' })
          continue
        }
        result.deleted.push(productId)

        // 재발행 요청
        await this.requestRepublish(productId, product.userId)
        result.republished.push(productId)
      }
    }

    await this.log('INFO', '감사 완료', {
      audited: result.audited,
      priceViolations: result.priceViolations.length,
      imageViolations: result.imageViolations.length,
      deleted: result.deleted.length,
      republished: result.republished.length,
    })

    return result
  }

  // ─── 내부 헬퍼 ───

  private async getGeminiClient(): Promise<GeminiClient | null> {
    if (this.geminiClient) return this.geminiClient

    // AiApiConfig 테이블에서 GEMINI 키 조회
    const apiConfig = await prisma.aiApiConfig.findFirst({
      where: { provider: AiProvider.GEMINI, isActive: true },
    })

    if (!apiConfig?.apiKey) return null

    this.geminiClient = new GeminiClient({
      provider: AiProvider.GEMINI,
      apiKey: apiConfig.apiKey,
      model: apiConfig.model || 'gemini-2.5-flash',
      temperature: 0.1,
    })

    return this.geminiClient
  }

  private async fetchImageAsBase64(url: string): Promise<AiImagePart | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!response.ok) return null

      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const mimeType = contentType.split(';')[0].trim()

      return { base64, mimeType }
    } catch {
      return null
    }
  }
}

export const productManagerAgent = new ProductManagerAgent()
