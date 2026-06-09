/**
 * 발주 텍스트 복사용 주문 텍스트 생성 유틸리티
 *
 * 규칙:
 * - 품명은 도매방 원본 품명(sourceProductName)을 우선 사용 (AI 가공 품명 금지)
 * - 금액은 배송비가 이미 포함된 합산 금액(상품가 × 수량 + 배송비)
 * - 합배송이므로 배송비는 주문 전체에 1회만 반영
 * - 품목이 여러 개인 주문은 품목별로 개별 발주서로 분리해서 생성 (도매처에 개별 전달)
 * - 보내는분 = 받는분일 경우 보내는분 줄 생략
 */

export interface OrderTextItem {
  productName: string
  sourceProductName?: string | null
  optionSummary: string | null
  quantity: number
  unitPrice: number        // 판매가 (소매 가격)
  shippingFee: number
  wholesalePrice?: number | null // 공급가 (도매원가) — 발주 텍스트 표시용
}

export interface OrderTextShipping {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address: string
  addressDetail: string | null
  deliveryMemo: string | null
}

export interface OrderTextData {
  orderNumber: string
  items: OrderTextItem[]
  shipping: OrderTextShipping
  wholesaleChannelName?: string
  retailChannelName?: string  // 소매밴드 이름 (다건이면 쉼표 합)
  customerName?: string
  customerPhone?: string
  // ⚠ 주문 레벨 금액 — item.unitPrice 가 배송비 포함 가격으로 저장되는 케이스 보완용.
  //   있으면 우선 사용 (판매가 = subtotal, 배송비 = total - subtotal + discount).
  //   없으면 옛 산식(item.unitPrice * qty + max(shippingFee)) 폴백.
  orderSubtotal?: number   // 상품 순합계 (Order.subtotalAmount)
  orderTotal?: number      // 청구 총액 (Order.totalAmount)
  orderDiscount?: number   // 할인 (Order.discountAmount)
}

/** 합배송 가정: items 중 최대 shippingFee를 주문 전체 배송비로 간주 */
function commonShipping(items: OrderTextItem[]): number {
  return items.reduce((max, i) => Math.max(max, i.shippingFee || 0), 0)
}

/**
 * 공급가(도매원가) 표시 줄 생성.
 * - 배송비 별도 + foldShipping: "공급가 : 25,000원 (배송비-4,000원포함)" (도매가+배송비 합산 표시)
 * - 배송비 별도 + !foldShipping(다품목 합배송): "공급가 : 21,000원 (배송비 별도)" (배송비는 하단 합배송 안내)
 * - 무료배송: "공급가 : 25,000원 (무료배송)"
 */
function formatSupplyLine(wholesaleAmount: number, ship: number, foldShipping: boolean): string {
  if (ship > 0) {
    if (foldShipping) {
      return `■ 공급가 : ${(wholesaleAmount + ship).toLocaleString()}원 (배송비-${ship.toLocaleString()}원포함)`
    }
    return `■ 공급가 : ${wholesaleAmount.toLocaleString()}원 (배송비 별도)`
  }
  return `■ 공급가 : ${wholesaleAmount.toLocaleString()}원 (무료배송)`
}

function buildShippingBlock(
  shipping: OrderTextShipping,
  customerName?: string,
  customerPhone?: string,
): { lines: string[]; isSamePerson: boolean } {
  const lines: string[] = []
  const isSamePerson = !customerName || customerName === shipping.recipientName
  const recipientLine = isSamePerson
    ? shipping.recipientName
    : `${shipping.recipientName}(${customerName})`
  lines.push('■ 배송정보')
  lines.push(`받는분: ${recipientLine}`)
  lines.push(`연락처: ${shipping.recipientPhone}`)
  const addr = shipping.addressDetail
    ? `${shipping.address},  ${shipping.addressDetail}`
    : shipping.address
  lines.push(`주소:  [${shipping.postalCode}] ${addr}`)
  if (!isSamePerson && customerName) {
    const senderPhone = customerPhone ? ` ${customerPhone}` : ''
    lines.push(`■ 보내는분 : ${customerName}${senderPhone}`)
  }
  return { lines, isSamePerson }
}

/**
 * 단일 발주서 텍스트 (여러 items를 하나의 블록으로 묶음)
 * 금액은 배송비 포함 합산 금액으로 표시
 */
