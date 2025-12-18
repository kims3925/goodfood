import prisma from '@bandauto/db'

/**
 * Shop App 알림 생성 서비스
 * 주문, 취소, 환불, 문의 이벤트 발생 시 알림 생성
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

/**
 * 신규 주문 알림 생성
 */
export async function createOrderNotification(
  userId: number,
  shopId: number,
  order: OrderInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
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
  userId: number,
  shopId: number,
  order: OrderInfo
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
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
  userId: number,
  shopId: number,
  returnRequest: ReturnInfo
): Promise<void> {
  try {
    const typeLabel = returnRequest.type === 'RETURN' ? '반품' :
                      returnRequest.type === 'EXCHANGE' ? '교환' : '취소'

    await prisma.notification.create({
      data: {
        userId,
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
  userId: number,
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
        userId,
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
