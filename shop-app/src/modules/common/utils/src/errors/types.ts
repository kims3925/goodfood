/**
 * Custom Error Classes
 *
 * 에러 추적을 용이하게 하기 위한 커스텀 에러 클래스들
 * - 명확한 에러 타입 분류
 * - 스택 트레이스 보존
 * - 에러 컨텍스트 정보 포함
 */

/**
 * 기본 애플리케이션 에러
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, any>
  public readonly timestamp: Date

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)

    this.name = this.constructor.name
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    this.timestamp = new Date()

    // 스택 트레이스 보존
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    }
  }
}

/**
 * Repository 레이어 에러
 */
export class RepositoryError extends AppError {
  constructor(
    message: string,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, 500, true, {
      ...context,
      layer: 'Repository',
      originalError: originalError?.message,
      originalStack: originalError?.stack
    })
  }
}

/**
 * Service 레이어 에러
 */
export class ServiceError extends AppError {
  constructor(
    message: string,
    statusCode: number = 500,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(message, statusCode, true, {
      ...context,
      layer: 'Service',
      originalError: originalError?.message,
      originalStack: originalError?.stack
    })
  }
}

/**
 * Validation 에러 (400)
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string[]>

  constructor(
    message: string,
    fields?: Record<string, string[]>,
    context?: Record<string, any>
  ) {
    super(message, 400, true, { ...context, fields })
    this.fields = fields
  }
}

/**
 * 인증 에러 (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = '인증이 필요합니다.', context?: Record<string, any>) {
    super(message, 401, true, context)
  }
}

/**
 * 권한 에러 (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '접근 권한이 없습니다.', context?: Record<string, any>) {
    super(message, 403, true, context)
  }
}

/**
 * 리소스 없음 에러 (404)
 */
export class NotFoundError extends AppError {
  constructor(
    resourceType: string,
    identifier?: string,
    context?: Record<string, any>
  ) {
    const message = identifier
      ? `${resourceType}(을)를 찾을 수 없습니다: ${identifier}`
      : `${resourceType}(을)를 찾을 수 없습니다.`

    super(message, 404, true, {
      ...context,
      resourceType,
      identifier
    })
  }
}

/**
 * 충돌 에러 (409) - 중복 등
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 409, true, context)
  }
}

/**
 * 비즈니스 로직 에러 (422)
 */
export class BusinessLogicError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 422, true, context)
  }
}

/**
 * 외부 API 에러 (502)
 */
export class ExternalAPIError extends AppError {
  constructor(
    serviceName: string,
    message: string,
    context?: Record<string, any>,
    originalError?: Error
  ) {
    super(`${serviceName} API 오류: ${message}`, 502, true, {
      ...context,
      serviceName,
      originalError: originalError?.message
    })
  }
}

/**
 * Database 에러 (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, any>, originalError?: Error) {
    super(message, 500, true, {
      ...context,
      originalError: originalError?.message,
      originalStack: originalError?.stack
    })
  }
}

/**
 * 에러가 AppError 인스턴스인지 확인
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError
}

/**
 * 에러가 운영 가능한 에러인지 확인 (복구 가능한 에러)
 */
export function isOperationalError(error: Error): boolean {
  if (isAppError(error)) {
    return error.isOperational
  }
  return false
}

/**
 * 에러 레벨 결정
 */
export function getErrorLevel(error: Error): 'error' | 'warn' | 'info' {
  if (isAppError(error)) {
    if (error.statusCode >= 500) return 'error'
    if (error.statusCode >= 400) return 'warn'
    return 'info'
  }
  return 'error'
}
