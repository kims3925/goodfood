import { AppError, isAppError, getErrorLevel } from '@/modules/common/utils/src/errors/types'

/**
 * 에러 로깅 유틸리티
 *
 * 기능:
 * - 구조화된 에러 로깅
 * - 에러 레벨별 분류 (error, warn, info)
 * - 컨텍스트 정보 포함
 * - 개발/프로덕션 환경 구분
 */

interface LogContext {
  userId?: string
  requestId?: string
  path?: string
  method?: string
  [key: string]: any
}

/**
 * 에러 로깅
 */
export function logError(
  error: Error,
  context?: LogContext
): void {
  const level = getErrorLevel(error)
  const timestamp = new Date().toISOString()

  const logData = {
    timestamp,
    level,
    name: error.name,
    message: error.message,
    stack: error.stack,
    context,
    ...(isAppError(error) && {
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      errorContext: error.context
    })
  }

  // 개발 환경: 상세 로그
  if (process.env.NODE_ENV === 'development') {
    console.error('\n========== ERROR LOG ==========')
    console.error('Timestamp:', timestamp)
    console.error('Level:', level.toUpperCase())
    console.error('Error:', error.name)
    console.error('Message:', error.message)

    if (isAppError(error)) {
      console.error('Status Code:', error.statusCode)
      console.error('Operational:', error.isOperational)
      if (error.context) {
        console.error('Error Context:', JSON.stringify(error.context, null, 2))
      }
    }

    if (context) {
      console.error('Request Context:', JSON.stringify(context, null, 2))
    }

    console.error('Stack:', error.stack)
    console.error('===============================\n')
  } else {
    // 프로덕션 환경: JSON 형식 로그 (로그 수집 도구 연동 용이)
    console.error(JSON.stringify(logData))
  }

  // TODO: 외부 로깅 서비스 연동 (Sentry, LogRocket 등)
  // sendToLoggingService(logData)
}

/**
 * 경고 로깅
 */
export function logWarning(
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString()

  if (process.env.NODE_ENV === 'development') {
    console.warn('\n========== WARNING ==========')
    console.warn('Timestamp:', timestamp)
    console.warn('Message:', message)
    if (context) {
      console.warn('Context:', JSON.stringify(context, null, 2))
    }
    console.warn('=============================\n')
  } else {
    console.warn(JSON.stringify({ timestamp, level: 'warn', message, context }))
  }
}

/**
 * 정보 로깅
 */
export function logInfo(
  message: string,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString()

  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] ${timestamp} - ${message}`)
    if (context) {
      console.log('Context:', context)
    }
  } else {
    console.log(JSON.stringify({ timestamp, level: 'info', message, context }))
  }
}

/**
 * 성능 로깅
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: LogContext
): void {
  const timestamp = new Date().toISOString()

  if (duration > 1000) {
    // 1초 이상 소요 시 경고
    logWarning(`Slow operation: ${operation} (${duration}ms)`, context)
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`[PERF] ${timestamp} - ${operation}: ${duration}ms`)
  }
}

/**
 * 성능 측정 데코레이터
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): () => Promise<T> {
  return async () => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      logPerformance(operation, duration, context)
      return result
    } catch (error) {
      const duration = Date.now() - start
      logError(error as Error, {
        ...context,
        operation,
        duration
      })
      throw error
    }
  }
}

/**
 * 에러를 사용자 친화적 메시지로 변환
 */
export function getUserFriendlyMessage(error: Error): string {
  if (isAppError(error)) {
    return error.message
  }

  // Prisma 에러
  if (error.name === 'PrismaClientKnownRequestError') {
    return '데이터베이스 처리 중 오류가 발생했습니다.'
  }

  // 네트워크 에러
  if (error.message.includes('ECONNREFUSED')) {
    return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
  }

  // 기본 메시지
  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
}
