/**
 * 배치 처리 공통 타입 정의
 *
 * 자동화 파이프라인과 수동 실행에서 공통으로 사용되는 배치 처리 타입
 */

/**
 * 배치 처리 결과 아이템
 */
export interface BatchResultItem<T> {
  /** 처리 성공 여부 */
  success: boolean
  /** 성공 시 결과 데이터 */
  data?: T
  /** 실패 시 에러 메시지 */
  error?: string
  /** 실패 유형 (재시도 가능 여부 판단용) */
  errorType?: 'TRANSIENT' | 'PERMANENT'
}

/**
 * 배치 처리 전체 결과
 */
export interface BatchResult<T> {
  /** 전체 처리 대상 수 */
  total: number
  /** 성공한 항목 수 */
  successCount: number
  /** 실패한 항목 수 */
  failedCount: number
  /** 건너뛴 항목 수 (중복 등) */
  skippedCount: number
  /** 개별 결과 목록 */
  results: BatchResultItem<T>[]
}

/**
 * 배치 처리 진행 콜백
 */
export type ProgressCallback<T = unknown> = (params: {
  /** 현재 처리 인덱스 (0-based) */
  current: number
  /** 전체 처리 대상 수 */
  total: number
  /** 현재 항목 처리 결과 */
  result: BatchResultItem<T>
  /** 현재 처리 중인 항목의 ID (선택) */
  itemId?: number
}) => Promise<void>

/**
 * 빈 배치 결과 생성 헬퍼
 */
export function createEmptyBatchResult<T>(): BatchResult<T> {
  return {
    total: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    results: [],
  }
}

/**
 * 배치 결과에 성공 항목 추가 헬퍼
 */
export function addSuccessResult<T>(result: BatchResult<T>, data: T): BatchResult<T> {
  return {
    ...result,
    total: result.total + 1,
    successCount: result.successCount + 1,
    results: [...result.results, { success: true, data }],
  }
}

/**
 * 배치 결과에 실패 항목 추가 헬퍼
 */
export function addFailedResult<T>(
  result: BatchResult<T>,
  error: string,
  errorType: 'TRANSIENT' | 'PERMANENT' = 'PERMANENT'
): BatchResult<T> {
  return {
    ...result,
    total: result.total + 1,
    failedCount: result.failedCount + 1,
    results: [...result.results, { success: false, error, errorType }],
  }
}

/**
 * 배치 결과에 건너뛴 항목 추가 헬퍼
 */
export function addSkippedResult<T>(result: BatchResult<T>, reason: string): BatchResult<T> {
  return {
    ...result,
    total: result.total + 1,
    skippedCount: result.skippedCount + 1,
    results: [...result.results, { success: true, error: reason }],
  }
}
