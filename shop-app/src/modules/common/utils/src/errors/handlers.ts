/**
 * Service Layer 에러 클래스
 * Service에서 발생하는 모든 에러를 표준화합니다
 */

/**
 * 기본 Service 에러 클래스
 */
export class ServiceError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ServiceError'

    // 스택 트레이스 유지
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    }
  }
}

/**
 * 유효성 검증 실패 에러
 *
 * @example
 * throw new ValidationError('상품 ID는 필수입니다', { field: 'productId' })
 */
export class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * 리소스를 찾을 수 없음 에러
 *
 * @example
 * throw new NotFoundError('상품', 'product-123')
 */
export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(
      'NOT_FOUND',
      `${resource}을(를) 찾을 수 없습니다: ${id}`,
      404,
      { resource, id }
    )
    this.name = 'NotFoundError'
  }
}

/**
 * 인증 실패 에러
 *
 * @example
 * throw new UnauthorizedError('로그인이 필요합니다')
 */
export class UnauthorizedError extends ServiceError {
  constructor(message: string = '인증이 필요합니다') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 권한 부족 에러
 *
 * @example
 * throw new ForbiddenError('이 작업을 수행할 권한이 없습니다')
 */
export class ForbiddenError extends ServiceError {
  constructor(message: string = '권한이 없습니다') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * 중복 리소스 에러
 *
 * @example
 * throw new DuplicateError('이미 등록된 밴드입니다', { bandKey: 'abc123' })
 */
export class DuplicateError extends ServiceError {
  constructor(message: string, details?: any) {
    super('DUPLICATE_ERROR', message, 409, details)
    this.name = 'DuplicateError'
  }
}

/**
 * 비즈니스 로직 에러
 *
 * @example
 * throw new BusinessLogicError('재고가 부족합니다', { required: 10, available: 5 })
 */
export class BusinessLogicError extends ServiceError {
  constructor(message: string, details?: any) {
    super('BUSINESS_LOGIC_ERROR', message, 422, details)
    this.name = 'BusinessLogicError'
  }
}

/**
 * 외부 API 호출 실패 에러
 *
 * @example
 * throw new ExternalApiError('Band API 호출에 실패했습니다', { api: 'Band', status: 500 })
 */
export class ExternalApiError extends ServiceError {
  constructor(message: string, details?: any) {
    super('EXTERNAL_API_ERROR', message, 502, details)
    this.name = 'ExternalApiError'
  }
}

/**
 * 데이터베이스 에러
 *
 * @example
 * throw new DatabaseError('데이터베이스 연결에 실패했습니다', error)
 */
export class DatabaseError extends ServiceError {
  constructor(message: string, details?: any) {
    super('DATABASE_ERROR', message, 500, details)
    this.name = 'DatabaseError'
  }
}

/**
 * 에러가 ServiceError 인스턴스인지 확인
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}

/**
 * 에러를 ApiResponse 형식으로 변환
 * API Route에서 catch 블록에서 사용
 *
 * @example
 * ```typescript
 * catch (error) {
 *   return handleServiceError(error)
 * }
 * ```
 */
export function handleServiceError(error: unknown): {
  message: string
  code: string
  statusCode: number
  details?: any
} {
  if (isServiceError(error)) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details
    }
  }

  // 일반 에러 처리
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  }

  // 알 수 없는 에러
  return {
    message: '알 수 없는 오류가 발생했습니다',
    code: 'UNKNOWN_ERROR',
    statusCode: 500
  }
}
