/**
 * 종합발행 콜라주 렌더러
 *
 * 12개(또는 N×M개) 상품을 "배경 제거된 상품 이미지 + 스펙 + 상품명 + 가격"
 * 셀로 구성된 포스터 PNG 1장으로 합성합니다.
 *
 * - 배경 제거: @imgly/background-removal-node (ONNX U2-Net, 서버 CPU)
 *   실패 시 원본 이미지로 폴백 (발행은 계속)
 * - HTML grid 레이아웃 → Playwright chromium 스크린샷 → /tmp/collage-*.png
 * - 호출측은 cleanupCollagePoster()로 임시 파일 정리 책임
 *
 * 작업지시서: C:\Users\kims3\SNS_AUTO\작업지시서_종합발행_콜라주모드.md
 */

import { chromium } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

export type CellOverlayColor = 'red' | 'yellow' | 'blue'

export interface CollageCardProduct {
  id: number
  name: string
  /** 빈 문자열이면 스펙 라인 자체 생략 */
  spec: string
  /** 이미 포맷팅된 가격 텍스트 ("19,900원") */
  priceText: string
  /** 원본 이미지 URL — 배경 제거 전 */
  imageUrl: string
  /** 셀별 추가 문구 (선택). 상품 이미지 위 반투명 배지로 표시. */
  overlayText?: string
  /** overlayText 표시 색. 기본 red. */
  overlayColor?: CellOverlayColor
}

export interface RenderCollageOptions {
  title: string
  subtitle?: string
  products: CollageCardProduct[]
  gridCols: number
  gridRows: number
  removeBackground: boolean
  /** 우측 상단 강조 배지 (예: "지금이 득템기회 🫵"). 미지정 시 배지 없음 */
  topBadgeText?: string
  /** 진행 상태 콜백 */
  onProgress?: (stage: 'bg-removal' | 'composing', current: number, total: number) => void
}

export interface RenderedCollage {
  filePath: string
  imageCount: number
  bgRemovedCount: number
  bgFailedCount: number
}

/**
 * 이미지 URL을 base64 data URI로 변환. HTTP 404나 네트워크 실패 시 null.
 */
