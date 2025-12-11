/**
 * Toss Payments Error Codes
 * 토스페이먼츠 에러 코드 상수 및 메시지 정의
 * @see docs/TOSS_ERROR_HANDLING.md
 */

// 결제 실패 에러 코드
export const TOSS_ERROR_CODES = {
  // 사용자 행동 관련
  PAY_PROCESS_CANCELED: 'PAY_PROCESS_CANCELED',
  PAY_PROCESS_ABORTED: 'PAY_PROCESS_ABORTED',
  USER_CANCEL: 'USER_CANCEL',

  // 카드사 관련
  REJECT_CARD_COMPANY: 'REJECT_CARD_COMPANY',
  FAILED_CARD_COMPANY: 'FAILED_CARD_COMPANY',
  INVALID_STOPPED_CARD: 'INVALID_STOPPED_CARD',
  INVALID_CARD_INFO_RE_REGISTER: 'INVALID_CARD_INFO_RE_REGISTER',
  INVALID_CARD_LOST_OR_STOLEN: 'INVALID_CARD_LOST_OR_STOLEN',

  // 결제 수단 관련
  MAINTAINED_METHOD: 'MAINTAINED_METHOD',
  NOT_ALLOWED_BRANDPAY_METHOD: 'NOT_ALLOWED_BRANDPAY_METHOD',
  NOT_FOUND_METHOD: 'NOT_FOUND_METHOD',
  NOT_SUPPORTED_METHOD: 'NOT_SUPPORTED_METHOD',

  // 주문 관련
  DUPLICATED_ORDER_ID: 'DUPLICATED_ORDER_ID',

  // 인증 관련
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INVALID_AUTHORIZE_AUTH: 'INVALID_AUTHORIZE_AUTH',

  // 고객 관련
  NOT_FOUND_CUSTOMER: 'NOT_FOUND_CUSTOMER',
  NOT_FOUND_METHOD_OWNERSHIP: 'NOT_FOUND_METHOD_OWNERSHIP',

  // 금액 관련
  BELOW_ZERO_AMOUNT: 'BELOW_ZERO_AMOUNT',
  EXCEED_MAX_DUE_DATE: 'EXCEED_MAX_DUE_DATE',

  // 시스템 관련
  INVALID_REQUEST: 'INVALID_REQUEST',
  FAILED_DB_PROCESSING: 'FAILED_DB_PROCESSING',

  // 잔액/한도 관련
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  EXCEED_MAX_DAILY_PAYMENT_COUNT: 'EXCEED_MAX_DAILY_PAYMENT_COUNT',

  // 카드 정보 관련
  INVALID_CARD_EXPIRATION: 'INVALID_CARD_EXPIRATION',
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT',
  INVALID_CARD_INSTALLMENT_PLAN: 'INVALID_CARD_INSTALLMENT_PLAN',

  // 가상계좌 관련
  RESTRICTED_TRANSFER_ACCOUNT: 'RESTRICTED_TRANSFER_ACCOUNT',
  INVALID_ACCOUNT_INFO_RE_INPUT: 'INVALID_ACCOUNT_INFO_RE_INPUT',

  // 기타
  NOT_FOUND_TERMINAL_ID: 'NOT_FOUND_TERMINAL_ID',
  OTHER_DEFINITION_ERROR: 'OTHER_DEFINITION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',

  // 재시도 관련 (커스텀)
  EXCEED_MAX_PAYMENT_RETRY: 'EXCEED_MAX_PAYMENT_RETRY',
  RETRY_TOO_SOON: 'RETRY_TOO_SOON',

  // 내부 시스템 에러
  FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING: 'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING',
  INTERNAL_SYSTEM_ERROR: 'INTERNAL_SYSTEM_ERROR',
} as const

export type TossErrorCode = keyof typeof TOSS_ERROR_CODES

