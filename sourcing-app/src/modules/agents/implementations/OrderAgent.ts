/**
 * OrderAgent — 주문 관리 에이전트
 *
 * 역할:
 *  1. 신규 주문(PENDING) 일괄 조회 및 상태 처리
 *  2. 결제 확인된 주문을 CONFIRMED(PAID)로 업데이트
 *  3. 주문 취소 처리
 *  4. 무통장입금 기한 초과 주문 자동 취소
 *
 * 구독 이벤트:
 *  - schedule.order.check    : 10분 주기 신규 주문 확인
 *  - order.created           : 새 주문 생성
 *  - payment.completed       : 결제 완료 → 주문 확정
 *  - order.cancel.requested  : 취소 요청
 *
 * 발행 이벤트:
 *  - order.confirmed             : 주문 확정 완료
 *  - order.cancelled             : 주문 취소 완료
 *  - shipping.prepare.requested  : 배송 준비 요청
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'

// ─── 상수 ───

/** 무통장입금 결제 기한: 24시간 */
const BANK_TRANSFER_EXPIRY_HOURS = 24

// ─── Agent 본체 ───

export class OrderAgent extends AgentBase {
  readonly name = 'order-agent'
  readonly layer = AgentLayer.COMMERCE

  getSubscribedEvents(): string[] {
    return [
      'schedule.order.check',
      'order.created',
      'payment.completed',
      'order.cancel.requested',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'schedule.order.check': {
          await this.onSchedule()
          break
        }

        case 'order.created': {
          const orderId = event.data.orderId as number
          await this.log('INFO', `신규 주문 감지: ${orderId}`)
          break
        }

        case 'payment.completed': {
          const orderId = event.data.orderId as number
          await this.confirmOrder(orderId)
          break
        }

        case 'order.cancel.requested': {
          const orderId = event.data.orderId as number
          const reason = (event.data.reason as string) ?? '고객 요청'
          await this.cancelOrder(orderId, reason)
          break
        }

        default:
          await this.log('WARN', `알 수 없는 이벤트: ${event.type}`)
      }

      return { success: true, duration: Date.now() - start }
    } catch (error: any) {
      await this.log('ERROR', `이벤트 처리 중 오류: ${error.message}`, {
        eventType: event.type,
        error: error.message,
      })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (10분 주기) ───

  async onSchedule(): Promise<void> {
    await this.log('INFO', '주문 정기 점검 시작')

    const [processResult, expiredResult] = await Promise.all([
      this.processNewOrders(),
      this.checkExpiredOrders(),
    ])

    // KPI 기록
    await this.recordKpi('orders_processed', processResult.processed)
    await this.recordKpi('orders_confirmed', processResult.confirmed)
    await this.recordKpi('orders_cancelled', processResult.cancelled)
    await this.recordKpi('expired_cancelled', expiredResult.expiredCancelled)

    await this.log('INFO', '주문 정기 점검 완료', {
      ...processResult,
      ...expiredResult,
    })
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 신규 주문 일괄 처리
  // ══════════════════════════════════════════════════

  /**
   * PENDING 상태의 주문 중 결제 완료된 건을 일괄 확정 처리합니다.
   */
  async processNewOrders(): Promise<{
    processed: number
    confirmed: number
    cancelled: number
  }> {
    let processed = 0
    let confirmed = 0
    let cancelled = 0

    try {
      // PENDING 상태 주문 조회 (결제 정보 포함)
      const pendingOrders = await prisma.order.findMany({
        where: { status: 'PENDING' },
        include: {
          payment: { select: { id: true, status: true, method: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })

      await this.log('INFO', `PENDING 주문 ${pendingOrders.length}건 조회`)

      for (const order of pendingOrders) {
        processed++

        try {
          // 결제 완료 확인 (Toss DONE 상태)
          if (order.payment?.status === 'DONE') {
            await this.confirmOrder(order.id)
            confirmed++
          }
        } catch (err: any) {
          await this.log('ERROR', `주문 ${order.id} 처리 실패: ${err.message}`)
        }
      }
    } catch (err: any) {
      await this.log('ERROR', `신규 주문 일괄 처리 실패: ${err.message}`)
    }

    return { processed, confirmed, cancelled }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 주문 확정
  // ══════════════════════════════════════════════════

  /**
   * 결제 확인된 주문을 PAID 상태로 업데이트하고 배송 준비를 요청합니다.
   */
  async confirmOrder(orderId: number): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payment: { select: { status: true } } },
      })

      if (!order) {
        await this.log('WARN', `주문 ${orderId}를 찾을 수 없음`)
        return
      }

      if (order.status !== 'PENDING') {
        await this.log('INFO', `주문 ${orderId}는 이미 ${order.status} 상태`)
        return
      }

      // 결제 상태 재확인
      if (order.payment?.status !== 'DONE') {
        await this.log('WARN', `주문 ${orderId}의 결제가 완료되지 않음`, {
          paymentStatus: order.payment?.status,
        })
        return
      }

      // 주문 확정 (PAID로 업데이트)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      await this.log('INFO', `주문 ${orderId} 확정 완료`)

      // 주문 확정 이벤트 발행
      await this.emitEvent('order.confirmed', {
        orderId,
        userId: order.userId,
        orderNumber: order.orderNumber,
      })

      // 배송 준비 요청 이벤트 발행
      await this.emitEvent('shipping.prepare.requested', {
        orderId,
        userId: order.userId,
        orderNumber: order.orderNumber,
      })
    } catch (err: any) {
      await this.log('ERROR', `주문 ${orderId} 확정 실패: ${err.message}`)
      throw err
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 주문 취소
  // ══════════════════════════════════════════════════

  /**
   * 주문을 취소 상태로 변경합니다.
   * PENDING 또는 PAID 상태에서만 취소 가능합니다.
   */
  async cancelOrder(orderId: number, reason = '고객 요청'): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      })

      if (!order) {
        await this.log('WARN', `주문 ${orderId}를 찾을 수 없음`)
        return
      }

      const cancellableStatuses = ['PENDING', 'PAID']
      if (!cancellableStatuses.includes(order.status)) {
        await this.log('WARN', `주문 ${orderId}는 취소 불가 상태: ${order.status}`)
        return
      }

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          cancelledBy: 'system',
        },
      })

      await this.log('INFO', `주문 ${orderId} 취소 완료`, { reason })

      await this.emitEvent('order.cancelled', {
        orderId,
        userId: order.userId,
        orderNumber: order.orderNumber,
        reason,
      })
    } catch (err: any) {
      await this.log('ERROR', `주문 ${orderId} 취소 실패: ${err.message}`)
      throw err
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 기한 초과 주문 자동 취소
  // ══════════════════════════════════════════════════

  /**
   * 무통장입금(VIRTUAL_ACCOUNT, BANK_TRANSFER) 주문 중
   * 24시간 이상 PENDING 상태인 건을 자동 취소합니다.
   */
  async checkExpiredOrders(): Promise<{ expiredCancelled: number }> {
    let expiredCancelled = 0

    try {
      const expiryDate = new Date(
        Date.now() - BANK_TRANSFER_EXPIRY_HOURS * 60 * 60 * 1000
      )

      // 무통장입금 결제 중 기한 초과 + PENDING 주문 조회
      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: expiryDate },
          payment: {
            method: { in: ['VIRTUAL_ACCOUNT', 'BANK_TRANSFER'] },
            status: { in: ['READY', 'WAITING_FOR_DEPOSIT'] },
          },
        },
        select: { id: true, orderNumber: true, userId: true },
        take: 50,
      })

      await this.log('INFO', `기한 초과 주문 ${expiredOrders.length}건 발견`)

      for (const order of expiredOrders) {
        try {
          await this.cancelOrder(order.id, '입금 기한 초과 자동 취소')
          expiredCancelled++
        } catch (err: any) {
          await this.log('ERROR', `기한 초과 주문 ${order.id} 취소 실패: ${err.message}`)
        }
      }
    } catch (err: any) {
      await this.log('ERROR', `기한 초과 주문 점검 실패: ${err.message}`)
    }

    return { expiredCancelled }
  }
}

export const orderAgent = new OrderAgent()
