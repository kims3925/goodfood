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
import { toDataUri, escapeHtml, FONT_CSS } from './renderer-utils'

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
  padding: 20px 22px 18px;
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(37,99,235,0.25);
}
.guide-title {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 10px;
}
.guide-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.guide-text {
  flex: 1;
  font-size: 22px;
  line-height: 1.4;
  opacity: 0.96;
  font-weight: 700;
}
.guide-text .hl {
  font-weight: 900;
  font-size: 24px;
}
.guide-arrow {
  flex: 0 0 auto;
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
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
          <div class="guide-row">
            <div class="guide-text">
              💬 댓글에 <span class="hl">(${orderNumber})번</span> 상품보기 주문링크 있어요
            </div>
            <div class="guide-arrow">↓</div>
          </div>
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

/**
 * 단일 카드 렌더링 — 외부에서 try/catch 로 감싸 호출.
 * 페이지/브라우저는 호출자가 관리 (재사용/재시작 결정 위임).
 */
async function renderSingleCard(
  page: import('playwright').Page,
  product: DigestCardProduct,
  orderNumber: number,
  tempDir: string
): Promise<RenderedCard> {
  // 1) 원본 이미지 URL들을 모두 base64로 변환 — 4장 병렬 처리 (이전 순차 → 4배 빠름)
  const sourceUrls = product.imageUrls.slice(0, 4)
  const uriResults = await Promise.all(sourceUrls.map((src) => toDataUri(src)))
  const dataUris = uriResults.filter((u): u is string => !!u)
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
  await element.screenshot({ type: 'png', path: filePath, timeout: 15_000 })
  return { productId: product.id, filePath }
}

export async function renderDigestCards(
  options: RenderDigestCardsOptions
): Promise<RenderedCard[]> {
  const { products, onProgress } = options
  const total = products.length
  const results: RenderedCard[] = []
  const tempDir = os.tmpdir()

  // 메모리 압박 방지 + 속도 균형:
  //  - PAGE_RESET_EVERY: 매 N장마다 page 만 새로 생성 (Browser 재시작 없이 메모리 일부 정리, 비용 0.1s)
  //  - BROWSER_RESTART_EVERY: 매 M장마다 Browser 전체 재시작 (Chrome OOM 완전 회피, 비용 2-5s)
  //  이전 v1.0(BATCH_SIZE=5 매번 browser 재시작)은 너무 공격적이었음 → 큰 배치 시 30-50% 시간 단축
  const PAGE_RESET_EVERY = 5
  const BROWSER_RESTART_EVERY = 15
  let browser: import('playwright').Browser | null = null
  let page: import('playwright').Page | null = null

  const startBrowser = async () => {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-dev-shm-usage', // /dev/shm 작은 도커 환경 대응
        '--no-sandbox',
        '--disable-gpu',
      ],
    })
    page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 1200 })
  }

  const resetPage = async () => {
    if (!browser) {
      await startBrowser()
      return
    }
    if (page) {
      try { await page.close() } catch { /* ignore */ }
    }
    page = await browser.newPage()
    await page.setViewportSize({ width: 800, height: 1200 })
  }

  try {
    await startBrowser()

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const orderNumber = i + 1

      // 카드 단위 try/catch — 한 장 실패해도 다른 카드 진행
      let attempt = 0
      let renderedCard: RenderedCard | null = null
      let lastError: any = null

      while (attempt < 2 && !renderedCard) {
        attempt++
        try {
          renderedCard = await renderSingleCard(page!, product, orderNumber, tempDir)
        } catch (err: any) {
          lastError = err
          const msg = String(err?.message || err)
          const looksFatal =
            msg.includes('Target crashed') ||
            msg.includes('Browser closed') ||
            msg.includes('disconnected') ||
            msg.includes('captureScreenshot')

          console.warn(
            `[digest-card-renderer] card #${orderNumber} (productId=${product.id}) attempt ${attempt} 실패: ${msg}`
          )

          if (looksFatal && attempt < 2) {
            // 브라우저 재시작 후 재시도
            console.warn('[digest-card-renderer] 치명적 에러 — 브라우저 재시작 후 재시도')
            await startBrowser()
          }
        }
      }

      if (renderedCard) {
        results.push(renderedCard)
        if (onProgress) onProgress(i + 1, total)
      } else {
        console.error(
          `[digest-card-renderer] card #${orderNumber} (productId=${product.id}) 최종 실패 — 스킵`,
          lastError
        )
        // 한 카드만 빠지고 다음 카드 진행 (전체 배치 보존)
      }

      // 메모리 정리 — 점진적 단계 (가벼운 리셋 → 무거운 재시작)
      const done = i + 1
      const remaining = products.length - done
      if (remaining > 0) {
        if (done % BROWSER_RESTART_EVERY === 0) {
          console.log(`[digest-card-renderer] ${BROWSER_RESTART_EVERY}장 완료 — 브라우저 전체 재시작 (메모리 완전 정리)`)
          await startBrowser()
        } else if (done % PAGE_RESET_EVERY === 0) {
          // page 만 재생성 — browser 재시작보다 10배 빠름 (0.1s vs 2-5s)
          await resetPage()
        }
      }
    }
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
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
