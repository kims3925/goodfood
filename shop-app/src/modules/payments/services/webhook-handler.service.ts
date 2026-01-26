import { NextRequest } from 'next/server'
import prisma, { Prisma } from '@bandauto/db'
import { getTossPaymentsService, TossPaymentResponse, PAYMENT_STATUS } from './toss-payments.service'
import { sendPaymentCompletedWebhook } from '@/services/order-webhook.service'

const Decimal = Prisma.Decimal

export interface WebhookEvent {
  eventType: string
  createdAt: string
  data: TossPaymentResponse
}

// 웹훅 이벤트 타입
export const WEBHOOK_EVENT_TYPES = {
  PAYMENT_STATUS_CHANGED: 'PAYMENT_STATUS_CHANGED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_CANCELED: 'PAYMENT_CANCELED',
  VIRTUAL_ACCOUNT_ISSUED: 'VIRTUAL_ACCOUNT_ISSUED',
  VIRTUAL_ACCOUNT_DEPOSIT: 'VIRTUAL_ACCOUNT_DEPOSIT',
} as const

/**
 * 토스페이먼츠 웹훅 이벤트 처리기
 */
export class TossPaymentsWebhookHandler {
  private async getTossService() {
    return await getTossPaymentsService()
  }

  /**
   * 웹훅 이벤트 처리 메인 함수
   */
  async handleWebhook(request: NextRequest): Promise<{ success: boolean; message: string }> {
    try {
      const body = await request.text()
      const signature = request.headers.get('x-tosspayments-signature') || ''

      // 웹훅 서명 검증
      const tossService = await this.getTossService()
      if (!tossService.verifyWebhookSignature(body, signature)) {
        console.error('웹훅 서명 검증 실패')
        return { success: false, message: '서명 검증 실패' }
      }

      const event: WebhookEvent = JSON.parse(body)
      console.log('웹훅 이벤트 수신:', event.eventType, event.data.orderId)

      // 이벤트 타입별 처리
      switch (event.eventType) {
        case WEBHOOK_EVENT_TYPES.PAYMENT_STATUS_CHANGED:
          return await this.handlePaymentStatusChanged(event.data)

        case WEBHOOK_EVENT_TYPES.VIRTUAL_ACCOUNT_DEPOSIT:
          return await this.handleVirtualAccountDeposit(event.data)

        case WEBHOOK_EVENT_TYPES.PAYMENT_CANCELED:
          return await this.handlePaymentCanceled(event.data)

        default:
          console.log('처리되지 않는 웹훅 이벤트:', event.eventType)
          return { success: true, message: '이벤트 무시' }
      }

    } catch (error) {
      console.error('웹훅 처리 오류:', error)
      return { success: false, message: '웹훅 처리 실패' }
    }
  }

  /**
   * 결제 상태 변경 이벤트 처리
   */
  private async handlePaymentStatusChanged(paymentData: TossPaymentResponse): Promise<{ success: boolean; message: string }> {
    try {
      const { paymentKey, orderId, status, totalAmount } = paymentData

      // 주문 조회 (현재 스키마에 맞게)
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        include: {
          user: true,
          items: true,
          payment: true
        }
      })

      if (!order) {
        console.error('주문을 찾을 수 없습니다:', orderId)
        return { success: false, message: '주문을 찾을 수 없음' }
      }

      // 결제 정보 업데이트 또는 생성
      await this.updateOrCreatePayment(order.id, paymentData)

      // 주문 상태 업데이트
      await this.updateOrderStatus(order.id, status)

      // 결제 완료 시 후처리
      if (status === PAYMENT_STATUS.DONE) {
        await this.handlePaymentCompleted(order.id, paymentData)
      }

      // 결제 실패/취소 시 후처리
      if ([PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.ABORTED, PAYMENT_STATUS.EXPIRED].includes(status as any)) {
        await this.handlePaymentFailed(order.id, paymentData)
      }

