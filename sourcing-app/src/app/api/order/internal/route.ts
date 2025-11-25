import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getCurrentUser } from '@/modules/auth/auth.service'

const prisma = new PrismaClient()

/**
 * POST /api/order/internal
 *
 * 내부 주문서 생성 (자체 주문서 양식용)
 * - 로그인한 사용자가 직접 주문을 등록
 * - 배송지, 결제수단, 현금영수증 등 모든 정보 저장
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
      productId,
      productName,
      quantity,
      unitPrice,
      shippingFee,
      totalPrice,
      customerName,
      customerPhone,
      recipientName,
      recipientPhone,
      postalCode,
      address,
      addressDetail,
      deliveryMemo,
      paymentMethod,
      cashReceiptType,
      cashReceiptNumber,
    } = body

    // 필수 필드 검증
    if (!productName) {
      return NextResponse.json(
        { success: false, error: '상품명이 필요합니다.' },
        { status: 400 }
      )
    }

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        { success: false, error: '주문자 정보가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!recipientName || !recipientPhone || !postalCode || !address) {
      return NextResponse.json(
        { success: false, error: '배송지 정보가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { success: false, error: '결제 수단을 선택해주세요.' },
        { status: 400 }
      )
    }

    // productId가 있으면 해당 상품이 존재하는지 확인
    if (productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          userId: user.userId,
        },
      })

      if (!product) {
        return NextResponse.json(
          { success: false, error: '선택한 상품을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
    }

    // 내부 주문 생성
    const order = await prisma.internalOrder.create({
      data: {
        userId: user.userId,
        productId: productId || null,
        productName,
        quantity: quantity || 1,
        unitPrice: unitPrice || 0,
        shippingFee: shippingFee || 0,
        totalPrice: totalPrice || 0,
        customerName,
        customerPhone,
        recipientName,
        recipientPhone,
        postalCode,
        address,
        addressDetail: addressDetail || null,
        deliveryMemo: deliveryMemo || null,
        paymentMethod,
        cashReceiptType: cashReceiptType || 'NONE',
        cashReceiptNumber: cashReceiptNumber || null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
            price: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: '주문이 등록되었습니다.',
      data: order,
    })
  } catch (error) {
    console.error('내부 주문 생성 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/order/internal
 *
 * 내부 주문서 목록 조회
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

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    // 필터 조건
    const where: any = {
      userId: user.userId,
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { productName: { contains: search } },
        { recipientName: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    // 총 개수 조회
    const total = await prisma.internalOrder.count({ where })

    // 주문 목록 조회
    const orders = await prisma.internalOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('내부 주문 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, error: '주문 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
