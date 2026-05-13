/**
 * 가격 이미지 필터링 유틸리티 (v2 — 2026-05-09)
 *
 * AI 상품 가공 시 "가격표/배너/안내장" 유형의 이미지를 감지하여 DB에서 제거.
 * 수동(ai-generate route) + 자동(transform pipeline) 양쪽에서 공유.
 *
 * 안전장치:
 * 1. confidence 80% 이상만 삭제 대상
 * 2. 최소 1장 반드시 보존 (전체 삭제 사고 방지)
 * 3. 물리 파일은 삭제하지 않음 (DB 레코드만 제거 → 복구 가능)
 * 4. 상세 로그 기록
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import prisma from '@bandauto/db'
import fs from 'fs'
import path from 'path'

const CONFIDENCE_THRESHOLD = 0.8

function expandHomePath(p: string): string {
  if (p.startsWith('~/')) return path.join(process.env.HOME || '/home/ubuntu', p.slice(2))
  return p
}

export interface PriceImageResult {
  isPriceBanner: boolean
  confidence: number
  reason: string
}

/**
 * Gemini Vision으로 이미지가 "가격표/배너/안내장" 유형인지 판별.
 *
 * 오탐 방지 핵심:
 * - "상품 사진 위에 가격 워터마크" vs "가격표/배너 전용 이미지" 를 명확히 구분
 * - 상품 실물 사진은 절대 삭제하지 않도록 프롬프트에 네거티브 예시 포함
 */
export async function analyzePriceImage(
  apiKey: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<PriceImageResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString('base64'),
            },
          },
          {
            text: `이 이미지를 분석해주세요. 아래 기준에 따라 JSON으로 응답하세요.

**삭제 대상 (isPriceBanner = true):**
- 가격표, 가격 안내 배너, 공급가/판매가 목록표
- 가격이 주요 내용인 텍스트 이미지 (예: "공급가 15,000원 / 판매가 25,000원")
- 도매가/소매가/할인가 등 금액 비교표
- 입금 계좌 안내, 주문 방법 안내장

**삭제하면 안 되는 것 (isPriceBanner = false):**
- 상품 실물 사진 (음식, 의류, 생활용품 등의 실제 모습)
- 상품 상세 이미지 (성분표, 영양정보, 사용법 등)
- 상품 포장 사진
- 배경에 작은 가격 태그가 있는 상품 진열 사진
- 리뷰/후기 이미지

반드시 아래 JSON 형식으로만 응답하세요:
{"isPriceBanner": true/false, "confidence": 0.0~1.0, "reason": "판단 근거 한 줄"}`,
          },
        ],
      }],
    })

    const text = result.response.text().trim()
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return {
      isPriceBanner: Boolean(parsed.isPriceBanner),
      confidence: Number(parsed.confidence) || 0,
      reason: String(parsed.reason || ''),
    }
  } catch (error) {
    console.error('[Image Price Check] Error:', error)
    return { isPriceBanner: false, confidence: 0, reason: 'API 호출 실패' }
  }
}

/**
 * 게시물 이미지 중 "가격표/배너" 유형을 DB에서 제거.
 *
 * @param apiKey Gemini API 키
 * @param postId 대상 게시물 ID
 * @returns 삭제된 이미지 수
 */
export async function filterPriceImages(apiKey: string, postId: number): Promise<number> {
  const images = await prisma.collectedPostImage.findMany({
    where: { postId },
    orderBy: { sortOrder: 'asc' },
  })

  // 이미지가 1장 이하면 필터링 스킵 (최소 보존)
  if (images.length <= 1) return 0

  const storagePath = process.env.POST_IMAGE_STORAGE_PATH || 'assets/images/post'
  const imagesDir = expandHomePath(storagePath)

  const deleteTargets: Array<{ id: number; fileName: string; reason: string; confidence: number }> = []

  for (const image of images) {
    const parts = image.url.split('/')
    const fileName = parts[parts.length - 1]
    const filePath = path.join(imagesDir, fileName)

    if (!fs.existsSync(filePath)) continue

    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(fileName).toLowerCase()
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

    const analysis = await analyzePriceImage(apiKey, buffer, mimeType)

    console.log(
      `[Image Price Filter] ${fileName}: isPriceBanner=${analysis.isPriceBanner}, ` +
      `confidence=${(analysis.confidence * 100).toFixed(0)}%, reason="${analysis.reason}"`
    )

    if (analysis.isPriceBanner && analysis.confidence >= CONFIDENCE_THRESHOLD) {
      deleteTargets.push({
        id: image.id,
        fileName,
        reason: analysis.reason,
        confidence: analysis.confidence,
      })
    }
  }

  // 안전장치: 최소 1장 보존
  const maxDeletable = images.length - 1
  const toDelete = deleteTargets.slice(0, maxDeletable)

  if (deleteTargets.length > maxDeletable) {
    console.warn(
      `[Image Price Filter] 안전장치 발동: ${deleteTargets.length}개 삭제 요청 중 ` +
      `${maxDeletable}개만 삭제 (최소 1장 보존, postId: ${postId})`
    )
  }

  // DB 레코드만 삭제 (파일 보존 → 복구 가능)
  for (const target of toDelete) {
    await prisma.collectedPostImage.delete({ where: { id: target.id } })
    console.log(
      `[Image Price Filter] 삭제: ${target.fileName} ` +
      `(confidence: ${(target.confidence * 100).toFixed(0)}%, reason: "${target.reason}", postId: ${postId})`
    )
  }

  // sortOrder 재정렬
  if (toDelete.length > 0) {
    const remaining = await prisma.collectedPostImage.findMany({
      where: { postId },
      orderBy: { sortOrder: 'asc' },
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await prisma.collectedPostImage.update({
          where: { id: remaining[i].id },
          data: { sortOrder: i },
        })
      }
    }
  }

  return toDelete.length
}

