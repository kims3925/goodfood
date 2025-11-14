import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { bandCollectionService } from '@/domain/wholesale/services/band-collection.service'
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

    const { bandId, dateRange } = await request.json()

    const result = await bandCollectionService.collectPosts({
      bandId,
      userId: parseInt(session.user.id, 10),
      dateRange
    })

    return successResponse({
      data: {
        summary: {
          totalFetched: result.totalFetched,
          newPosts: result.newPosts,
          duplicates: result.duplicates,
          failed: result.failed
        },
        collectedPosts: result.collectedPosts,
        errors: result.errors
      },
      message: `${result.newPosts}개의 새 게시물이 수집되었습니다`,
      code: 'POSTS_COLLECTED',
      status: 201,
      requestAt
    })
  } catch (error: any) {
    console.error('게시물 수집 오류:', error)
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
