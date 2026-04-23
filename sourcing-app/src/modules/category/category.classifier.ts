/**
 * 카테고리 자동 분류기
 *
 * 상품명 + 설명에서 CATEGORY_MAP의 키워드를 단순 부분일치로 매칭해
 * 가장 많이 매칭된 카테고리를 선택합니다. 매칭 0건이면 ETC 반환.
 *
 * - AI 호출 없이 동기 처리 (수집/가공 파이프라인에 추가 레이턴시 없음)
 * - 동점 시 CATEGORY_CODES 선언 순서(SEA → AGR → ...)가 우선
 * - confidence = min(match_count / 3, 1.0). 3개 이상 매칭이면 1.0
 */

import { CATEGORY_MAP, CATEGORY_CODES, type CategoryCode } from './category.keywords'

export interface ClassifyResult {
  categoryId: CategoryCode
  categoryName: string
  confidence: number
  matchedKeywords: string[]
}

export function classifyProduct(
  productName: string | null | undefined,
  description?: string | null,
): ClassifyResult {
  const text = `${productName ?? ''} ${description ?? ''}`

  const scores: { code: CategoryCode; count: number; matched: string[] }[] = []

  for (const code of CATEGORY_CODES) {
    if (code === 'ETC') continue // ETC는 폴백 전용
    const cat = CATEGORY_MAP[code]
    const matched = cat.keywords.filter((kw) => text.includes(kw))
    if (matched.length > 0) {
      scores.push({ code, count: matched.length, matched })
    }
  }

  if (scores.length === 0) {
    return {
      categoryId: 'ETC',
      categoryName: CATEGORY_MAP.ETC.name,
      confidence: 0,
      matchedKeywords: [],
    }
  }

  // 매칭 키워드 수가 가장 많은 카테고리 선택 (동점 시 선언 순서 → Array.sort는 stable)
  scores.sort((a, b) => b.count - a.count)
  const best = scores[0]

  return {
    categoryId: best.code,
    categoryName: CATEGORY_MAP[best.code].name,
    confidence: Math.min(best.count / 3, 1),
    matchedKeywords: best.matched,
  }
}
