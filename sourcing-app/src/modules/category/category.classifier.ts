/**
 * 카테고리 자동 분류기
 *
 * 상품명 + 설명에서 CATEGORY_MAP의 키워드를 단순 부분일치로 매칭해
 * 가장 많이 매칭된 카테고리를 선택합니다. 매칭 0건이면 ETC 반환.
 *
 * - AI 호출 없이 동기 처리 (수집/가공 파이프라인에 추가 레이턴시 없음)
 * - **원재료 카테고리(SEA/AGR/MEA) 가중치 1.5배** (작업지침서 2026-05-15 §4)
 *   "갈치조림세트 밑반찬" 같은 상품에서 SEA 1점×1.5=1.5 > MKT 0점 으로 SEA 우선.
 * - 동점 시 CATEGORY_CODES 선언 순서(SEA → AGR → ...)가 우선 (Array.sort stable)
 * - confidence = min(match_count / 3, 1.0). 3개 이상 매칭이면 1.0
 *
 * COM(상시상품) 2차 분류:
 *  1차 원재료/가공 분류 완료 후, COM 키워드가 2개 이상 매칭되면 COM 으로 재분류.
 *  단일 매칭은 오탐 가능성 높아 제외.
 */

import { CATEGORY_MAP, CATEGORY_CODES, type CategoryCode } from './category.keywords'

export interface ClassifyResult {
  categoryId: CategoryCode
  categoryName: string
  confidence: number
  matchedKeywords: string[]
}

// 원재료 카테고리 — 가공/조리 카테고리(MKT/PRC)보다 우선 (가중치 1.5배)
const PRIMARY_CATEGORIES: ReadonlyArray<CategoryCode> = ['SEA', 'AGR', 'MEA']
const PRIORITY_WEIGHT = 1.5

export function classifyProduct(
  productName: string | null | undefined,
  description?: string | null,
): ClassifyResult {
  const text = `${productName ?? ''} ${description ?? ''}`

  const scores: {
    code: CategoryCode
    count: number
    weightedScore: number
    matched: string[]
  }[] = []

  for (const code of CATEGORY_CODES) {
    if (code === 'ETC') continue // ETC는 폴백 전용
    if (code === 'COM') continue // COM은 2차 분류 (아래 별도 체크)
    const cat = CATEGORY_MAP[code]
    const matched = cat.keywords.filter((kw) => text.includes(kw))
    if (matched.length > 0) {
      const weight = PRIMARY_CATEGORIES.includes(code) ? PRIORITY_WEIGHT : 1.0
      scores.push({
        code,
        count: matched.length,
        weightedScore: matched.length * weight,
        matched,
      })
    }
  }

  // 1차 결과 (없으면 ETC 폴백)
  let result: ClassifyResult
  if (scores.length === 0) {
    result = {
      categoryId: 'ETC',
      categoryName: CATEGORY_MAP.ETC.name,
      confidence: 0,
      matchedKeywords: [],
    }
  } else {
    // 가중 점수로 정렬 (원재료 카테고리 우선). 동점 시 선언 순서(stable sort) 유지.
    scores.sort((a, b) => b.weightedScore - a.weightedScore)
    const best = scores[0]
    result = {
      categoryId: best.code,
      categoryName: CATEGORY_MAP[best.code].name,
      confidence: Math.min(best.count / 3, 1),
      matchedKeywords: best.matched,
    }
  }

  // ── 2차 분류: COM(상시상품) — 키워드 2개 이상 매칭 시 재분류 ──
  // 단일 매칭(예: "상시" 1개)은 오탐 위험 — 2개+ 매칭일 때만 COM 으로 전환.
  const comKeywords = CATEGORY_MAP.COM.keywords
  if (comKeywords.length > 0) {
    const comMatched = comKeywords.filter((kw) => text.includes(kw))
    if (comMatched.length >= 2) {
      return {
        categoryId: 'COM',
        categoryName: CATEGORY_MAP.COM.name,
        confidence: Math.min(comMatched.length / 3, 1),
        matchedKeywords: comMatched,
      }
    }
  }

  return result
}
