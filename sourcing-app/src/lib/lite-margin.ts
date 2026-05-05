/**
 * Lite Manager — 마진 계산 모듈 (D2)
 *
 * 셀러 학습용 단순 마진 추정:
 *   gross = sellingPrice - wholesalePrice
 *   marginRate = gross / sellingPrice  (백분율)
 *
 * 정밀한 결제 수수료 / 배송비 / 부가세는 Pro 매니저에서 처리.
 * Lite 는 "감"을 키우는 용도이므로 단순화.
 */

export interface MarginInput {
  sellingPrice: number
  wholesalePrice: number | null | undefined
  /** 결제 수수료 비율 (예: 0.033 = 3.3%) — 기본 추정 3% */
  feeRate?: number
}

export interface MarginResult {
  /** 판매가 (셀러가 받는 금액) */
  sellingPrice: number
  /** 도매 원가 (없으면 null) */
  wholesalePrice: number | null
  /** 결제 수수료 (sellingPrice * feeRate) */
  fee: number
  /** 추정 순이익 = sellingPrice - wholesalePrice - fee */
  net: number | null
  /** 마진율 (% 정수) — null 이면 도매가 모름 */
  marginPct: number | null
}

const DEFAULT_FEE_RATE = 0.03 // 결제수수료 추정 3% (Toss/카드 평균)

export function computeMargin({ sellingPrice, wholesalePrice, feeRate = DEFAULT_FEE_RATE }: MarginInput): MarginResult {
  const sp = Number(sellingPrice) || 0
  const wp = wholesalePrice == null ? null : Number(wholesalePrice)
  const fee = Math.round(sp * feeRate)

  if (wp == null || wp <= 0 || sp <= 0) {
    return { sellingPrice: sp, wholesalePrice: wp, fee, net: null, marginPct: null }
  }

  const net = sp - wp - fee
  const marginPct = Math.round((net / sp) * 100)
  return { sellingPrice: sp, wholesalePrice: wp, fee, net, marginPct }
}

/**
 * 주문 합산 마진 — 여러 OrderItem 의 (price × quantity, wholesalePrice × quantity) 합산
 */
export function sumMargin(
  items: Array<{ unitPrice: number | string; wholesalePrice?: number | string | null; quantity: number }>
): MarginResult {
  let totalSelling = 0
  let totalWholesale = 0
  let hasWholesale = false

  for (const item of items) {
    const price = Number(item.unitPrice) || 0
    const wp = item.wholesalePrice != null ? Number(item.wholesalePrice) : null
    const qty = item.quantity || 0
    totalSelling += price * qty
    if (wp != null && wp > 0) {
      totalWholesale += wp * qty
      hasWholesale = true
    }
  }

  return computeMargin({
    sellingPrice: totalSelling,
    wholesalePrice: hasWholesale ? totalWholesale : null,
  })
}
