import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/domain/auth'
import { retailBandService } from '@/domain/retail/services/retail-band.service'
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

    const bands = await retailBandService.findAllByUserId(
      session.user.id,
      true // isActiveOnly
    )

    return successResponse({
      data: { bands },
      message: '소매 밴드 목록을 조회했습니다',
      code: 'RETAIL_BANDS_FETCHED',
      requestAt
    })

  } catch (error) {
    console.error('Failed to load retail bands:', error)
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

    const { bandKey, bandName, description, memberCount } = await request.json()

    const band = await retailBandService.createBand({
      userId: session.user.id,
      bandKey,
      bandName,
      description,
      memberCount
    })

    return successResponse({
      data: { band },
      message: `"${bandName}" 밴드가 소매밴드로 추가되었습니다`,
      code: 'RETAIL_BAND_CREATED',
      status: 201,
      requestAt
    })

  } catch (error) {
    console.error('Failed to add retail band:', error)
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

    const { searchParams } = new URL(request.url)
    const bandId = searchParams.get('id')

    if (!bandId) {
      return errorResponse({
        message: 'Band ID is required',
        code: 'VALIDATION_ERROR',
        status: 400,
        requestAt
      })
    }

    // 소프트 삭제 (isActive를 false로 변경)
    const deactivatedBand = await retailBandService.deactivateBand(
      bandId,
      session.user.id
    )

    return successResponse({
      data: null,
      message: `"${deactivatedBand.bandName}" 밴드가 소매밴드에서 제거되었습니다`,
      code: 'RETAIL_BAND_DEACTIVATED',
      requestAt
    })

  } catch (error) {
    console.error('Failed to remove retail band:', error)
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