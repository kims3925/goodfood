/**
 * Base Controller
 * API 응답 표준화 및 헬퍼 함수 제공
 */

import { NextResponse } from 'next/server'

/**
 * 표준 API 응답 타입
 * 모든 API 엔드포인트에서 이 형식을 사용합니다
 */
export type ApiResponse<T = unknown> = {
  success: boolean          // 성공 여부
  code: string              // 성공/에러 공통 코드
  message: string           // 사용자 메시지

  data?: T                  // 성공 데이터
  meta?: Record<string, any> // 페이징, 디버그 meta

  requestAt: string         // 서버가 요청을 받은 시각 (ISO)
  responseAt: string        // 서버가 응답을 생성한 시각 (ISO)
}

/**
 * 성공 응답 생성 헬퍼
 *
 * @example
 * ```typescript
 * return successResponse({
 *   data: products,
 *   message: '상품 목록을 조회했습니다',
 *   code: 'PRODUCTS_FETCHED'
 * })
 * ```
 */
export function successResponse<T = unknown>(options: {
  data?: T
  message?: string
  code?: string
  meta?: Record<string, any>
  requestAt?: string
  status?: number
}): NextResponse<ApiResponse<T>> {
  const now = new Date().toISOString()

  const response: ApiResponse<T> = {
    success: true,
    code: options.code || 'SUCCESS',
    message: options.message || '요청이 성공적으로 처리되었습니다',
    data: options.data,
    meta: options.meta,
    requestAt: options.requestAt || now,
    responseAt: now
  }

  return NextResponse.json(response, { status: options.status || 200 })
}

/**
 * 실패 응답 생성 헬퍼
 *
 * @example
 * ```typescript
 * return errorResponse({
 *   message: '상품을 찾을 수 없습니다',
 *   code: 'PRODUCT_NOT_FOUND',
 *   status: 404
 * })
 * ```
 */
export function errorResponse(options: {
  message: string
  code?: string
  status?: number
  meta?: Record<string, any>
  requestAt?: string
}): NextResponse<ApiResponse<never>> {
  const now = new Date().toISOString()

  const response: ApiResponse<never> = {
    success: false,
    code: options.code || 'ERROR',
    message: options.message,
    meta: options.meta,
    requestAt: options.requestAt || now,
    responseAt: now
  }

  return NextResponse.json(response, { status: options.status || 500 })
}

/**
 * 페이징 메타데이터 생성 헬퍼
 *
 * @example
 * ```typescript
 * const meta = createPaginationMeta({
 *   page: 1,
 *   limit: 20,
 *   total: 150
 * })
 * ```
 */
export function createPaginationMeta(options: {
  page: number
  limit: number
  total: number
}): Record<string, any> {
  const { page, limit, total } = options
  const totalPages = Math.ceil(total / limit)

  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }
}

/**
 * Base Controller 클래스
 * 컨트롤러에서 공통으로 사용하는 유틸리티 제공
 */
export abstract class BaseController {
  /**
   * 성공 응답 반환
   */
  protected success<T = unknown>(options: {
    data?: T
    message?: string
    code?: string
    meta?: Record<string, any>
    status?: number
  }): NextResponse<ApiResponse<T>> {
    return successResponse(options)
  }

  /**
   * 에러 응답 반환
   */
  protected error(options: {
    message: string
    code?: string
    status?: number
    meta?: Record<string, any>
  }): NextResponse<ApiResponse<never>> {
    return errorResponse(options)
  }

  /**
   * 페이징 응답 반환
   */
  protected paginated<T = unknown>(options: {
    data: T
    page: number
    limit: number
    total: number
    message?: string
    code?: string
  }): NextResponse<ApiResponse<T>> {
    return successResponse({
      data: options.data,
      message: options.message,
      code: options.code,
      meta: createPaginationMeta({
        page: options.page,
        limit: options.limit,
        total: options.total
      })
    })
  }
}
