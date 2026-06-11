/**
 * AI 카테고리 분류 폴백 (B2B 공급몰 전환 STEP 1-3)
 *
 * 1차 키워드 분류(category.classifier.ts)가 미스(ETC, 매칭 0건)일 때만 호출되는
 * 2차 분류기. DB Category 트리(코드+이름)를 프롬프트에 포함해 Gemini(또는 폴백
 * provider)에게 코드 하나를 고르게 한다.
 *
 * - 실패(API 에러/무효 응답) 시 null 반환 → 호출부에서 'UNCLASSIFIED' 처리
 * - 카테고리 트리는 10분 메모리 캐시 (배치 변환 중 반복 조회 방지)
 */

import prisma from '@bandauto/db'
import { generateContentWithFallback, type AiClientConfig } from '../transformation/ai.client'

export type AiClassifierCandidate = AiClientConfig

interface CategoryEntry {
  code: string
  name: string
  depth: number
  parentCode: string | null
}

const TREE_CACHE_TTL_MS = 10 * 60 * 1000
let treeCache: { entries: CategoryEntry[]; loadedAt: number } | null = null

/** 활성 카테고리 목록 로드 (depth 1~2, UNCLASSIFIED 제외) — 10분 캐시 */
async function loadCategoryEntries(): Promise<CategoryEntry[]> {
  if (treeCache && Date.now() - treeCache.loadedAt < TREE_CACHE_TTL_MS) {
    return treeCache.entries
  }
  const rows = await prisma.category.findMany({
    where: { deletedAt: null, isActive: true, depth: { lte: 2 }, code: { not: 'UNCLASSIFIED' } },
    select: { code: true, name: true, depth: true, parent: { select: { code: true } } },
    orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }],
  })
  const entries = rows.map((r) => ({
    code: r.code,
    name: r.name,
    depth: r.depth,
    parentCode: r.parent?.code ?? null,
  }))
  treeCache = { entries, loadedAt: Date.now() }
  return entries
}

/** 테스트/시드 후 강제 갱신용 */
export function invalidateCategoryTreeCache(): void {
  treeCache = null
}

function buildClassifyPrompt(name: string, description: string | null | undefined, entries: CategoryEntry[]): string {
  const treeLines = entries
    .filter((e) => e.depth === 1)
    .map((parent) => {
      const children = entries.filter((e) => e.parentCode === parent.code)
      const childPart = children.length
        ? '\n' + children.map((c) => `  - ${c.code}: ${c.name}`).join('\n')
        : ''
      return `- ${parent.code}: ${parent.name}${childPart}`
    })
    .join('\n')

  return `다음 식품 도매 상품을 아래 카테고리 중 하나로 분류하세요.

# 상품 정보
상품명: ${name}
설명: ${(description || '').slice(0, 500) || '(없음)'}

# 카테고리 목록 (코드: 이름)
${treeLines}

# 규칙
- 가능하면 중분류(들여쓰기된 항목) 코드를 선택하세요. 애매하면 대분류 코드를 선택하세요.
- 반드시 위 목록에 있는 코드 하나만 답하세요. 다른 텍스트 없이 코드만 출력하세요.

답:`
}

/**
 * AI 폴백 분류 — 유효 카테고리 코드 또는 null 반환.
 * candidates 는 변환 파이프라인과 동일한 provider 후보 목록 (primary + 폴백).
 */
export async function classifyCategoryWithAi(
  name: string,
  description: string | null | undefined,
  candidates: AiClassifierCandidate[]
): Promise<string | null> {
  if (!candidates.length) return null

  try {
    const entries = await loadCategoryEntries()
    if (entries.length === 0) return null
    const validCodes = new Set(entries.map((e) => e.code))

    const prompt = buildClassifyPrompt(name, description, entries)
    // 분류는 짧은 출력이라 maxTokens 를 작게 — 비용/지연 최소화
    const response = await generateContentWithFallback(
      candidates.map((c) => ({ ...c, maxTokens: 64, temperature: 0 })),
      prompt,
      () => {}
    )

    const raw = response.content || ''
    // 응답에서 유효 코드 추출 (앞뒤 군더더기 텍스트 허용)
    const match = raw.toUpperCase().match(/[A-Z][A-Z0-9_]{1,99}/g)
    if (!match) return null
    const found = match.find((m) => validCodes.has(m))
    return found ?? null
  } catch (err) {
    console.warn('[CategoryAiClassifier] AI 분류 실패 (UNCLASSIFIED 처리):', (err as Error).message)
    return null
  }
}
