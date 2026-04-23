/**
 * 종합 게시글 빌더 (Digest Builder)
 *
 * 카테고리별로 여러 상품을 하나의 밴드 게시글로 조립합니다.
 * - 제목: "🐟 오늘의 수산물 - 4월 23일 (수)"
 * - 본문: 번호 매긴 상품 블록들 (품명/설명/가격/마감/링크)
 * - 이미지: Band 최대 20장 제약 — MVP는 상품당 1장 기본 (옵션으로 2/4장)
 */

import { CATEGORY_MAP, type CategoryCode } from '../category/category.keywords'

export interface DigestProduct {
  id: number
  name: string
  description: string | null
  price: number | null
  variants: { optionSummary: string; price: number }[]
  images: { url: string; sortOrder: number }[]
  shopProductUrl?: string
  deadline?: string
}

export interface DigestOptions {
  category: CategoryCode
  products: DigestProduct[]
  date?: Date
  headerText?: string
  footerText?: string
  /** 게시글 1개에 담을 최대 상품 수 (기본 20) */
  maxProducts?: number
  /** 상품당 이미지 수 (기본 1 — 20개 상품 × 1장 = Band 한도 20장 딱 맞음) */
  maxImagesPerProduct?: number
  /** 밴드 이미지 총량 상한 (기본 20) */
  maxTotalImages?: number
}

export interface DigestResult {
  title: string
  content: string
  imageUrls: string[]
  productCount: number
  truncated: boolean // maxProducts 초과로 일부 잘렸는지
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const

function formatDateLabel(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  const day = DAY_NAMES[date.getDay()]
  return `${m}월 ${d}일 (${day})`
}

function summarizePrice(product: DigestProduct): string | null {
  if (product.variants && product.variants.length > 1) {
    const prices = product.variants.map((v) => v.price).filter((p) => p > 0)
    if (prices.length === 0) return null
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === max) return `💰 ${min.toLocaleString()}원`
    return `💰 ${min.toLocaleString()}원 ~ ${max.toLocaleString()}원`
  }
  if (product.price && product.price > 0) {
    return `💰 ${product.price.toLocaleString()}원`
  }
  return null
}

export function buildDigest(options: DigestOptions): DigestResult {
  const {
    category,
    products,
    date = new Date(),
    headerText,
    footerText,
    maxProducts = 20,
    maxImagesPerProduct = 1,
    maxTotalImages = 20,
  } = options

  const cat = CATEGORY_MAP[category]
  const title = `${cat.emoji} ${cat.label} - ${formatDateLabel(date)}`

  const selected = products.slice(0, maxProducts)
  const truncated = products.length > maxProducts

  const lines: string[] = []
  const allImageUrls: string[] = []

  // 헤더
  lines.push(title)
  lines.push('')
  if (headerText && headerText.trim()) {
    lines.push(headerText.trim())
    lines.push('')
  }
  lines.push(`총 ${selected.length}개 상품 | 신선 직송`)
  lines.push('━━━━━━━━━━━━━━━━━━━━')
  lines.push('')

  // 상품 블록
  selected.forEach((product, idx) => {
    const num = idx + 1
    lines.push(`${num}. ${product.name}`)

    // 설명 한 줄 요약 (최대 50자)
    if (product.description) {
      const firstLine = product.description.split('\n')[0].trim()
      const short = firstLine.length > 50 ? firstLine.substring(0, 50) + '…' : firstLine
      if (short) lines.push(`   ${short}`)
    }

    const priceLine = summarizePrice(product)
    if (priceLine) lines.push(`   ${priceLine}`)

    if (product.deadline) lines.push(`   ⏰ 마감: ${product.deadline}`)
    if (product.shopProductUrl) lines.push(`   🛒 주문 👉 ${product.shopProductUrl}`)

    lines.push('')

    // 이미지 수집
    const imgs = [...product.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, maxImagesPerProduct)
      .map((img) => img.url)
    allImageUrls.push(...imgs)
  })

  // 푸터
  lines.push('━━━━━━━━━━━━━━━━━━━━')
  if (footerText && footerText.trim()) {
    lines.push(footerText.trim())
  } else {
    lines.push('📦 배송: 마감 전 주문시 당일 출고, 마감 이후 익일 출고')
    lines.push('💳 결제: 카드결제 / 무통장입금')
  }

  const finalImages = allImageUrls.slice(0, maxTotalImages)

  return {
    title,
    content: lines.join('\n'),
    imageUrls: finalImages,
    productCount: selected.length,
    truncated,
  }
}
