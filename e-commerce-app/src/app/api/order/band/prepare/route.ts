/**
 * Band Order Prepare API
 * 밴드 주문 준비 - 결제 전 주문 정보를 쿠키에 임시 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma, { PublishStatus } from '@bandauto/db'

// 주문번호 생성 (밴드 주문용)
function generateBandOrderNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `BAND-${dateStr}-${random}`
}

// 게스트 사용자 조회 또는 생성
async function getOrCreateGuestUser(phone: string, name: string) {
  // 전화번호로 기존 사용자 찾기
  let user = await prisma.user.findFirst({
    where: { phone },
  })

  // 없으면 게스트 사용자 생성
  if (!user) {
    const timestamp = Date.now()
    user = await prisma.user.create({
      data: {
        email: `guest_${phone.replace(/\D/g, '')}_${timestamp}@band.local`,
        name,
        phone,
        password: '', // 비밀번호 없음 (로그인 불가)
      },
    })
    console.log(`[Band Order] 게스트 사용자 생성: ID=${user.id}, 전화번호=${phone}`)
  }

  return user
}

interface OrderPrepareData {
  orderId: string
  userId: number
  fromCart: boolean
  items: { productPublishId: number; variantId?: number; quantity: number }[]
  customerInfo: {
    name: string
    phone: string
    email?: string
  }
  shippingAddress: {
    recipientName: string
    recipientPhone: string
    address: string
    postalCode: string
    addressDetail?: string
    deliveryMemo?: string
  }
  cashReceipt?: {
    type: 'NONE' | 'INCOME' | 'EXPENSE'
    number?: string
  }
  retailBandId: number
}

/**
 * POST /api/order/band/prepare
 * 밴드 주문 정보 검증 및 임시 저장
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      retailBandId,
      productPublishId,
      quantity = 1,
      customerInfo,
      shippingAddress,
      cashReceipt,
    } = body

    // 1. 필수 입력 검증
    if (!retailBandId) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!productPublishId) {
      return NextResponse.json(
        { success: false, error: '상품을 선택해주세요.' },
        { status: 400 }
      )
    }

    if (!customerInfo?.name?.trim()) {
      return NextResponse.json(
        { success: false, error: '주문자 이름을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!customerInfo?.phone?.trim()) {
      return NextResponse.json(
        { success: false, error: '주문자 연락처를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.address || !shippingAddress?.postalCode) {
      return NextResponse.json(
        { success: false, error: '배송 주소를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!shippingAddress?.recipientName?.trim()) {
      return NextResponse.json(
        { success: false, error: '받는 분 이름을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 2. 소매밴드 확인
    const retailBand = await prisma.retailBand.findFirst({
      where: {
        id: parseInt(retailBandId),
        isActive: true,
      },
    })

    if (!retailBand) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 발행 상품 확인
    const productPublish = await prisma.productPublish.findFirst({
      where: {
        id: parseInt(productPublishId),
        retailBandId: parseInt(retailBandId),
        status: PublishStatus.SUCCESS,
      },
      include: {
        product: {
          include: {
            variants: { take: 1 },
          },
        },
      },
    })

    if (!productPublish) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없거나 판매 중인 상품이 아닙니다.' },
        { status: 404 }
      )
    }

    // 4. 게스트 사용자 조회/생성
    const user = await getOrCreateGuestUser(
      customerInfo.phone.trim(),
      customerInfo.name.trim()
    )

    // 5. 금액 계산
    const product = productPublish.product
    const mainVariant = product.variants[0]
    const unitPrice = mainVariant?.price || product.price || 0
    const subtotal = Number(unitPrice) * quantity

    // 배송비 계산 (50,000원 이상 무료)
    const FREE_SHIPPING_THRESHOLD = 50000
    const SHIPPING_FEE = 3000
    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
    const totalAmount = subtotal + shippingFee

    // 6. 주문번호 생성
    const orderId = generateBandOrderNumber()

    // 7. 주문 준비 데이터
    const prepareData: OrderPrepareData = {
      orderId,
      userId: user.id,
      fromCart: false,
      items: [
        {
          productPublishId: productPublish.id,
          quantity,
        },
      ],
      customerInfo: {
        name: customerInfo.name.trim(),
        phone: customerInfo.phone.trim(),
        email: customerInfo.email || undefined,
      },
      shippingAddress: {
        recipientName: shippingAddress.recipientName.trim(),
        recipientPhone: shippingAddress.recipientPhone?.trim() || customerInfo.phone.trim(),
        address: shippingAddress.address,
        postalCode: shippingAddress.postalCode,
        addressDetail: shippingAddress.addressDetail || undefined,
        deliveryMemo: shippingAddress.deliveryMemo || undefined,
      },
      cashReceipt: cashReceipt?.type !== 'NONE' ? cashReceipt : undefined,
      retailBandId: parseInt(retailBandId),
    }

    // 8. 쿠키에 주문 정보 저장 (base64 인코딩)
    const prepareDataJson = JSON.stringify(prepareData)
    const encodedData = Buffer.from(prepareDataJson).toString('base64')

    const response = NextResponse.json({
      success: true,
      order: {
        orderNumber: orderId,
        productName: product.name,
        quantity,
        unitPrice: Number(unitPrice),
        subtotal,
        shippingFee,
        totalAmount,
        thumbnailUrl: product.thumbnailUrl,
        retailBandName: retailBand.name,
      },
      tossClientKey: process.env.TOSS_PAYMENTS_CLIENT_KEY || '',
      message: '주문 준비가 완료되었습니다. 결제를 진행해주세요.',
    })

    // 쿠키 설정 (10분간 유효)
    response.cookies.set('order_prepare', encodedData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10분
      path: '/',
    })

    console.log(
      `[Band Order] 주문 준비 완료: ${orderId}, 상품=${product.name}, ` +
        `수량=${quantity}, 총액=${totalAmount}원, 밴드=${retailBand.name}`
    )

    return response
  } catch (error: any) {
    console.error('[Band Order] 주문 준비 실패:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주문 준비 실패' },
      { status: 500 }
    )
  }
}
