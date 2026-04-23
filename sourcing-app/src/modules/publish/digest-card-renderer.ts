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
import QRCode from 'qrcode'

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
  description?: string | null // 간단한 설명 (카드에 1-2줄로 표시)
  imageUrls: string[] // 0~4장. 0장이면 회색 플레이스홀더
}

/** 설명을 카드 표시용으로 요약. 줄바꿈·과도 공백 제거 + maxLen 글자로 절단 */
function summarizeDescription(raw: string | null | undefined, maxLen = 75): string {
  if (!raw) return ''
  const cleaned = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= maxLen) return cleaned
  // 단어 경계에서 자르기 (한글은 공백 단위가 유의미할 수 있음)
  const sliced = cleaned.slice(0, maxLen)
  const lastSpace = sliced.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.6 ? sliced.slice(0, lastSpace) : sliced) + '…'
}

/** 안내 문구 내 상품명이 너무 길면 축약 */
function truncateName(name: string, maxLen = 20): string {
  const n = name || ''
  return n.length <= maxLen ? n : n.slice(0, maxLen) + '…'
}

/**
 * 주문 URL로 QR 코드 data URI 생성. 실패 시 null.
 * Band 웹 에디터가 이미지-텍스트 교차 배치를 허용하지 않아 모든 이미지가
 * 갤러리로 묶이는 제약을 우회하기 위해, 카드 PNG 자체에 QR을 박아
 * 사용자가 휴대폰으로 스캔 시 바로 결제 페이지로 이동할 수 있게 한다.
 */
async function generateQrDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    return await QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M',
      color: { dark: '#1D4ED8', light: '#FFFFFF' },
    })
  } catch (err) {
    console.warn(`[digest-card] QR 생성 실패: ${url}`, err)
    return null
  }
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
    return `<div style="width:100%;aspect-ratio:1/1;background:#E5E7EB;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:22px;">이미지 없음</div>`
  }
  // 1장: 정사각형 단일, 그 외는 2×2 그리드 (3장이면 4번째 슬롯은 회색 placeholder)
  if (imgs.length === 1) {
    return `<div style="width:100%;aspect-ratio:1/1;overflow:hidden;">
      <img src="${imgs[0]}" style="width:100%;height:100%;object-fit:cover;display:block;">
    </div>`
  }
  const cells: string[] = []
  for (let i = 0; i < 4; i++) {
    if (i < imgs.length) {
      cells.push(`<div style="width:100%;aspect-ratio:1/1;overflow:hidden;">
        <img src="${imgs[i]}" style="width:100%;height:100%;object-fit:cover;display:block;">
      </div>`)
    } else {
      cells.push(`<div style="width:100%;aspect-ratio:1/1;background:#F3F4F6;"></div>`)
    }
  }
  return `<div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#F3F4F6;">
    ${cells.join('')}
  </div>`
}

function buildCardHtml(
  product: DigestCardProduct,
  orderNumber: number,
  qrDataUri: string | null
): string {
  const rawName = product.name || ''
  const name = escapeHtml(rawName)
  const shortName = escapeHtml(truncateName(rawName, 20))
  const priceLine = product.priceText
    ? escapeHtml(product.priceText)
    : product.price
    ? `${product.price.toLocaleString()}원`
    : ''
  // 마감시간은 도매글에 표기가 있을 때(= deadline 값 존재)만 렌더
  const deadline = product.deadline ? escapeHtml(product.deadline) : ''
  const description = escapeHtml(summarizeDescription(product.description, 75))

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
}
.image-grid { width: 100%; background: #f9fafb; }
.text-area {
  padding: 36px 36px 44px;
  background: #ffffff;
  border-top: 6px solid #F3F4F6;
}
/* 좌: QR / 우: 상품 정보 + 안내 박스 */
.main-block {
  display: flex;
  gap: 22px;
  align-items: stretch;
}
.qr-panel {
  flex: 0 0 220px;
  width: 220px;
  padding: 12px;
  background: #FFFFFF;
  border: 3px solid #2563EB;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(37,99,235,0.15);
}
.qr-panel img { width: 100%; height: auto; display: block; }
.qr-panel .qr-label {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 800;
  color: #1D4ED8;
  text-align: center;
}
.info-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.order-num {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: #2563EB;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
}
.title {
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1.2;
  word-break: keep-all;
}
.price {
  font-size: 26px;
  font-weight: 800;
  color: #DC2626;
  margin-top: 2px;
}
.deadline {
  font-size: 18px;
  color: #4B5563;
}
.desc {
  font-size: 17px;
  color: #374151;
  line-height: 1.45;
  word-break: keep-all;
}
.guide-box {
  margin-top: auto;
  background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
  color: #ffffff;
  padding: 16px 18px 14px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
}
.guide-title {
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 6px;
}
.guide-text {
  font-size: 15px;
  line-height: 1.5;
  opacity: 0.96;
}
.guide-text .hl { font-weight: 800; }
.guide-arrow {
  font-size: 36px;
  font-weight: 900;
  text-align: center;
  line-height: 1;
  margin-top: 4px;
}
</style>
</head>
<body>
<div id="card">
  <div class="image-grid">
    ${buildImageGridHtml(product.imageUrls)}
  </div>
  <div class="text-area">
    <div class="main-block">
      ${qrDataUri ? `<div class="qr-panel">
        <img src="${qrDataUri}" alt="QR">
        <div class="qr-label">📱 QR 스캔</div>
      </div>` : ''}
      <div class="info-panel">
        <div class="title-row">
          <span class="order-num">${orderNumber}</span>
          <span class="title">${name}</span>
        </div>
        ${priceLine ? `<div class="price">💰 ${priceLine}</div>` : ''}
        ${deadline ? `<div class="deadline">⏰ 주문 마감: ${deadline}</div>` : ''}
        ${description ? `<div class="desc">${description}</div>` : ''}
        <div class="guide-box">
          <div class="guide-title">🛒 상품보기 / 주문</div>
          <div class="guide-text">
            <span class="hl">사진 댓글</span>에 링크가 있고,<br>
            댓글란에도 <span class="hl">(${orderNumber})번</span> 주문링크가 있습니다
          </div>
          <div class="guide-arrow">↓</div>
        </div>
      </div>
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

      // 2) 주문 URL → QR 코드 data URI (카드에 박아 스캔 가능하게)
      const qrDataUri = await generateQrDataUri(product.orderUrl)

      const html = buildCardHtml(productForHtml, orderNumber, qrDataUri)

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
