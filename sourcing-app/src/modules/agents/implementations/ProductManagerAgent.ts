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

// ─── 가격정책 파서 ───

interface ParsedPolicyRule {
  minWholesale: number
  maxWholesale: number | null
  margin: number
  marginType: 'fixed' | 'percent'
}

/**
 * 채널 가격정책 content 문자열에서 마진 규칙을 파싱합니다.
 *
 * 지원 포맷 (CLAUDE.md 정책 내용 기준):
 *  - "0 ~ 9,999원 → +1,000원"  (고정 마진)
 *  - "10,000원 이상 → +10%"     (퍼센트 마진)
 *  - "40,000원 이상 제외"        (제외 조건)
 */
function parsePricingPolicyRules(content: string): ParsedPolicyRule[] {
  const rules: ParsedPolicyRule[] = []

  // 고정 마진 패턴: "숫자 ~ 숫자 → +숫자원" 또는 "숫자원 미만/이하 → +숫자원"
  const fixedMarginPattern =
    /(\d[\d,]*)\s*[~～]\s*(\d[\d,]*)\s*원?\s*[→\-\>]+\s*\+\s*(\d[\d,]*)\s*원/g
  let match: RegExpExecArray | null
  while ((match = fixedMarginPattern.exec(content)) !== null) {
    rules.push({
      minWholesale: parseKoreanNumber(match[1]),
      maxWholesale: parseKoreanNumber(match[2]),
      margin: parseKoreanNumber(match[3]),
      marginType: 'fixed',
    })
  }

  // 퍼센트 마진 패턴: "숫자원 이상 → +숫자%" 또는 단독 줄
  const percentPattern =
    /(\d[\d,]*)\s*원?\s*이상\s*[→\-\>]+\s*\+\s*(\d+)\s*%/g
  while ((match = percentPattern.exec(content)) !== null) {
    rules.push({
      minWholesale: parseKoreanNumber(match[1]),
      maxWholesale: null,
      margin: parseInt(match[2], 10),
      marginType: 'percent',
    })
  }

  return rules
}

function parseKoreanNumber(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10) || 0
}

/**
 * 도매가에 해당하는 정책 기준 판매가를 계산합니다.
 * 매칭되는 규칙이 없으면 null 반환 (정책 적용 불가 또는 제외 대상)
 */
function calcExpectedPrice(
  wholesalePrice: number,
  rules: ParsedPolicyRule[],
  excludeAbove?: number
): number | null {
  // 제외 조건 (예: 40,000원 이상 제외)
  if (excludeAbove !== undefined && wholesalePrice >= excludeAbove) return null

  // 범위 정렬 (오름차순) 후 매칭
  const sorted = [...rules].sort((a, b) => a.minWholesale - b.minWholesale)

  for (const rule of sorted) {
    const inRange =
      wholesalePrice >= rule.minWholesale &&
      (rule.maxWholesale === null || wholesalePrice <= rule.maxWholesale)
    if (inRange) {
      if (rule.marginType === 'fixed') {
        return wholesalePrice + rule.margin
      } else {
        return Math.round(wholesalePrice * (1 + rule.margin / 100))
      }
    }
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
      'product.audit.requested',
      'product.published',
      'schedule.product.audit',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

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
    await this.log('INFO', '정기 감사 시작')
    await this.runFullAudit({ autoFix: true })
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
  //  SKILL 1: 가격정책 검증
  // ══════════════════════════════════════════════════

  /**
   * 발행 상품들을 대상으로 가격정책 위반 여부 검사
   * - 채널별 PricingPolicy.content 파싱
   * - 각 variant의 wholesalePrice vs 실제 price 비교
   */
  async validateProductPricing(products: any[]): Promise<PriceViolation[]> {
    const violations: PriceViolation[] = []

    for (const product of products) {
      // 채널에 연결된 가격정책 가져오기
      const policy =
        product.channel?.pricingPolicies?.[0] ??
        // 소매채널에 발행된 경우 채널의 정책도 확인
        product.channelProducts?.[0]?.channel?.pricingPolicies?.[0]

      if (!policy) continue // 정책 없으면 검증 불가 → 스킵

      const rules = parsePricingPolicyRules(policy.content)
      if (rules.length === 0) continue

      const excludeAbove = parseExcludeAbove(policy.content)

      for (const variant of product.variants ?? []) {
        const wholesale = Number(variant.wholesalePrice ?? 0)
        const actual = variant.price

        if (!wholesale || !actual) continue

        const expected = calcExpectedPrice(wholesale, rules, excludeAbove)
        if (expected === null) continue // 제외 대상

        const diff = Math.abs(actual - expected)
        if (diff > PRICE_TOLERANCE) {
          const violationType: PriceViolation['violationType'] =
            actual === wholesale
              ? 'NO_MARGIN_APPLIED'
              : actual > expected + PRICE_TOLERANCE
              ? 'WRONG_MARGIN'
              : 'WRONG_MARGIN'

          violations.push({
            productId: product.id,
            productName: product.name,
            channelId: product.channelId ?? null,
            channelName: product.channel?.name ?? null,
            variantId: variant.id,
            optionSummary: variant.optionSummary,
            wholesalePrice: wholesale,
            actualPrice: actual,
            expectedPrice: expected,
            violationType,
            policyName: policy.name,
          })
        }
      }
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
