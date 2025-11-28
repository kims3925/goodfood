/**
 * Pricing Service
 * 가격정책 비즈니스 로직 레이어
 *
 * CLAUDE.md 기준 6개 도매밴드 가격정책:
 * 1. 가족도매방: 원가 그대로 + 39,900원 이상 구간별 마진
 * 2. 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진
 * 3. 나은 상품 공급방 & S D 푸드 & 폐쇄몰VIP도매: 공급가 기준 마진
 */

import prisma from '@bandauto/db'
import {
  ParsedPrice,
  ApplyPricingPolicyDTO,
  PricingResult,
  PricingPolicyType,
  CalculateShippingFeeDTO,
  SupplyPriceResult
} from '@/domain/pricing/types/pricing.type'
import { ValidationError } from '@/lib/errors/handlers'

export class PricingService {
  // 기본 가격정책 (fallback)
  private readonly FALLBACK_PRICING_POLICY = `수집가격 기준 구간별 마진 적용 (19,900원 이하 +1,000원, 20,000~29,900원 +2,000원, 30,000~39,900원 +3,000원, 40,000~49,900원 +4,000원, 50,000~59,900원 +5,000원, 60,001~70,000원 +6,000원, 70,001~80,000원 +7,000원, 80,001~90,000원 +8,000원, 90,001~100,000원 +9,000원, 100,001~150,000원 +12,000원, 150,001~200,000원 +20,000원, 200,001원 이상 +20,000원)`

  /**
   * 가격 문자열 파싱
   */
  parsePrice(priceStr: any): ParsedPrice {
    if (!priceStr) {
      return { value: 0, isValid: false, rawInput: priceStr }
    }

    if (typeof priceStr === 'number' && !isNaN(priceStr) && priceStr > 0) {
      return {
        value: Math.floor(priceStr),
        isValid: true,
        rawInput: priceStr
      }
    }

    let cleanStr = String(priceStr)

    // 1. "5,500원" 형태 파싱
    const priceMatch = cleanStr.match(/([0-9,]+)원/)
    if (priceMatch) {
      const priceOnly = priceMatch[1].replace(/,/g, '')
      const parsed = parseInt(priceOnly)
      if (!isNaN(parsed) && parsed > 0) {
        return { value: parsed, isValid: true, rawInput: priceStr }
      }
    }

    // 2. "15000" 또는 "15,000" 형태 파싱
    const numberMatch = cleanStr.match(/^[0-9,]+/)
    if (numberMatch) {
      const cleanPrice = numberMatch[0].replace(/,/g, '')
      const parsed = parseInt(cleanPrice)
      if (!isNaN(parsed) && parsed > 0) {
        return { value: parsed, isValid: true, rawInput: priceStr }
      }
    }

    // 3. 문자열에서 숫자만 추출
    const allNumbers = cleanStr.replace(/[^0-9]/g, '')
    if (allNumbers) {
      const limitedNumbers = allNumbers.substring(0, 6)
      const parsed = parseInt(limitedNumbers)
      if (!isNaN(parsed) && parsed > 0) {
        return { value: parsed, isValid: true, rawInput: priceStr }
      }
    }

    return { value: 0, isValid: false, rawInput: priceStr }
  }