export function generateOrderText(data: OrderTextData): string {
  const lines: string[] = []
  const { shipping, customerName, customerPhone } = data

  // 품명들
  data.items.forEach((item) => {
    const name = item.sourceProductName || item.productName
    lines.push(`■ 품명 : ${name}`)
    if (item.optionSummary) {
      lines.push(`  옵션 : ${item.optionSummary}`)
    }
    if (item.quantity > 1) {
      lines.push(`  수량 : ${item.quantity}개`)
    }
  })

  // ⚠ 산식 우선순위:
  //   1) order 레벨 합계 (subtotal/total/discount) 가 있으면 그걸로 — 가장 정확
  //   2) 폴백: item.unitPrice * qty + max(shippingFee)
  //     · item.unitPrice 가 배송비 포함 가격으로 저장된 케이스 (Shop calculateSellingPrice 결과)
  //       에서는 (1) 이 올바른 판매가/배송비 분리를 보장.
  const itemsTotal = data.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity, 0
  )
  const itemsShip = commonShipping(data.items)

  let sellPrice: number  // 판매가 (순 상품가)
  let ship: number       // 배송비
  let grandTotal: number // 합계 (실제 청구)

  if (data.orderTotal != null && data.orderSubtotal != null) {
    sellPrice = data.orderSubtotal
    ship = Math.max(0, data.orderTotal - data.orderSubtotal + (data.orderDiscount ?? 0))
    grandTotal = data.orderTotal
  } else {
    sellPrice = itemsTotal
    ship = itemsShip
    grandTotal = itemsTotal + itemsShip
  }

  // 공급가 합계 (도매원가 × 수량) — wholesalePrice 없는 품목은 0 처리
  const totalWholesale = data.items.reduce(
    (sum, i) => sum + (i.wholesalePrice ?? 0) * i.quantity, 0
  )

  lines.push(`■ 판매가 : ${sellPrice.toLocaleString()}원`)
  if (totalWholesale > 0) {
    // 단일 블록(전 품목 묶음) → 공급가에 배송비 합산 표시
    lines.push(formatSupplyLine(totalWholesale, ship, true))
  }
  lines.push(`■ 배송비 : ${ship > 0 ? `${ship.toLocaleString()}원` : '무료'}`)
  lines.push(`■ 합계   : ${grandTotal.toLocaleString()}원`)

  // 배송정보
  const { lines: shipLines } = buildShippingBlock(shipping, customerName, customerPhone)
  lines.push(...shipLines)

  // 도매방 / 소매밴드
  if (data.wholesaleChannelName || data.retailChannelName) {
    lines.push('')
    if (data.wholesaleChannelName) lines.push(`■ 도매방 : ${data.wholesaleChannelName}`)
    if (data.retailChannelName) lines.push(`■ 소매밴드 : ${data.retailChannelName}`)
  }

  return lines.join('\n')
}

/**
 * 품목별로 분리된 발주서 텍스트 배열
 * - 단일 품목: 금액 = 상품가 + 배송비 (합산)
 * - 여러 품목: 각 발주서 금액 = 해당 품목 상품가, 마지막에 합배송 공통 배송비 안내
 */
export function generateOrderTextsPerItem(data: OrderTextData): string[] {
  const { items, shipping, customerName, customerPhone, wholesaleChannelName, retailChannelName } = data
  const isSingle = items.length === 1

  // ⚠ order 레벨 합계 우선 — item.unitPrice 가 배송비 포함 가격으로 저장된 케이스
  //    (calculateSellingPrice 결과) 에서 판매가가 부풀려 보이는 사고 보완.
  //    예: GORD-20260519-9XNVY4 — 판매가 19,000 인데 텍스트에 23,000 표시 (배송비 4,000 포함).
  const hasOrderTotals = data.orderTotal != null && data.orderSubtotal != null
  const orderShip = hasOrderTotals
    ? Math.max(0, data.orderTotal! - data.orderSubtotal! + (data.orderDiscount ?? 0))
    : commonShipping(items)

  // 단일 품목일 때 판매가 = order.subtotalAmount (배송비 제외)
  // 다중 품목일 때 각 item.unitPrice * qty 사용 (단, hasOrderTotals 이면 비례 조정 권장 — 옛 로직 유지)
  const ship = orderShip

  return items.map((item) => {
    const lines: string[] = []
    const name = item.sourceProductName || item.productName
    lines.push(`■ 품명 : ${name}`)
    if (item.optionSummary) {
      lines.push(`  옵션 : ${item.optionSummary}`)
    }
    if (item.quantity > 1) {
      lines.push(`  수량 : ${item.quantity}개`)
    }

    // 판매가 — 단일 품목이고 orderSubtotal 있으면 그 값 우선 (배송비 미포함 보장)
    const itemPrice = (isSingle && hasOrderTotals && data.orderSubtotal != null)
      ? data.orderSubtotal
      : item.unitPrice * item.quantity
    const itemWholesale = (item.wholesalePrice ?? 0) * item.quantity

    lines.push(`■ 판매가 : ${itemPrice.toLocaleString()}원`)
    if (itemWholesale > 0) {
      // 단일 품목 → 공급가에 배송비 합산 표시 / 다품목 → 배송비는 하단 합배송 안내(중복합산 방지)
      lines.push(formatSupplyLine(itemWholesale, ship, isSingle))
    }
    if (isSingle) {
      const finalTotal = hasOrderTotals && data.orderTotal != null
        ? data.orderTotal
        : itemPrice + ship
      lines.push(`■ 배송비 : ${ship > 0 ? `${ship.toLocaleString()}원` : '무료'}`)
      lines.push(`■ 합계   : ${finalTotal.toLocaleString()}원`)
    }
    // 여러 품목은 배송비/합계는 아래 합배송 안내로 처리

    const { lines: shipLines } = buildShippingBlock(shipping, customerName, customerPhone)
    lines.push(...shipLines)

    if (!isSingle) {
      lines.push('')
      const msg = ship > 0
        ? `합배송 배송비 ${ship.toLocaleString()}원 (주문 전체 1회)`
        : '합배송 (무료배송)'
      lines.push(`※ ${msg}`)
    }

    // 도매방 / 소매밴드
    if (wholesaleChannelName || retailChannelName) {
      lines.push('')
      if (wholesaleChannelName) lines.push(`■ 도매방 : ${wholesaleChannelName}`)
      if (retailChannelName) lines.push(`■ 소매밴드 : ${retailChannelName}`)
    }

    return lines.join('\n')
  })
}
