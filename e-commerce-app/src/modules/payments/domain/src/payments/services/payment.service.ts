/**
 * Payment Service
 * 결제 비즈니스 로직 레이어
 */

import { Payment } from '@bandauto/db'
import { getTossPaymentsService } from '@/modules/payments/domain/src/payments'
import { paymentRepository, PaymentRepository } from '@/modules/payments/domain/src/payments/repository/payment.repository'
import { refundRepository, RefundRepository } from '@/modules/payments/domain/src/payments/repository/refund.repository'
import { getOrderRepository } from '@/modules/order/domain/src/orders/repository/order.repository'
import prisma from '@/modules/common/utils/src/database/client'
import {
  ConfirmPaymentDTO,
  CancelPaymentDTO,
  PaymentFilter,
  PaymentResponse,
  ConfirmPaymentResult,
  CancelPaymentResult
} from '@/types/services/payment'
import {
  ValidationError,
  NotFoundError,
  BusinessLogicError
} from '@/modules/common/utils/src/errors/handlers'

export class PaymentService {
  private orderRepository = getOrderRepository()

  constructor(
    private repository: PaymentRepository = paymentRepository,
    private refundRepo: RefundRepository = refundRepository
  ) {}

  /**
   * 결제 승인
   */
  async confirmPayment(data: ConfirmPaymentDTO): Promise<ConfirmPaymentResult> {
    // 입력값 검증
    if (!data.paymentKey) {
      throw new ValidationError('결제 키는 필수입니다')
    }

    if (!data.orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    if (!data.amount || data.amount <= 0) {
      throw new ValidationError('유효하지 않은 결제 금액입니다')
    }

    // 토스페이먼츠 서비스 인스턴스 생성
    const tossService = await getTossPaymentsService()

    // 금액 유효성 검증
    if (!tossService.validateAmount(data.amount)) {
      throw new ValidationError('유효하지 않은 결제 금액입니다')
    }

    // 주문 ID 유효성 검증
    if (!tossService.validateOrderId(data.orderId)) {
      throw new ValidationError('유효하지 않은 주문 ID입니다')
    }

    // 주문 존재 확인
    const order = await this.orderRepository.findByOrderNumber(data.orderId)

    if (!order) {
      throw new NotFoundError('주문', data.orderId)
    }

    // 주문 금액과 결제 금액 일치 확인
    if (order.totalAmount !== data.amount) {
      throw new BusinessLogicError('주문 금액과 결제 금액이 일치하지 않습니다')
    }

    // 토스페이먼츠 결제 승인 요청
    const paymentResult = await tossService.confirmPayment({
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      amount: data.amount
    })

    // 결제 수단 조회 또는 생성
    const paymentMethod = await this.getOrCreatePaymentMethod('토스페이먼츠')

    // 결제 정보를 데이터베이스에 저장
    const payment = await this.repository.create({
      order: {
        connect: { id: order.id }
      },
      paymentMethod: {
        connect: { id: paymentMethod.id }
      },
      paymentKey: data.paymentKey,
      method: paymentResult.method || 'UNKNOWN',
      amount: paymentResult.totalAmount,
      status: paymentResult.status,
      approvedAt: paymentResult.approvedAt ? new Date(paymentResult.approvedAt) : null,
      webhookData: JSON.stringify(paymentResult)
    })

    // 주문 상태 업데이트
    await this.orderRepository.updatePaymentStatus(order.id, 'PAID')
    await this.orderRepository.updateStatus(order.id, 'CONFIRMED')

    console.log('결제 승인 성공:', {
      orderId: data.orderId,
      paymentKey: data.paymentKey,
      amount: paymentResult.totalAmount
    })

    // 업데이트된 주문 조회
    const updatedOrder = await this.orderRepository.findById(order.id)

    return {
      payment: this.formatPaymentResponse(payment),
      order: {
        id: updatedOrder!.id,
        orderNumber: updatedOrder!.orderNumber,
        status: updatedOrder!.status,
        paymentStatus: updatedOrder!.paymentStatus
      },
      tossPaymentData: paymentResult
    }
  }

  /**
   * 결제 취소
   */
  async cancelPayment(data: CancelPaymentDTO): Promise<CancelPaymentResult> {
    // 입력값 검증
    if (!data.paymentKey) {
      throw new ValidationError('결제 키는 필수입니다')
    }

    if (!data.cancelReason) {
      throw new ValidationError('취소 사유는 필수입니다')
    }

    // 결제 정보 조회
    const payment = await this.repository.findByPaymentKey(data.paymentKey)

    if (!payment) {
      throw new NotFoundError('결제 정보', data.paymentKey)
    }

    // 이미 취소된 결제인지 확인
    if (payment.status === 'CANCELED') {
      throw new BusinessLogicError('이미 취소된 결제입니다')
    }

    // 취소 금액 검증 (부분 취소인 경우)
    if (data.cancelAmount !== undefined) {
      const tossService = await getTossPaymentsService()

      if (!tossService.validateAmount(data.cancelAmount)) {
        throw new ValidationError('유효하지 않은 취소 금액입니다')
      }

      if (data.cancelAmount > payment.amount) {
        throw new BusinessLogicError('취소 금액이 결제 금액을 초과합니다')
      }
    }

    // 토스페이먼츠 결제 취소 요청
    const tossService = await getTossPaymentsService()
    const cancelResult = await tossService.cancelPayment(
      data.paymentKey,
      data.cancelReason,
      data.cancelAmount
    )

    // 취소 정보를 데이터베이스에 저장
    const refund = await this.refundRepo.create({
      payment: {
        connect: { id: payment.id }
      },
      amount: data.cancelAmount || payment.amount,
      reason: data.cancelReason,
      status: 'COMPLETED',
      refundData: JSON.stringify(cancelResult)
    })

    // 결제 상태 업데이트
    const newStatus =
      data.cancelAmount && data.cancelAmount < payment.amount
        ? 'PARTIAL_CANCELED'
        : 'CANCELED'

    await this.repository.updateStatus(payment.id, newStatus, cancelResult)

    // 주문 상태 업데이트
    const orderStatus = newStatus === 'CANCELED' ? 'CANCELED' : 'PARTIAL_REFUND'
    const paymentStatus = newStatus === 'CANCELED' ? 'REFUNDED' : 'PARTIAL_REFUND'

    await this.orderRepository.updateStatus(payment.orderId, orderStatus)
    await this.orderRepository.updatePaymentStatus(payment.orderId, paymentStatus)

    console.log('결제 취소 성공:', {
      paymentKey: data.paymentKey,
      cancelAmount: data.cancelAmount || payment.amount,
      reason: data.cancelReason
    })

    // 업데이트된 결제 및 주문 조회
    const updatedPayment = await this.repository.findById(payment.id)
    const updatedOrder = await this.orderRepository.findById(payment.orderId)

    return {
      refund: {
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        createdAt: refund.createdAt
      },
      payment: this.formatPaymentResponse(updatedPayment!),
      order: {
        id: updatedOrder!.id,
        orderNumber: updatedOrder!.orderNumber,
        status: updatedOrder!.status,
        paymentStatus: updatedOrder!.paymentStatus
      },
      tossCancelData: cancelResult
    }
  }

  /**
   * 결제 키로 조회
   */
  async findByPaymentKey(paymentKey: string): Promise<PaymentResponse> {
    if (!paymentKey) {
      throw new ValidationError('결제 키는 필수입니다')
    }

    const payment = await this.repository.findByPaymentKey(paymentKey)

    if (!payment) {
      throw new NotFoundError('결제 정보', paymentKey)
    }

    return this.formatPaymentResponse(payment)
  }

  /**
   * ID로 결제 조회
   */
  async findById(id: number): Promise<PaymentResponse> {
    if (!id) {
      throw new ValidationError('결제 ID는 필수입니다')
    }

    const payment = await this.repository.findById(id)

    if (!payment) {
      throw new NotFoundError('결제 정보', id)
    }

    return this.formatPaymentResponse(payment)
  }

  /**
   * 주문별 결제 조회
   */
  async findByOrderId(orderId: number): Promise<PaymentResponse[]> {
    if (!orderId) {
      throw new ValidationError('주문 ID는 필수입니다')
    }

    const payments = await this.repository.findByOrderId(orderId)

    return payments.map(payment => this.formatPaymentResponse(payment))
  }

  /**
   * 필터 조건으로 결제 조회
   */
  async findByFilter(filter: PaymentFilter): Promise<PaymentResponse[]> {
    const payments = await this.repository.findByFilter(filter)

    return payments.map(payment => this.formatPaymentResponse(payment))
  }

  /**
   * 결제 개수 조회
   */
  async countPayments(filter?: Partial<PaymentFilter>): Promise<number> {
    return this.repository.count(filter)
  }

  /**
   * Private: 결제 수단 조회 또는 생성
   */
  private async getOrCreatePaymentMethod(name: string) {
    let paymentMethod = await prisma.paymentMethod.findFirst({
      where: { name }
    })

    if (!paymentMethod) {
      paymentMethod = await prisma.paymentMethod.create({
        data: {
          name,
          config: JSON.stringify({ provider: 'tosspayments' })
        }
      })
    }

    return paymentMethod
  }

  /**
   * Private: 결제 응답 포맷팅
   */
  private formatPaymentResponse(payment: any): PaymentResponse {
    return {
      id: payment.id,
      paymentKey: payment.paymentKey,
      orderId: payment.orderId,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      approvedAt: payment.approvedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      refunds: payment.refunds
        ? payment.refunds.map((refund: any) => ({
            id: refund.id,
            paymentId: refund.paymentId,
            amount: refund.amount,
            reason: refund.reason,
            status: refund.status,
            createdAt: refund.createdAt
          }))
        : undefined
    }
  }
}

// Singleton 인스턴스
export const paymentService = new PaymentService()
