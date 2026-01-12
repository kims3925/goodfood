/**
 * 토스페이먼츠 공통 타입 정의
 * shop-app과 sourcing-app에서 공유하여 사용
 */

/**
 * 토스페이먼츠 거래 정보
 */
export interface TossTransaction {
  mId: string
  transactionKey: string
  paymentKey: string
  orderId: string
  method: string              // 결제 수단 (카드, 계좌이체, 가상계좌 등)
  customerKey?: string
  useEscrow: boolean
  receiptUrl?: string
  status: string              // DONE, CANCELED, PARTIAL_CANCELED 등
  transactionAt: string       // 거래 시각 (ISO 문자열)
  currency: string
  amount: number
}

/**
 * 토스페이먼츠 거래 조회 API 응답
 */
export interface TossTransactionsResponse {
  hasMore: boolean
  lastCursor?: string
  data: TossTransaction[]
}

/**
 * 거래 요약 정보
 */
export interface TransactionsSummary {
  totalAmount: number         // 총 거래 금액 (DONE 상태)
  totalCount: number          // 총 거래 건수 (DONE 상태)
  cardAmount: number          // 카드 결제 금액
  cardCount: number           // 카드 결제 건수
  transferAmount: number      // 계좌이체 금액
  transferCount: number       // 계좌이체 건수
  virtualAccountAmount: number  // 가상계좌 금액
  virtualAccountCount: number   // 가상계좌 건수
  canceledAmount: number      // 취소 금액
  canceledCount: number       // 취소 건수
  transactions: TossTransaction[]
  methodTypes?: string[]      // 디버깅용: 결제 수단 목록
}
