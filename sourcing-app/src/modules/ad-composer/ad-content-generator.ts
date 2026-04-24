/**
 * 카카오톡 광고 카드 — AI 콘텐츠 생성기 (Claude Haiku)
 *
 * 작업지시서: 작업지시서_카카오톡광고_자동생성.md
 *
 * 한 상품마다 4개의 Claude 호출을 병렬로 실행해 카드 콘텐츠를 만든다.
 * - 타이틀 (20자 이내)
 * - 서브타이틀 (30자 내외)
 * - 본문 설명 (200자 내외, 이모지 + 가격)
 * - 강조 배너 (선택, 키워드 있을 때만)
 *
 * 각 카드의 타이틀 색상은 카테고리 매핑(규칙)으로 결정 — AI 호출 안 함.
 * 리본 배지("국내산100%")도 정규식 감지로 결정.
 *
 * 호출 비용 (Haiku):
 * - 카드당 4 호출 × 평균 500 토큰 ≈ 2000 토큰
 * - 6장 발행 ≈ 12,000 토큰 ≈ $0.015
 */

import { createAiClient, type BaseAiClient } from '@/modules/transformation/ai.client'
import { CATEGORY_MAP, type CategoryCode } from '@/modules/category/category.keywords'
import { buildTitlePrompt } from './prompts/title.prompt'
import { buildSubtitlePrompt } from './prompts/subtitle.prompt'
import { buildDescriptionPrompt } from './prompts/description.prompt'
import { buildBannerPrompt } from './prompts/banner.prompt'

export type AdTitleColor = 'red' | 'blue' | 'green'

export interface AdContentInput {
  productId: number
  name: string
  description: string | null
  categoryId: string | null
  price: number | null
  variants: { optionSummary: string | null; price: number }[]
}

export interface AdContentResult {
  productId: number
  title: string
  titleColor: AdTitleColor
  subtitle: string
  bannerText: string | null
  ribbonText: string | null
  productName: string
  descriptionHtml: string
  priceText: string
  aiGenerated: boolean
  tokensUsed: number
  warnings: string[]
}

export interface AdContentGeneratorOptions {
  apiKey: string
  model?: string                   // 기본 'claude-haiku-4-5-20251001'
  forceTitleColor?: AdTitleColor
  enableBanner?: boolean
  titleMaxLen?: number             // 기본 20
  descMaxLen?: number              // 기본 220 (200자 내외 + 여유)
  /** 진행 상태 콜백 */
  onProgress?: (productId: number, stage: 'title' | 'subtitle' | 'desc' | 'banner' | 'done') => void
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

// 카테고리 → 타이틀 색상 매핑 (작업지시서 8-4)
const CATEGORY_COLOR: Record<string, AdTitleColor> = {
  SEA: 'blue',     // 수산물 — 바다
  AGR: 'red',      // 농산물 — 신선감
  MEA: 'red',      // 축산물 — 정육
  MKT: 'red',      // 밀키트/반찬
  PRC: 'red',      // 가공식품
  HLT: 'green',    // 건강식품
  COM: 'red',      // 상시상품
  ETC: 'red',
}

function pickTitleColor(categoryId: string | null, override?: AdTitleColor): AdTitleColor {
  if (override) return override
  if (!categoryId) return 'red'
  return CATEGORY_COLOR[categoryId] || 'red'
}

function pickRibbon(input: AdContentInput): string | null {
  const text = `${input.name} ${input.description || ''}`
  if (/국내산/.test(text)) return '국내산100%'
  if (/유기농/.test(text)) return '유기농인증'
  if (/친환경/.test(text)) return '친환경인증'
  return null
}

function buildPriceText(input: AdContentInput): string {
  if (input.variants && input.variants.length > 0) {
    const lines = input.variants
      .filter((v) => v.price > 0)
      .map((v) => {
        const opt = (v.optionSummary || '').trim()
        return opt
          ? `${opt} ${v.price.toLocaleString()}원`
          : `${v.price.toLocaleString()}원`
      })
    if (lines.length > 0) return lines.join(' / ')
  }
  if (input.price && input.price > 0) {
    return `${input.price.toLocaleString()}원`
  }
  return '가격 문의'
}

function buildVariantSummary(input: AdContentInput): string {
  if (!input.variants || input.variants.length === 0) {
    return input.price ? `${input.price.toLocaleString()}원` : '단일 상품'
  }
  return input.variants
    .map((v) => `${(v.optionSummary || '단일').trim()} ${v.price.toLocaleString()}원`)
    .join(', ')
}

function clampOutput(text: string, maxLen: number): string {
  // 첫 줄만 추출 (Claude가 가끔 부연설명을 덧붙임)
  const firstLine = text.split('\n')[0].trim()
  // 따옴표·괄호 제거
  const cleaned = firstLine
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^\(|\)$/g, '')
    .trim()
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen).trim()
}

async function callOnce(client: BaseAiClient, prompt: string): Promise<{ text: string; tokens: number }> {
  const r = await client.generateContent(prompt)
  return { text: r.content, tokens: r.tokensUsed || 0 }
}

async function callWithRetry(
  client: BaseAiClient,
  prompt: string,
  retries = 1
): Promise<{ text: string; tokens: number }> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await callOnce(client, prompt)
    } catch (err) {
      if (i === retries) throw err
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('unreachable')
}

