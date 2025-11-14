import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { wholesaleService } from '@/domain/wholesale/services/wholesale.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function POST(request: NextRequest) {
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

    const { postIds, finalContents } = await request.json()

    console.log('📋 소싱 확정 요청:', { postIds, userId: session.user.id, finalContentsCount: finalContents?.length })

    const result = await wholesaleService.confirmSourcing({
      postIds,
      userId: session.user.id,
      finalContents
    })

    return successResponse({
      data: {
        createdProducts: result.createdProducts,
        failedPosts: result.failedPosts,
        summary: {
          total: result.totalCount,
          success: result.successCount,
          failed: result.failedCount
        }
      },
      message: `${result.successCount}개 상품이 생성되었습니다`,
      code: 'SOURCING_CONFIRMED',
      status: 201,
      requestAt
    })
  } catch (error: any) {
    console.error('소싱 확정 오류:', error)
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
