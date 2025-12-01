import { NextRequest, NextResponse } from 'next/server'
import prisma, { ChannelKind } from '@bandauto/db'

// 환경변수에서 설정 (없으면 기본값 사용)
const WEBHOOK_SECRET = process.env.ORDER_WEBHOOK_SECRET || 'your-webhook-secret'
const DEFAULT_USER_ID = parseInt(process.env.DEFAULT_USER_ID || '1')

/**
 * POST /api/order/webhook
 *
 * Google Forms 웹훅 전용 엔드포인트
 * - 간단한 secret key 인증
 * - userId는 환경변수에서 설정 (단일 판매자용)
 *
 * 필수 필드:
 * - customerName: 고객 이름
 * - productName: 상품명
 * - channelId: 소매채널 ID (권장 - 정확한 매칭을 위해)
 *
 * 선택 필드:
 * - quantity: 수량 (기본값: 1)
 * - totalPrice: 총액 (없으면 자동 계산)
 * - formUrl: 폼 URL (channelId 없을 때 폴백)
 * - channelId: 하위 호환성 (channelId로 대체됨)
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
      quantity: rawQuantity,
      totalPrice,
      channelId: rawChannelId,
      channelId: rawRetailChannelId, // 하위 호환성
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

    // === 소매채널 ID 확정 ===
    let channelId: number | null = null

    // 1순위: channelId 직접 전달
    const rawId = rawChannelId || rawRetailChannelId // 하위 호환성
    if (rawId) {
      const parsedId = typeof rawId === 'number'
        ? rawId
        : parseInt(String(rawId))

      if (!isNaN(parsedId)) {
        const channel = await prisma.channel.findFirst({
          where: {
            id: parsedId,
            userId: DEFAULT_USER_ID,
            kind: ChannelKind.RETAIL,
          },
          select: { id: true },
        })
        channelId = channel?.id || null
      }
    }

    // 2순위: formUrl로 Channel 매칭
    if (!channelId && formUrl) {
      const channel = await prisma.channel.findFirst({
        where: {
          userId: DEFAULT_USER_ID,
          kind: ChannelKind.RETAIL,
          formUrl: { contains: formUrl },
        },
        select: { id: true },
      })
      channelId = channel?.id || null
    }

    // === PublishedProduct 매칭 (channelId + productName) ===
    let publishedProductId: number | null = null
    let matchedPublish: {
      id: number
      product: { id: number; name: string; price: number | null }
    } | null = null

    if (channelId) {
      const normalizedInput = productName.trim().toLowerCase().replace(/\s+/g, '')

      // 1단계: 정확한 이름 매칭
      matchedPublish = await prisma.publishedProduct.findFirst({
        where: {
          userId: DEFAULT_USER_ID,
          channelId,
          product: {
            name: productName,
          },
        },
        select: {
          id: true,
          product: {
            select: { id: true, name: true, price: true },
          },
        },
      })

      // 2단계: 포함 매칭
      if (!matchedPublish) {
        matchedPublish = await prisma.publishedProduct.findFirst({
          where: {
            userId: DEFAULT_USER_ID,
            channelId,
            product: {
              name: { contains: productName },
            },
          },
          select: {
            id: true,
            product: {
              select: { id: true, name: true, price: true },
            },
          },
        })
      }

      // 3단계: 정규화 매칭
      if (!matchedPublish) {
        const allPublishes = await prisma.publishedProduct.findMany({
          where: {
            userId: DEFAULT_USER_ID,
            channelId,
          },
          select: {
            id: true,
            product: {
              select: { id: true, name: true, price: true },
            },
          },
        })

        matchedPublish = allPublishes.find(p => {
          const normalizedName = p.product.name.trim().toLowerCase().replace(/\s+/g, '')
          return normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)
        }) || null
      }

      if (matchedPublish) {
        publishedProductId = matchedPublish.id
      }
    }

    // === 가격 계산 ===
    let unitPrice: number | null = null
    let calculatedTotalPrice: number | null = null

    // 1순위: 매칭된 상품의 가격으로 자동 계산
    if (matchedPublish?.product?.price) {
      unitPrice = matchedPublish.product.price
      calculatedTotalPrice = unitPrice * quantity
    }

    // 2순위: 폼에서 직접 입력한 totalPrice
    if (!calculatedTotalPrice && totalPrice) {
      if (typeof totalPrice === 'number') {
        calculatedTotalPrice = totalPrice
      } else if (typeof totalPrice === 'string') {
        const cleaned = totalPrice.replace(/[^0-9]/g, '')
        calculatedTotalPrice = cleaned ? parseInt(cleaned) : null
      }
      if (calculatedTotalPrice && quantity > 0) {
        unitPrice = Math.round(calculatedTotalPrice / quantity)
      }
    }

    // === OrderTest 생성 ===
    const order = await prisma.orderTest.create({
      data: {
        userId: DEFAULT_USER_ID,
        publishedProductId,
        productName,
        quantity,
        unitPrice,
        totalPrice: calculatedTotalPrice,
        customerName,
      },
      include: {
        publishedProduct: {
          select: {
            id: true,
            channel: {
              select: { id: true, name: true },
            },
            product: {
              select: { id: true, name: true, price: true, thumbnailUrl: true },
            },
          },
        },
      },
    })

    const channelSource = rawId ? '직접전달' : formUrl ? 'formUrl' : '미분류'
    const priceSource = matchedPublish?.product?.price ? '자동계산' : totalPrice ? '직접입력' : '없음'
    console.log(`[Webhook] 주문 생성: ID=${order.id}, 고객=${customerName}, 상품=${productName}(${quantity}개), 단가=${unitPrice || '?'}원, 총액=${calculatedTotalPrice || '?'}원(${priceSource}), PublishedProduct=${publishedProductId || '없음'}, 채널ID=${channelId || '없음'}(${channelSource})`)

    return NextResponse.json(
      {
        success: true,
        message: publishedProductId
          ? `주문이 등록되었습니다. (상품 "${matchedPublish?.product?.name}" 매칭됨, ${quantity}개 × ${unitPrice?.toLocaleString() || '?'}원 = ${calculatedTotalPrice?.toLocaleString() || '?'}원)`
          : `주문이 등록되었습니다. (매칭되는 발행 상품 없음, 수량: ${quantity}개)`,
        data: {
          orderId: order.id,
          publishedProductMatched: !!publishedProductId,
          publishedProductId,
          matchedProductName: matchedPublish?.product?.name || null,
          channelId,
          channelName: order.publishedProduct?.channel?.name || null,
          quantity,
          unitPrice,
          totalPrice: calculatedTotalPrice,
          priceSource,
          channelSource,
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
