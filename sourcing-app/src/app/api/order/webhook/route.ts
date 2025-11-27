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
    const { customerName, productName, totalPrice } = body

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
    let matchedProduct: { id: number; name: string } | null = null

    // 입력값 정규화 (공백 제거, 소문자)
    const normalizedInput = productName.trim().toLowerCase().replace(/\s+/g, '')

    // 1단계: 정확한 이름 매칭 (MySQL은 기본적으로 대소문자 무시)
    matchedProduct = await prisma.product.findFirst({
      where: {
        userId: DEFAULT_USER_ID,
        name: productName,
      },
      select: { id: true, name: true },
    })

    // 2단계: 포함 매칭
    if (!matchedProduct) {
      matchedProduct = await prisma.product.findFirst({
        where: {
          userId: DEFAULT_USER_ID,
          name: { contains: productName },
        },
        select: { id: true, name: true },
      })
    }

    // 3단계: 입력값이 상품명에 포함되는 경우 (정규화 매칭)
    if (!matchedProduct) {
      const allProducts = await prisma.product.findMany({
        where: { userId: DEFAULT_USER_ID },
        select: { id: true, name: true },
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

    // 가격 파싱 (문자열이나 숫자 모두 처리)
    let parsedPrice: number | null = null
    if (totalPrice) {
      if (typeof totalPrice === 'number') {
        parsedPrice = totalPrice
      } else if (typeof totalPrice === 'string') {
        // "15,000원" 또는 "15000" 형태 처리
        const cleaned = totalPrice.replace(/[^0-9]/g, '')
        parsedPrice = cleaned ? parseInt(cleaned) : null
      }
    }

    // 주문 생성
    const order = await prisma.purchaseOrder.create({
      data: {
        userId: DEFAULT_USER_ID,
        productId,
        productName,
        totalPrice: parsedPrice,
        customerName,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
      },
    })

    console.log(`[Webhook] 주문 생성 완료: ID=${order.id}, 고객=${customerName}, 상품=${productName}`)

    return NextResponse.json(
      {
        success: true,
        message: productId
          ? `주문이 등록되었습니다. (상품 "${matchedProduct?.name}" 매칭됨)`
          : '주문이 등록되었습니다. (매칭되는 상품 없음)',
        data: {
          orderId: order.id,
          productMatched: !!productId,
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
