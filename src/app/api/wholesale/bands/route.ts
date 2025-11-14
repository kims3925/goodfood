import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { wholesaleBandService } from '@/domain/wholesale/services/wholesale-band.service'
import { successResponse, errorResponse } from '@/lib/http/response'
import { handleServiceError } from '@/lib/errors/handlers'

export async function GET(request: NextRequest) {
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

    // Convert string ID to number
    const userId = parseInt(session.user.id, 10)
    if (isNaN(userId)) {
      return errorResponse({
        message: '유효하지 않은 사용자 ID입니다',
        code: 'INVALID_USER_ID',
        status: 400,
        requestAt
      })
    }

    const bands = await wholesaleBandService.findAllByUserId(
      userId,
      true // isActiveOnly
    )

    return successResponse({
      data: { bands },
      message: '도매 밴드 목록을 조회했습니다',
      code: 'WHOLESALE_BANDS_FETCHED',
      requestAt
    })

  } catch (error) {
    console.error('도매 밴드 목록 조회 실패:', error)
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

    // Convert string ID to number
    const userId = parseInt(session.user.id, 10)
    if (isNaN(userId)) {
      return errorResponse({
        message: '유효하지 않은 사용자 ID입니다',
        code: 'INVALID_USER_ID',
        status: 400,
        requestAt
      })
    }

    const { selectedBands } = await request.json()

    const result = await wholesaleBandService.createManyBands(
      userId,
      selectedBands
    )

    return successResponse({
      data: {
        savedBands: result.savedBands,
        savedCount: result.savedBands.length,
        skippedCount: result.skippedCount
      },
      message: `${result.savedBands.length}개의 밴드가 등록되었습니다${
        result.skippedCount > 0 ? ` (${result.skippedCount}개 중복 제외)` : ''
      }`,
      code: 'WHOLESALE_BANDS_CREATED',
      status: 201,
      requestAt
    })

  } catch (error) {
    console.error('도매 밴드 등록 실패:', error)
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

// 일괄 밴드 삭제
export async function DELETE(request: NextRequest) {
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

    // Convert string ID to number
    const userId = parseInt(session.user.id, 10)
    if (isNaN(userId)) {
      return errorResponse({
        message: '유효하지 않은 사용자 ID입니다',
        code: 'INVALID_USER_ID',
        status: 400,
        requestAt
      })
    }

    const { bandIds } = await request.json()

    // Convert string IDs to numbers
    const numericBandIds = bandIds.map((id: string) => parseInt(id, 10))

    const result = await wholesaleBandService.deleteBands(
      numericBandIds,
      userId
    )

    return successResponse({
      data: {
        deletedCount: result.deletedCount,
        deletedPostsCount: result.deletedPostsCount
      },
      message: result.message,
      code: 'WHOLESALE_BANDS_DELETED',
      requestAt
    })

  } catch (error: any) {
    console.error('밴드 일괄 삭제 실패:', error)
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