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
}

export interface WebhookMessage {
  title: string
  orderNumber: string
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  paymentMethod?: string
  paymentStatus?: string
  createdAt: Date
  isExternal?: boolean // 외부 주문 여부
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
    .map((item) => `• ${item.name} x ${item.quantity}`)
    .join('\n')

  const orderType = message.isExternal ? '외부 주문' : '새로운 주문'
  const emoji = message.isExternal ? '📝' : '🛒'

  return {
    blocks: [
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
        fields: [
          {
            type: 'mrkdwn',
            text: `*주문번호:*\n${message.orderNumber}`,
          },
          {
            type: 'mrkdwn',
            text: `*고객명:*\n${message.customerName}`,
          },
          {
            type: 'mrkdwn',
            text: `*결제금액:*\n${message.totalAmount.toLocaleString()}원`,
          },
          {
            type: 'mrkdwn',
            text: `*주문유형:*\n${orderType}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📦 주문 상품:*\n${itemsList}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `결제상태: ${message.paymentStatus || '대기'}${message.paymentMethod ? ` | 결제수단: ${message.paymentMethod}` : ''}`,
          },
        ],
      },
      {
        type: 'divider',
      },
    ],
  }
}

/**
 * 디스코드 Embed 메시지 포맷
 */
function formatDiscordMessage(message: WebhookMessage): object {
  const itemsList = message.items
    .map((item) => `• ${item.name} x ${item.quantity}`)
    .join('\n')

  const orderType = message.isExternal ? '외부 주문' : '새로운 주문'

  // 외부 주문: 파란색, 일반 주문: 녹색
  const color = message.isExternal ? 0x3498db : 0x00ff00

  return {
    embeds: [
      {
        title: message.title,
        color,
        fields: [
          {
            name: '주문번호',
            value: message.orderNumber,
            inline: true,
          },
          {
            name: '고객명',
            value: message.customerName,
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
          {
            name: '결제상태',
            value: `${message.paymentStatus || '대기'}${message.paymentMethod ? ` (${message.paymentMethod})` : ''}`,
            inline: true,
          },
        ],
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
  orderNumber: string
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  isExternal?: boolean
}): Promise<void> {
  const message: WebhookMessage = {
    title: params.isExternal
      ? '외부 주문이 등록되었습니다!'
      : '새로운 주문이 접수되었습니다!',
    orderNumber: params.orderNumber,
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    paymentStatus: params.isExternal ? '계좌이체 대기' : '결제 대기',
    createdAt: new Date(),
    isExternal: params.isExternal,
  }

  await sendOrderWebhook(message)
}

/**
 * 결제 완료 시 웹훅 전송
 */
export async function sendPaymentCompletedWebhook(params: {
  orderNumber: string
  customerName: string
  totalAmount: number
  items: WebhookOrderItem[]
  paymentMethod: string
}): Promise<void> {
  const message: WebhookMessage = {
    title: '결제가 완료되었습니다!',
    orderNumber: params.orderNumber,
    customerName: params.customerName,
    totalAmount: params.totalAmount,
    items: params.items,
    paymentMethod: params.paymentMethod,
    paymentStatus: '결제완료',
    createdAt: new Date(),
  }

  await sendOrderWebhook(message)
}
