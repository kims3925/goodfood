/**
 * 종합발행 카드 렌더러
 *
 * 각 상품을 "상품 사진(최대 4장 2×2 그리드) + 번호/제목/가격/마감/주문링크"가
 * 포함된 정사각형 PNG 카드로 렌더링합니다. Playwright chromium으로 HTML→PNG.
 *
 * 반환: 임시 디렉터리의 로컬 파일 경로 배열.
 * 호출측은 발행 완료 후 cleanupDigestCards()로 파일 정리를 책임집니다.
 */

import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * 이미지 URL을 base64 data URI로 변환. HTTP 404나 네트워크 실패 시 null 반환.
 * - 상대 경로(/...) → NEXT_PUBLIC_APP_URL prefix
 * - file:// 또는 OS 절대 경로 → fs로 읽기
 * - http(s) → fetch
 */
async function toDataUri(urlOrPath: string): Promise<string | null> {
  try {
    // 로컬 절대 경로
    if (urlOrPath.startsWith('file://')) {
      const p = urlOrPath.replace(/^file:\/\//, '')
      if (!fs.existsSync(p)) return null
      const buf = fs.readFileSync(p)
      const mime = p.endsWith('.png') ? 'image/png' : p.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    }
    // 일반 파일시스템 절대 경로 (리눅스 /xxx 또는 윈도우 C:\xxx)
    if ((urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')) || /^[a-zA-Z]:[\\/]/.test(urlOrPath)) {
      // URL path vs filesystem path — 실제 파일이면 파일로 처리
      if (fs.existsSync(urlOrPath)) {
        const buf = fs.readFileSync(urlOrPath)
        const mime = urlOrPath.endsWith('.png') ? 'image/png' : urlOrPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
        return `data:${mime};base64,${buf.toString('base64')}`
      }
      // 파일이 아니면 NEXT_PUBLIC_APP_URL prefix 붙여 fetch
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      urlOrPath = `${base}${urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath}`
    }

    const res = await fetch(urlOrPath, {
      headers: { 'User-Agent': 'Mozilla/5.0 BandAuto/1.0' },
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime =
      res.headers.get('content-type')?.split(';')[0] ||
      (urlOrPath.endsWith('.png') ? 'image/png' : urlOrPath.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn(`[digest-card] toDataUri 실패: ${urlOrPath}`, err)
    return null
  }
}

export interface DigestCardProduct {
  id: number
  name: string
  price: number | null
  priceText?: string | null // 이미 포맷팅된 가격 라인 (예: "13,000원 ~ 25,000원")
  deadline?: string | null
  orderUrl?: string | null
  imageUrls: string[] // 0~4장. 0장이면 회색 플레이스홀더
}

const FONT_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
`

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildImageGridHtml(imageUrls: string[]): string {
  const imgs = imageUrls.slice(0, 4)
  if (imgs.length === 0) {
    return `<div style="width:100%;height:560px;background:#E5E7EB;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:20px;">이미지 없음</div>`
  }
  // 1장 → 단일 큰 이미지, 2장 → 좌우 2분할, 3장 → 상단 큰 + 하단 2분할, 4장 → 2×2
  if (imgs.length === 1) {
    return `<div style="width:100%;height:560px;overflow:hidden;">
      <img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;display:block;">
    </div>`
  }
  if (imgs.length === 2) {
    return `<div style="width:100%;height:560px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      ${imgs.map((u) => `<img src="${u}" style="width:100%;height:100%;object-fit:cover;display:block;">`).join('')}
    </div>`
  }
  if (imgs.length === 3) {
    return `<div style="width:100%;height:560px;display:grid;grid-template-rows:2fr 1fr;gap:4px;">
      <img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;display:block;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <img src="${imgs[1]}" style="width:100%;height:100%;object-fit:cover;display:block;">
        <img src="${imgs[2]}" style="width:100%;height:100%;object-fit:cover;display:block;">
      </div>
    </div>`
  }
  return `<div style="width:100%;height:560px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;">
    ${imgs.slice(0, 4).map((u) => `<img src="${u}" style="width:100%;height:100%;object-fit:cover;display:block;">`).join('')}
  </div>`
}

function buildCardHtml(product: DigestCardProduct, orderNumber: number): string {
  const name = escapeHtml(product.name || '')
  const priceLine = product.priceText
    ? escapeHtml(product.priceText)
    : product.price
    ? `${product.price.toLocaleString()}원`
    : ''
  const deadline = product.deadline ? escapeHtml(product.deadline) : ''
  const orderUrl = product.orderUrl || ''

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
${FONT_CSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #ffffff; font-family: 'Pretendard', -apple-system, system-ui, sans-serif; }
#card {
  width: 800px; background: #ffffff;
  /* 상하 여백 + 카드 테두리로 다음 카드와 시각적 구분 */
  padding: 24px;
  border-bottom: 8px solid #F3F4F6;
}
.card-inner {
  border: 2px solid #E5E7EB;
  border-radius: 16px;
  overflow: hidden;
  background: #ffffff;
}
.image-area { width: 100%; background: #f9fafb; }
.divider {
  height: 3px; background: #E5E7EB;
}
.text-area {
  padding: 28px 32px 32px;
  background: #ffffff;
}
.row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.order-num {
  flex: 0 0 auto;
  display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 50%;
  background: #2563EB; color: #fff; font-size: 24px; font-weight: 800;
}
.title {
  font-size: 32px; font-weight: 800; color: #111827; line-height: 1.25;
  word-break: keep-all;
}
.price {
  font-size: 30px; font-weight: 800; color: #DC2626; margin: 14px 0 10px;
}
.meta {
  font-size: 20px; color: #4B5563; margin-top: 6px;
}
.order-btn {
  margin-top: 22px;
  padding: 18px 22px;
  background: linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%);
  border-radius: 14px;
  color: #ffffff;
  font-size: 22px; font-weight: 800;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
}
.order-btn .arrow {
  font-size: 28px; font-weight: 800;
}
.empty-placeholder { color: #9CA3AF; font-size: 20px; }
</style>
</head>
<body>
<div id="card">
  <div class="card-inner">
    <div class="image-area">
      ${buildImageGridHtml(product.imageUrls)}
    </div>
    <div class="divider"></div>
    <div class="text-area">
      <div class="row">
        <span class="order-num">${orderNumber}</span>
        <span class="title">${name}</span>
      </div>
      ${priceLine ? `<div class="price">💰 ${priceLine}</div>` : ''}
      ${deadline ? `<div class="meta">⏰ 마감: ${deadline}</div>` : ''}
      ${orderUrl ? `<div class="order-btn">
        <span>🛒 상품 자세히 보기</span>
        <span class="arrow">→</span>
      </div>` : ''}
    </div>
  </div>
</div>
</body>
</html>`
}

export interface RenderDigestCardsOptions {
  products: DigestCardProduct[]
  /** 진행 콜백 (current, total). 카드 1장이 완료될 때마다 호출 */
  onProgress?: (current: number, total: number) => void
}

export interface RenderedCard {
  productId: number
  filePath: string
}

export async function renderDigestCards(
  options: RenderDigestCardsOptions
): Promise<RenderedCard[]> {
  const { products, onProgress } = options
  const total = products.length
  const results: RenderedCard[] = []
  const tempDir = os.tmpdir()

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 1200 })

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const orderNumber = i + 1

      // 1) 원본 이미지 URL들을 모두 base64로 변환 (네트워크 의존 제거)
      const dataUris: string[] = []
      for (const src of product.imageUrls.slice(0, 4)) {
        const uri = await toDataUri(src)
        if (uri) dataUris.push(uri)
      }
      const productForHtml = { ...product, imageUrls: dataUris }

      const html = buildCardHtml(productForHtml, orderNumber)

      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 })
      // 모든 <img> 요소의 load/error 완료 대기
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
      })
      await page.waitForTimeout(200) // 폰트/레이아웃 안정화

      const element = await page.$('#card')
      if (!element) {
        throw new Error(`digest card #${orderNumber}: #card element not found`)
      }

      const filePath = path.join(
        tempDir,
        `digest-card-${Date.now()}-${orderNumber}-${product.id}.png`
      )
      await element.screenshot({ type: 'png', path: filePath })
      results.push({ productId: product.id, filePath })

      if (onProgress) onProgress(i + 1, total)
    }
  } finally {
    await browser.close()
  }
  return results
}

export function cleanupDigestCards(cards: RenderedCard[]): void {
  for (const c of cards) {
    try {
      if (fs.existsSync(c.filePath)) fs.unlinkSync(c.filePath)
    } catch {
      // ignore
    }
  }
}
