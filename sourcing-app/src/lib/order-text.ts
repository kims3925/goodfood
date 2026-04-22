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
  unitPrice: number
  shippingFee: number
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
  customerName?: string
  customerPhone?: string
}

/** 합배송 가정: items 중 최대 shippingFee를 주문 전체 배송비로 간주 */
function commonShipping(items: OrderTextItem[]): number {
  return items.reduce((max, i) => Math.max(max, i.shippingFee || 0), 0)
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

  // 금액 (상품가 합계 + 합배송 배송비 1회 포함 단일 값)
  const totalItemPrice = data.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity, 0
  )
  const ship = commonShipping(data.items)
  const grandTotal = totalItemPrice + ship
  lines.push(`■ 금액 : ${grandTotal.toLocaleString()}원`)

  // 배송정보
  const { lines: shipLines } = buildShippingBlock(shipping, customerName, customerPhone)
  lines.push(...shipLines)

  // 도매방
  if (data.wholesaleChannelName) {
    lines.push('')
    lines.push(`■ 도매방 : ${data.wholesaleChannelName}`)
  }

  return lines.join('\n')
}

/**
 * 품목별로 분리된 발주서 텍스트 배열
 * - 단일 품목: 금액 = 상품가 + 배송비 (합산)
 * - 여러 품목: 각 발주서 금액 = 해당 품목 상품가, 마지막에 합배송 공통 배송비 안내
 */
export function generateOrderTextsPerItem(data: OrderTextData): string[] {
  const { items, shipping, customerName, customerPhone, wholesaleChannelName } = data
  const ship = commonShipping(items)
  const isSingle = items.length === 1

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

    const itemPrice = item.unitPrice * item.quantity
    if (isSingle) {
      // 단일 품목은 배송비 포함한 최종 결제 금액
      lines.push(`■ 금액 : ${(itemPrice + ship).toLocaleString()}원`)
    } else {
      // 여러 품목은 해당 품목 상품가만 (배송비는 공통 안내로 1회)
      lines.push(`■ 금액 : ${itemPrice.toLocaleString()}원`)
    }

    const { lines: shipLines } = buildShippingBlock(shipping, customerName, customerPhone)
    lines.push(...shipLines)

    if (!isSingle) {
      lines.push('')
      const msg = ship > 0
        ? `합배송 배송비 ${ship.toLocaleString()}원 (주문 전체 1회)`
        : '합배송 (무료배송)'
      lines.push(`※ ${msg}`)
    }

    if (wholesaleChannelName) {
      lines.push('')
      lines.push(`■ 도매방 : ${wholesaleChannelName}`)
    }

    return lines.join('\n')
  })
}
