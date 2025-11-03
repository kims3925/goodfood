import { NextRequest, NextResponse } from 'next/server'
import { getTossPaymentsService } from '@/lib/payments/toss-payments'
import prisma from '@/lib/db'

// 시스템 사용자 가져오기 또는 생성 (익명 주문용)
async function getSystemUser() {
  const SYSTEM_EMAIL = 'system@bandauto.shop'

  let systemUser = await prisma.user.findFirst({
    where: { email: SYSTEM_EMAIL }
  })

  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        name: 'System User',
        email: SYSTEM_EMAIL,
        password: 'system-user-password-not-for-login',
        role: 'ADMIN'
      }
    })
  }

  return systemUser
}

// 주문 생성
export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      userId,
      productId,
      quantity = 1,
      customerInfo,
      shippingAddress,
      paymentMethod = 'tosspayments'
    } = await request.json()

    // 입력값 검증
    if (!productId || quantity < 1 || !customerInfo) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!customerInfo.name || !customerInfo.phone) {
      return NextResponse.json(
        { success: false, error: '고객 정보(이름, 전화번호)가 필요합니다.' },
        { status: 400 }
      )
    }

    // 상품 조회
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      // 테스트를 위한 Mock 상품 데이터
      const mockProduct = {
        id: productId,
        title: '[500g 2,900원] 택배비보다 싼!! 가마솥 사골 도가니탕 2종',
        salePrice: 2900,
        originalPrice: 4900,
        category: '육류',
        images: JSON.stringify(['https://via.placeholder.com/600x600/FF6B6B/FFFFFF?text=도가니탕']),
        stock: 1000
      }

      // Mock 상품으로 계속 진행
      const unitPrice = mockProduct.salePrice
      const subtotal = unitPrice * quantity

      // 배송비 계산
      const freeShippingAmount = parseInt(process.env.FREE_SHIPPING_AMOUNT || '30000')
      const defaultShippingFee = parseInt(process.env.DEFAULT_SHIPPING_FEE || '3000')
      const shippingFee = subtotal >= freeShippingAmount ? 0 : defaultShippingFee

      const totalAmount = subtotal + shippingFee

      // 고객 정보 생성 또는 조회
      let customer = await prisma.customer.findFirst({
        where: {
          OR: [
            { email: customerInfo.email || '' },
            { phone: customerInfo.phone }
          ]
        }
      })

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: customerInfo.name,
            email: customerInfo.email || null,
            phone: customerInfo.phone,
            address: shippingAddress ? JSON.stringify(shippingAddress) : null
          }
        })
      }

      // 토스페이먼츠 서비스로 주문 ID 생성
      const tossService = await getTossPaymentsService()
      const orderNumber = tossService.generateOrderId()

      // Mock 상품을 사용하여 실제 주문을 데이터베이스에 저장
      // 시스템 사용자 가져오기
      let effectiveUserId = userId
      if (!effectiveUserId) {
        const systemUser = await getSystemUser()
        effectiveUserId = systemUser.id
      }

      // Mock 상품을 Product 테이블에 임시로 생성
      let mockProductRecord = await prisma.product.findUnique({
        where: { id: productId }
      })

      if (!mockProductRecord) {
        mockProductRecord = await prisma.product.create({
          data: {
            id: productId,
            userId: effectiveUserId,
            title: mockProduct.title,
            salePrice: mockProduct.salePrice,
            originalPrice: mockProduct.originalPrice,
            category: mockProduct.category,
            images: mockProduct.images,
            stock: mockProduct.stock,
            isActive: true,
            description: 'Mock 상품 (개발/테스트용)',
            wholesaleBandId: 1, // 기본값
            postId: 'mock-post-id',
            seoTitle: mockProduct.title,
            seoDescription: 'Mock 상품입니다.'
          }
        })
      }

      // 실제 주문 데이터베이스 저장
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          productId: mockProductRecord.id,
          userId: effectiveUserId,
          quantity,
          totalAmount,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
          customerMemo: customerInfo.memo || null
        },
        include: {
          customer: true,
          product: true
        }
      })

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone
          },
          product: {
            id: mockProductRecord.id,
            title: mockProductRecord.title,
            images: JSON.parse(mockProductRecord.images || '[]'),
            unitPrice
          },
          quantity: order.quantity,
          subtotal,
          shippingFee,
          createdAt: order.createdAt
        },
        paymentRequest: tossService.createPaymentRequest(
          orderNumber,
          totalAmount,
          `${mockProductRecord.title} ${quantity > 1 ? `외 ${quantity-1}건` : ''}`,
          customer.email
        ),
        message: '주문이 생성되었습니다. (테스트 모드)'
      })
    }

    // 재고 확인 (기본적으로 충분한 재고가 있다고 가정)
    const availableStock = product.stock || 1000
    if (availableStock < quantity) {
      return NextResponse.json(
        { success: false, error: '재고가 부족합니다.' },
        { status: 400 }
      )
    }

    // 가격 계산
    const unitPrice = product.salePrice
    const subtotal = unitPrice * quantity

    // 배송비 계산
    const freeShippingAmount = parseInt(process.env.FREE_SHIPPING_AMOUNT || '30000')
    const defaultShippingFee = parseInt(process.env.DEFAULT_SHIPPING_FEE || '3000')
    const shippingFee = subtotal >= freeShippingAmount ? 0 : defaultShippingFee

    const totalAmount = subtotal + shippingFee

    // 고객 정보 생성 또는 조회
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: customerInfo.email || '' },
          { phone: customerInfo.phone }
        ]
      }
    })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerInfo.name,
          email: customerInfo.email || null,
          phone: customerInfo.phone,
          address: shippingAddress ? JSON.stringify(shippingAddress) : null
        }
      })
    }

    // 토스페이먼츠 서비스로 주문 ID 생성 (DB에서 키 조회)
    const tossService = await getTossPaymentsService()
    const orderNumber = tossService.generateOrderId()

    // 사용자 ID 처리 (로그인된 사용자 또는 시스템 사용자)
    let effectiveUserId = userId
    if (!effectiveUserId) {
      const systemUser = await getSystemUser()
      effectiveUserId = systemUser.id
    }

    // 주문 생성
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        productId: product.id,
        userId: effectiveUserId,
        quantity,
        totalAmount,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        shippingAddress: shippingAddress ? JSON.stringify(shippingAddress) : null,
        customerMemo: customerInfo.memo || null
      },
      include: {
        customer: true,
        product: true
      }
    })

    // 결제 요청 데이터 생성
    const paymentRequest = tossService.createPaymentRequest(
      orderNumber,
      totalAmount,
      `${product.title} ${quantity > 1 ? `외 ${quantity-1}건` : ''}`,
      customer.email
    )

    // 장바구니에서 해당 상품 제거 (만약 장바구니에서 주문했다면)
    if (sessionId || userId) {
      const whereCondition: any = {}
      if (userId) {
        whereCondition.userId = userId
      } else if (sessionId) {
        whereCondition.sessionId = sessionId
      }

      const cart = await prisma.cart.findFirst({ where: whereCondition })
      if (cart) {
        await prisma.cartItem.deleteMany({
          where: {
            cartId: cart.id,
            productId: product.id
          }
        })
      }
    }

    console.log('주문 생성 성공:', {
      orderNumber,
      customerId: customer.id,
      productId: product.id,
      totalAmount
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        },
        product: {
          id: product.id,
          title: product.title,
          images: product.images ? JSON.parse(product.images) : [],
          unitPrice
        },
        quantity: order.quantity,
        subtotal: subtotal,
        shippingFee: shippingFee,
        createdAt: order.createdAt
      },
      paymentRequest,
      message: '주문이 생성되었습니다.'
    })

  } catch (error: any) {
    console.error('주문 생성 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '주문 생성 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 주문 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const orderNumber = searchParams.get('orderNumber')
    const customerId = searchParams.get('customerId')

    if (!orderId && !orderNumber && !customerId) {
      return NextResponse.json(
        { success: false, error: '조회 조건이 필요합니다.' },
        { status: 400 }
      )
    }

    let whereCondition: any = {}

    if (orderId) {
      whereCondition.id = orderId
    } else if (orderNumber) {
      whereCondition.orderNumber = orderNumber
    } else if (customerId) {
      whereCondition.customerId = customerId
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        customer: true,
        product: true,
        payments: {
          include: {
            refunds: true,
            paymentMethod: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      customer: {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone
      },
      product: {
        id: order.product.id,
        title: order.product.title,
        images: order.product.images ? JSON.parse(order.product.images) : [],
        category: order.product.category
      },
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
      payments: order.payments.map(payment => ({
        id: payment.id,
        paymentKey: payment.paymentKey,
        method: payment.method,
        amount: payment.amount,
        status: payment.status,
        approvedAt: payment.approvedAt,
        refunds: payment.refunds
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }))

    if (orderId || orderNumber) {
      // 단일 주문 조회
      return NextResponse.json({
        success: true,
        order: formattedOrders[0]
      })
    } else {
      // 여러 주문 조회
      return NextResponse.json({
        success: true,
        orders: formattedOrders,
        totalCount: formattedOrders.length
      })
    }

  } catch (error: any) {
    console.error('주문 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '주문 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}