// 에러 메시지 매핑
export const TOSS_ERROR_MESSAGES: Record<string, string> = {
  [TOSS_ERROR_CODES.PAY_PROCESS_CANCELED]: '사용자가 결제를 취소했습니다.',
  [TOSS_ERROR_CODES.PAY_PROCESS_ABORTED]: '결제 진행 중 승인에 실패하여 결제가 중단되었습니다.',
  [TOSS_ERROR_CODES.USER_CANCEL]: '사용자가 결제를 취소했습니다.',
  [TOSS_ERROR_CODES.REJECT_CARD_COMPANY]: '결제 승인이 거절되었습니다.',
  [TOSS_ERROR_CODES.FAILED_CARD_COMPANY]: '카드사 점검 중으로 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.MAINTAINED_METHOD]: '현재 점검 중입니다.',
  [TOSS_ERROR_CODES.INVALID_STOPPED_CARD]: '정지된 카드입니다.',
  [TOSS_ERROR_CODES.INVALID_CARD_INFO_RE_REGISTER]: '유효하지 않은 카드입니다. 카드 재등록 후 시도해주세요.',
  [TOSS_ERROR_CODES.INVALID_CARD_LOST_OR_STOLEN]: '분실 혹은 도난 카드입니다.',
  [TOSS_ERROR_CODES.DUPLICATED_ORDER_ID]: '이미 승인 및 취소가 진행된 중복된 주문번호입니다. 다른 주문번호로 진행해주세요.',
  [TOSS_ERROR_CODES.NOT_ALLOWED_BRANDPAY_METHOD]: '삭제된 결제 수단이거나 가맹점에서 사용이 불가능한 결제 수단입니다.',
  [TOSS_ERROR_CODES.NOT_FOUND_METHOD]: '존재하지 않는 결제 수단입니다.',
  [TOSS_ERROR_CODES.INVALID_REQUEST]: '잘못된 요청입니다.',
  [TOSS_ERROR_CODES.NOT_SUPPORTED_METHOD]: '지원되지 않는 결제 수단입니다.',
  [TOSS_ERROR_CODES.INVALID_PASSWORD]: '결제 비밀번호가 일치하지 않습니다.',
  [TOSS_ERROR_CODES.NOT_FOUND_CUSTOMER]: '유효한 고객 정보가 없습니다.',
  [TOSS_ERROR_CODES.FAILED_DB_PROCESSING]: '잘못된 요청 값으로 처리 중 DB 에러가 발생했습니다.',
  [TOSS_ERROR_CODES.NOT_FOUND_METHOD_OWNERSHIP]: '결제수단의 소유자가 아닙니다.',
  [TOSS_ERROR_CODES.BELOW_ZERO_AMOUNT]: '금액은 0보다 커야 합니다.',
  [TOSS_ERROR_CODES.EXCEED_MAX_DUE_DATE]: '가상 계좌의 최대 유효만료 기간을 초과했습니다.',
  [TOSS_ERROR_CODES.INSUFFICIENT_BALANCE]: '잔액이 부족합니다.',
  [TOSS_ERROR_CODES.EXCEED_MAX_DAILY_PAYMENT_COUNT]: '일일 결제 한도를 초과했습니다.',
  [TOSS_ERROR_CODES.INVALID_CARD_EXPIRATION]: '카드 유효기간이 잘못되었습니다.',
  [TOSS_ERROR_CODES.NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT]: '할부가 지원되지 않는 카드입니다.',
  [TOSS_ERROR_CODES.INVALID_CARD_INSTALLMENT_PLAN]: '잘못된 할부 개월 수입니다.',
  [TOSS_ERROR_CODES.NOT_FOUND_TERMINAL_ID]: '터미널 ID를 찾을 수 없습니다.',
  [TOSS_ERROR_CODES.INVALID_AUTHORIZE_AUTH]: '유효하지 않은 인증입니다.',
  [TOSS_ERROR_CODES.RESTRICTED_TRANSFER_ACCOUNT]: '이체 제한 계좌입니다.',
  [TOSS_ERROR_CODES.INVALID_ACCOUNT_INFO_RE_INPUT]: '계좌 정보를 다시 입력해 주세요.',
  [TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR]: '기타 오류가 발생했습니다.',
  [TOSS_ERROR_CODES.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다.',
  [TOSS_ERROR_CODES.EXCEED_MAX_PAYMENT_RETRY]: '최대 재시도 횟수를 초과했습니다.',
  [TOSS_ERROR_CODES.RETRY_TOO_SOON]: '너무 빠르게 재시도하고 있습니다.',
  [TOSS_ERROR_CODES.FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING]: '결제 처리 중 내부 시스템 오류가 발생했습니다.',
  [TOSS_ERROR_CODES.INTERNAL_SYSTEM_ERROR]: '내부 시스템 오류가 발생했습니다.',
}

// 해결 방법 메시지 매핑
export const TOSS_ERROR_SOLUTIONS: Record<string, string> = {
  [TOSS_ERROR_CODES.PAY_PROCESS_CANCELED]: '다시 결제를 진행해 주세요.',
  [TOSS_ERROR_CODES.PAY_PROCESS_ABORTED]: '잠시 후 다시 시도하거나 다른 결제 수단을 이용해 주세요.',
  [TOSS_ERROR_CODES.USER_CANCEL]: '다시 결제를 진행해 주세요.',
  [TOSS_ERROR_CODES.REJECT_CARD_COMPANY]: '다른 결제 수단을 이용하거나 카드사에 문의해 주세요.',
  [TOSS_ERROR_CODES.FAILED_CARD_COMPANY]: '잠시 후 다시 시도하거나 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.MAINTAINED_METHOD]: '잠시 후 다시 시도하거나 다른 결제 수단을 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_STOPPED_CARD]: '카드 상태를 확인하거나 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_CARD_INFO_RE_REGISTER]: '카드 정보를 다시 등록하거나 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_CARD_LOST_OR_STOLEN]: '다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.DUPLICATED_ORDER_ID]: '새로운 주문을 시작해 주세요.',
  [TOSS_ERROR_CODES.NOT_ALLOWED_BRANDPAY_METHOD]: '다른 결제 수단을 이용해 주세요.',
  [TOSS_ERROR_CODES.NOT_FOUND_METHOD]: '다른 결제 수단을 선택해 주세요.',
  [TOSS_ERROR_CODES.INVALID_REQUEST]: '잠시 후 다시 시도해 주세요.',
  [TOSS_ERROR_CODES.NOT_SUPPORTED_METHOD]: '다른 결제 수단을 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_PASSWORD]: '비밀번호를 다시 확인해 주세요.',
  [TOSS_ERROR_CODES.NOT_FOUND_CUSTOMER]: '로그인 상태를 확인하고 다시 시도해 주세요.',
  [TOSS_ERROR_CODES.FAILED_DB_PROCESSING]: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.',
  [TOSS_ERROR_CODES.NOT_FOUND_METHOD_OWNERSHIP]: '본인 명의의 결제 수단을 이용해 주세요.',
  [TOSS_ERROR_CODES.BELOW_ZERO_AMOUNT]: '올바른 결제 금액을 입력해 주세요.',
  [TOSS_ERROR_CODES.EXCEED_MAX_DUE_DATE]: '유효 기간을 다시 설정해 주세요.',
  [TOSS_ERROR_CODES.INSUFFICIENT_BALANCE]: '다른 결제 수단을 이용하거나 카드사에 문의해 주세요.',
  [TOSS_ERROR_CODES.EXCEED_MAX_DAILY_PAYMENT_COUNT]: '내일 다시 시도하거나 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_CARD_EXPIRATION]: '카드 정보를 다시 확인해 주세요.',
  [TOSS_ERROR_CODES.NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT]: '일시불로 결제하거나 다른 카드를 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_CARD_INSTALLMENT_PLAN]: '할부 개월 수를 다시 선택해 주세요.',
  [TOSS_ERROR_CODES.NOT_FOUND_TERMINAL_ID]: '고객센터에 문의해 주세요.',
  [TOSS_ERROR_CODES.INVALID_AUTHORIZE_AUTH]: '인증을 다시 시도해 주세요.',
  [TOSS_ERROR_CODES.RESTRICTED_TRANSFER_ACCOUNT]: '다른 계좌를 이용해 주세요.',
  [TOSS_ERROR_CODES.INVALID_ACCOUNT_INFO_RE_INPUT]: '계좌 정보를 다시 입력해 주세요.',
  [TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR]: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.',
  [TOSS_ERROR_CODES.UNKNOWN_ERROR]: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.',
  [TOSS_ERROR_CODES.EXCEED_MAX_PAYMENT_RETRY]: '장바구니에서 새로운 주문을 생성해 주세요.',
  [TOSS_ERROR_CODES.RETRY_TOO_SOON]: '30초 후 다시 시도해 주세요.',
  [TOSS_ERROR_CODES.FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING]: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.',
  [TOSS_ERROR_CODES.INTERNAL_SYSTEM_ERROR]: '잠시 후 다시 시도하거나 고객센터에 문의해 주세요.',
}