async function fetchImageBuffer(urlOrPath: string): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    if (urlOrPath.startsWith('file://')) {
      const p = urlOrPath.replace(/^file:\/\//, '')
      if (!fs.existsSync(p)) return null
      return { buf: fs.readFileSync(p), mime: detectMime(p) }
    }
    if ((urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')) || /^[a-zA-Z]:[\\/]/.test(urlOrPath)) {
      if (fs.existsSync(urlOrPath)) {
        return { buf: fs.readFileSync(urlOrPath), mime: detectMime(urlOrPath) }
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
    return { buf, mime }
  } catch (err) {
    console.warn(`[collage] fetchImageBuffer 실패: ${urlOrPath}`, err)
    return null
  }
}

function detectMime(urlOrPath: string): string {
  if (urlOrPath.endsWith('.png')) return 'image/png'
  if (urlOrPath.endsWith('.webp')) return 'image/webp'
  if (urlOrPath.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function bufferToDataUri(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString('base64')}`
}

/**
 * @imgly/background-removal-node로 배경 제거 → PNG 버퍼.
 * 라이브러리 로드/실행 실패 시 null 반환 (호출측이 원본으로 폴백).
 *
 * 메모리 압박이 크므로 호출측에서 반드시 직렬(for) 처리할 것.
 */
async function removeBackgroundFromBuffer(
  buf: Buffer,
  mime: string
): Promise<Buffer | null> {
  try {
    // 동적 import — 모듈 자체가 없거나 onnxruntime-node가 안 깔린 경우 폴백
    const mod = await import('@imgly/background-removal-node').catch(() => null)
    if (!mod || typeof mod.removeBackground !== 'function') {
      console.warn('[collage] @imgly/background-removal-node 미설치 — 배경제거 스킵')
      return null
    }
    // Node Buffer를 신선한 ArrayBuffer 위에 복사해야 Blob TS 타입이 만족됨.
    // (lib.dom의 BlobPart는 ArrayBuffer만 허용, SharedArrayBufferLike 거부)
    const ab = new ArrayBuffer(buf.byteLength)
    new Uint8Array(ab).set(buf)
    const blob = new Blob([ab], { type: mime })
    const result: any = await mod.removeBackground(blob, {
      output: { format: 'image/png', quality: 0.9 },
    })
    // 반환은 Blob 또는 Buffer일 수 있음. 정규화.
    if (result && typeof result.arrayBuffer === 'function') {
      const ab = await result.arrayBuffer()
      return Buffer.from(ab)
    }
    if (Buffer.isBuffer(result)) return result
    if (result instanceof Uint8Array) return Buffer.from(result)
    console.warn('[collage] @imgly 결과 타입 미지원:', typeof result)
    return null
  } catch (err: any) {
    console.warn('[collage] 배경 제거 실패:', err?.message || err)
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

function buildPosterHtml(opts: {
  title: string
  subtitle?: string
  topBadgeText?: string
  cells: {
    spec: string
    name: string
    priceText: string
    imgDataUri: string | null
    overlayText?: string
    overlayColor?: CellOverlayColor
  }[]
  gridCols: number
  gridRows: number
  posterWidth: number
}): string {
  const { title, subtitle, topBadgeText, cells, gridCols, gridRows, posterWidth } = opts

  // 셀 수가 적을수록 각 셀이 커지므로 내부 요소 크기를 비례 확대.
  // 기준: 12셀(3×4) = 1.0배. 셀당 가용 면적비의 제곱근으로 선형 증감하면
  // 시각적 균형이 유지된다 (면적 2배 → 선형 √2배).
  const cellCount = gridCols * gridRows
  const cellScale = Math.min(1.8, Math.max(1, Math.sqrt(12 / cellCount)))
  const imgH = Math.round(240 * cellScale)
  const specSize = Math.round(22 * cellScale)
  const nameSize = Math.round(30 * cellScale)
  const priceSize = Math.round(42 * cellScale)
  const nameMinH = Math.round(70 * cellScale)
  const cellsHtml = cells
    .map((c) => {
      // 빈 셀 판단: 상품 정보가 없고 이미지도 없음 → placeholder만 자리 차지
      const isEmpty = !c.name && !c.priceText && !c.imgDataUri
      if (isEmpty) {
        return `<div class="cell cell-empty" aria-hidden="true"></div>`
      }
      const img = c.imgDataUri
        ? `<img src="${c.imgDataUri}" alt="">`
        : `<div class="img-placeholder">이미지 없음</div>`
      const overlay = c.overlayText
        ? `<div class="overlay-badge overlay-${c.overlayColor || 'red'}">${escapeHtml(c.overlayText)}</div>`
        : ''
      return `
      <div class="cell">
        ${c.spec ? `<div class="spec">${escapeHtml(c.spec)}</div>` : '<div class="spec spec-empty">&nbsp;</div>'}
        <div class="img-wrap">${img}${overlay}</div>
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="price">${escapeHtml(c.priceText)}</div>
      </div>`
    })
    .join('')

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
${FONT_CSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #ffffff; font-family: 'Pretendard', -apple-system, system-ui, sans-serif; }
#poster {
  width: ${posterWidth}px;
  background: linear-gradient(180deg, #FFE5EC 0%, #FFEFEC 60%, #FFFFFF 100%);
  padding: 56px 40px 48px;
  position: relative;
}
.title-block { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.title-text {
  font-size: 78px; font-weight: 900; color: #111827;
  letter-spacing: -2px; line-height: 1.05;
}
.title-accent { color: #DC2626; }
.subtitle {
  margin-top: 10px; font-size: 24px; color: #6B7280; font-weight: 600;
}
.top-badge {
  position: absolute; top: 36px; right: 36px;
  background: #DC2626; color: #fff;
  padding: 12px 22px; border-radius: 26px;
  font-size: 22px; font-weight: 800;
  box-shadow: 0 6px 14px rgba(220,38,38,0.3);
}
.grid {
  display: grid;
  grid-template-columns: repeat(${gridCols}, 1fr);
  grid-template-rows: repeat(${gridRows}, 1fr);
  gap: 28px;
  margin-top: 36px;
}
.cell-empty {
  background: transparent;
  border: none;
  visibility: hidden;
}
.cell {
  background: rgba(255,255,255,0.55);
  border-radius: 18px;
  padding: 18px 16px 22px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  position: relative;
}
.spec {
  font-size: ${specSize}px; font-weight: 800; color: #DC2626;
  letter-spacing: -0.5px;
  min-height: ${Math.round(28 * cellScale)}px;
}
.spec-empty { visibility: hidden; }
.img-wrap {
  height: ${imgH}px;
  display: flex; align-items: center; justify-content: center;
  margin: 10px 0 12px;
  position: relative;
}
.overlay-badge {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  padding: ${Math.round(6 * cellScale)}px ${Math.round(16 * cellScale)}px;
  font-size: ${Math.round(20 * cellScale)}px;
  font-weight: 900;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  white-space: nowrap;
  letter-spacing: -0.5px;
  z-index: 2;
  max-width: 95%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.overlay-red { background: #DC2626; color: #fff; }
.overlay-yellow { background: #FCD34D; color: #111827; }
.overlay-blue { background: #2563EB; color: #fff; }
.img-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.15));
}
.img-placeholder {
  width: 100%; height: 100%; display: flex;
  align-items: center; justify-content: center;
  background: #F3F4F6; color: #9CA3AF;
  border-radius: 12px; font-size: 18px;
}
.name {
  font-size: ${nameSize}px; font-weight: 800; color: #111827;
  line-height: 1.18; word-break: keep-all;
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: ${nameMinH}px;
}
.price {
  margin-top: 10px;
  font-size: ${priceSize}px; font-weight: 900;
  color: #FBBF24;
  -webkit-text-stroke: 2px #111827;
  letter-spacing: -1px;
}
</style>
</head>
<body>
<div id="poster">
  ${topBadgeText ? `<div class="top-badge">${escapeHtml(topBadgeText)}</div>` : ''}
  <div class="title-block">
    <span class="title-text">${escapeHtml(title)}</span>
  </div>
  ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
  <div class="grid">
    ${cellsHtml}
  </div>
</div>
</body>
</html>`
}

export async function renderCollagePoster(
  options: RenderCollageOptions
): Promise<RenderedCollage> {
  const {
    title,
    subtitle,
    products,
    gridCols,
    gridRows,
    removeBackground,
    topBadgeText,
    onProgress,
  } = options

  const expected = gridCols * gridRows
  if (products.length === 0) {
    throw new Error('콜라주 렌더러: 상품 수가 0입니다.')
  }
  if (products.length > expected) {
    throw new Error(
      `콜라주 렌더러: 상품 수(${products.length})가 그리드 크기(${gridCols}×${gridRows}=${expected})보다 많습니다.`
    )
  }
  const emptySlots = expected - products.length // 부족 셀은 빈 placeholder로 렌더

  // 1) 각 이미지 처리 — fetch → (옵션) 배경 제거 → data URI
  // 메모리 보호를 위해 순차 처리. 12장 기준 1-2분 예상.
  let bgRemovedCount = 0
  let bgFailedCount = 0
  const cellData: {
    spec: string
    name: string
    priceText: string
    imgDataUri: string | null
    overlayText?: string
    overlayColor?: CellOverlayColor
  }[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    onProgress?.('bg-removal', i + 1, products.length)

    let imgDataUri: string | null = null
    if (p.imageUrl) {
      const fetched = await fetchImageBuffer(p.imageUrl)
      if (fetched) {
        if (removeBackground) {
          const removed = await removeBackgroundFromBuffer(fetched.buf, fetched.mime)
          if (removed) {
            imgDataUri = bufferToDataUri(removed, 'image/png')
            bgRemovedCount++
          } else {
            // 폴백: 원본 사용
            imgDataUri = bufferToDataUri(fetched.buf, fetched.mime)
            bgFailedCount++
          }
        } else {
          imgDataUri = bufferToDataUri(fetched.buf, fetched.mime)
        }
      }
    }

    cellData.push({
      spec: p.spec || '',
      name: p.name,
      priceText: p.priceText,
      imgDataUri,
      overlayText: p.overlayText,
      overlayColor: p.overlayColor,
    })
  }

  // 빈 셀 placeholder — grid 레이아웃은 유지하되 내용은 visibility:hidden
  for (let i = 0; i < emptySlots; i++) {
    cellData.push({ spec: '', name: '', priceText: '', imgDataUri: null })
  }

  // 2) HTML 합성 + Playwright 스크린샷
  onProgress?.('composing', 1, 1)
  const posterWidth = 1200
  const html = buildPosterHtml({
    title,
    subtitle,
    topBadgeText,
    cells: cellData,
    gridCols,
    gridRows,
    posterWidth,
  })

  const browser = await chromium.launch({ headless: true })
  const tempDir = os.tmpdir()
  const filePath = path.join(
    tempDir,
    `digest-collage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  )

  try {
    // 6셀(scale≈1.41) 모드에서 포스터 세로가 1800px을 넘길 수 있어
    // 뷰포트를 여유있게 잡는다. element.screenshot은 스크롤 캡처지만
    // 레이아웃 안정성을 위해 충분한 크기 확보.
    const expectedPosterHeight =
      Math.ceil(300 + gridRows * Math.max(450, 420 * Math.sqrt(12 / (gridCols * gridRows))))
    const page = await browser.newPage({
      viewport: { width: posterWidth + 40, height: Math.max(1800, expectedPosterHeight + 200) },
      deviceScaleFactor: 1.5,
    })
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 })

    // 모든 이미지/폰트 로드 대기
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
      if (document.fonts && document.fonts.ready) {
        // @ts-ignore
        await document.fonts.ready
      }
    })
    await page.waitForTimeout(300)

    const element = await page.$('#poster')
    if (!element) throw new Error('포스터 element(#poster)를 찾지 못했습니다.')

    await element.screenshot({ type: 'png', path: filePath })
  } finally {
    await browser.close()
  }

  return {
    filePath,
    imageCount: cellData.filter((c) => c.imgDataUri).length,
    bgRemovedCount,
    bgFailedCount,
  }
}

export function cleanupCollagePoster(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    // ignore
  }
}

// ─── 스펙 추출 헬퍼 (3단 폴백) ─────────────────────────────────────
// 작업지시서 2-2 기준: variant.optionSummary → description → name → 빈문자열
const SPEC_PATTERNS: RegExp[] = [
  /(\d+(?:\.\d+)?\s*(?:kg|g|개|팩|병|ml|L|마리|통|박스|세트|구이|포))/i,
  /(\d+\s*[×xX]\s*\d+\s*(?:g|kg|개|팩|병|ml|L)?)/,
  /(\d+(?:\.\d+)?\s*(?:인분))/i,
]

export interface SpecSource {
  name: string
  description?: string | null
  variants?: { optionSummary: string | null | undefined }[]
}

export function extractSpec(product: SpecSource): string {
  const firstVariant = product.variants?.[0]
  if (firstVariant?.optionSummary && firstVariant.optionSummary.trim()) {
    return firstVariant.optionSummary.trim()
  }
  if (product.description) {
    for (const pat of SPEC_PATTERNS) {
      const m = product.description.match(pat)
      if (m) return m[1].replace(/\s+/g, ' ').trim()
    }
  }
  for (const pat of SPEC_PATTERNS) {
    const m = product.name.match(pat)
    if (m) return m[1].replace(/\s+/g, ' ').trim()
  }
  return ''
}
