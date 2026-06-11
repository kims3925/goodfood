/**
 * 중복상품 감지 (B2B 공급몰 전환 STEP 2-3, G4)
 *
 * 수집→변환 사이 + 상품 생성 직후 두 지점에서 동작해 AI 비용과 중복 발행을 줄인다.
 *
 * 1차 (변환 전, transform 파이프라인): 동일 채널 내 정규화 제목 완전 일치 →
 *    해당 게시물 soft-delete(가역) + 변환 스킵. AI 호출 자체를 막는다.
 * 2차 (상품 생성 직후): 제목 유사도(레벤슈타인 기반) ≥ 0.85 →
 *    ProductDuplicate 기록. 관리자 "중복 후보" 화면에서 무시/비활성 처리.
 * 3차 (선택, 미구현): 대표 이미지 pHash — 채널이 다른 동일 상품 감지.
 */

import prisma from '@bandauto/db'

/** 제목 정규화: 공백/특수문자/이모지 제거 + 소문자화 */
export function normalizeTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    // 한글/영문/숫자만 남김 (공백·특수문자·이모지 제거)
    .replace(/[^가-힣ㄱ-ㆎ0-9a-z]/g, '')
}

/** 레벤슈타인 거리 (반복 DP, 메모리 O(min(n,m))) */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (a.length > b.length) [a, b] = [b, a]

  let prev = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    const curr = [j]
    for (let i = 1; i <= a.length; i++) {
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[a.length]
}

/** 정규화 제목 유사도 0~1 */
export function titleSimilarity(titleA: string, titleB: string): number {
  const a = normalizeTitle(titleA)
  const b = normalizeTitle(titleB)
  if (!a || !b) return 0
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / maxLen
}

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.85

/**
 * 1차 — 변환 전 완전 중복 검사 (동일 채널, 정규화 제목 일치).
 * 일치하는 기존 활성 Product 가 있으면 그 id 반환 (변환 스킵 대상).
 */
export async function findExactDuplicateProduct(
  userId: number,
  channelId: number,
  title: string
): Promise<number | null> {
  const normalized = normalizeTitle(title)
  if (!normalized) return null

  // 동일 채널의 활성 상품 제목만 (최근 1000건) 메모리 비교 — 정규화는 DB 로 못 미루므로 JS 에서
  const products = await prisma.product.findMany({
    where: { userId, channelId, deletedAt: null },
    select: { id: true, name: true, sourceProductName: true },
    orderBy: { id: 'desc' },
    take: 1000,
  })

  for (const p of products) {
    if (normalizeTitle(p.name) === normalized) return p.id
    if (p.sourceProductName && normalizeTitle(p.sourceProductName) === normalized) return p.id
  }
  return null
}

export interface DuplicateCandidate {
  dupProductId: number
  similarity: number
}

/**
 * 2차 — 상품 생성 직후 유사 중복 스캔.
 * 같은 사용자(채널 무관)의 최근 활성 상품과 제목 유사도 비교,
 * 임계치 이상이면 ProductDuplicate upsert (idempotent).
 */
export async function scanSimilarDuplicates(
  userId: number,
  productId: number,
  title: string
): Promise<DuplicateCandidate[]> {
  const normalized = normalizeTitle(title)
  if (!normalized) return []

  const products = await prisma.product.findMany({
    where: { userId, deletedAt: null, id: { not: productId } },
    select: { id: true, name: true },
    orderBy: { id: 'desc' },
    take: 500,
  })

  const candidates: DuplicateCandidate[] = []
  for (const p of products) {
    const sim = titleSimilarity(title, p.name)
    if (sim >= DUPLICATE_SIMILARITY_THRESHOLD) {
      candidates.push({ dupProductId: p.id, similarity: Math.round(sim * 1000) / 1000 })
    }
  }

  for (const c of candidates) {
    try {
      await prisma.productDuplicate.upsert({
        where: {
          productId_dupProductId_method: {
            productId,
            dupProductId: c.dupProductId,
            method: 'TITLE_SIM',
          },
        },
        update: { similarity: c.similarity },
        create: {
          productId,
          dupProductId: c.dupProductId,
          method: 'TITLE_SIM',
          similarity: c.similarity,
        },
      })
    } catch (e: any) {
      console.warn('[DuplicateDetector] ProductDuplicate 기록 실패:', e?.message)
    }
  }

  if (candidates.length > 0) {
    console.log(`[DuplicateDetector] product#${productId} "${title.slice(0, 30)}" 중복 후보 ${candidates.length}건 기록`)
  }
  return candidates
}
