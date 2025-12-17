import prisma from '@bandauto/db'

/**
 * 쇼핑몰 알림 생성 서비스
 * 주문, 취소, 환불, 문의, 정산 이벤트 발생 시 알림 생성
 */

interface OrderInfo {
  id: number
  orderNumber: string
  totalAmount?: number
  customerName?: string
}

interface InquiryInfo {
  id: number
  title?: string
  type?: string
  customerName?: string
}

interface ReturnInfo {
  id: number
  orderNumber?: string
  type?: string // CANCEL, RETURN, EXCHANGE
  customerName?: string
}

interface SettlementInfo {
  id: number
  periodStart?: Date
  periodEnd?: Date
  totalAmount?: number
}

/**
 * 신규 주문 알림 생성
 */
export async function createOrderNotification(
  shopId: number,
  order: OrderInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        shopId,
        section: 'shop',
        type: 'ORDER',
        title: '새로운 주문이 접수되었습니다',
        message: `주문번호 ${order.orderNumber}${order.customerName ? ` (${order.customerName})` : ''}${order.totalAmount ? ` - ${order.totalAmount.toLocaleString()}원` : ''}`,
        link: `/shop/order/detail/${order.id}`,
        orderId: order.id,
      },
    })
  } catch (error) {
    console.error('[Notification] 주문 알림 생성 실패:', error)
  }
}

/**
 * 주문 취소 요청 알림 생성
 */
export async function createCancelNotification(
  shopId: number,
  order: OrderInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        shopId,
        section: 'shop',
        type: 'CANCEL',
        title: '주문 취소 요청이 접수되었습니다',
        message: `주문번호 ${order.orderNumber}${order.customerName ? ` (${order.customerName})` : ''} 취소 요청`,
        link: `/shop/order/detail/${order.id}`,
        orderId: order.id,
      },
    })
  } catch (error) {
    console.error('[Notification] 취소 알림 생성 실패:', error)
  }
}

/**
 * 환불/반품 요청 알림 생성
 */
export async function createRefundNotification(
  shopId: number,
  returnRequest: ReturnInfo
): Promise<void> {
  try {
    const typeLabel = returnRequest.type === 'RETURN' ? '반품' :
                      returnRequest.type === 'EXCHANGE' ? '교환' : '취소'

    await prisma.notification.create({
      data: {
        shopId,
        section: 'shop',
        type: 'REFUND',
        title: `${typeLabel} 요청이 접수되었습니다`,
        message: `${returnRequest.orderNumber ? `주문번호 ${returnRequest.orderNumber}` : ''}${returnRequest.customerName ? ` (${returnRequest.customerName})` : ''} ${typeLabel} 요청`,
        link: `/shop/order/list?tab=returns`,
        returnRequestId: returnRequest.id,
      },
    })
  } catch (error) {
    console.error('[Notification] 환불 알림 생성 실패:', error)
  }
}

/**
 * 신규 문의 알림 생성
 */
export async function createInquiryNotification(
  shopId: number,
  inquiry: InquiryInfo
): Promise<void> {
  try {
    const typeLabels: Record<string, string> = {
      PRODUCT: '상품',
      DELIVERY: '배송',
      ORDER: '주문',
      PAYMENT: '결제',
      RETURN: '반품',
      EXCHANGE: '교환',
      GENERAL: '일반',
    }
    const typeLabel = inquiry.type ? typeLabels[inquiry.type] || '일반' : '일반'

    await prisma.notification.create({
      data: {
        shopId,
        section: 'shop',
        type: 'INQUIRY',
        title: '새로운 문의가 등록되었습니다',
        message: `[${typeLabel}] ${inquiry.title || '문의'}${inquiry.customerName ? ` - ${inquiry.customerName}` : ''}`,
        link: `/shop/cs/inquiry/${inquiry.id}`,
        inquiryId: inquiry.id,
      },
    })
  } catch (error) {
    console.error('[Notification] 문의 알림 생성 실패:', error)
  }
}

/**
 * 정산 완료 알림 생성
 */
