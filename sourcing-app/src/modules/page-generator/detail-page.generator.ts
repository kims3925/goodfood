/**
 * 상세페이지 HTML 생성기 (작업지침서 §5-1).
 *
 * 입력: ExtractedProductData + DetailPageConfig
 * 출력: 완성된 HTML + meta + SEO
 *
 * AI 카피라이팅 → Handlebars 템플릿 렌더링 → DOMPurify 검증 (서버 측 sanitize 는 생략 — 운영자 자체 검수)
 */

import Handlebars from 'handlebars'
import type { BaseAiClient } from '../transformation/ai.client'
import type { ExtractedProductData } from '../html-import/types'
import { DETAIL_PAGE_PROMPT } from './prompts/detail-page.prompt'
import { getTemplate, TEMPLATES } from './templates'

export interface DetailPageConfig {
  templateId?: string
  colorScheme?: {
    primary: string
    secondary: string
    background: string
    text: string
  }
  layout?: 'standard' | 'wide' | 'magazine'
  shopBranding?: {
    logo?: string
    shopName: string
    contactInfo?: string
  }
}

export interface DetailPageResult {
  html: string
  css: string
  meta: {
    title: string
    description: string
    ogImage?: string
  }
  copy: any
  templateId: string
}

const DEFAULT_COLORS = {
  primary: '#2563EB',
  secondary: '#1E40AF',
  background: '#FFFFFF',
  text: '#1F2937',
}

export class DetailPageGenerator {
  constructor(private aiClient: BaseAiClient) {}

  async generateDetailPage(
    product: ExtractedProductData,
    config: DetailPageConfig = {}
  ): Promise<DetailPageResult> {
    const copy = await this.generateCopywriting(product)
    const templateId = config.templateId || this.suggestTemplate(product)
    const tpl = getTemplate(templateId)
    const compiled = Handlebars.compile(tpl.source)

    const templateData = {
      product: {
        name: product.name,
        price: product.price?.toLocaleString('ko-KR') || '',
        originalPrice: product.originalPrice?.toLocaleString('ko-KR') || '',
        discount: product.discount,
        images: product.images,
        options: product.options,
        description: product.description,
      },
      copy,
      config: {
        colors: config.colorScheme || DEFAULT_COLORS,
        layout: config.layout || 'standard',
        shop: config.shopBranding,
      },
    }

    const html = compiled(templateData)
    const meta = {
      title: `${product.name} | ${config.shopBranding?.shopName || '쇼핑몰'}`,
      description: copy.seoDescription || `${product.name} 상세 정보`,
      ogImage: product.images[0],
    }

    return { html, css: '', meta, copy, templateId }
  }

  private async generateCopywriting(product: ExtractedProductData): Promise<any> {
    const prompt = DETAIL_PAGE_PROMPT.replace('{productName}', product.name || '')
      .replace('{productPrice}', String(product.price || ''))
      .replace('{productDescription}', (product.description || '').slice(0, 1000))
      .replace('{productCategory}', product.category || '일반')
      .replace('{sellingPoints}', JSON.stringify(product.sellingPoints || []))

    const response = await this.aiClient.generateContent(prompt)
    const cleaned = this.cleanJsonResponse(response.content)
    try {
      return JSON.parse(cleaned)
    } catch (err) {
      // 파싱 실패 시 최소 폴백 카피 반환 (페이지 자체는 렌더 가능)
      console.warn('[DetailPageGenerator] copywriting JSON 파싱 실패, 폴백 사용', (err as Error).message)
      return this.fallbackCopy(product)
    }
  }

  private fallbackCopy(product: ExtractedProductData) {
    return {
      headline: product.name || '신선한 상품',
      subheadline: product.seoDescription || '',
      heroDescription: '',
      sellingPoints: (product.sellingPoints || []).map((p) => ({
        icon: '✨',
        title: p.slice(0, 8),
        description: p,
      })),
      detailSections: product.description
        ? [{ title: '상품 소개', content: product.description, type: 'text' }]
        : [],
      trustBadges: ['무료배송', '신선보장'],
      ctaText: '구매하기',
      seoDescription: product.seoDescription || product.name || '',
      faq: [],
    }
  }

  private suggestTemplate(product: ExtractedProductData): string {
    const cat = (product.category || '').toLowerCase()
    if (cat.includes('수산') || cat.includes('해산')) return 'basic' // 향후 'seafood'
    if ((product.price || 0) > 100_000) return 'basic' // 향후 'premium'
    return 'basic'
  }

  private cleanJsonResponse(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    let s = fenced ? fenced[1] : text
    const obj = s.match(/(\{[\s\S]*\})/)
    if (obj) s = obj[1]
    return s.trim()
  }

  listTemplates() {
    return TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category }))
  }
}
