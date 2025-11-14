import { NextRequest } from 'next/server'
import { cartService } from '@/domain/cart/services/cart.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

// 장바구니 조회
export async function GET(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userIdParam = searchParams.get('userId')
    const userId = userIdParam ? parseInt(userIdParam) : undefined

    const cart = await cartService.getCartBySessionOrUser(
      sessionId || '',
      userId
    )

    if (!cart) {
      return successResponse({
        data: {
          cart: null,
          items: [],
          totalAmount: 0,
          totalItems: 0,
          shippingFee: 0,
          finalAmount: 0
        },
        message: '장바구니가 비어있습니다',
        code: 'CART_EMPTY',
        requestAt
      })
    }

    return successResponse({
      data: {
        cart: {
          id: cart.id,
          sessionId: cart.sessionId,
          userId: cart.userId
        },
        items: cart.items.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAt: item.priceAt,
          product: {
            id: item.product.id,
            title: item.product.title,
            images: item.product.images
              ? JSON.parse(item.product.images)
              : [],
            salePrice: item.product.salePrice,
            isAvailable: item.product.isAvailable,
            shippingFee: item.product.shippingFee
          },
          subtotal: item.priceAt * item.quantity
        })),
        totalAmount: cart.totalAmount,
        totalItems: cart.totalItems,
        shippingFee: cart.shippingFee,
        finalAmount: cart.finalAmount
      },
      message: '장바구니를 조회했습니다',
      code: 'CART_FETCHED',
      requestAt
    })
  } catch (error: any) {
    console.error('장바구니 조회 오류:', error)
    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}

// 장바구니에 상품 추가
export async function POST(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { sessionId, userId, productId, quantity = 1 } = await request.json()

    const cart = await cartService.addItemToCart(
      sessionId || '',
      parseInt(productId),
      quantity,
      userId ? parseInt(userId) : undefined
    )

    return successResponse({
      data: { cart },
      message: '장바구니에 상품이 추가되었습니다',
      code: 'CART_ITEM_ADDED',
      status: 201,
      requestAt
    })
  } catch (error: any) {
    console.error('장바구니 추가 오류:', error)
    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}

// 장바구니 아이템 수량 변경
export async function PUT(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { sessionId, userId, itemId, quantity } = await request.json()

    const cart = await cartService.updateItemQuantity(
      sessionId || '',
      parseInt(itemId),
      quantity,
      userId ? parseInt(userId) : undefined
    )

    return successResponse({
      data: { cart },
      message: '수량이 변경되었습니다',
      code: 'CART_ITEM_UPDATED',
      requestAt
    })
  } catch (error: any) {
    console.error('장바구니 수량 변경 오류:', error)
    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}

// 장바구니 아이템 삭제
export async function DELETE(request: NextRequest) {
  const requestAt = new Date().toISOString()

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userIdParam = searchParams.get('userId')
    const itemIdParam = searchParams.get('itemId')

    const userId = userIdParam ? parseInt(userIdParam) : undefined

    if (!itemIdParam) {
      return errorResponse({
        message: 'itemId가 필요합니다',
        code: 'VALIDATION_ERROR',
        status: 400,
        requestAt
      })
    }

    const itemId = parseInt(itemIdParam)

    const cart = await cartService.removeItemFromCart(
      sessionId || '',
      itemId,
      userId
    )

    return successResponse({
      data: { cart },
      message: '장바구니에서 상품이 제거되었습니다',
      code: 'CART_ITEM_REMOVED',
      requestAt
    })
  } catch (error: any) {
    console.error('장바구니 삭제 오류:', error)
    const errorInfo = handleServiceError(error)
    return errorResponse({
      message: errorInfo.message,
      code: errorInfo.code,
      status: errorInfo.statusCode,
      meta: { details: errorInfo.details },
      requestAt
    })
  }
}