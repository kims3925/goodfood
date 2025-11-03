import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { getTossPaymentsService, TossPaymentResponse, PAYMENT_STATUS } from './toss-payments'

export interface WebhookEvent {
  eventType: string
  createdAt: string
  data: TossPaymentResponse
}

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
        case 'PAYMENT_STATUS_CHANGED':
          return await this.handlePaymentStatusChanged(event.data)
        
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

      // 주문 조회
      const order = await prisma.order.findUnique({
        where: { orderNumber: orderId },
        include: {
          customer: true,
          product: true,
          payments: true
        }
      })

      if (!order) {
        console.error('주문을 찾을 수 없습니다:', orderId)
        return { success: false, message: '주문을 찾을 수 없음' }
      }

      // 결제 정보 업데이트 또는 생성
      await this.updateOrCreatePayment(order.id, paymentData)

      // 주문 상태 업데이트
      await this.updateOrderStatus(order.id, status, totalAmount)

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
   * 결제 정보 업데이트 또는 생성
   */
  private async updateOrCreatePayment(orderId: string, paymentData: TossPaymentResponse) {
    const { paymentKey, method, status, totalAmount, approvedAt, failure } = paymentData

    // 토스페이먼츠 결제 수단 확인 (없으면 생성)
    let paymentMethod = await prisma.paymentMethod.findFirst({
      where: { name: '토스페이먼츠' }
    })

    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          name: '토스페이먼츠',
          config: JSON.stringify({ provider: 'tosspayments' })
        }
      })
    }

    // 기존 결제 정보 확인
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        orderId,
        paymentKey 
      }
    })

    if (existingPayment) {
      // 업데이트
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status,
          approvedAt: approvedAt ? new Date(approvedAt) : null,
          failReason: failure?.message || null,
          webhookData: JSON.stringify(paymentData),
          updatedAt: new Date()
        }
      })
    } else {
      // 새로 생성
      await prisma.payment.create({
        data: {
          orderId,
          paymentKey,
          method,
          amount: totalAmount,
          status,
          approvedAt: approvedAt ? new Date(approvedAt) : null,
          failReason: failure?.message || null,
          webhookData: JSON.stringify(paymentData),
          paymentMethodId: paymentMethod.id
        }
      })
    }
  }

  /**
   * 주문 상태 업데이트
   */
  private async updateOrderStatus(orderId: string, paymentStatus: string, amount: number) {
    let orderPaymentStatus = 'PENDING'
    let orderStatus = 'PENDING'

    switch (paymentStatus) {
      case PAYMENT_STATUS.DONE:
        orderPaymentStatus = 'PAID'
        orderStatus = 'CONFIRMED'
        break
      case PAYMENT_STATUS.CANCELED:
      case PAYMENT_STATUS.ABORTED:
      case PAYMENT_STATUS.EXPIRED:
        orderPaymentStatus = 'FAILED'
        orderStatus = 'CANCELED'
        break
      case PAYMENT_STATUS.WAITING_FOR_DEPOSIT:
        orderPaymentStatus = 'PENDING'
        orderStatus = 'PAYMENT_WAITING'
        break
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: orderPaymentStatus,
        status: orderStatus,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 결제 완료 후처리
   */
  private async handlePaymentCompleted(orderId: string, paymentData: TossPaymentResponse) {
    try {
      console.log(`결제 완료 처리 시작: ${orderId}`)

      // 1. 재고 차감 (필요시)
      // await this.deductInventory(orderId)

      // 2. 고객 알림 발송
      await this.sendPaymentCompletionNotification(orderId)

      // 3. 관리자 알림
      await this.sendAdminNotification(orderId, '새로운 주문이 결제 완료되었습니다.')

      // 4. 도매업체 발주 시스템 연동 (기존 시스템 활용)
      await this.triggerWholesaleOrder(orderId)

      console.log(`결제 완료 처리 완료: ${orderId}`)

    } catch (error) {
      console.error('결제 완료 후처리 오류:', error)
      // 에러가 발생해도 웹훅은 성공으로 응답 (중복 처리 방지)
    }
  }

  /**
   * 결제 실패 후처리
   */
  private async handlePaymentFailed(orderId: string, paymentData: TossPaymentResponse) {
    try {
      console.log(`결제 실패 처리: ${orderId}`)

      // 1. 고객에게 결제 실패 알림
      await this.sendPaymentFailureNotification(orderId, paymentData.failure?.message)

      // 2. 관리자에게 알림
      await this.sendAdminNotification(orderId, `결제 실패: ${paymentData.failure?.message}`)

    } catch (error) {
      console.error('결제 실패 후처리 오류:', error)
    }
  }

  /**
   * 고객에게 결제 완료 알림 발송
   */
  private async sendPaymentCompletionNotification(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          product: true
        }
      })

      if (!order || !order.customer.email) return

      // 이메일 발송 (기존 이메일 서비스 활용)
      // TODO: 이메일 발송 로직 구현

      console.log(`결제 완료 알림 발송: ${order.customer.email}`)

    } catch (error) {
      console.error('결제 완료 알림 발송 오류:', error)
    }
  }

  /**
   * 고객에게 결제 실패 알림 발송
   */
  private async sendPaymentFailureNotification(orderId: string, failureReason?: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { customer: true }
      })

      if (!order || !order.customer.email) return

      // 실패 알림 발송
      console.log(`결제 실패 알림 발송: ${order.customer.email}, 사유: ${failureReason}`)

    } catch (error) {
      console.error('결제 실패 알림 발송 오류:', error)
    }
  }

  /**
   * 관리자에게 알림 발송
   */
  private async sendAdminNotification(orderId: string, message: string) {
    try {
      // 관리자 이메일이나 슬랙 등으로 알림
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
   * 도매업체 자동 발주 시스템 연동
   */
  private async triggerWholesaleOrder(orderId: string) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          product: true,
          customer: true
        }
      })

      if (!order) return

      // 기존 주문 관리 시스템과 연동
      // TODO: 자동 발주서 생성 로직 구현
      console.log(`도매업체 발주 요청: ${order.product.title} x ${order.quantity}개`)

    } catch (error) {
      console.error('도매업체 발주 연동 오류:', error)
    }
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