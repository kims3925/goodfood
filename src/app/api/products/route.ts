import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { productService } from '@/domain/products'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

const requestAt = new Date().toISOString()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorResponse({
        message: '인증이 필요합니다',
        code: 'UNAUTHORIZED',
        status: 401,
        requestAt
      })
    }

    const userId = parseInt(session.user.id, 10)
    const products = await productService.findAllByUserId(userId)

    console.log('📦 상품 조회 결과:', {
      userId,
      productCount: products.length,
      products: products.map(p => ({ id: p.id, title: p.title, status: p.status }))
    })

    const responseData = {
      data: { products },
      message: '상품 목록을 조회했습니다',
      code: 'PRODUCTS_FETCHED',
      requestAt
    }

    console.log('📤 API 응답 데이터:', JSON.stringify(responseData, null, 2))

    return successResponse(responseData)

  } catch (error) {
    console.error('상품 조회 실패:', error)
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorResponse({
        message: '인증이 필요합니다',
        code: 'UNAUTHORIZED',
        status: 401,
        requestAt
      })
    }

    const body = await request.json()

    const product = await productService.createProduct({
      userId: session.user.id,
      title: body.title,
      originalPrice: parseFloat(body.originalPrice),
      salePrice: parseFloat(body.salePrice),
      description: body.description,
      status: body.status
    })

    return successResponse({
      data: { product },
      message: '상품이 생성되었습니다',
      code: 'PRODUCT_CREATED',
      status: 201,
      requestAt
    })

  } catch (error) {
    console.error('상품 생성 실패:', error)
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