/**
 * 한 상품의 광고 카드 콘텐츠를 AI로 생성.
 * 4개 호출(title, subtitle, desc, banner)을 병렬로 실행.
 * 부분 실패가 발생해도 폴백 값으로 카드 생성은 계속한다.
 */
export async function generateAdContent(
  input: AdContentInput,
  opts: AdContentGeneratorOptions
): Promise<AdContentResult> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    forceTitleColor,
    enableBanner = true,
    titleMaxLen = 20,
    descMaxLen = 220,
    onProgress,
  } = opts

  const warnings: string[] = []
  let totalTokens = 0
  let aiGenerated = true

  const categoryName = input.categoryId
    ? CATEGORY_MAP[input.categoryId as CategoryCode]?.name || '상품'
    : '상품'

  const safeDesc = (input.description || '').trim()
  const priceText = buildPriceText(input)
  const variantSummary = buildVariantSummary(input)

  const client = createAiClient({
    provider: 'CLAUDE' as any,
    apiKey,
    model,
    temperature: 0.6,
    maxTokens: 512,
  })

  // 4개 호출 병렬 실행
  onProgress?.(input.productId, 'title')

  const titleP = callWithRetry(
    client,
    buildTitlePrompt({ productName: input.name, description: safeDesc, categoryName })
  )
    .then((r) => {
      totalTokens += r.tokens
      return clampOutput(r.text, titleMaxLen)
    })
    .catch((err) => {
      warnings.push(`title 실패: ${err?.message || err}`)
      return input.name.slice(0, titleMaxLen)
    })

  const descP = callWithRetry(
    client,
    buildDescriptionPrompt({
      productName: input.name,
      description: safeDesc,
      priceText,
      variantSummary,
      categoryName,
    })
  )
    .then((r) => {
      totalTokens += r.tokens
      const text = (r.text || '').trim()
      return text.length > descMaxLen + 50 ? text.slice(0, descMaxLen + 50) : text
    })
    .catch((err) => {
      warnings.push(`description 실패: ${err?.message || err}`)
      return safeDesc.slice(0, descMaxLen) || `${input.name}\n${priceText}`
    })

  const bannerP = enableBanner
    ? callWithRetry(client, buildBannerPrompt({ productName: input.name, description: safeDesc }))
        .then((r) => {
          totalTokens += r.tokens
          const text = clampOutput(r.text, 50)
          if (!text || text.toUpperCase() === 'SKIP') return null
          return text
        })
        .catch((err) => {
          warnings.push(`banner 실패: ${err?.message || err}`)
          return null
        })
    : Promise.resolve(null)

  const [title, descRaw, bannerText] = await Promise.all([titleP, descP, bannerP])

  // subtitle은 title이 결정된 후 호출 (의존성)
  onProgress?.(input.productId, 'subtitle')
  let subtitle = ''
  try {
    const sR = await callWithRetry(
      client,
      buildSubtitlePrompt({ productName: input.name, description: safeDesc, title })
    )
    totalTokens += sR.tokens
    subtitle = clampOutput(sR.text, 40)
  } catch (err: any) {
    warnings.push(`subtitle 실패: ${err?.message || err}`)
    subtitle = safeDesc.split(/\n/)[0]?.slice(0, 30) || ''
  }

  // 폴백 결과만 잔뜩 나오면 aiGenerated=false로 처리
  if (warnings.length >= 3) aiGenerated = false

  onProgress?.(input.productId, 'done')

  return {
    productId: input.productId,
    title: title || input.name.slice(0, titleMaxLen),
    titleColor: pickTitleColor(input.categoryId, forceTitleColor),
    subtitle: subtitle || '',
    bannerText: enableBanner ? bannerText : null,
    ribbonText: pickRibbon(input),
    productName: input.name,
    descriptionHtml: descRaw,
    priceText,
    aiGenerated,
    tokensUsed: totalTokens,
    warnings,
  }
}

/**
 * 여러 상품의 광고 콘텐츠를 일괄 생성. 동시성 제한으로 rate limit 회피.
 */
export async function generateAdContentBatch(
  inputs: AdContentInput[],
  opts: AdContentGeneratorOptions,
  concurrency = 3
): Promise<AdContentResult[]> {
  const results: AdContentResult[] = new Array(inputs.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const idx = cursor++
      if (idx >= inputs.length) return
      try {
        results[idx] = await generateAdContent(inputs[idx], opts)
      } catch (err: any) {
        // 단일 상품의 모든 폴백이 실패한 극단 케이스 — 최소 데이터로 채움
        const inp = inputs[idx]
        results[idx] = {
          productId: inp.productId,
          title: inp.name.slice(0, opts.titleMaxLen ?? 20),
          titleColor: pickTitleColor(inp.categoryId, opts.forceTitleColor),
          subtitle: '',
          bannerText: null,
          ribbonText: pickRibbon(inp),
          productName: inp.name,
          descriptionHtml: (inp.description || '').slice(0, opts.descMaxLen ?? 220),
          priceText: buildPriceText(inp),
          aiGenerated: false,
          tokensUsed: 0,
          warnings: [`전체 실패: ${err?.message || err}`],
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, worker))
  return results
}