export async function createSettlementNotification(
  shopId: number,
  settlement: SettlementInfo
): Promise<void> {
  try {
    const formatDate = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    const periodText = settlement.periodStart && settlement.periodEnd
      ? `${formatDate(settlement.periodStart)} ~ ${formatDate(settlement.periodEnd)}`
      : ''

    await prisma.notification.create({
      data: {
        shopId,
        section: 'shop',
        type: 'SETTLEMENT',
        title: '정산이 완료되었습니다',
        message: `${periodText}${settlement.totalAmount ? ` 정산금액: ${settlement.totalAmount.toLocaleString()}원` : ''}`,
        link: `/shop/settlement/list`,
        settlementId: settlement.id,
      },
    })
  } catch (error) {
    console.error('[Notification] 정산 알림 생성 실패:', error)
  }
}

// ===== 소싱 알림 생성 함수 =====

interface CollectInfo {
  channelName?: string
  collectCount?: number
  workflowRunId?: number
}

interface TransformInfo {
  productCount?: number
  successCount?: number
  failCount?: number
  workflowRunId?: number
}

interface PublishInfo {
  shopName?: string
  productCount?: number
  successCount?: number
  failCount?: number
  workflowRunId?: number
}

interface ErrorInfo {
  errorType?: string
  errorMessage?: string
  workflowRunId?: number
}

/**
 * 수집 완료 알림 생성
 */
export async function createCollectNotification(
  info: CollectInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'COLLECT',
        title: '상품 수집이 완료되었습니다',
        message: `${info.channelName ? `[${info.channelName}] ` : ''}${info.collectCount || 0}개 상품 수집 완료`,
        link: '/sourcing/automation/logs',
      },
    })
  } catch (error) {
    console.error('[Notification] 수집 알림 생성 실패:', error)
  }
}

/**
 * AI 변환 완료 알림 생성
 */
export async function createTransformNotification(
  info: TransformInfo
): Promise<void> {
  try {
    const successText = info.successCount !== undefined ? `성공 ${info.successCount}개` : ''
    const failText = info.failCount && info.failCount > 0 ? `, 실패 ${info.failCount}개` : ''

    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'TRANSFORM',
        title: 'AI 변환이 완료되었습니다',
        message: `${info.productCount || 0}개 상품 변환 완료${successText || failText ? ` (${successText}${failText})` : ''}`,
        link: '/sourcing/automation/logs',
      },
    })
  } catch (error) {
    console.error('[Notification] AI변환 알림 생성 실패:', error)
  }
}

/**
 * 발행 완료 알림 생성
 */
export async function createPublishNotification(
  info: PublishInfo
): Promise<void> {
  try {
    const successText = info.successCount !== undefined ? `성공 ${info.successCount}개` : ''
    const failText = info.failCount && info.failCount > 0 ? `, 실패 ${info.failCount}개` : ''

    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'PUBLISH',
        title: '상품 발행이 완료되었습니다',
        message: `${info.shopName ? `[${info.shopName}] ` : ''}${info.productCount || 0}개 상품 발행 완료${successText || failText ? ` (${successText}${failText})` : ''}`,
        link: '/sourcing/automation/logs',
      },
    })
  } catch (error) {
    console.error('[Notification] 발행 알림 생성 실패:', error)
  }
}

/**
 * 오류 알림 생성
 */
export async function createErrorNotification(
  info: ErrorInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'ERROR',
        title: `오류가 발생했습니다${info.errorType ? ` (${info.errorType})` : ''}`,
        message: info.errorMessage || '작업 중 오류가 발생했습니다. 확인해주세요.',
        link: '/sourcing/automation/logs',
      },
    })
  } catch (error) {
    console.error('[Notification] 오류 알림 생성 실패:', error)
  }
}

/**
 * 일반 정보 알림 생성
 */
export async function createInfoNotification(
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        section: 'sourcing',
        type: 'INFO',
        title,
        message,
        link,
      },
    })
  } catch (error) {
    console.error('[Notification] 정보 알림 생성 실패:', error)
  }
}

/**
 * 알림 읽음 처리
 */
export async function markNotificationsAsRead(ids: number[]): Promise<number> {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })
    return result.count
  } catch (error) {
    console.error('[Notification] 읽음 처리 실패:', error)
    throw error
  }
}

/**
 * 알림 삭제
 */
export async function deleteNotifications(ids: number[]): Promise<number> {
  try {
    const result = await prisma.notification.deleteMany({
      where: { id: { in: ids } },
    })
    return result.count
  } catch (error) {
    console.error('[Notification] 삭제 실패:', error)
    throw error
  }
}
