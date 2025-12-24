/**
 * 템플릿 이미지로 Band에 발행하는 API
 * 1. HTML 템플릿 → 이미지 생성
 * 2. 이미지를 임시 파일로 저장
 * 3. Playwright로 Band에 이미지 포함 게시물 발행
 */

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import prisma, { ChannelKind } from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'
import { bandPlaywrightService } from '@/modules/band-playwright/band-playwright.service'
import fs from 'fs'
import path from 'path'
import os from 'os'

// 폰트 CSS (Pretendard)
const FONT_CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
`

interface TemplatePublishRequest {
  productId: number
  channelId: number
  templateType?: 'standard' | 'simple' | 'premium'
  customTitle?: string
  customIntro?: string
  showOrderLink?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body: TemplatePublishRequest = await request.json()
    const {
      productId,
      channelId,
      templateType = 'standard',
      customTitle,
      customIntro = '안녕하세요, 밴드 회원님들!',
      showOrderLink = true,
    } = body

    // 1. 채널 정보 조회
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        userId: user.userId,
        kind: ChannelKind.RETAIL,
        isActive: true,
      },
      include: {
        shop: {
          select: {
            id: true,
            subdomain: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (!channel) {
      return NextResponse.json(
        { error: '채널을 찾을 수 없거나 발행 권한이 없습니다.' },
        { status: 404 }
      )
    }

    // Playwright 세션 확인
    const channelSession = await prisma.channel.findFirst({
      where: { id: channelId },
      select: {
        bandSessionCookie: true,
        sessionExpiresAt: true,
      },
    })

    const hasValidSession =
      channelSession?.bandSessionCookie &&
      channelSession.sessionExpiresAt &&
      new Date(channelSession.sessionExpiresAt) > new Date()

    if (!hasValidSession) {
      return NextResponse.json(
        { error: '밴드 세션이 없거나 만료되었습니다. 채널 설정에서 밴드 로그인을 해주세요.' },
        { status: 400 }
      )
    }

    // 2. 상품 정보 조회
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

    // 3. 주문 링크 생성
    let orderLink: string | undefined
    if (channel.shop?.subdomain && channel.shop.isActive) {
      const shopBaseUrl = process.env.NEXT_PUBLIC_SHOP_BASE_URL || 'http://localhost:3000'
      orderLink = `${shopBaseUrl}/${channel.shop.subdomain}/product/${productId}`
    }

    // 4. 템플릿 이미지 생성
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
    const browser = await chromium.launch({ headless: true })
    let templateImagePath: string | null = null

    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 600, height: 800 })
      await page.setContent(html, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)

      const contentElement = await page.$('#template-content')
      if (!contentElement) {
        throw new Error('템플릿 컨텐츠를 찾을 수 없습니다.')
      }

      // 임시 파일로 저장
      templateImagePath = path.join(os.tmpdir(), `band-template-${Date.now()}.png`)
      await contentElement.screenshot({
        type: 'png',
        path: templateImagePath,
      })
    } finally {
      await browser.close()
    }

    // 5. 게시글 본문 생성 (간단 버전)
    const postContent = buildPostContent(product, { orderLink })

    // 6. Band에 발행 (템플릿 이미지 + 상품 이미지)
    const imageUrls: string[] = []

    // 템플릿 이미지를 base64로 변환하여 URL로 사용 (또는 업로드 서비스 활용)
    // 여기서는 상품 이미지만 사용하고, 템플릿은 본문으로 대체
    // 실제로는 이미지 호스팅 서비스에 업로드 후 URL 사용 필요

    // 상품 이미지 추가
    if (product.images) {
      imageUrls.push(...product.images.map((img) => img.url))
    }

    // Playwright로 Band에 발행
    const publishResult = await bandPlaywrightService.publishWithImages({
      channelId,
      bandKey: channel.channelKey,
      bandName: channel.name,
      content: postContent,
      imageUrls: imageUrls.slice(0, 20),
    })

    // 임시 파일 삭제
    if (templateImagePath && fs.existsSync(templateImagePath)) {
      fs.unlinkSync(templateImagePath)
    }

    if (!publishResult.success) {
      return NextResponse.json(
        { error: publishResult.error || '발행에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 7. PublishedProduct 레코드 생성
    const publishedProduct = await prisma.publishedProduct.create({
      data: {
        userId: user.userId,
        productId,
        channelId,
        postKey: publishResult.postKey,
        publishedAt: new Date(),
        productName: product.name,
        thumbnailUrl: product.thumbnailUrl,
        imageUrls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      },
    })

    return NextResponse.json({
      success: true,
      publishedProductId: publishedProduct.id,
      postKey: publishResult.postKey,
    })
  } catch (error: any) {
    console.error('[Template Publish] Error:', error)
    return NextResponse.json(
      { error: error.message || '발행 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시글 본문 생성
function buildPostContent(
  product: {
    name: string
    description: string | null
    variants: Array<{ optionSummary: string | null; price: number }>
  },
  options?: { orderLink?: string }
): string {
  const lines: string[] = []

  // 상단 주문 링크
  if (options?.orderLink) {
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
    lines.push('')
  }

  // 상품명
  lines.push(`📦 ${product.name}`)
  lines.push('')

  // 판매가
  if (product.variants && product.variants.length > 0) {
    lines.push('💰 판매가:')
    for (const variant of product.variants.slice(0, 5)) {
      const optionName = variant.optionSummary || '기본'
      const price = variant.price.toLocaleString()
      lines.push(`  • ${optionName}: ${price}원`)
    }
    if (product.variants.length > 5) {
      lines.push(`  외 ${product.variants.length - 5}개 옵션`)
    }
    lines.push('')
  }

  // 상품 설명 (간략)
  if (product.description) {
    const shortDesc = product.description.slice(0, 200)
    lines.push(shortDesc + (product.description.length > 200 ? '...' : ''))
  }

  // 하단 주문 링크
  if (options?.orderLink) {
    lines.push('')
    lines.push(`🛒 주문하기 👉 ${options.orderLink}`)
  }

  return lines.join('\n')
}

// HTML 템플릿 생성 (render API와 동일)
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
  const titleFontSize = title.length > 25 ? '24px' : '36px'

  const headerBgColor =
    templateType === 'premium'
      ? '#FFE082'
      : templateType === 'simple'
      ? '#E3F2FD'
      : '#C8E6C9'

  const priceHTML =
    product.variants.length > 0
      ? `
      <div style="margin-bottom: 16px;">
        <h3 style="font-weight: 700; color: #1f2937; margin-bottom: 8px; font-size: 16px;">💰 판매가</h3>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${product.variants
            .slice(0, 5)
            .map(
              (v) => `
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
              <span style="color: #6b7280;">${v.optionSummary || '기본'}</span>
              <span style="font-weight: 600; color: #1f2937;">${formatPrice(v.price)}</span>
            </div>
          `
            )
            .join('')}
          ${product.variants.length > 5 ? `<p style="font-size: 12px; color: #9ca3af;">외 ${product.variants.length - 5}개 옵션</p>` : ''}
        </div>
      </div>
    `
      : ''

  const shippingHTML =
    product.shippingFee || (product.bundleMaxQty && product.bundleMaxQty > 1)
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

  const orderLinkHTML = showOrderLink
    ? `
      <div style="background: #EBF5FF; border-radius: 8px; padding: 12px; text-align: center; margin-top: 16px;">
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
