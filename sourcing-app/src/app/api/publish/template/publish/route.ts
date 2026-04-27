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
import { calculateSellingPrice } from '@/lib/price-calculator'
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

    // sessionExpiresAt이 null이면 세션쿠키(만료일 없음) → 유효로 처리
    const hasValidSession =
      channelSession?.bandSessionCookie &&
      (!channelSession.sessionExpiresAt || new Date(channelSession.sessionExpiresAt) > new Date())

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
        bundleShippingType: true,
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
    // ⚠️ 사용자 요청 (2026-04-27): 카드는 "제목 배너"만 표시. 인사말/가격/배송/
    // 주문링크는 본문(buildPostContent)에 동일 정보가 이미 들어가므로 카드에 중복
    // 표시할 필요가 없다. customIntro / showOrderLink / templateType의 부가 영역은
    // generateTemplateHTML 내부에서 모두 비활성.
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

    // 6. Band에 발행 (템플릿 카드 PNG + 상품 이미지)
    // bandPlaywrightService.publishWithImages는 imageUrls에 file path/URL 모두 처리한다
    // (digest API에서 동일 패턴으로 카드 PNG를 file path로 첨부 중). 외부 이미지 호스팅
    // 서비스 없이 임시 파일을 그대로 업로드 가능.
    //
    // ⚠️ 변경 이력: 이전엔 templateImagePath를 렌더만 하고 imageUrls에 넣지 않아 폐기했고,
    // 그 결과 본문은 plain 텍스트만 + raw 상품 이미지만 첨부되어 자동발행(digest 모드)과
    // 시각 차이가 컸음. 이제 카드 PNG를 첫 이미지로 첨부해 자동/수동/재발행이 모두 동일한
    // 포맷의 카드 + 상품 이미지를 갖도록 통일.
    const imageUrls: string[] = []

    if (templateImagePath && fs.existsSync(templateImagePath)) {
      imageUrls.push(templateImagePath)
    }

    // 상품 원본 이미지 (최대 4장 — Product.images.take:4)
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

    // 7. ChannelProduct 레코드 생성 (채널 발행이므로 channelProduct 사용)
    const channelProduct = await prisma.channelProduct.create({
      data: {
        userId: user.userId,
        productId,
        channelId,
        publishedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      channelProductId: channelProduct.id,
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
    shippingFee: number | null
    bundleShippingType: string | null
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

  // 판매가 - 공통 모듈로 배송비 포함된 가격 계산
  if (product.variants && product.variants.length > 0) {
    const shippingFee = product.shippingFee || 0
    const bundleShippingType = product.bundleShippingType || null

    lines.push('💰 판매가:')
    for (const variant of product.variants.slice(0, 5)) {
      const optionName = variant.optionSummary || '기본'
      // 공통 모듈로 판매가 계산 (배송비 타입에 따라 자동 처리)
      const sellingPrice = calculateSellingPrice(variant.price, shippingFee, bundleShippingType)
      lines.push(`  • ${optionName}: ${sellingPrice.toLocaleString()}원`)
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
    bundleShippingType: string | null
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
  // 사용자 요청(2026-04-27): 카드는 "제목 배너"만 표시.
  // 인사말/가격/배송/주문링크는 본문 텍스트(buildPostContent)에 들어가므로 카드에 중복 X.
  // intro/showOrderLink/templateType은 시그니처 호환성을 위해 받기만 하고 미사용.
  const { product, title, templateType } = params

  // 길이별 자동 줄바꿈/축소
  const titleFontSize = title.length > 30 ? 56 : title.length > 20 ? 72 : 88

  const headerBgColor =
    templateType === 'premium'
      ? '#FFE082'
      : templateType === 'simple'
      ? '#E3F2FD'
      : '#C8E6C9'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${FONT_CSS}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      background: #ffffff;
      padding: 20px;
    }

    #template-content {
      width: 600px;
      min-height: 240px;
      background: ${headerBgColor};
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 6px 18px -4px rgba(0, 0, 0, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 56px 36px;
      text-align: center;
    }

    #template-content h1 {
      font-size: ${titleFontSize}px;
      font-weight: 900;
      color: #111827;
      line-height: 1.18;
      letter-spacing: -1.5px;
      word-break: keep-all;
    }
  </style>
</head>
<body>
  <div id="template-content">
    <h1>${escapeHtml(title)}</h1>
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
