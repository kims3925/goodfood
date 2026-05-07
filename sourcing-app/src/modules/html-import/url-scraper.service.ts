/**
 * URL을 Playwright로 풀렌더링 후 HTML/스크린샷/메타 추출
 *
 * 작업지침서 §4-1. Band 세션과 격리된 별도 chromium 인스턴스 사용.
 * 사용 후 close() 필수 (메모리 누수 방지).
 */

import { chromium, type Browser } from 'playwright'
import type { ScrapedPage } from './types'

const SCRAPE_TIMEOUT_MS = 30_000

export class UrlScraperService {
  private browser: Browser | null = null

  async scrapeUrl(url: string): Promise<ScrapedPage> {
    const browser = await this.getBrowser()
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    })

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: SCRAPE_TIMEOUT_MS })

      // lazy load 이미지 트리거
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(2000)
      await page.evaluate(() => window.scrollTo(0, 0))

      const screenshot = await page.screenshot({ fullPage: true, type: 'png' })

      const extracted = await page.evaluate(() => {
        const getMeta = (name: string): string | undefined =>
          document
            .querySelector<HTMLMetaElement>(
              `meta[property="${name}"], meta[name="${name}"]`
            )
            ?.getAttribute('content') || undefined

        const jsonLd = Array.from(
          document.querySelectorAll<HTMLScriptElement>(
            'script[type="application/ld+json"]'
          )
        )
          .map((el) => {
            try {
              return JSON.parse(el.textContent || '')
            } catch {
              return null
            }
          })
          .filter(Boolean)

        const priceEl = document.querySelector(
          '[class*="price"], [id*="price"], [data-price], .product-price, .sale-price'
        )
        const priceText =
          priceEl?.textContent?.replace(/[^\d,.]/g, '') || undefined

        const images = Array.from(
          document.querySelectorAll<HTMLImageElement>('img[src]')
        )
          .map((img) => img.src)
          .filter((src) => !src.includes('pixel') && !src.includes('tracking'))

        return {
          title: document.title,
          html: document.documentElement.outerHTML,
          meta: {
            ogTitle: getMeta('og:title'),
            ogDescription: getMeta('og:description'),
            ogImage: getMeta('og:image'),
            price: priceText,
          },
          structuredData: jsonLd,
          images,
          textContent: document.body.innerText.slice(0, 10_000),
        }
      })

      return { url, screenshot, ...extracted }
    } finally {
      await page.close().catch(() => {})
    }
  }

  async scrapeUrls(urls: string[]): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = []
    for (const url of urls) {
      try {
        results.push(await this.scrapeUrl(url))
      } catch (err) {
        console.error(`[url-scraper] ${url} 실패:`, (err as Error).message)
      }
    }
    return results
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {})
    this.browser = null
  }
}
