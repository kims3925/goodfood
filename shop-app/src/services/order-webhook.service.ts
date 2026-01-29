/**
 * Order Webhook Service
 * 주문 생성 및 결제 완료 시 슬랙/디스코드 웹훅으로 알림 전송
 */

// ============================================
// Types
// ============================================

export interface WebhookOrderItem {
  name: string
  quantity: number
  options?: string // 옵션 정보 (예: "색상: 블랙 / 사이즈: L")
}

export interface WebhookMessage {
  title: string
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  paymentMethod?: string
  paymentStatus?: string // 결제상태 (무통장입금 등에서 사용)
  createdAt: Date
  isExternal?: boolean // 외부 주문 여부
  // 추가 정보
  phone?: string // 연락처
  address?: string // 배송지 주소
  memo?: string // 요청사항
  // 취소 관련
  isCancellation?: boolean
  orderNumber?: string
  cancelReason?: string
  cancelledBy?: string
}

type WebhookType = 'slack' | 'discord'

// ============================================
// Slack/Discord Message Formatters
// ============================================

/**
 * 슬랙 Block Kit 메시지 포맷
 */
function formatSlackMessage(message: WebhookMessage): object {
  const itemsList = message.items
    .map((item) => {
      const line = `• ${item.name} x ${item.quantity}`
      return item.options ? `${line}\n  └ 옵션: ${item.options}` : line
    })
    .join('\n')

  const isCancellation = message.isCancellation === true
  const orderType = message.isExternal ? '외부 주문' : '새로운 주문'
  const emoji = isCancellation ? '❌' : message.isExternal ? '📝' : '🛒'

  const sectionFields: any[] = isCancellation
    ? [
        {
          type: 'mrkdwn',
          text: `*주문번호:*\n${message.orderNumber || '-'}`,
        },
        {
          type: 'mrkdwn',
          text: `*고객명:*\n${message.customerName}`,
        },
        {
          type: 'mrkdwn',
          text: `*취소금액:*\n${message.totalAmount.toLocaleString()}원`,
        },
        {
          type: 'mrkdwn',
          text: `*취소사유:*\n${message.cancelReason || '-'}`,
        },
      ]
    : [
        {
          type: 'mrkdwn',
          text: `*고객명:*\n${message.customerName}`,
        },
        {
          type: 'mrkdwn',
          text: `*연락처:*\n${message.phone || '-'}`,
        },
        {
          type: 'mrkdwn',
          text: `*결제금액:*\n${message.totalAmount.toLocaleString()}원`,
        },
        {
          type: 'mrkdwn',
          text: `*주문유형:*\n${orderType}`,
        },
      ]

  const itemsLabel = isCancellation ? '📦 취소 상품:' : '📦 주문 상품:'

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${message.title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: sectionFields,
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${itemsLabel}*\n${itemsList}`,
      },
    },
  ]

  // 배송지 주소
  if (message.address) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🏠 배송지:*\n${message.address}`,
      },
    })
  }

  // 요청사항
  if (message.memo) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 요청사항:*\n${message.memo}`,
      },
    })
  }

  // context 정보
  const contextParts: string[] = []
  if (isCancellation) {
    const cancellerLabel = message.cancelledBy === 'GUEST' ? '비회원 고객' : '고객'
    contextParts.push(`취소자: ${cancellerLabel}`)
    if (message.phone) {
      contextParts.push(`연락처: ${message.phone}`)
    }
  } else {
    if (message.paymentMethod) {
      contextParts.push(`결제수단: ${message.paymentMethod}`)
    }
    if (message.paymentStatus) {
      contextParts.push(`결제상태: ${message.paymentStatus}`)
    }
  }
  if (contextParts.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: contextParts.join(' | '),
        },
      ],
    })
  }

  blocks.push({ type: 'divider' })

  return { blocks }
}

/**
 * 디스코드 Embed 메시지 포맷
 */
function formatDiscordMessage(message: WebhookMessage): object {
  const itemsList = message.items
    .map((item) => {
      const line = `• ${item.name} x ${item.quantity}`
      return item.options ? `${line}\n  └ 옵션: ${item.options}` : line
    })
    .join('\n')

  const isCancellation = message.isCancellation === true
  const orderType = message.isExternal ? '외부 주문' : '새로운 주문'

  // 취소: 빨간색, 외부 주문: 파란색, 일반 주문: 녹색
  const color = isCancellation ? 0xff0000 : message.isExternal ? 0x3498db : 0x00ff00

  const fields: any[] = isCancellation
    ? [
        {
          name: '주문번호',
          value: message.orderNumber || '-',
          inline: true,
        },
        {
          name: '고객명',
          value: message.customerName,
          inline: true,
        },
        {
          name: '취소금액',
          value: `${message.totalAmount.toLocaleString()}원`,
          inline: true,
        },
        {
          name: '취소사유',
          value: message.cancelReason || '-',
          inline: true,
        },
        {
          name: '취소자',
          value: message.cancelledBy === 'GUEST' ? '비회원 고객' : '고객',
          inline: true,
        },
        {
          name: '📦 취소 상품',
          value: itemsList || '상품 정보 없음',
          inline: false,
        },
      ]
    : [
        {
          name: '고객명',
          value: message.customerName,
          inline: true,
        },
        {
          name: '연락처',
          value: message.phone || '-',
          inline: true,
        },
        {
          name: '결제금액',
          value: `${message.totalAmount.toLocaleString()}원`,
          inline: true,
        },
        {
          name: '주문유형',
          value: orderType,
          inline: true,
        },
        {
          name: '📦 주문 상품',
          value: itemsList || '상품 정보 없음',
          inline: false,
        },
      ]

  // 배송지 주소
  if (message.address) {
    fields.push({
      name: '🏠 배송지',
      value: message.address,
      inline: false,
    })
  }

  // 요청사항
  if (message.memo) {
    fields.push({
      name: '📝 요청사항',
      value: message.memo,
      inline: false,
    })
  }

  // 결제수단
  if (message.paymentMethod) {
    fields.push({
      name: '결제수단',
      value: message.paymentMethod,
      inline: true,
    })
  }

  // 결제상태 (무통장입금 등)
  if (message.paymentStatus) {
    fields.push({
      name: '결제상태',
      value: message.paymentStatus,
      inline: true,
    })
  }

  return {
    embeds: [
      {
        title: message.title,
        color,
        fields,
        timestamp: message.createdAt.toISOString(),
        footer: {
          text: 'BandAuto 주문 알림',
        },
      },
    ],
  }
}

// ============================================
// Webhook Sender
// ============================================

/**
 * 웹훅 URL과 타입 가져오기
 */
function getWebhookConfig(): { url: string | null; type: WebhookType } {
  const url = process.env.ORDER_WEBHOOK_URL || null
  const type = (process.env.ORDER_WEBHOOK_TYPE as WebhookType) || 'slack'
  return { url, type }
}

/**
 * 주문 웹훅 전송
 * 실패 시 에러 로깅만 하고 메인 로직을 블로킹하지 않음
 */
export async function sendOrderWebhook(message: WebhookMessage): Promise<void> {
  const { url, type } = getWebhookConfig()

  if (!url) {
    // 웹훅 URL이 설정되지 않은 경우 조용히 무시
    return
  }

  try {
    const payload =
      type === 'discord'
        ? formatDiscordMessage(message)
        : formatSlackMessage(message)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(
        `[OrderWebhook] 웹훅 전송 실패: ${response.status} ${response.statusText}`
      )
    }
  } catch (error) {
    console.error('[OrderWebhook] 웹훅 전송 오류:', error)
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * 주문 생성 시 웹훅 전송
 */
export async function sendOrderCreatedWebhook(params: {
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  isExternal?: boolean
  phone?: string
  address?: string
  memo?: string
}): Promise<void> {
  const message: WebhookMessage = {
    title: params.isExternal
      ? '외부 주문이 등록되었습니다!'
      : '새로운 주문이 접수되었습니다!',
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    createdAt: new Date(),
    isExternal: params.isExternal,
    phone: params.phone,
    address: params.address,
    memo: params.memo,
  }

  await sendOrderWebhook(message)
}

/**
 * 결제 완료 시 웹훅 전송
 */
export async function sendPaymentCompletedWebhook(params: {
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  paymentMethod: string
  phone?: string
  address?: string
  memo?: string
}): Promise<void> {
  const message: WebhookMessage = {
    title: '결제가 완료되었습니다!',
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    paymentMethod: params.paymentMethod,
    createdAt: new Date(),
    phone: params.phone,
    address: params.address,
    memo: params.memo,
  }

  await sendOrderWebhook(message)
}

/**
 * 주문 취소 시 웹훅 전송
 */
export async function sendOrderCancelledWebhook(params: {
  orderNumber: string
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  cancelReason: string
  cancelledBy: string
  phone?: string
}): Promise<void> {
  const message: WebhookMessage = {
    title: '주문이 취소되었습니다',
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    createdAt: new Date(),
    isCancellation: true,
    orderNumber: params.orderNumber,
    cancelReason: params.cancelReason,
    cancelledBy: params.cancelledBy,
    phone: params.phone,
  }

  await sendOrderWebhook(message)
}

/**
 * 무통장입금(가상계좌) 주문 등록 시 웹훅 전송
 */
export async function sendBankTransferOrderWebhook(params: {
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  bankName?: string
  accountNumber?: string
  dueDate?: string
  phone?: string
  address?: string
  memo?: string
}): Promise<void> {
  const bankInfo = params.bankName && params.accountNumber
    ? `${params.bankName} ${params.accountNumber}${params.dueDate ? ` (${params.dueDate}까지)` : ''}`
    : '가상계좌'

  const message: WebhookMessage = {
    title: '주문이 등록되었습니다!',
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    paymentMethod: bankInfo,
    paymentStatus: '입금대기',
    createdAt: new Date(),
    phone: params.phone,
    address: params.address,
    memo: params.memo,
  }

  await sendOrderWebhook(message)
}
