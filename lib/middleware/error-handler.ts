import { NextResponse } from 'next/server'
import { isAppError, AppError, isOperationalError } from '@/lib/errors/custom-errors'
import { logError, getUserFriendlyMessage } from '@/lib/utils/error-logger'
import { Prisma } from '@prisma/client'

/**
 * API Route용 통합 에러 핸들러
 *
 * 사용법:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return handleAPIError(async () => {
 *     // API 로직
 *     const data = await someService.getData()
 *     return NextResponse.json({ success: true, data })
 *   }, request)
 * }
 * ```
 */
export async function handleAPIError(
  handler: () => Promise<NextResponse>,
  request?: Request
): Promise<NextResponse> {
  try {
    return await handler()
  } catch (error) {
    return handleError(error as Error, request)
  }
}

/**
 * 에러 처리 및 응답 생성
 */
function handleError(error: Error, request?: Request): NextResponse {
  // 요청 컨텍스트 정보
  const context: Record<string, any> = {}

  if (request) {
    context.url = request.url
    context.method = request.method
  }

  // AppError 처리
  if (isAppError(error)) {
    logError(error, context)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.name,
        ...(process.env.NODE_ENV === 'development' && {
          context: error.context,
          stack: error.stack
        })
      },
      { status: error.statusCode }
    )
  }

  // Prisma 에러 처리
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error, context)
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logError(error, context)

    return NextResponse.json(
      {
        success: false,
        error: '입력값 검증에 실패했습니다.',
        code: 'VALIDATION_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message
        })
      },
      { status: 400 }
    )
  }

  // 일반 에러 처리
  logError(error, context)

  const userMessage = getUserFriendlyMessage(error)
  const isDevelopment = process.env.NODE_ENV === 'development'

  return NextResponse.json(
    {
      success: false,
      error: userMessage,
      code: 'INTERNAL_ERROR',
      ...(isDevelopment && {
        originalError: error.message,
        stack: error.stack
      })
    },
    { status: 500 }
  )
}

/**
 * Prisma 에러 처리
 */
function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  context: Record<string, any>
): NextResponse {
  logError(error as any, context)

  let statusCode = 500
  let message = '데이터베이스 오류가 발생했습니다.'

  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      statusCode = 409
      message = '이미 존재하는 데이터입니다.'
      break

    case 'P2025':
      // Record not found
      statusCode = 404
      message = '요청한 데이터를 찾을 수 없습니다.'
      break

    case 'P2003':
      // Foreign key constraint violation
      statusCode = 400
      message = '관련된 데이터를 찾을 수 없습니다.'
      break

    case 'P2014':
      // Invalid relation
      statusCode = 400
      message = '유효하지 않은 관계입니다.'
      break

    default:
      statusCode = 500
      message = '데이터베이스 처리 중 오류가 발생했습니다.'
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code: `PRISMA_${error.code}`,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        meta: error.meta
      })
    },
    { status: statusCode }
  )
}

/**
 * try-catch 래퍼 (비동기 함수용)
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (errorMessage) {
      console.error(errorMessage, error)
    }
    throw error
  }
}

/**
 * 에러 응답 생성 헬퍼
 */
export function createErrorResponse(
  error: Error,
  statusCode: number = 500
): NextResponse {
  const message = isAppError(error) ? error.message : getUserFriendlyMessage(error)

  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack
      })
    },
    { status: statusCode }
  )
}

/**
 * 성공 응답 생성 헬퍼
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message })
    },
    { status: statusCode }
  )
}
