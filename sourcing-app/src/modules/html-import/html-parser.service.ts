/**
 * HTML 문자열에서 상품 정보 추출 (cheerio 기반)
 *
 * 작업지침서 §4-2 — 다양한 쇼핑몰의 HTML 패턴을 셀렉터 우선순위로 시도.
 * 1순위 매칭 실패 시 단계적 폴백 (h1, og:title 등).
 */

import * as cheerio from 'cheerio'
import type { ExtractedProductData } from './types'

type CheerioRoot = cheerio.CheerioAPI

export class HtmlParserService {
  parseProductFromHtml(html: string): ExtractedProductData {
    const $ = cheerio.load(html)
    const name = this.extractProductName($)
    const { price, originalPrice, discount } = this.extractPrices($)
    const images = this.extractImages($)
    const options = this.extractOptions($)
    const description = this.extractDescription($)
    const shipping = this.extractShippingInfo($)

    return {
      name,
      price,
      originalPrice,
      discount,
      images,
      options,
      description,
      shipping,
      rawHtml: html.length > 500_000 ? html.slice(0, 500_000) : html, // 5MB 제한 보호
    }
  }

  private extractProductName($: CheerioRoot): string {
    const selectors = [
      'h1.product-name',
      'h1.product-title',
      '#product-name',
      '[class*="product"] h1',
      '[class*="item"] h1',
      'meta[property="og:title"]',
      'h1',
    ]
    for (const sel of selectors) {
      const el = $(sel).first()
      if (!el.length) continue
      const text = sel.includes('meta') ? el.attr('content') : el.text().trim()
      if (text && text.length > 2 && text.length < 200) return text
    }
    return ''
  }

  private extractPrices($: CheerioRoot) {
    const priceSelectors = [
      '.sale-price',
      '.product-price',
      '.price-sale',
      '#price',
      '[class*="price"]:not([class*="original"]):not([class*="before"])',
    ]
    const originalSelectors = [
      '.original-price',
      '.price-original',
      '.before-price',
      '[class*="original"], [class*="before"], del',
    ]

    const parsePrice = (text: string): number | null => {
      const cleaned = text.replace(/[\s,]/g, '')
      const match = cleaned.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : null
    }

    let price: number | null = null
    let originalPrice: number | null = null

    for (const sel of priceSelectors) {
      const el = $(sel).first()
      if (el.length) {
        price = parsePrice(el.text())
        if (price) break
      }
    }
    for (const sel of originalSelectors) {
      const el = $(sel).first()
      if (el.length) {
        originalPrice = parsePrice(el.text())
        if (originalPrice) break
      }
    }

    const discount =
      originalPrice && price && originalPrice > price
        ? Math.round((1 - price / originalPrice) * 100)
        : null

    return { price, originalPrice, discount }
  }

  private extractImages($: CheerioRoot): string[] {
    const imageSelectors = [
      '.product-image img',
      '.product-gallery img',
      '#product-images img',
      '[class*="product"] img',
      '[class*="gallery"] img',
      '.detail-image img',
      '#detail img',
    ]

    const images: string[] = []
    for (const sel of imageSelectors) {
      $(sel).each((_, el) => {
        const $el = $(el)
        const src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-lazy')
        if (src && !images.includes(src)) images.push(src)
      })
      if (images.length > 0) break
    }

    if (images.length === 0) {
      $('img').each((_, el) => {
        const $el = $(el)
        const src = $el.attr('src') || $el.attr('data-src')
        const widthAttr = $el.attr('width') || '0'
        const width = parseInt(widthAttr, 10) || 0
        if (src && (width >= 200 || width === 0)) {
          if (!images.includes(src)) images.push(src)
        }
      })
    }

    return images.slice(0, 20)
  }

  private extractOptions(
    $: CheerioRoot
  ): Array<{ name: string; values: string[] }> {
    const options: Array<{ name: string; values: string[] }> = []

    $('select[name*="option"], select[class*="option"]').each((_, sel) => {
      const $sel = $(sel)
      const name =
        $sel.prev('label').text().trim() ||
        $sel.attr('title') ||
        `옵션${options.length + 1}`
      const values = $sel
        .find('option')
        .map((_, opt) => $(opt).text().trim())
        .get()
        .filter((v: string) => v && !v.includes('선택'))
      if (values.length) options.push({ name, values })
    })

    $('[class*="option-group"], [class*="swatch"]').each((_, group) => {
      const $group = $(group)
      const name =
        $group.find('label, .title, .name').first().text().trim() ||
        `옵션${options.length + 1}`
      const values = $group
        .find('button, .item, input[type="radio"]')
        .map((_, btn) => {
          const $btn = $(btn)
          return $btn.text().trim() || $btn.attr('value') || ''
        })
        .get()
        .filter(Boolean)
      if (values.length) options.push({ name, values })
    })

    return options
  }

  private extractDescription($: CheerioRoot): string {
    const detailSelectors = [
      '.product-detail',
      '.product-description',
      '#product-detail',
      '[class*="detail-content"]',
      '[class*="description"]',
    ]

    for (const sel of detailSelectors) {
      const el = $(sel).first()
      if (el.length) {
        const text = el.text().trim()
        if (text.length > 50) return el.html() || text
      }
    }
    return ''
  }

  private extractShippingInfo($: CheerioRoot): string | undefined {
    const el = $('[class*="shipping"], [class*="delivery"]').first()
    return el.length ? el.text().trim().slice(0, 200) : undefined
  }
}