/**
 * 발행 시점에 ProductImage 의 가격이미지 여부 분석·기록.
 *
 * filterPriceImages 는 AI 가공 시점에 confidence ≥ 0.8 인 명확한 배너를 CollectedPostImage 에서
 * 삭제한다. 그러나 0.5~0.79 의 경계 케이스는 살아남아 ProductImage 가 되고, retail Band 발행 시
 * "공급가 N원" 텍스트가 그대로 노출되는 사고가 발생할 수 있다 (2026-05-13 하우스자두 사고).
 *
 * 이 함수는 publish.service.ts 가 호출. ProductImage.isPriceBanner=NULL 인 항목만 분석하여
 * DB 에 영구 기록 → 재발행 시 재분석 X (캐시 효과). 임계값 0.5 로 더 공격적.
 *
 * 발행 시 호출자는 isPriceBanner=true 인 ProductImage 를 imageUrls 에서 제외해야 한다.
 * 단 "최소 1장 보존" 안전장치는 호출자 (publish.service) 가 책임진다.
 */
export async function markPriceImagesOnProduct(
  apiKey: string,
  productId: number
): Promise<{ analyzed: number; flagged: number }> {
  const images = await prisma.productImage.findMany({
    where: { productId, isPriceBanner: null },
    orderBy: { sortOrder: 'asc' },
  })
  if (images.length === 0) return { analyzed: 0, flagged: 0 }

  const storagePath = process.env.PRODUCT_IMAGE_STORAGE_PATH || 'assets/images/product'
  const imagesDir = expandHomePath(storagePath)

  const PUBLISH_CONFIDENCE_THRESHOLD = 0.5

  // 병렬 분석 (Gemini 호출 ~1-2초/장 × 3장 직렬 → 1-2초 병렬)
  const analyses = await Promise.all(
    images.map(async (image) => {
      const fileName = image.fileName || image.url.split('/').pop() || ''
      if (!fileName) {
        return { id: image.id, isBanner: false, reason: 'no filename' as string, confidence: 0 }
      }
      const filePath = path.join(imagesDir, fileName)
      if (!fs.existsSync(filePath)) {
        return { id: image.id, isBanner: false, reason: 'file not found' as string, confidence: 0 }
      }
      try {
        const buffer = fs.readFileSync(filePath)
        const ext = path.extname(fileName).toLowerCase()
        const mimeType =
          ext === '.png' ? 'image/png' :
          ext === '.webp' ? 'image/webp' : 'image/jpeg'
        const analysis = await analyzePriceImage(apiKey, buffer, mimeType)
        const isBanner =
          analysis.isPriceBanner && analysis.confidence >= PUBLISH_CONFIDENCE_THRESHOLD
        return { id: image.id, isBanner, reason: analysis.reason, confidence: analysis.confidence }
      } catch (err) {
        // 실패 시 false 로 마킹 — 재시도 회피
        return { id: image.id, isBanner: false, reason: `analyze failed: ${(err as Error).message}`, confidence: 0 }
      }
    })
  )

  // DB 일괄 업데이트
  let flagged = 0
  for (const r of analyses) {
    await prisma.productImage.update({
      where: { id: r.id },
      data: { isPriceBanner: r.isBanner },
    })
    if (r.isBanner) flagged += 1
  }

  console.log(
    `[Price Image Mark] product=${productId} analyzed=${analyses.length} flagged=${flagged} ` +
    `details=[${analyses.map(a => `${a.id}:${a.isBanner ? 'B' : 'OK'}(${(a.confidence * 100).toFixed(0)}%)`).join(', ')}]`
  )

  return { analyzed: analyses.length, flagged }
}
