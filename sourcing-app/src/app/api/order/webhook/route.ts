import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// 환경변수에서 설정 (없으면 기본값 사용)
const WEBHOOK_SECRET = process.env.ORDER_WEBHOOK_SECRET || 'your-webhook-secret'
const DEFAULT_USER_ID = parseInt(process.env.DEFAULT_USER_ID || '1')

/**
 * POST /api/order/webhook
 *
 * Google Forms 웹훅 전용 엔드포인트
 * - 간단한 secret key 인증
 * - userId는 환경변수에서 설정 (단일 판매자용)
 */
export async function POST(request: NextRequest) {
  try {
    // CORS 헤더 설정 (Google Apps Script에서 호출 허용)
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
    }

    const body = await request.json()

    // Webhook Secret 검증 (선택적)
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (WEBHOOK_SECRET !== 'your-webhook-secret' && webhookSecret !== WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Webhook 인증 실패' },
        { status: 401, headers }
      )
    }

    // 필수 필드 검증
    const {
      customerName,
      productName,
      quantity: rawQuantity,  // 수량 (필수)
      totalPrice,             // 총액 (선택 - 없으면 자동 계산)
      retailBandId: rawRetailBandId,
      formUrl
    } = body

    if (!customerName) {
      return NextResponse.json(
        { success: false, error: '고객 이름이 필요합니다.' },
        { status: 400, headers }
      )
    }

    if (!productName) {
      return NextResponse.json(
        { success: false, error: '상품명이 필요합니다.' },
        { status: 400, headers }
      )
    }

    // 수량 파싱 (기본값: 1)
    let quantity = 1
    if (rawQuantity) {
      const parsed = typeof rawQuantity === 'number'
        ? rawQuantity
        : parseInt(String(rawQuantity).replace(/[^0-9]/g, ''))
      if (!isNaN(parsed) && parsed > 0) {
        quantity = parsed
      }
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '판매자 계정을 찾을 수 없습니다.' },
        { status: 404, headers }
      )
    }

    // 상품명으로 Product 매칭 시도 (다단계 매칭)
    let productId: number | null = null
    let matchedProduct: { id: number; name: string; price: number | null } | null = null

    // 입력값 정규화 (공백 제거, 소문자)
    const normalizedInput = productName.trim().toLowerCase().replace(/\s+/g, '')

    // 1단계: 정확한 이름 매칭 (MySQL은 기본적으로 대소문자 무시)
    matchedProduct = await prisma.product.findFirst({
      where: {
        userId: DEFAULT_USER_ID,
        name: productName,
      },
      select: { id: true, name: true, price: true },
    })

    // 2단계: 포함 매칭
    if (!matchedProduct) {
      matchedProduct = await prisma.product.findFirst({
        where: {
          userId: DEFAULT_USER_ID,
          name: { contains: productName },
        },
        select: { id: true, name: true, price: true },
      })
    }

    // 3단계: 입력값이 상품명에 포함되는 경우 (정규화 매칭)
    if (!matchedProduct) {
      const allProducts = await prisma.product.findMany({
        where: { userId: DEFAULT_USER_ID },
        select: { id: true, name: true, price: true },
      })

      // 정규화된 이름으로 매칭 시도
      matchedProduct = allProducts.find(p => {
        const normalizedName = p.name.trim().toLowerCase().replace(/\s+/g, '')
        return normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)
      }) || null
    }

    if (matchedProduct) {
      productId = matchedProduct.id
    }

    // 소매밴드 매칭
    let retailBandId: number | null = null

    // 1순위: retailBandId 직접 전달 (가장 간단하고 확실한 방법)
    if (rawRetailBandId) {
      const parsedBandId = typeof rawRetailBandId === 'number'
        ? rawRetailBandId
        : parseInt(String(rawRetailBandId))

      if (!isNaN(parsedBandId)) {
        // 해당 retailBandId가 실제 존재하는지 확인
        const retailBand = await prisma.retailBand.findFirst({
          where: {
            id: parsedBandId,
            userId: DEFAULT_USER_ID,
          },
          select: { id: true },
        })
        retailBandId = retailBand?.id || null
      }
    }

    // 2순위: formUrl로 RetailBand 매칭 (기존 방식 호환)
    if (!retailBandId && formUrl) {
      const retailBand = await prisma.retailBand.findFirst({
        where: {
          userId: DEFAULT_USER_ID,
          formUrl: { contains: formUrl },
        },
        select: { id: true },
      })
      retailBandId = retailBand?.id || null
    }

    // 3순위: PublishHistory로 매칭 (최후 폴백)
    if (!retailBandId && productId) {
      const publishHistory = await prisma.publishHistory.findFirst({
        where: {
          productId,
          status: 'SUCCESS',
        },
        orderBy: { publishedAt: 'desc' },
        select: { retailBandId: true },
      })
      retailBandId = publishHistory?.retailBandId || null
    }

    // 가격 계산 로직
    let unitPrice: number | null = null
    let calculatedTotalPrice: number | null = null

    // 1순위: 매칭된 상품의 가격으로 자동 계산
    if (matchedProduct?.price) {
      unitPrice = matchedProduct.price
      calculatedTotalPrice = unitPrice * quantity
    }

    // 2순위: 폼에서 직접 입력한 totalPrice가 있으면 사용 (기존 방식 호환)
    if (!calculatedTotalPrice && totalPrice) {
      if (typeof totalPrice === 'number') {
        calculatedTotalPrice = totalPrice
      } else if (typeof totalPrice === 'string') {
        // "15,000원" 또는 "15000" 형태 처리
        const cleaned = totalPrice.replace(/[^0-9]/g, '')
        calculatedTotalPrice = cleaned ? parseInt(cleaned) : null
      }
      // 직접 입력한 경우 unitPrice 역산 시도
      if (calculatedTotalPrice && quantity > 0) {
        unitPrice = Math.round(calculatedTotalPrice / quantity)
      }
    }

    // 테스트 주문 생성
    const order = await prisma.orderTest.create({
      data: {
        userId: DEFAULT_USER_ID,
        productId,
        retailBandId,
        productName,
        quantity,
        unitPrice,
        totalPrice: calculatedTotalPrice,
        customerName,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            thumbnailUrl: true,
          },
        },
      },
    })

    const bandSource = rawRetailBandId ? '직접전달' : formUrl ? 'formUrl' : productId ? 'PublishHistory' : '미분류'
    const priceSource = matchedProduct?.price ? '자동계산' : totalPrice ? '직접입력' : '없음'
    console.log(`[Webhook] 주문 생성 완료: ID=${order.id}, 고객=${customerName}, 상품=${productName}(${quantity}개), 단가=${unitPrice || '?'}원, 총액=${calculatedTotalPrice || '?'}원(${priceSource}), 밴드ID=${retailBandId || '없음'}(${bandSource})`)

    return NextResponse.json(
      {
        success: true,
        message: productId
          ? `주문이 등록되었습니다. (상품 "${matchedProduct?.name}" 매칭됨, ${quantity}개 × ${unitPrice?.toLocaleString() || '?'}원 = ${calculatedTotalPrice?.toLocaleString() || '?'}원)`
          : `주문이 등록되었습니다. (매칭되는 상품 없음, 수량: ${quantity}개)`,
        data: {
          orderId: order.id,
          productMatched: !!productId,
          matchedProductName: matchedProduct?.name || null,
          quantity,
          unitPrice,
          totalPrice: calculatedTotalPrice,
          priceSource,
          retailBandId,
          retailBandSource: bandSource,
        },
      },
      { headers }
    )
  } catch (error) {
    console.error('[Webhook] 주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// OPTIONS: CORS preflight 처리
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
      },
    }
  )
}
