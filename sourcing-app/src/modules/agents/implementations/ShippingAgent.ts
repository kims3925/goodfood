/**
 * ShippingAgent -- 배송담당 에이전트
 *
 * 역할:
 *  1. 주문의 배송 상태 추적 및 업데이트
 *  2. 배달 완료 시 이벤트 발행
 *  3. 배송 지연 감지 및 알림
 *
 * 구독 이벤트:
 *  - shipping.prepare.requested : OrderAgent로부터 배송 준비 요청
 *  - schedule.shipping.check    : 2시간 주기 배송 상태 추적
 *  - order.shipped              : 운송장 등록 완료
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'

// ─── 배송 상태 상수 ───

const SHIPPED_STATUS = 'SHIPPED'
const DELIVERED_STATUS = 'DELIVERED'
const DELAY_THRESHOLD_DAYS = 7

// ─── Agent 본체 ───

export class ShippingAgent extends AgentBase {
  readonly name = 'shipping-agent'
  readonly layer = AgentLayer.COMMERCE

  getSubscribedEvents(): string[] {
    return [
      'shipping.prepare.requested',
      'schedule.shipping.check',
      'order.shipped',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'shipping.prepare.requested': {
          const orderId = event.data.orderId as number
          await this.log('INFO', `배송 준비 요청: 주문 ${orderId}`)
          // 배송 준비 상태로 전환 (trackingNumber 등록 대기)
          await this.updateDeliveryStatus(orderId, 'PREPARING')
          return { success: true, data: { orderId, status: 'PREPARING' }, duration: Date.now() - start }
        }

        case 'order.shipped': {
          const orderId = event.data.orderId as number
          const trackingNumber = event.data.trackingNumber as string | undefined
          await this.log('INFO', `운송장 등록 완료: 주문 ${orderId}`, { trackingNumber })
          await this.updateDeliveryStatus(orderId, SHIPPED_STATUS)
          return { success: true, data: { orderId, status: SHIPPED_STATUS }, duration: Date.now() - start }
        }

        case 'schedule.shipping.check': {
          const result = await this.checkAllShipments()
          return { success: true, data: result, duration: Date.now() - start }
        }

        default:
          return { success: false, error: `알 수 없는 이벤트: ${event.type}`, duration: Date.now() - start }
      }
    } catch (error: any) {
      await this.log('ERROR', `배송 처리 중 오류 발생: ${error.message}`, { eventType: event.type })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───

  async onSchedule(): Promise<void> {
    await this.log('INFO', '정기 배송 상태 체크 시작')
    await this.checkAllShipments()
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 배송 상태 조회
  // ══════════════════════════════════════════════════

  /**
   * 주문의 배송 상태를 조회합니다.
   * trackingNumber, deliveryStatus 등을 반환합니다.
   */
  async trackShipment(orderId: number): Promise<{
    orderId: number
    status: string
    shippedAt: Date | null
  } | null> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          shippedAt: true,
        },
      })

      if (!order) {
        await this.log('WARN', `주문을 찾을 수 없음: ${orderId}`)
        return null
      }

      return {
        orderId: order.id,
        status: order.status,
        shippedAt: order.shippedAt ?? null,
      }
    } catch (error: any) {
      await this.log('ERROR', `배송 상태 조회 실패: 주문 ${orderId} - ${error.message}`)
      return null
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 배송 상태 업데이트
  // ══════════════════════════════════════════════════

  /**
   * Order.deliveryStatus를 DB에서 업데이트합니다.
   */
  async updateDeliveryStatus(orderId: number, status: string): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        status,
      }

      if (status === SHIPPED_STATUS) {
        updateData.shippedAt = new Date()
      }

      if (status === DELIVERED_STATUS) {
        updateData.deliveredAt = new Date()
      }

      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      })

      await this.log('INFO', `배송 상태 업데이트: 주문 ${orderId} → ${status}`)
    } catch (error: any) {
      await this.log('ERROR', `배송 상태 업데이트 실패: 주문 ${orderId} - ${error.message}`)
      throw error
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 배달 완료 알림
  // ══════════════════════════════════════════════════

  /**
   * 배달 완료 시 order.delivered 이벤트를 발행합니다.
   */
  async sendDeliveryAlert(orderId: number): Promise<void> {
    try {
      await this.emitEvent(
        'order.delivered',
        { orderId, deliveredAt: new Date().toISOString() },
        'NORMAL'
      )
      await this.log('INFO', `배달 완료 이벤트 발행: 주문 ${orderId}`)
    } catch (error: any) {
      await this.log('ERROR', `배달 완료 이벤트 발행 실패: 주문 ${orderId} - ${error.message}`)
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 배송 지연 감지
  // ══════════════════════════════════════════════════

  /**
   * 예상 배달일 초과 여부를 감지합니다.
   * SHIPPED 상태에서 7일 이상 경과하면 지연으로 판단합니다.
   */
  async detectDeliveryDelay(orderId: number): Promise<boolean> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, shippedAt: true, status: true },
      })

      if (!order || !order.shippedAt || order.status !== SHIPPED_STATUS) {
        return false
      }

      const daysSinceShipped = Math.floor(
        (Date.now() - new Date(order.shippedAt).getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysSinceShipped > DELAY_THRESHOLD_DAYS) {
        await this.log('WARN', `배송 지연 감지: 주문 ${orderId} (${daysSinceShipped}일 경과)`)
        await this.emitEvent(
          'shipping.delay.detected',
          { orderId, daysSinceShipped },
          'HIGH'
        )
        return true
      }

      return false
    } catch (error: any) {
      await this.log('ERROR', `배송 지연 감지 실패: 주문 ${orderId} - ${error.message}`)
      return false
    }
  }

  // ══════════════════════════════════════════════════
  //  전체 배송 상태 체크
  // ══════════════════════════════════════════════════

  /**
   * SHIPPED 상태의 모든 주문을 조회하고 배송 지연을 감지합니다.
   */
  private async checkAllShipments(): Promise<Record<string, unknown>> {
    let shipmentsTracked = 0
    let deliveriesCompleted = 0
    let delaysDetected = 0

    try {
      // SHIPPED 상태이고 아직 DELIVERED가 아닌 주문 조회
      const shippedOrders = await prisma.order.findMany({
        where: {
          status: SHIPPED_STATUS,
        },
        select: {
          id: true,
          shippedAt: true,
        },
        orderBy: { shippedAt: 'asc' },
      })

      shipmentsTracked = shippedOrders.length

      for (const order of shippedOrders) {
        if (!order.shippedAt) continue

        const daysSinceShipped = Math.floor(
          (Date.now() - new Date(order.shippedAt).getTime()) / (1000 * 60 * 60 * 24)
        )

        // 7일 초과 → 지연 감지
        if (daysSinceShipped > DELAY_THRESHOLD_DAYS) {
          delaysDetected++
          await this.log('WARN', `배송 지연: 주문 ${order.id} (${daysSinceShipped}일 경과)`)
          await this.emitEvent(
            'shipping.delay.detected',
            { orderId: order.id, daysSinceShipped },
            'HIGH'
          )
        }
      }

      await this.log('INFO', '배송 상태 체크 완료', {
        shipmentsTracked,
        deliveriesCompleted,
        delaysDetected,
      })
    } catch (error: any) {
      await this.log('ERROR', `배송 상태 체크 중 오류: ${error.message}`)
    }

    // KPI 기록
    await this.recordKpi('shipments_tracked', shipmentsTracked)
    await this.recordKpi('deliveries_completed', deliveriesCompleted)
    await this.recordKpi('delays_detected', delaysDetected)

    return { shipmentsTracked, deliveriesCompleted, delaysDetected }
  }
}

export const shippingAgent = new ShippingAgent()