  /**
   * 가격정책 적용
   */
  async applyPricingPolicy(data: ApplyPricingPolicyDTO): Promise<PricingResult> {
    if (!data.originalPrice || data.originalPrice <= 0) {
      throw new ValidationError('원가는 0보다 커야 합니다')
    }

    // 정책이 없거나 공백이면 기본 정책 사용
    let effectivePolicy = data.pricingPolicyText
    if (!effectivePolicy || effectivePolicy.trim() === '') {
      console.log('⚠️ 가격정책이 없음 → 기본 정책 로드')
      effectivePolicy = data.userId
        ? await this.getDefaultPricingPolicy(data.userId)
        : this.FALLBACK_PRICING_POLICY
      console.log(`📋 기본 정책 적용: ${effectivePolicy.substring(0, 50)}...`)
    }

    const policy = effectivePolicy.toLowerCase()
    const shippingFee = data.shippingFee || 0

    console.log(
      `🔧 가격정책 적용 시도: 원가 ${data.originalPrice}원, 배송비 ${shippingFee}원, 정책: ${effectivePolicy.substring(0, 100)}...`
    )

    // 1️⃣ 가족도매방: 원가 그대로 판매 (단, 39,900원 이상은 구간별 마진 적용)
    if (
      policy.includes('원가 그대로') ||
      policy.includes('원가그대로') ||
      policy.includes('마진 없음') ||
      policy.includes('마진없음')
    ) {
      return this.applyFamilyWholesalePolicy(data.originalPrice, effectivePolicy)
    }

    // 2️⃣ 요한이네♧소매방 & 초록이네: 수집가격 기준 구간별 마진 적용
    if (
      policy.includes('수집가격 기준 구간별 마진') ||
      policy.includes('수집된 게시물 가격 기준으로')
    ) {
      return this.applyYohanChorokiPolicy(data.originalPrice, effectivePolicy)
    }

    // 3️⃣ 나은 상품 공급방, S D 푸드, 폐쇄몰VIP도매: 공급가 기준 마진 적용, 배송비 별도
    if (
      policy.includes('공급가와 배송비를 분리') ||
      policy.includes('공급가에만 마진 적용')
    ) {
      return this.applyNaeunSDClosedPolicy(data.originalPrice, effectivePolicy)
    }

    // 4️⃣ 퍼센트 마진 패턴 (예: 30% 마진, 20% 추가)
    const percentMatch = policy.match(
      /(\d+)%\s*마진|(\d+)%\s*추가|(\d+)%\s*올려서|마진\s*(\d+)%/
    )
    if (percentMatch) {
      const percent = parseInt(
        percentMatch[1] || percentMatch[2] || percentMatch[3] || percentMatch[4]
      )
      const appliedPrice = Math.round(data.originalPrice * (1 + percent / 100))
      const margin = appliedPrice - data.originalPrice
      console.log(`📋 정책 적용: ${percent}% 마진 → ${appliedPrice}원`)

      return {
        originalPrice: data.originalPrice,
        appliedPrice,
        margin,
        marginPercentage: percent,
        policyType: PricingPolicyType.PERCENT_MARGIN,
        policyDescription: `${percent}% 마진 적용`,
        shippingFee
      }
    }

    // 5️⃣ 고정 마진 패턴 (예: 1000원 마진, +2000원)
    const fixedMarginMatch = policy.match(
      /(\d+)원\s*마진|마진\s*(\d+)원|\+(\d+)원|(\d+)원\s*추가/
    )
    if (fixedMarginMatch) {
      const margin = parseInt(
        fixedMarginMatch[1] ||
          fixedMarginMatch[2] ||
          fixedMarginMatch[3] ||
          fixedMarginMatch[4]
      )
      const appliedPrice = data.originalPrice + margin
      console.log(`📋 정책 적용: +${margin}원 마진 → ${appliedPrice}원`)

      return {
        originalPrice: data.originalPrice,
        appliedPrice,
        margin,
        marginPercentage: (margin / data.originalPrice) * 100,
        policyType: PricingPolicyType.FIXED_MARGIN,
        policyDescription: `+${margin}원 고정 마진`,
        shippingFee
      }
    }

    // 6️⃣ 배수 패턴 (예: 1.3배, 원가의 120%)
    const multipleMatch = policy.match(/(\d+\.?\d*)배|원가의?\s*(\d+)%/)
    if (multipleMatch) {
      const multiple =
        parseFloat(multipleMatch[1]) || parseInt(multipleMatch[2]) / 100
      const appliedPrice = Math.round(data.originalPrice * multiple)
      const margin = appliedPrice - data.originalPrice
      console.log(`📋 정책 적용: ${multiple}배 → ${appliedPrice}원`)

      return {
        originalPrice: data.originalPrice,
        appliedPrice,
        margin,
        marginPercentage: (multiple - 1) * 100,
        policyType: PricingPolicyType.MULTIPLE,
        policyDescription: `${multiple}배 적용`,
        shippingFee
      }
    }

    // 7️⃣ 최소 마진 패턴
    const minMarginMatch = policy.match(/최소\s*마진\s*(\d+)원|최소\s*(\d+)원/)
    if (minMarginMatch) {
      const minMargin = parseInt(minMarginMatch[1] || minMarginMatch[2])
      const appliedPrice = data.originalPrice + minMargin
      console.log(`📋 정책 적용: 최소 ${minMargin}원 마진 → ${appliedPrice}원`)

      return {
        originalPrice: data.originalPrice,
        appliedPrice,
        margin: minMargin,
        marginPercentage: (minMargin / data.originalPrice) * 100,
        policyType: PricingPolicyType.MIN_MARGIN,
        policyDescription: `최소 ${minMargin}원 마진`,
        shippingFee
      }
    }

    // 8️⃣ 기본값: 정책이 있지만 패턴이 일치하지 않는 경우 - 원가 그대로 반환
    console.log(`⚠️ 정책 패턴 불일치 → 원가 그대로: ${data.originalPrice}원`)

    return {
      originalPrice: data.originalPrice,
      appliedPrice: data.originalPrice,
      margin: 0,
      marginPercentage: 0,
      policyType: PricingPolicyType.NO_POLICY,
      policyDescription: '정책 없음 (원가 그대로)',
      shippingFee
    }
  }

