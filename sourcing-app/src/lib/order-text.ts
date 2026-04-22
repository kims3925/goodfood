/**
 * 발주 텍스트 복사용 주문 텍스트 생성 유틸리티
 *
 * 주문 상세 정보를 클립보드로 복사하여 도매처에 발주할 수 있는
 * 텍스트 형식으로 변환합니다.
 *
 * 규칙:
 * - 품명은 도매방 원본 품명(sourceProductName)을 우선 사용 (AI 가공 품명 금지)
 * - 금액은 도매가 합계 + 배송비 표시
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

export function generateOrderText(data: OrderTextData): string {
  const lines: string[] = []
  const { shipping, customerName, customerPhone } = data

  // ── 품명 (도매방 원본 품명 우선) ──
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

  // ── 금액 (도매가 + 배송비 표시) ──
  const totalPrice = data.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity, 0
  )
  const totalShipping = data.items.reduce(
    (sum, i) => sum + (i.shippingFee || 0), 0
  )
  const priceStr = `${totalPrice.toLocaleString()}원`
  const shipStr = totalShipping === 0
    ? '(무료배송)'
    : `(배송비 ${totalShipping.toLocaleString()}원)`
  lines.push(`■ 금액 : ${priceStr} ${shipStr}`)

  // ── 배송정보 ──
  lines.push('■ 배송정보')
  const isSamePerson = !customerName
    || customerName === shipping.recipientName
  const recipientLine = isSamePerson
    ? shipping.recipientName
    : `${shipping.recipientName}(${customerName})`
  lines.push(`받는분: ${recipientLine}`)
  lines.push(`연락처: ${shipping.recipientPhone}`)
  const addr = shipping.addressDetail
    ? `${shipping.address},  ${shipping.addressDetail}`
    : shipping.address
  lines.push(`주소:  [${shipping.postalCode}] ${addr}`)

  // ── 보내는분 (받는분과 다를 때만) ──
  if (!isSamePerson && customerName) {
    const senderPhone = customerPhone ? ` ${customerPhone}` : ''
    lines.push(`■ 보내는분 : ${customerName}${senderPhone}`)
  }

  // ── 도매방 (맨 마지막) ──
  if (data.wholesaleChannelName) {
    lines.push('')
    lines.push(`■ 도매방 : ${data.wholesaleChannelName}`)
  }

  return lines.join('\n')
}
