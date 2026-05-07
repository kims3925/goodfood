/**
 * Playwright 기반 이미지 렌더러 공통 유틸 (Phase 6 — 작업지침서)
 *
 * digest-card-renderer / digest-collage-renderer / ad-card-renderer 가
 * 95% 동일하게 중복 보유한 toDataUri / escapeHtml / FONT_CSS / chromium.launch
 * 패턴을 일원화. 신규 렌더러는 이 모듈 사용 권장.
 *
 * 기존 3개 렌더러는 점진 마이그레이션 (호환성 유지 — 본 모듈은 추가만, 기존 함수 삭제 X).
 */

import { chromium, type Browser } from 'playwright'
import fs from 'fs'
import os from 'os'
import path from 'path'

const DEFAULT_FETCH_TIMEOUT_MS = 10_000
const DEFAULT_PAGE_TIMEOUT_MS = 30_000

// ─────────────────────────────────────────────────────────
// 이미지 → Data URI
// ─────────────────────────────────────────────────────────

/**
 * 이미지 URL/경로 → base64 data URI.
 * file:// → fs 읽기, http(s) → fetch, 상대경로 → NEXT_PUBLIC_APP_URL prefix.
 * @returns data URI 문자열 (실패 시 null)
 */
export async function toDataUri(urlOrPath: string): Promise<string | null> {
  try {
    // file:// scheme
    if (urlOrPath.startsWith('file://')) {
      const p = urlOrPath.replace(/^file:\/\//, '')
      if (!fs.existsSync(p)) return null
      const buf = fs.readFileSync(p)
      return `data:${detectMime(p)};base64,${buf.toString('base64')}`
    }

    // OS 절대 경로 (Linux /xxx, Windows C:\xxx)
    if (
      (urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')) ||
      /^[a-zA-Z]:[\\/]/.test(urlOrPath)
    ) {
      if (fs.existsSync(urlOrPath)) {
        const buf = fs.readFileSync(urlOrPath)
        return `data:${detectMime(urlOrPath)};base64,${buf.toString('base64')}`
      }
      // 파일이 없으면 URL 로 간주
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
      urlOrPath = `${base}${urlOrPath.startsWith('/') ? urlOrPath : '/' + urlOrPath}`
    }

    // HTTP(S) fetch
    const res = await fetch(urlOrPath, {
      headers: { 'User-Agent': 'Mozilla/5.0 BandAuto/1.0' },
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime =
      res.headers.get('content-type')?.split(';')[0] || detectMime(urlOrPath)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (err) {
    console.warn(
      `[renderer-utils] toDataUri 실패: ${urlOrPath}`,
      (err as Error).message
    )
    return null
  }
}

/** 확장자로 MIME 추정 */
export function detectMime(filePath: string): string {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg'
  return 'image/jpeg'
}

// ─────────────────────────────────────────────────────────
// HTML 유틸
// ─────────────────────────────────────────────────────────

/** HTML 이스케이프 (XSS 방지) */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Pretendard 폰트 CSS (CDN) — 한국어 우선 sans-serif */
export const FONT_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
* { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; }
`

// ─────────────────────────────────────────────────────────
// Playwright 브라우저 관리
// ─────────────────────────────────────────────────────────

/** 렌더러 전용 chromium 실행 (headless, 컨테이너 친화 args) */
export async function launchRenderer(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
}

/**
 * HTML → PNG 렌더링 (이미지 + 폰트 로드 대기 포함).
 * 호출자가 browser 라이프사이클 책임.
 */
export async function renderHtmlToPng(
  browser: Browser,
  html: string,
  opts: { width: number; height: number; deviceScaleFactor?: number; selector?: string }
): Promise<Buffer> {
  const page = await browser.newPage({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: opts.deviceScaleFactor ?? 2,
  })
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: DEFAULT_PAGE_TIMEOUT_MS })

    // 이미지 + 폰트 로드 대기
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise<void>((resolve) => {
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
    await page.waitForTimeout(200)

    if (opts.selector) {
      const el = await page.$(opts.selector)
      if (!el) throw new Error(`[renderer-utils] selector not found: ${opts.selector}`)
      return await el.screenshot({ type: 'png' })
    }
    return await page.screenshot({ type: 'png' })
  } finally {
    await page.close().catch(() => {})
  }
}

// ─────────────────────────────────────────────────────────
// 임시 파일 관리
// ─────────────────────────────────────────────────────────

/** 임시 디렉터리 생성 */
export function createTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

/** 임시 디렉터리 삭제 (실패해도 로그만) */
export function cleanupTempDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  } catch (err) {
    console.warn(
      `[renderer-utils] cleanupTempDir 실패: ${dirPath}`,
      (err as Error).message
    )
  }
}

/** 임시 PNG 파일 경로 생성 (저장은 호출자가) */
export function tempPngPath(prefix: string): string {
  const tempDir = os.tmpdir()
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  return path.join(tempDir, fileName)
}

/** 단일 임시 파일 삭제 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {
    /* silent */
  }
}