// 재시도 가능한 에러 코드
export const RETRYABLE_ERROR_CODES: string[] = [
  TOSS_ERROR_CODES.PAY_PROCESS_ABORTED,
  TOSS_ERROR_CODES.FAILED_CARD_COMPANY,
  TOSS_ERROR_CODES.MAINTAINED_METHOD,
  TOSS_ERROR_CODES.FAILED_DB_PROCESSING,
  TOSS_ERROR_CODES.OTHER_DEFINITION_ERROR,
]

// 사용자 취소 에러 코드
export const USER_CANCEL_ERROR_CODES: string[] = [
  TOSS_ERROR_CODES.PAY_PROCESS_CANCELED,
  TOSS_ERROR_CODES.USER_CANCEL,
]

// 카드 관련 에러 코드
export const CARD_ERROR_CODES: string[] = [
  TOSS_ERROR_CODES.REJECT_CARD_COMPANY,
  TOSS_ERROR_CODES.FAILED_CARD_COMPANY,
  TOSS_ERROR_CODES.INVALID_STOPPED_CARD,
  TOSS_ERROR_CODES.INVALID_CARD_INFO_RE_REGISTER,
  TOSS_ERROR_CODES.INVALID_CARD_LOST_OR_STOLEN,
  TOSS_ERROR_CODES.INVALID_CARD_EXPIRATION,
  TOSS_ERROR_CODES.NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT,
  TOSS_ERROR_CODES.INVALID_CARD_INSTALLMENT_PLAN,
]

