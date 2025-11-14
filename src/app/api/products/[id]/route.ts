import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { productService } from '@/domain/products'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestAt = new Date().toISOString()

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

    const updates = await request.json()
    const productId = parseInt(params.id, 10)
    const userId = parseInt(session.user.id, 10)

    const updatedProduct = await productService.updateProduct(
      productId,
      userId,
      updates
    )

    console.log(`상품 업데이트 완료: ${updatedProduct.title} (${updatedProduct.id})`)

    return successResponse({
      data: { product: updatedProduct },
      message: '상품이 성공적으로 업데이트되었습니다',
      code: 'PRODUCT_UPDATED',
      requestAt
    })

  } catch (error) {
    console.error('상품 업데이트 실패:', error)
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestAt = new Date().toISOString()

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

    const productId = parseInt(params.id, 10)
    const userId = parseInt(session.user.id, 10)
    await productService.deleteProduct(productId, userId)

    console.log(`상품 삭제 완료: ${params.id}`)

    return successResponse({
      data: null,
      message: '상품이 성공적으로 삭제되었습니다',
      code: 'PRODUCT_DELETED',
      requestAt
    })

  } catch (error) {
    console.error('상품 삭제 실패:', error)
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestAt = new Date().toISOString()

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

    const productId = parseInt(params.id, 10)
    const userId = parseInt(session.user.id, 10)
    const product = await productService.findById(productId, userId)

    return successResponse({
      data: { product },
      message: '상품을 조회했습니다',
      code: 'PRODUCT_FETCHED',
      requestAt
    })

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