  /**
   * 가족도매방 정책 적용
   */
  private applyFamilyWholesalePolicy(
    originalPrice: number,
    policyText: string
  ): PricingResult {
    console.log('📋 [가족도매방] 정책 적용')

    let appliedPrice = originalPrice
    let margin = 0

    if (originalPrice <= 39900) {
      appliedPrice = originalPrice
      margin = 0
      console.log(`  ✅ 39,900원 이하 → 원가 그대로: ${appliedPrice}원`)
    } else if (originalPrice >= 40000 && originalPrice <= 49900) {
      margin = 2000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 40,000~49,900원 → +2,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 50000 && originalPrice <= 59900) {
      margin = 4000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 50,000~59,900원 → +4,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 60001 && originalPrice <= 70000) {
      margin = 6000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 60,001~70,000원 → +6,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 70001 && originalPrice <= 80000) {
      margin = 7000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 70,001~80,000원 → +7,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 80001 && originalPrice <= 90000) {
      margin = 8000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 80,001~90,000원 → +8,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 90001 && originalPrice <= 100000) {
      margin = 9000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 90,001~100,000원 → +9,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 100001 && originalPrice <= 150000) {
      margin = 12000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 100,001~150,000원 → +12,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 150001 && originalPrice <= 200000) {
      margin = 20000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 150,001~200,000원 → +20,000원: ${appliedPrice}원`)
    } else {
      appliedPrice = originalPrice
      margin = 0
      console.log(`  ✅ 범위 밖 → 원가 그대로: ${appliedPrice}원`)
    }

    return {
      originalPrice,
      appliedPrice,
      margin,
      marginPercentage: originalPrice > 0 ? (margin / originalPrice) * 100 : 0,
      policyType: PricingPolicyType.FAMILY_WHOLESALE,
      policyDescription: '가족도매방: 원가 그대로 + 구간별 마진',
      shippingFee: 0
    }
  }

  /**
   * 요한이네/초록이네 정책 적용
   */
  private applyYohanChorokiPolicy(
    originalPrice: number,
    policyText: string
  ): PricingResult {
    console.log('📋 [요한이네/초록이네] 정책 적용')

    let appliedPrice = originalPrice
    let margin = 0

    if (originalPrice <= 19900) {
      margin = 1000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 19,900원 이하 → +1,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 20000 && originalPrice <= 29900) {
      margin = 2000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 20,000~29,900원 → +2,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 30000 && originalPrice <= 39900) {
      margin = 3000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 30,000~39,900원 → +3,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 40000 && originalPrice <= 49900) {
      margin = 4000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 40,000~49,900원 → +4,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 50000 && originalPrice <= 59900) {
      margin = 5000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 50,000~59,900원 → +5,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 60001 && originalPrice <= 70000) {
      margin = 6000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 60,001~70,000원 → +6,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 70001 && originalPrice <= 80000) {
      margin = 7000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 70,001~80,000원 → +7,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 80001 && originalPrice <= 90000) {
      margin = 8000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 80,001~90,000원 → +8,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 90001 && originalPrice <= 100000) {
      margin = 9000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 90,001~100,000원 → +9,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 100001 && originalPrice <= 150000) {
      margin = 12000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 100,001~150,000원 → +12,000원: ${appliedPrice}원`)
    } else if (originalPrice >= 150001 && originalPrice <= 200000) {
      margin = 20000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 150,001~200,000원 → +20,000원: ${appliedPrice}원`)
    } else {
      margin = 20000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 200,001원 이상 → +20,000원: ${appliedPrice}원`)
    }

    return {
      originalPrice,
      appliedPrice,
      margin,
      marginPercentage: (margin / originalPrice) * 100,
      policyType: PricingPolicyType.YOHAN_CHOROKI,
      policyDescription: '요한이네/초록이네: 수집가격 기준 구간별 마진',
      shippingFee: 0
    }
  }

  /**
   * 나은/SD푸드/폐쇄몰 정책 적용
   */
  private applyNaeunSDClosedPolicy(
    originalPrice: number,
    policyText: string
  ): PricingResult {
    console.log('📋 [나은/SD푸드/폐쇄몰] 정책 적용')

    let margin = 0
    let appliedPrice = originalPrice

    if (originalPrice <= 19900) {
      margin = 4000
      appliedPrice = originalPrice + margin
      console.log(`  ✅ 19,900원 이하 → +4,000원: ${appliedPrice}원`)
    } else {
      const excess = originalPrice - 19900
      const additionalSections = Math.ceil(excess / 10000)
      const additionalMargin = additionalSections * 1000
      margin = 4000 + additionalMargin
      appliedPrice = originalPrice + margin
      console.log(
        `  ✅ 19,900원 초과 → 기본 4,000원 + 초과구간(${additionalSections}구간) ${additionalMargin}원 = 총 마진 ${margin}원: ${appliedPrice}원`
      )
    }

    return {
      originalPrice,
      appliedPrice,
      margin,
      marginPercentage: (margin / originalPrice) * 100,
      policyType: PricingPolicyType.NAEUN_SD_CLOSED,
      policyDescription: '나은/SD푸드/폐쇄몰: 공급가 기준 마진 + 배송비 별도',
      shippingFee: 0
    }
  }

  /**
   * 배송비 계산
   */
  calculateShippingFee(data: CalculateShippingFeeDTO): number {
    const freeShippingAmount =
      data.freeShippingAmount ||
      parseFloat(process.env.FREE_SHIPPING_AMOUNT || '30000')

    const defaultShippingFee =
      data.defaultShippingFee ||
      parseFloat(process.env.DEFAULT_SHIPPING_FEE || '3000')

    return data.totalAmount >= freeShippingAmount ? 0 : defaultShippingFee
  }

  /**
   * 공급가 계산 (가족도매방 전용)
   * 공급가 = 원가 × 90%
   */
  calculateSupplyPrice(originalPrice: number): SupplyPriceResult {
    if (!originalPrice || originalPrice <= 0) {
      throw new ValidationError('원가는 0보다 커야 합니다')
    }

    const supplyPrice = Math.round(originalPrice * 0.9)

    // 판매가 계산 (가족도매방 정책 적용)
    const pricingResult = this.applyFamilyWholesalePolicy(
      originalPrice,
      '원가 그대로'
    )
    const salePrice = pricingResult.appliedPrice

    return {
      supplyPrice,
      originalPrice,
      salePrice,
      margin: salePrice - supplyPrice
    }
  }

  /**
   * Private: 데이터베이스에서 기본 가격정책 로드
   */
  private async getDefaultPricingPolicy(userId: string): Promise<string> {
    try {
      const automationSettings = await prisma.automationSettings.findUnique({
        where: { userId: parseInt(userId) }
      })

      if (automationSettings && automationSettings.defaultPricingPolicy) {
        return automationSettings.defaultPricingPolicy
      }

      return this.FALLBACK_PRICING_POLICY
    } catch (error) {
      console.error('❌ 기본 가격정책 로드 실패, fallback 사용:', error)
      return this.FALLBACK_PRICING_POLICY
    }
  }
}

// Singleton 인스턴스
export const pricingService = new PricingService()