// 잔액/한도 관련 에러 코드
export const BALANCE_ERROR_CODES: string[] = [
  TOSS_ERROR_CODES.INSUFFICIENT_BALANCE,
  TOSS_ERROR_CODES.EXCEED_MAX_DAILY_PAYMENT_COUNT,
]

/**
 * 에러 코드로 메시지 가져오기
 */
export function getErrorMessage(errorCode: string): string {
  return TOSS_ERROR_MESSAGES[errorCode] || TOSS_ERROR_MESSAGES[TOSS_ERROR_CODES.UNKNOWN_ERROR]
}

/**
 * 에러 코드로 해결 방법 가져오기
 */
export function getErrorSolution(errorCode: string): string {
  return TOSS_ERROR_SOLUTIONS[errorCode] || TOSS_ERROR_SOLUTIONS[TOSS_ERROR_CODES.UNKNOWN_ERROR]
}

/**
 * 재시도 가능한 에러인지 확인
 */
export function isRetryableError(errorCode: string): boolean {
  return RETRYABLE_ERROR_CODES.includes(errorCode)
}

/**
 * 사용자 취소 에러인지 확인
 */
export function isUserCancelError(errorCode: string): boolean {
  return USER_CANCEL_ERROR_CODES.includes(errorCode)
}

/**
 * 카드 관련 에러인지 확인
 */
export function isCardError(errorCode: string): boolean {
  return CARD_ERROR_CODES.includes(errorCode)
}

/**
 * 잔액/한도 관련 에러인지 확인
 */
export function isBalanceError(errorCode: string): boolean {
  return BALANCE_ERROR_CODES.includes(errorCode)
}

/**
 * 에러 상세 정보 가져오기
 */
export function getErrorDetails(errorCode: string) {
  return {
    code: errorCode,
    message: getErrorMessage(errorCode),
    solution: getErrorSolution(errorCode),
    isRetryable: isRetryableError(errorCode),
    isUserCancel: isUserCancelError(errorCode),
    isCardError: isCardError(errorCode),
    isBalanceError: isBalanceError(errorCode),
  }
}
