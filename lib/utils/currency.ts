/**
 * 환율 계산 및 관리 유틸리티
 * AliExpress 통합을 위한 USD → KRW 변환
 */

interface ExchangeRateCache {
  rate: number
  timestamp: number
}

let cachedRate: ExchangeRateCache | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1시간

/**
 * USD → KRW 환율 조회 (1시간 캐싱)
 */
export async function getExchangeRate(): Promise<number> {
  const now = Date.now()

  // 캐시 확인
  if (cachedRate && (now - cachedRate.timestamp) < CACHE_DURATION) {
    console.log(`💰 캐시된 환율 사용: ${cachedRate.rate} KRW/USD`)
    return cachedRate.rate
  }

  try {
    // 환율 API 호출
    const apiUrl = process.env.EXCHANGE_RATE_API_URL || 'https://api.exchangerate-api.com/v4/latest/USD'
    const response = await fetch(apiUrl)
    const data = await response.json()

    const rate = data.rates?.KRW || 1300 // 기본값 1300원

    cachedRate = {
      rate,
      timestamp: now
    }

    console.log(`💰 환율 업데이트: ${rate} KRW/USD`)
    return rate

  } catch (error) {
    console.error('환율 조회 실패, 기본값 사용:', error)
    return 1300 // 실패 시 기본 환율
  }
}

/**
 * USD → KRW 변환
 */
export function convertToKRW(usdAmount: number, exchangeRate: number): number {
  return Math.round(usdAmount * exchangeRate)
}

/**
 * KRW → USD 변환
 */
export function convertToUSD(krwAmount: number, exchangeRate: number): number {
  return Math.round((krwAmount / exchangeRate) * 100) / 100
}

/**
 * 가격 정책 텍스트 파싱 (Band와 동일 + AliExpress 추가)
 */
export interface PricingPolicy {
  exchangeRate: number
  shippingCost: number
  customsDutyPercent: number
  marginPercent: number
  includeShipping: boolean
}

export function parsePricingPolicy(policyText: string, defaultExchangeRate: number = 1300): PricingPolicy {
  const policy: PricingPolicy = {
    exchangeRate: defaultExchangeRate,
    shippingCost: 0,
    customsDutyPercent: 0,
    marginPercent: 0,
    includeShipping: false
  }

  if (!policyText) {
    return policy
  }

  // 환율 추출
  const exchangeMatch = policyText.match(/환율\s*([0-9,]+)\s*원/i)
  if (exchangeMatch) {
    policy.exchangeRate = parseInt(exchangeMatch[1].replace(/,/g, ''))
  }

  // 배송비 추출
  const shippingMatch = policyText.match(/배송비\s*([0-9,]+)\s*원/i)
  if (shippingMatch) {
    policy.shippingCost = parseInt(shippingMatch[1].replace(/,/g, ''))
  }
  if (policyText.includes('배송비 포함') || policyText.includes('배송비포함')) {
    policy.includeShipping = true
  }

  // 관세 추출
  const customsMatch = policyText.match(/관세\s*([0-9]+)\s*%/i)
  if (customsMatch) {
    policy.customsDutyPercent = parseInt(customsMatch[1])
  }

  // 마진 추출
  const marginMatch = policyText.match(/([0-9]+)\s*%\s*마진/i) || policyText.match(/마진\s*([0-9]+)\s*%/i)
  if (marginMatch) {
    policy.marginPercent = parseInt(marginMatch[1])
  }

  return policy
}

/**
 * AliExpress 상품 최종 가격 계산
 */
export interface PriceCalculation {
  originalPriceUSD: number
  exchangeRate: number
  originalPriceKRW: number
  shippingCost: number
  customsDuty: number
  totalCost: number
  marginPercent: number
  marginAmount: number
  adjustedPrice: number
  policyUsed: string
}

export function calculateAliExpressPrice(
  originalPriceUSD: number,
  shippingPriceUSD: number,
  policy: PricingPolicy
): PriceCalculation {
  // 1. USD → KRW 환산
  const originalPriceKRW = convertToKRW(originalPriceUSD, policy.exchangeRate)
  const shippingCostKRW = policy.includeShipping ? 0 : (shippingPriceUSD ? convertToKRW(shippingPriceUSD, policy.exchangeRate) : policy.shippingCost)

  // 2. 관세 계산
  const customsDuty = Math.round(originalPriceKRW * (policy.customsDutyPercent / 100))

  // 3. 총 원가
  const totalCost = originalPriceKRW + shippingCostKRW + customsDuty

  // 4. 마진 적용
  const marginAmount = Math.round(totalCost * (policy.marginPercent / 100))
  const adjustedPrice = totalCost + marginAmount

  // 5. 100원 단위 반올림
  const finalPrice = Math.round(adjustedPrice / 100) * 100

  return {
    originalPriceUSD,
    exchangeRate: policy.exchangeRate,
    originalPriceKRW,
    shippingCost: shippingCostKRW,
    customsDuty,
    totalCost,
    marginPercent: policy.marginPercent,
    marginAmount,
    adjustedPrice: finalPrice,
    policyUsed: `환율 ${policy.exchangeRate}원, 배송비 ${shippingCostKRW}원, 관세 ${policy.customsDutyPercent}%, 마진 ${policy.marginPercent}%`
  }
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearExchangeRateCache(): void {
  cachedRate = null
}
