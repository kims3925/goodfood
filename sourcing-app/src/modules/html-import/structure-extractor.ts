/**
 * AI Vision/Text 으로 페이지 레이아웃 분석 + 상품 데이터 보강
 *
 * 작업지침서 §4-3. 기존 transformation/ai.client 의 createAiClient + AiImagePart 재사용.
 * Provider 는 사용자 AiApiConfig 에서 활성 설정을 자동 선택 (GEMINI 우선).
 */

import prisma from '@bandauto/db'
import {
  createAiClient,
  type BaseAiClient,
  type AiImagePart,
} from '../transformation/ai.client'
import { AiProvider } from '@bandauto/db'
import type { ExtractedProductData, PageLayoutAnalysis } from './types'

/**
 * 사용자의 활성 AI 설정에서 클라이언트 생성.
 * 우선순위: GEMINI > CLAUDE > OPENAI (Vision 지원 우선)
 */
export async function createUserAiClient(userId: number): Promise<BaseAiClient> {
  const order: AiProvider[] = [AiProvider.GEMINI, 'CLAUDE' as AiProvider, AiProvider.OPENAI]
  for (const provider of order) {
    const config = await prisma.aiApiConfig.findFirst({
      where: { userId, provider, isActive: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (config?.apiKey) {
      return createAiClient({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
      })
    }
  }
  throw new Error(
    'AI 설정이 없습니다. /sourcing/settings/ai 페이지에서 Gemini 또는 Claude API 키를 등록해 주세요.'
  )
}

export class StructureExtractor {
  constructor(private aiClient: BaseAiClient) {}

  async analyzePageLayout(screenshot: Buffer): Promise<PageLayoutAnalysis> {
    const imagePart: AiImagePart = {
      base64: screenshot.toString('base64'),
      mimeType: 'image/png',
    }

    const prompt = `이 쇼핑몰 페이지 스크린샷을 분석해주세요.

다음 JSON 형식으로 응답:
{
  "pageType": "product_detail" | "category_list" | "landing" | "event",
  "layout": {
    "headerStyle": "fixed" | "static" | "transparent",
    "productImagePosition": "left" | "top" | "full-width",
    "gridColumns": 2 | 3 | 4,
    "hasHeroBanner": true/false,
    "hasSidebar": true/false
  },
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "accent": "#hex"
  },
  "typography": {
    "headingFont": "sans-serif | serif | display",
    "bodyFont": "sans-serif | serif",
    "titleSize": "large | medium | small"
  },
  "features": ["breadcrumb", "reviews", "related-products", "sticky-cart"],
  "overallStyle": "minimal" | "luxury" | "playful" | "corporate" | "traditional"
}

JSON만 응답하세요. 마크다운/코드펜스 없이.`

    const response = await this.aiClient.generateContentWithImages(prompt, [imagePart])
    const cleaned = this.cleanJsonResponse(response.content)
    return JSON.parse(cleaned) as PageLayoutAnalysis
  }

  async enrichProductData(
    extracted: ExtractedProductData,
    screenshot?: Buffer
  ): Promise<ExtractedProductData> {
    const parts: AiImagePart[] = screenshot
      ? [{ base64: screenshot.toString('base64'), mimeType: 'image/png' }]
      : []

    const prompt = `다음 쇼핑몰에서 추출한 상품 정보를 검증하고 보강해주세요.

추출된 데이터:
- 상품명: ${extracted.name || '(미추출)'}
- 가격: ${extracted.price ?? '(미추출)'}
- 옵션: ${JSON.stringify(extracted.options)}
- 이미지 수: ${extracted.images.length}장

보강 필요 사항:
1. 상품명이 비어있거나 너무 길면 스크린샷에서 자연스러운 카피로 추출 (20-35자)
2. 가격 검증 (원/달러 구분 — 한국 쇼핑몰이면 원)
3. 카테고리 자동 분류 (수산/농산/축산/밀키트/가공/건강/기타 중 1)
4. SEO용 설명문 생성 (150자 이내)
5. 판매 포인트 3개 추출

JSON 응답 (마크다운 없이):
{
  "name": "보강된 상품명",
  "price": 숫자_또는_null,
  "category": "카테고리명",
  "seoDescription": "SEO 설명",
  "sellingPoints": ["포인트1", "포인트2", "포인트3"],
  "suggestedTags": ["태그1", "태그2"]
}`

    const response = parts.length
      ? await this.aiClient.generateContentWithImages(prompt, parts)
      : await this.aiClient.generateContent(prompt)

    let enriched: any
    try {
      enriched = JSON.parse(this.cleanJsonResponse(response.content))
    } catch (err) {
      // 파싱 실패 시 원본 그대로 반환 (오류 무시)
      console.warn('[StructureExtractor] enrichment 응답 파싱 실패, 원본 사용', (err as Error).message)
      return extracted
    }

    return {
      ...extracted,
      name: enriched.name || extracted.name,
      price: enriched.price ?? extracted.price,
      category: enriched.category ?? null,
      seoDescription: enriched.seoDescription ?? null,
      sellingPoints: enriched.sellingPoints ?? [],
      tags: enriched.suggestedTags ?? [],
    }
  }

  private cleanJsonResponse(text: string): string {
    // ```json ... ``` 제거 + 첫 { ... } 추출
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    let s = fenced ? fenced[1] : text
    const obj = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (obj) s = obj[1]
    return s.trim()
  }
}
