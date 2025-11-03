import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// 장바구니 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId')

    if (!sessionId && !userId) {
      return NextResponse.json(
        { success: false, error: '세션 ID 또는 사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 장바구니 조회 조건
    const whereCondition: any = {}
    if (userId) {
      whereCondition.userId = userId
    } else if (sessionId) {
      whereCondition.sessionId = sessionId
    }

    const cart = await prisma.cart.findFirst({
      where: whereCondition,
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    })

    if (!cart) {
      return NextResponse.json({
        success: true,
        cart: null,
        items: [],
        totalAmount: 0,
        totalItems: 0
      })
    }

    // 총 금액 및 아이템 수 계산
    const totalAmount = cart.items.reduce((sum, item) => {
      const price = item.product.salePrice
      return sum + (price * item.quantity)
    }, 0)

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0)

    return NextResponse.json({
      success: true,
      cart: {
        id: cart.id,
        sessionId: cart.sessionId,
        userId: cart.userId,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt
      },
      items: cart.items.map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          title: item.product.title,
          images: item.product.images ? JSON.parse(item.product.images) : [],
          originalPrice: item.product.originalPrice,
          salePrice: item.product.salePrice,
          category: item.product.category,
          stock: 1000
        },
        subtotal: item.product.salePrice * item.quantity
      })),
      totalAmount,
      totalItems
    })

  } catch (error: any) {
    console.error('장바구니 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '장바구니 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 장바구니에 상품 추가
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, productId, quantity = 1 } = await request.json()

    // 입력값 검증
    if (!productId || (!sessionId && !userId)) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { success: false, error: '수량은 1개 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 상품 존재 확인
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 재고 확인
    const availableStock = product.stock || 1000
    if (availableStock < quantity) {
      return NextResponse.json(
        { success: false, error: '재고가 부족합니다.' },
        { status: 400 }
      )
    }

    // 장바구니 찾기 또는 생성
    const whereCondition: any = {}
    const createData: any = {}

    if (userId) {
      whereCondition.userId = userId
      createData.userId = userId
    } else {
      whereCondition.sessionId = sessionId
      createData.sessionId = sessionId
    }

    let cart = await prisma.cart.findFirst({ where: whereCondition })

    if (!cart) {
      cart = await prisma.cart.create({ data: createData })
    }

    // 기존 장바구니 아이템 확인
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId
      }
    })

    if (existingItem) {
      // 기존 아이템 수량 업데이트
      const newQuantity = existingItem.quantity + quantity

      if (availableStock < newQuantity) {
        return NextResponse.json(
          { success: false, error: '재고가 부족합니다.' },
          { status: 400 }
        )
      }

      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          priceAt: product.salePrice // 현재 판매가로 업데이트
        },
        include: {
          product: true
        }
      })

      return NextResponse.json({
        success: true,
        message: '장바구니에 상품이 추가되었습니다.',
        item: {
          id: updatedItem.id,
          productId: updatedItem.productId,
          quantity: updatedItem.quantity,
          product: {
            id: updatedItem.product.id,
            title: updatedItem.product.title,
            images: updatedItem.product.images ? JSON.parse(updatedItem.product.images) : [],
            salePrice: updatedItem.product.salePrice
          }
        }
      })
    } else {
      // 새로운 아이템 추가
      const newItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          priceAt: product.salePrice // 장바구니 담을 당시 가격 저장
        },
        include: {
          product: true
        }
      })

      return NextResponse.json({
        success: true,
        message: '장바구니에 상품이 추가되었습니다.',
        item: {
          id: newItem.id,
          productId: newItem.productId,
          quantity: newItem.quantity,
          product: {
            id: newItem.product.id,
            title: newItem.product.title,
            images: newItem.product.images ? JSON.parse(newItem.product.images) : [],
            salePrice: newItem.product.salePrice
          }
        }
      })
    }

  } catch (error: any) {
    console.error('장바구니 추가 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '장바구니에 상품 추가 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 장바구니 아이템 수량 변경
export async function PUT(request: NextRequest) {
  try {
    const { itemId, quantity } = await request.json()

    if (!itemId || quantity < 0) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 파라미터입니다.' },
        { status: 400 }
      )
    }

    // 아이템 존재 확인
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        product: true
      }
    })

    if (!item) {
      return NextResponse.json(
        { success: false, error: '장바구니 아이템을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 수량이 0이면 아이템 삭제
    if (quantity === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } })

      return NextResponse.json({
        success: true,
        message: '장바구니에서 상품이 제거되었습니다.'
      })
    }

    // 재고 확인
    const availableStock = item.product.stock || 1000
    if (availableStock < quantity) {
      return NextResponse.json(
        { success: false, error: '재고가 부족합니다.' },
        { status: 400 }
      )
    }

    // 수량 업데이트
    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: true
      }
    })

    return NextResponse.json({
      success: true,
      message: '수량이 변경되었습니다.',
      item: {
        id: updatedItem.id,
        productId: updatedItem.productId,
        quantity: updatedItem.quantity,
        product: {
          id: updatedItem.product.id,
          title: updatedItem.product.title,
          salePrice: updatedItem.product.salePrice
        }
      }
    })

  } catch (error: any) {
    console.error('장바구니 수량 변경 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '수량 변경 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 장바구니 아이템 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'itemId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 아이템 존재 확인
    const item = await prisma.cartItem.findUnique({
      where: { id: itemId }
    })

    if (!item) {
      return NextResponse.json(
        { success: false, error: '장바구니 아이템을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 아이템 삭제
    await prisma.cartItem.delete({
      where: { id: itemId }
    })

    return NextResponse.json({
      success: true,
      message: '장바구니에서 상품이 제거되었습니다.'
    })

  } catch (error: any) {
    console.error('장바구니 삭제 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: '장바구니 삭제 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}