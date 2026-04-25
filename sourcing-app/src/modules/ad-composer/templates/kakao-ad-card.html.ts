/**
 * 카카오톡 광고 카드 HTML 템플릿
 *
 * 작업지시서 9 + 2 (디자인 분석)
 * - 720×1280 세로 (모바일 카카오톡 최적)
 * - 3D 윤곽선 타이틀 (빨강 / 파랑 / 녹색)
 * - 회색 서브타이틀 박스
 * - 메인 상품 이미지 (배경 제거 안 함, 원본 cover)
 * - 옵션: 좌상 리본 배지, 우상 행사 배지, 빨간 강조 배너
 * - 상품명 + 본문 설명 + 가격 라인
 */

export type AdTitleColor = 'red' | 'blue' | 'green'

export interface AdCardHtmlInput {
  title: string
  titleColor: AdTitleColor
  subtitle: string
  bannerText?: string | null
  ribbonText?: string | null
  saleBadge?: boolean
  productName: string
  /** plain text (줄바꿈 \n으로 표현). HTML 직접 주입 금지 (XSS) */
  descriptionText: string
  priceText: string
  /** data:image/...;base64,... 형식 권장. 외부 URL이면 Playwright가 다운로드해야 함 */
  productImageDataUri: string | null
}

const FONT_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
`

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function nl2br(str: string): string {
  return escapeHtml(str).replace(/\n/g, '<br>')
}

function titleColorVars(color: AdTitleColor): { stroke: string; shadow: string } {
  switch (color) {
    case 'blue':
      return { stroke: '#1D4ED8', shadow: '#1E3A8A' }
    case 'green':
      return { stroke: '#15803D', shadow: '#14532D' }
    case 'red':
    default:
      return { stroke: '#DC2626', shadow: '#7F1D1D' }
  }
}

export function buildAdCardHtml(input: AdCardHtmlInput): string {
  const { stroke, shadow } = titleColorVars(input.titleColor)
  const title = escapeHtml(input.title)
  const subtitle = escapeHtml(input.subtitle)
  const banner = input.bannerText ? escapeHtml(input.bannerText) : ''
  const ribbon = input.ribbonText ? escapeHtml(input.ribbonText) : ''
  const productName = escapeHtml(input.productName)
  const descHtml = nl2br(input.descriptionText)
  const priceText = escapeHtml(input.priceText)
  const imgSrc = input.productImageDataUri || ''

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
${FONT_CSS}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #ffffff; font-family: 'Pretendard', -apple-system, system-ui, sans-serif; }
#card {
  width: 720px;
  height: 1280px;
  position: relative;
  background: linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%);
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
}
.ribbon {
  position: absolute;
  top: 24px;
  left: 24px;
  background: #16A34A;
  color: #ffffff;
  padding: 10px 18px;
  font-size: 18px;
  font-weight: 800;
  border-radius: 6px 6px 6px 0;
  box-shadow: 0 4px 8px rgba(22,163,74,0.25);
  z-index: 5;
}
.ribbon::after {
  content: '';
  position: absolute;
  left: 0; top: 100%;
  width: 0; height: 0;
  border-top: 10px solid #14532D;
  border-left: 10px solid transparent;
}
.sale-badge {
  position: absolute;
  top: 24px;
  right: 24px;
  background: #DC2626;
  color: #ffffff;
  padding: 10px 18px;
  font-size: 18px;
  font-weight: 800;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(220,38,38,0.3);
  z-index: 5;
}
.title-area {
  text-align: center;
  margin-top: 26px;
  padding: 0 12px;
}
.title {
  font-size: 64px;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: -2px;
  line-height: 1.1;
  -webkit-text-stroke: 5px ${stroke};
  text-shadow: 5px 5px 0 ${shadow};
  word-break: keep-all;
}
.subtitle-box {
  display: inline-block;
  margin-top: 16px;
  background: #E5E7EB;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 22px;
  font-weight: 700;
  color: #374151;
  text-decoration: underline;
  text-decoration-color: #DC2626;
  text-underline-offset: 4px;
  text-decoration-thickness: 2px;
}
.product-name {
  font-size: 30px;
  font-weight: 800;
  color: #111827;
  line-height: 1.3;
  margin: 18px 0 0;
  word-break: keep-all;
  text-align: center;
  flex: 0 0 auto;
}
.description {
  font-size: 22px;
  font-weight: 500;
  color: #1F2937;
  line-height: 1.5;
  margin-top: 14px;
  white-space: normal;
  word-break: keep-all;
  flex: 0 0 auto;
}
/* 본문(설명)과 가격라인 사이 여백 없음 — 사용자 요청 */
.price-line {
  font-size: 28px;
  font-weight: 900;
  color: #DC2626;
  margin: 0;
  letter-spacing: -0.5px;
  word-break: keep-all;
  flex: 0 0 auto;
}
.banner {
  background: #DC2626;
  color: #ffffff;
  font-size: 24px;
  font-weight: 800;
  padding: 14px 18px;
  border-radius: 8px;
  text-align: center;
  margin: 14px 0 0;
  letter-spacing: -0.5px;
  word-break: keep-all;
  flex: 0 0 auto;
}
.image-area {
  flex: 1 1 auto;
  margin: 14px 0 0;
  width: 100%;
  min-height: 460px;
  background: #F3F4F6;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-area img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-empty {
  color: #9CA3AF;
  font-size: 22px;
}
</style>
</head>
<body>
<div id="card">
  ${ribbon ? `<div class="ribbon">${ribbon}</div>` : ''}
  ${input.saleBadge ? `<div class="sale-badge">행사상품</div>` : ''}
  <div class="title-area">
    <div class="title">${title}</div>
    ${subtitle ? `<div class="subtitle-box">${subtitle}</div>` : ''}
  </div>
  <div class="product-name">${productName}</div>
  <div class="image-area">
    ${imgSrc ? `<img src="${imgSrc}" alt="">` : `<div class="image-empty">이미지 없음</div>`}
  </div>
  ${banner ? `<div class="banner">${banner}</div>` : ''}
  <div class="description">${descHtml}</div>
  <div class="price-line">💰 ${priceText}</div>
</div>
</body>
</html>`
}
