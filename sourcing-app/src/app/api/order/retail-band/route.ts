import { NextRequest, NextResponse } from 'next/server'
import prisma from '@bandauto/db'
import { getCurrentUser } from '@/modules/auth/auth.service'

/**
 * POST /api/order/retail-band
 * 소매밴드 자체 주문서 생성
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      retailBandId,
      productPublishId,
      productName,
      quantity = 1,
      unitPrice,
      totalPrice,
      customerName,
      customerPhone,
      customerMemo,
    } = body

    // 필수 필드 검증
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

    if (!customerName?.trim()) {
      return NextResponse.json(
        { success: false, error: '주문자 이름을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 소매밴드 확인
    const retailBand = await prisma.retailBand.findFirst({
      where: {
        id: retailBandId,
        userId: user.userId,
      },
    })

    if (!retailBand) {
      return NextResponse.json(
        { success: false, error: '소매밴드를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // ProductPublish 확인
    const productPublish = await prisma.productPublish.findFirst({
      where: {
        id: productPublishId,
        userId: user.userId,
        retailBandId,
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

    if (!productPublish) {
      return NextResponse.json(
        { success: false, error: '발행 상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 금액 계산
    const finalUnitPrice = unitPrice ?? productPublish.product.price ?? 0
    const finalTotalPrice = totalPrice ?? finalUnitPrice * quantity

    // OrderTest 생성 (구글폼 주문과 동일한 테이블 사용)
    const order = await prisma.orderTest.create({
      data: {
        userId: user.userId,
        productPublishId,
        productName: productName || productPublish.product.name,
        quantity,
        unitPrice: finalUnitPrice,
        totalPrice: finalTotalPrice,
        customerName: customerName.trim(),
        // Note: OrderTest 테이블에는 customerPhone, customerMemo 필드가 없음
        // 추후 테이블 통합 시 추가 예정
      },
      include: {
        productPublish: {
          select: {
            id: true,
            retailBand: {
              select: { id: true, name: true },
            },
            product: {
              select: { id: true, name: true, price: true, thumbnailUrl: true },
            },
          },
        },
      },
    })

    console.log(`[RetailBand Order] 주문 생성: ID=${order.id}, 고객=${customerName}, 상품=${productName}(${quantity}개), 총액=${finalTotalPrice}원, 밴드=${retailBand.name}`)

    return NextResponse.json({
      success: true,
      message: '주문이 등록되었습니다.',
      data: {
        orderId: order.id,
        orderNumber: `BAND-${String(order.id).padStart(6, '0')}`,
        retailBandId,
        retailBandName: retailBand.name,
        productPublishId,
        productName: order.productName,
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        totalPrice: order.totalPrice,
        customerName: order.customerName,
      },
    })
  } catch (error) {
    console.error('[RetailBand Order] 주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/order/retail-band
 * 소매밴드 주문 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const retailBandId = searchParams.get('retailBandId')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {
      userId: user.userId,
    }

    if (retailBandId) {
      where.productPublish = {
        retailBandId: parseInt(retailBandId),
      }
    }

    if (search) {
      where.OR = [
        { productName: { contains: search } },
        { customerName: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.orderTest.findMany({
        where,
        include: {
          productPublish: {
            select: {
              id: true,
              retailBand: {
                select: { id: true, name: true },
              },
              product: {
                select: { id: true, name: true, price: true, thumbnailUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.orderTest.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        orders: orders.map(order => ({
          id: order.id,
          orderNumber: `BAND-${String(order.id).padStart(6, '0')}`,
          customerName: order.customerName,
          productName: order.productName,
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          totalPrice: order.totalPrice,
          retailBandId: order.productPublish?.retailBand?.id,
          retailBandName: order.productPublish?.retailBand?.name,
          productThumbnail: order.productPublish?.product?.thumbnailUrl,
          createdAt: order.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('[RetailBand Order] 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
