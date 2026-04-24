/**
 * 카카오톡 광고 카드 PNG 렌더러
 *
 * 작업지시서 9
 *
 * - HTML 템플릿(kakao-ad-card.html.ts) → Playwright chromium → 720×1280 PNG
 * - 상품 이미지는 base64 data URI로 변환해 Playwright network 의존 제거
 * - 임시 파일은 /tmp/kakao-ad-{id}-{ts}.png로 저장 — 호출측이 cleanup 책임
 */

import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildAdCardHtml, type AdCardHtmlInput } from './templates/kakao-ad-card.html'

export interface RenderAdCardInput {
  cardId: number
  imageUrlOrPath: string | null
  card: Omit<AdCardHtmlInput, 'productImageDataUri'>
}

export interface RenderedAdCard {
  cardId: number
  filePath: string
  bytes: number
}

/**
 * 이미지 URL or 로컬 경로 → base64 data URI.
 * 실패 시 null. 호출측은 placeholder로 폴백.
 */
async function toDataUri(urlOrPath: string | null): Promise<string | null> {
  if (!urlOrPath) return null
  try {
    if (urlOrPath.startsWith('file://')) {
      const p = urlOrPath.replace(/^file:\/\//, '')
      if (!fs.existsSync(p)) return null
      const buf = fs.readFileSync(p)
      const mime = detectMime(p)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
    if ((urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')) || /^[a-zA-Z]:[\\/]/.test(urlOrPath)) {
      if (fs.existsSync(urlOrPath)) {
        const buf = fs.readFileSync(urlOrPath)
        return `data:${detectMime(urlOrPath)};base64,${buf.toString('base64')}`
      }
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      urlOrPath = `${base}${urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath}`
    }
    const res = await fetch(urlOrPath, {
      headers: { 'User-Agent': 'Mozilla/5.0 BandAuto/1.0' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type')?.split(';')[0] || detectMime(urlOrPath)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn(`[ad-card] toDataUri 실패: ${urlOrPath}`, err)
    return null
  }
}

function detectMime(urlOrPath: string): string {
  if (urlOrPath.endsWith('.png')) return 'image/png'
  if (urlOrPath.endsWith('.webp')) return 'image/webp'
  if (urlOrPath.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

/**
 * 카드 1장 렌더 — 자체 브라우저 1개 띄우는 비용 있음.
 * 다수 카드를 한꺼번에 만들 땐 renderAdCardsBatch() 사용 권장.
 */
export async function renderAdCard(input: RenderAdCardInput): Promise<RenderedAdCard> {
  const dataUri = await toDataUri(input.imageUrlOrPath)
  const html = buildAdCardHtml({ ...input.card, productImageDataUri: dataUri })

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 720, height: 1280 },
      deviceScaleFactor: 2, // 카카오톡 모바일 retina용
    })
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 })
    await page.evaluate(async () => {
      const imgs = Array.from(document.images)
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
        )
      )
      // @ts-ignore
      if (document.fonts && document.fonts.ready) await document.fonts.ready
    })
    await page.waitForTimeout(200)

    const tempDir = os.tmpdir()
    const filePath = path.join(
      tempDir,
      `kakao-ad-${input.cardId}-${Date.now()}.png`
    )
    const element = await page.$('#card')
    if (!element) throw new Error('광고 카드 element(#card)를 찾지 못했습니다.')
    await element.screenshot({ type: 'png', path: filePath })
    const stat = fs.statSync(filePath)
    return { cardId: input.cardId, filePath, bytes: stat.size }
  } finally {
    await browser.close()
  }
}

/**
 * 다수 카드를 한 브라우저 인스턴스에서 순차 렌더 — 메모리/속도 효율.
 */
export async function renderAdCardsBatch(
  inputs: RenderAdCardInput[],
  onProgress?: (current: number, total: number) => void
): Promise<RenderedAdCard[]> {
  if (inputs.length === 0) return []

  const browser = await chromium.launch({ headless: true })
  const results: RenderedAdCard[] = []
  const tempDir = os.tmpdir()

  try {
    const page = await browser.newPage({
      viewport: { width: 720, height: 1280 },
      deviceScaleFactor: 2,
    })

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      try {
        const dataUri = await toDataUri(input.imageUrlOrPath)
        const html = buildAdCardHtml({ ...input.card, productImageDataUri: dataUri })
        await page.setContent(html, { waitUntil: 'load', timeout: 30_000 })
        await page.evaluate(async () => {
          const imgs = Array.from(document.images)
          await Promise.all(
            imgs.map((img) =>
              img.complete
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve()
                    img.onerror = () => resolve()
                  })
            )
          )
          // @ts-ignore
          if (document.fonts && document.fonts.ready) await document.fonts.ready
        })
        await page.waitForTimeout(150)

        const filePath = path.join(
          tempDir,
          `kakao-ad-${input.cardId}-${Date.now()}-${i}.png`
        )
        const element = await page.$('#card')
        if (!element) throw new Error(`#card not found for card ${input.cardId}`)
        await element.screenshot({ type: 'png', path: filePath })
        const stat = fs.statSync(filePath)
        results.push({ cardId: input.cardId, filePath, bytes: stat.size })
      } catch (err: any) {
        console.warn(`[ad-card] 카드 ${input.cardId} 렌더 실패:`, err?.message || err)
        // 실패한 카드는 결과에 포함 안 함 (호출측 책임)
      }
      onProgress?.(i + 1, inputs.length)
    }
  } finally {
    await browser.close()
  }

  return results
}

export function cleanupAdCardFile(filePath: string | null | undefined): void {
  if (!filePath) return
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

export function cleanupAdCards(cards: { filePath: string }[]): void {
  for (const c of cards) cleanupAdCardFile(c.filePath)
}
