/**
 * 카톡 발주용 주문 텍스트 생성 유틸리티
 *
 * 주문 상세 정보를 카카오톡으로 복사하여 도매처에 발주할 수 있는
 * 텍스트 형식으로 변환합니다.
 */

export interface OrderTextItem {
  productName: string
  optionSummary: string | null
  quantity: number
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
}

/**
 * 주문 정보를 카톡 발주용 텍스트로 변환
 */
export function generateOrderText(data: OrderTextData): string {
  const lines: string[] = []

  // 헤더
  lines.push('=============================')
  lines.push(`[발주] ${data.orderNumber}`)
  if (data.wholesaleChannelName) {
    lines.push(`도매처: ${data.wholesaleChannelName}`)
  }
  lines.push('=============================')
  lines.push('')

  // 상품 정보
  lines.push('■ 상품정보')
  data.items.forEach((item, index) => {
    const num = data.items.length > 1 ? `${index + 1}. ` : ''
    lines.push(`${num}${item.productName}`)
    if (item.optionSummary) {
      lines.push(`  옵션: ${item.optionSummary}`)
    }
    lines.push(`  수량: ${item.quantity}개`)
    if (index < data.items.length - 1) lines.push('')
  })

  lines.push('')

  // 배송 정보
  lines.push('■ 배송정보')
  lines.push(`수령인: ${data.shipping.recipientName}`)
  lines.push(`연락처: ${data.shipping.recipientPhone}`)
  lines.push(`주소: [${data.shipping.postalCode}] ${data.shipping.address}${data.shipping.addressDetail ? ` ${data.shipping.addressDetail}` : ''}`)
  if (data.shipping.deliveryMemo) {
    lines.push(`배송메모: ${data.shipping.deliveryMemo}`)
  }

  lines.push('')
  lines.push('=============================')

  return lines.join('\n')
}
