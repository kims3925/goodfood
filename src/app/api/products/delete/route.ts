import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { productService } from '@/domain/products'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function POST(request: NextRequest) {
  const requestAt = new Date().toISOString()
  console.log('=== 상품 삭제 API 호출됨 ===')

  try {
    const session = await getServerSession(authOptions)
    console.log('세션 확인:', session?.user?.id)

    if (!session?.user?.id) {
      console.log('인증 실패: 세션이 없음')
      return errorResponse({
        message: '인증이 필요합니다',
        code: 'UNAUTHORIZED',
        status: 401,
        requestAt
      })
    }

    const body = await request.json()
    console.log('요청 body:', body)

    const { productIds } = body

    const result = await productService.deleteProducts(
      productIds,
      parseInt(session.user.id, 10)
    )

    console.log(`삭제 처리 완료: ${result.message}`)

    return successResponse({
      data: {
        deletedCount: result.deletedCount,
        deactivatedCount: result.deactivatedCount,
        hasOrderedProducts: result.hasOrderedProducts
      },
      message: result.message,
      code: 'PRODUCTS_DELETED',
      requestAt
    })

  } catch (error) {
    console.error('상품 삭제 실패 - 상세 에러:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
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