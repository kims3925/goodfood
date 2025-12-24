/**
 * 템플릿 이미지 렌더링 API
 * HTML 템플릿을 Playwright로 렌더링하여 이미지로 변환
 */

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

// 폰트 CSS (Pretendard)
const FONT_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
`

interface TemplateRenderRequest {
  productId: number
  templateType?: 'standard' | 'simple' | 'premium'
  customTitle?: string
  customIntro?: string
  showOrderLink?: boolean
  orderLink?: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body: TemplateRenderRequest = await request.json()
    const {
      productId,
      templateType = 'standard',
      customTitle,
      customIntro = '안녕하세요, 밴드 회원님들!',
      showOrderLink = true,
      orderLink,
    } = body

    // 상품 정보 조회
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        userId: user.userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnailUrl: true,
        price: true,
        shippingFee: true,
        bundleMaxQty: true,
        variants: {
          select: {
            id: true,
            optionSummary: true,
            price: true,
          },
          take: 10,
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { url: true },
          take: 4,
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // HTML 템플릿 생성
    const title = customTitle || product.name
    const html = generateTemplateHTML({
      product,
      title,
      intro: customIntro,
      showOrderLink,
      orderLink,
      templateType,
    })

    // Playwright로 이미지 렌더링
    const browser = await chromium.launch({
      headless: true,
    })

    try {
      const page = await browser.newPage()

      // 뷰포트 설정
      await page.setViewportSize({ width: 600, height: 800 })

      // HTML 로드
      await page.setContent(html, { waitUntil: 'networkidle' })

      // 폰트 로딩 대기
      await page.waitForTimeout(1000)

      // 컨텐츠 영역만 스크린샷
      const contentElement = await page.$('#template-content')
      if (!contentElement) {
        throw new Error('템플릿 컨텐츠를 찾을 수 없습니다.')
      }

      const screenshot = await contentElement.screenshot({
        type: 'png',
        omitBackground: false,
      })

      // Buffer를 Uint8Array로 변환
      const uint8Array = new Uint8Array(screenshot)

      return new NextResponse(uint8Array, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `inline; filename="template-${productId}.png"`,
        },
      })
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    console.error('[Template Render] Error:', error)
    return NextResponse.json(
      { error: error.message || '템플릿 렌더링 실패' },
      { status: 500 }
    )
  }
}

interface GenerateHTMLParams {
  product: {
    id: number
    name: string
    description: string | null
    thumbnailUrl: string | null
    price: number | null
    shippingFee: number | null
    bundleMaxQty: number | null
    variants: Array<{ id: number; optionSummary: string | null; price: number }>
    images: Array<{ url: string }>
  }
  title: string
  intro: string
  showOrderLink: boolean
  orderLink?: string
  templateType: 'standard' | 'simple' | 'premium'
}

function generateTemplateHTML(params: GenerateHTMLParams): string {
  const { product, title, intro, showOrderLink, orderLink, templateType } = params

  const formatPrice = (price: number) => price.toLocaleString() + '원'

  // 타이틀 크기 결정 (1줄/2줄)
  const titleFontSize = title.length > 25 ? '24px' : '36px'

  // 배경색 설정 (템플릿 타입별)
  const headerBgColor = templateType === 'premium'
    ? '#FFE082'
    : templateType === 'simple'
    ? '#E3F2FD'
    : '#C8E6C9'

  // 가격 정보 HTML
  const priceHTML = product.variants.length > 0
    ? `
      <div style="margin-bottom: 16px;">
        <h3 style="font-weight: 700; color: #1f2937; margin-bottom: 8px; font-size: 16px;">💰 판매가</h3>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${product.variants.slice(0, 5).map(v => `
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span style="color: #6b7280;">${v.optionSummary || '기본'}</span>
              <span style="font-weight: 600; color: #1f2937;">${formatPrice(v.price)}</span>
            </div>
          `).join('')}
          ${product.variants.length > 5 ? `<p style="font-size: 12px; color: #9ca3af;">외 ${product.variants.length - 5}개 옵션</p>` : ''}
        </div>
      </div>
    `
    : ''

  // 배송 정보 HTML
  const shippingHTML = (product.shippingFee || (product.bundleMaxQty && product.bundleMaxQty > 1))
    ? `
      <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
        <h3 style="font-weight: 700; color: #1f2937; margin-bottom: 8px; font-size: 16px;">🚚 배송정보</h3>
        <div style="font-size: 14px; color: #6b7280;">
          ${product.shippingFee ? `<p>배송비: ${formatPrice(product.shippingFee)}</p>` : ''}
          ${product.bundleMaxQty && product.bundleMaxQty > 1 ? `<p>합배송: ${product.bundleMaxQty}개까지 묶음배송</p>` : ''}
        </div>
      </div>
    `
    : ''

  // 상품 설명 HTML
  const descriptionHTML = product.description
    ? `
      <div style="margin-bottom: 16px;">
        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; white-space: pre-line;">
          ${product.description.slice(0, 400)}${product.description.length > 400 ? '...' : ''}
        </p>
      </div>
    `
    : ''

  // 이미지 HTML
  const imagesHTML = product.images.length > 0
    ? `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px;">
        ${product.images.slice(0, 4).map(img => `
          <div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: #e5e7eb;">
            <img src="${img.url}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        `).join('')}
      </div>
    `
    : ''

  // 주문 링크 HTML
  const orderLinkHTML = showOrderLink
    ? `
      <div style="background: #EBF5FF; border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #2563eb; font-weight: 600; font-size: 14px;">
          🛒 주문하기 👉 ${orderLink || '[쇼핑몰에서 확인]'}
        </p>
      </div>
    `
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${FONT_CSS}

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      background: #f3f4f6;
      padding: 20px;
    }

    #template-content {
      width: 500px;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .header {
      background: ${headerBgColor};
      padding: 20px 24px;
    }

    .header h1 {
      font-size: ${titleFontSize};
      font-weight: 800;
      color: #1f2937;
      line-height: 1.3;
    }

    .content {
      padding: 20px 24px;
    }

    .intro {
      color: #4b5563;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 16px;
      white-space: pre-line;
    }

    .info-box {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div id="template-content">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
    </div>

    <div class="content">
      ${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ''}

      <div class="info-box">
        ${priceHTML}
        ${shippingHTML}
      </div>

      ${descriptionHTML}
      ${imagesHTML}
      ${orderLinkHTML}
    </div>
  </div>
</body>
</html>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
