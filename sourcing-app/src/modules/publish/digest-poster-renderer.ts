/**
 * 종합발행 상단 포스터 렌더러
 *
 * 게시글 갤러리 맨 앞에 들어가는 "오늘의 상품 목록" 텍스트 포스터 1장을 생성한다.
 * (노란 배경 + 초록 테두리 + 상품명 나열 — 수산천국 접수글 스타일)
 * Playwright chromium 으로 HTML→PNG. 반환: 임시 디렉터리의 로컬 파일 경로.
 * 호출측이 발행 후 파일 삭제를 책임진다 (digest-card 와 동일 규약).
 */

import { chromium } from 'playwright'
import os from 'os'
import path from 'path'
import { escapeHtml, FONT_CSS } from './renderer-utils'

export interface DigestPosterOptions {
  /** 포스터에 나열할 상품명 (발행 선택 순서 유지) */
  productNames: string[]
  /** 상단 타이틀. 미지정 시 "{YYYY. M. D.} 상품 많이 있어요" */
  title?: string
  /** 안내 문구 (예: "16시 이전 결제 시 당일 발송"). 빈 값이면 줄 생략 */
  noticeText?: string
  date?: Date
}

function buildPosterHtml(options: DigestPosterOptions): string {
  const { productNames, noticeText, date = new Date() } = options
  const title =
    options.title?.trim() ||
    `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. 상품 많이 있어요`

  const redSlash = `<span style="color:#EF4444;font-weight:900;"> / </span>`
  const namesHtml = productNames
    .map((n) => `<span>${escapeHtml(n.trim())}</span>`)
    .join(redSlash)

  const noticeHtml = noticeText?.trim()
    ? `<div style="text-align:center;font-size:30px;font-weight:800;color:#DB2777;margin:18px 0 6px;">♡ ${escapeHtml(noticeText.trim())} ♡</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
${FONT_CSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #fff; }
#poster {
  width: 900px;
  background: #FDE992;
  border: 12px solid #22C55E;
  border-radius: 6px;
  padding: 40px 36px;
  font-family: 'Pretendard', -apple-system, 'Malgun Gothic', sans-serif;
}
.title {
  text-align: center;
  font-size: 40px;
  font-weight: 900;
  color: #DC2626;
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.names {
  font-size: 42px;
  font-weight: 900;
  color: #111827;
  line-height: 1.55;
  text-align: center;
  word-break: keep-all;
  margin-top: 18px;
}
</style>
</head>
<body>
  <div id="poster">
    <div class="title">♥ ${escapeHtml(title)} ♥</div>
    ${noticeHtml}
    <div class="names">${namesHtml}</div>
  </div>
</body>
</html>`
}

/**
 * 포스터 1장 렌더링. 실패 시 throw — 호출측에서 catch 후 포스터 없이 발행 진행.
 */
export async function renderDigestPoster(options: DigestPosterOptions): Promise<string> {
  if (!options.productNames || options.productNames.length === 0) {
    throw new Error('포스터에 나열할 상품이 없습니다.')
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1000, height: 1400 })
    await page.setContent(buildPosterHtml(options), { waitUntil: 'networkidle' })

    const element = await page.$('#poster')
    if (!element) throw new Error('#poster 엘리먼트를 찾지 못함')

    const filePath = path.join(os.tmpdir(), `digest-poster-${Date.now()}.png`)
    await element.screenshot({ type: 'png', path: filePath, timeout: 15_000 })
    return filePath
  } finally {
    try {
      await browser.close()
    } catch {
      /* ignore */
    }
  }
}