      return { success: true, message: '결제 상태 업데이트 완료' }

    } catch (error) {
      console.error('결제 상태 변경 처리 오류:', error)
      return { success: false, message: '결제 상태 처리 실패' }
    }
  }

  /**
   * 가상계좌 입금 처리
   */
  private async handleVirtualAccountDeposit(paymentData: TossPaymentResponse): Promise<{ success: boolean; message: string }> {
    try {
      const { orderId, status, totalAmount } = paymentData

      console.log('가상계좌 입금 확인:', orderId, totalAmount)

      // 주문 조회
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        include: {
          user: true,
          payment: true
        }
      })

      if (!order) {
        console.error('주문을 찾을 수 없습니다:', orderId)
        return { success: false, message: '주문을 찾을 수 없음' }
      }

      // 결제 정보 업데이트
      if (order.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'DONE',
            approvedAt: new Date(),
            rawResponse: JSON.stringify(paymentData)
          }
        })
      }

      // 주문 상태 업데이트
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      })

      // 입금 완료 후처리
      await this.handlePaymentCompleted(order.id, paymentData)

      return { success: true, message: '가상계좌 입금 처리 완료' }

    } catch (error) {
      console.error('가상계좌 입금 처리 오류:', error)
      return { success: false, message: '가상계좌 입금 처리 실패' }
    }
  }

  /**
   * 결제 취소 이벤트 처리
   */
  private async handlePaymentCanceled(paymentData: TossPaymentResponse): Promise<{ success: boolean; message: string }> {
    try {
      const { orderId, status, cancels } = paymentData

      console.log('결제 취소 웹훅:', orderId)

      // 주문 조회
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        include: {
          payment: true
        }
      })

      if (!order || !order.payment) {
        console.error('주문 또는 결제 정보를 찾을 수 없습니다:', orderId)
        return { success: false, message: '주문을 찾을 수 없음' }
      }

      // 취소 금액 계산
      const totalCancelledAmount = cancels?.reduce((sum: number, cancel: any) => sum + cancel.cancelAmount, 0) || 0

      // 결제 정보 업데이트
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: status === 'CANCELED' ? 'CANCELED' : 'PARTIAL_CANCELED',
          cancelledAmount: new Decimal(totalCancelledAmount),
          cancelledAt: new Date(),
          rawResponse: JSON.stringify(paymentData)
        }
      })

      // 주문 상태 업데이트 (전액 취소 시에만 CANCELLED로 변경)
      if (status === 'CANCELED') {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })
      }

      return { success: true, message: '결제 취소 처리 완료' }

    } catch (error) {
      console.error('결제 취소 처리 오류:', error)
      return { success: false, message: '결제 취소 처리 실패' }
    }
  }

  /**
   * 결제 정보 업데이트 또는 생성
   */
  private async updateOrCreatePayment(orderId: number, paymentData: TossPaymentResponse) {
    const { paymentKey, method, status, totalAmount, approvedAt, failure, virtualAccount, card } = paymentData

    const paymentDataToSave = {
      paymentKey,
      tossOrderId: paymentData.orderId,
      method: this.mapPaymentMethod(method),
      status: this.mapPaymentStatus(status),
      amount: new Decimal(totalAmount),
      virtualAccountNumber: virtualAccount?.accountNumber || null,
      virtualAccountBank: virtualAccount?.bank || null,
      virtualAccountDueDate: virtualAccount?.dueDate ? new Date(virtualAccount.dueDate) : null,
      cardCompany: card?.company || null,
      cardNumber: card?.number || null,
      installmentMonth: card?.installmentPlanMonths || 0,
      approvedAt: approvedAt ? new Date(approvedAt) : null,
      cancelReason: failure?.message || null,
      rawResponse: JSON.stringify(paymentData),
    }

    // upsert로 결제 정보 저장
    await prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        ...paymentDataToSave
      },
      update: paymentDataToSave
    })
  }

  /**
   * 주문 상태 업데이트
   */
  private async updateOrderStatus(orderId: number, paymentStatus: string) {
    let orderStatus: string = 'PENDING'

    switch (paymentStatus) {
      case PAYMENT_STATUS.DONE:
        orderStatus = 'PAID'
        break
      case PAYMENT_STATUS.CANCELED:
        orderStatus = 'CANCELLED'
        break
      case PAYMENT_STATUS.PARTIAL_CANCELED:
        // 부분 취소 시 주문 상태는 PAID 유지
        orderStatus = 'PAID'
        break
      case PAYMENT_STATUS.ABORTED:
      case PAYMENT_STATUS.EXPIRED:
        orderStatus = 'CANCELLED'
        break
      case PAYMENT_STATUS.WAITING_FOR_DEPOSIT:
        orderStatus = 'PENDING'
        break
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: orderStatus as any,
        paidAt: paymentStatus === PAYMENT_STATUS.DONE ? new Date() : undefined,
        cancelledAt: [PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.ABORTED].includes(paymentStatus as any) ? new Date() : undefined
      }
    })
  }

  /**
   * 결제 완료 후처리
   */
  private async handlePaymentCompleted(orderId: number, paymentData: TossPaymentResponse) {
    try {
      console.log(`결제 완료 처리 시작: ${orderId}`)

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          shippingAddress: true,
          items: {
            include: {
              shopProduct: {
                include: {
                  product: true
                }
              }
            }
          }
        }
      })

      if (!order) return

      // 1. 고객 알림 발송
      await this.sendPaymentCompletionNotification(order)

      // 2. 관리자 알림
      await this.sendAdminNotification(orderId, '새로운 주문이 결제 완료되었습니다.')

      // 3. 외부 웹훅 알림 (슬랙/디스코드)
      const shippingAddr = order.shippingAddress
      const fullAddress = shippingAddr?.addressDetail
        ? `${shippingAddr.address} ${shippingAddr.addressDetail}`
        : shippingAddr?.address

      sendPaymentCompletedWebhook({
        customerName: shippingAddr?.recipientName || order.user?.name || '고객',
        totalAmount: Number(order.totalAmount),
        items: order.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          options: item.optionSummary || undefined,
        })),
        paymentMethod: this.mapPaymentMethod(paymentData.method),
        phone: shippingAddr?.recipientPhone || undefined,
        address: fullAddress || undefined,
        memo: shippingAddr?.deliveryMemo || undefined,
      })

      console.log(`결제 완료 처리 완료: ${orderId}`)

    } catch (error) {
      console.error('결제 완료 후처리 오류:', error)
    }
  }

  /**
   * 결제 실패 후처리
   */
  private async handlePaymentFailed(orderId: number, paymentData: TossPaymentResponse) {
    try {
      console.log(`결제 실패 처리: ${orderId}`)

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true }
      })

      if (!order) return

      // 1. 고객에게 결제 실패 알림
      await this.sendPaymentFailureNotification(order, paymentData.failure?.message)

      // 2. 관리자에게 알림
      await this.sendAdminNotification(orderId, `결제 실패: ${paymentData.failure?.message}`)

    } catch (error) {
      console.error('결제 실패 후처리 오류:', error)
    }
  }

  /**
   * 고객에게 결제 완료 알림 발송
   */
  private async sendPaymentCompletionNotification(order: any) {
    try {
      if (!order.user?.email) return

      // TODO: 이메일 발송 로직 구현
      console.log(`결제 완료 알림 발송: ${order.user.email}`)

    } catch (error) {
      console.error('결제 완료 알림 발송 오류:', error)
    }
  }

  /**
   * 고객에게 결제 실패 알림 발송
   */
  private async sendPaymentFailureNotification(order: any, failureReason?: string) {
    try {
      if (!order.user?.email) return

      console.log(`결제 실패 알림 발송: ${order.user.email}, 사유: ${failureReason}`)

    } catch (error) {
      console.error('결제 실패 알림 발송 오류:', error)
    }
  }

  /**
   * 관리자에게 알림 발송
   */
  private async sendAdminNotification(orderId: number, message: string) {
    try {
      const adminEmail = process.env.SHOP_ADMIN_EMAIL
      if (adminEmail) {
        console.log(`관리자 알림: ${message} (주문: ${orderId})`)
        // TODO: 관리자 이메일 발송 구현
      }
    } catch (error) {
      console.error('관리자 알림 발송 오류:', error)
    }
  }

  /**
   * 결제 수단 매핑
   */
  private mapPaymentMethod(method: string): any {
    const methodMap: Record<string, string> = {
      '카드': 'CARD',
      'CARD': 'CARD',
      '가상계좌': 'VIRTUAL_ACCOUNT',
      'VIRTUAL_ACCOUNT': 'VIRTUAL_ACCOUNT',
      '계좌이체': 'TRANSFER',
      'TRANSFER': 'TRANSFER',
      '휴대폰': 'MOBILE',
      'MOBILE': 'MOBILE',
      '문화상품권': 'CULTURE_GIFT',
      '도서문화상품권': 'BOOK_GIFT',
      '게임문화상품권': 'GAME_GIFT',
    }
    return methodMap[method] || 'CARD'
  }

  /**
   * 결제 상태 매핑
   */
  private mapPaymentStatus(status: string): any {
    const statusMap: Record<string, string> = {
      'READY': 'READY',
      'IN_PROGRESS': 'IN_PROGRESS',
      'WAITING_FOR_DEPOSIT': 'WAITING_FOR_DEPOSIT',
      'DONE': 'DONE',
      'CANCELED': 'CANCELED',
      'PARTIAL_CANCELED': 'PARTIAL_CANCELED',
      'ABORTED': 'ABORTED',
      'EXPIRED': 'EXPIRED',
    }
    return statusMap[status] || 'READY'
  }
}

// 싱글톤 인스턴스
let webhookHandlerInstance: TossPaymentsWebhookHandler | null = null

export function getWebhookHandler(): TossPaymentsWebhookHandler {
  if (!webhookHandlerInstance) {
    webhookHandlerInstance = new TossPaymentsWebhookHandler()
  }
  return webhookHandlerInstance
}
