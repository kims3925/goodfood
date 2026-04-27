/**
 * 게시글 본문에서 대표 가격을 추출하는 유틸.
 *
 * 지침서 Phase 1 — 수집 단계 가격 필터링.
 * Channel.minSourcingPrice / maxSourcingPrice 와 비교해 범위 밖 게시글을 collection
 * 단계에서 아예 스킵하기 위해 사용.
 *
 * 추출 우선순위:
 *  1. "판매가/공급가/가격: N원" 류 라벨 + 숫자 — 가장 신뢰도 높음
 *  2. "N원" 단독 패턴 중 가장 큰 값 (옵션 가격 후보)
 *  3. 한글 표기 "N천원/만원" — parseKoreanNumber 폴백
 *  4. 추출 실패 시 null — 호출 측에서는 통과시켜야 함 (false negative 방지 우선)
 *
 * 의도적 보수성: 가격이 "옵션별로 다름" 같은 케이스(예: 1kg 5,000원 / 3kg 12,000원)
 * 에서는 가장 큰 값을 반환해 maxSourcingPrice 필터에 더 잘 걸리게 함. minSourcingPrice
 * 필터는 가장 작은 값으로 비교하면 좋겠지만, 단순화를 위해 동일 max 사용.
 * (정확도가 더 필요하면 추출된 모든 후보를 배열로 반환하도록 확장 가능.)
 */

const PRICE_REGEX_LABELED =
  /(?:판매\s*가|판매가격|공급\s*가|공급가격|소비자\s*가|가격|단가|값|Price)\s*[:：]?\s*(\d[\d,]*)\s*원/g
const PRICE_REGEX_PLAIN = /(\d[\d,]{2,})\s*원/g
// 한글 표기 — "5천원", "1만원", "1만5천원" 등
const PRICE_REGEX_KOREAN = /(\d+(?:\.\d+)?\s*만\s*\d*\s*천?|\d+\s*천)\s*원/g

function parseKoreanAmount(raw: string): number | null {
  // "1만5천", "2만", "5천" 형식 파싱
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(만|천)?\s*(\d+)?\s*(천)?$/)
  if (!m) return null
  const a = parseFloat(m[1])
  const u1 = m[2]
  const b = m[3] ? parseInt(m[3], 10) : 0
  const u2 = m[4]
  let total = 0
  if (u1 === '만') total += a * 10000
  else if (u1 === '천') total += a * 1000
  else total += a
  if (u2 === '천') total += b * 1000
  else total += b
  return Math.round(total)
}

/**
 * 본문 문자열에서 후보 가격들을 모두 추출.
 * 결과는 정수 원 단위 배열 (오름차순). 가격 미추출 시 빈 배열.
 */
export function extractPriceCandidates(content: string): number[] {
  if (!content) return []
  const out: number[] = []

  // 1) 라벨 + 가격
  for (const m of content.matchAll(PRICE_REGEX_LABELED)) {
    const n = parseInt(m[1].replace(/,/g, ''), 10)
    if (Number.isFinite(n) && n > 0) out.push(n)
  }
  // 2) 단순 N원 (3자리 이상만 — "10원" 같은 노이즈 제외)
  if (out.length === 0) {
    for (const m of content.matchAll(PRICE_REGEX_PLAIN)) {
      const n = parseInt(m[1].replace(/,/g, ''), 10)
      if (Number.isFinite(n) && n >= 100) out.push(n)
    }
  }
  // 3) 한글 표기
  if (out.length === 0) {
    for (const m of content.matchAll(PRICE_REGEX_KOREAN)) {
      const n = parseKoreanAmount(m[1].replace(/\s+/g, ''))
      if (n != null && n > 0) out.push(n)
    }
  }

  return Array.from(new Set(out)).sort((a, b) => a - b)
}

/**
 * 본문에서 대표 가격(최댓값)을 추출. 추출 실패 시 null.
 * maxSourcingPrice 필터링에 적합.
 */
export function extractPriceFromContent(content: string): number | null {
  const candidates = extractPriceCandidates(content)
  if (candidates.length === 0) return null
  return candidates[candidates.length - 1] // 최댓값
}

/**
 * 가격 범위 필터 결과.
 * pass=true면 게시글 수집, false면 스킵.
 */
export interface PriceFilterResult {
  pass: boolean
  detectedPrice: number | null
  reason?: string
}

/**
 * 본문에서 추출한 대표 가격이 [min, max] 범위 안에 있는지 검사.
 * 추출 실패(null) 시 항상 통과 — false negative(놓치고 수집 안 함) 방지 우선.
 */
export function checkPriceWithinRange(
  content: string,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined
): PriceFilterResult {
  if (minPrice == null && maxPrice == null) {
    return { pass: true, detectedPrice: null }
  }
  const price = extractPriceFromContent(content)
  if (price == null) {
    return { pass: true, detectedPrice: null, reason: '가격 추출 실패 — 안전하게 통과' }
  }
  if (minPrice != null && price < minPrice) {
    return {
      pass: false,
      detectedPrice: price,
      reason: `최저가 ${minPrice.toLocaleString()}원 미만 (${price.toLocaleString()}원)`,
    }
  }
  if (maxPrice != null && price > maxPrice) {
    return {
      pass: false,
      detectedPrice: price,
      reason: `최고가 ${maxPrice.toLocaleString()}원 초과 (${price.toLocaleString()}원)`,
    }
  }
  return { pass: true, detectedPrice: price }
}
