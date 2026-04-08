/**
 * SettlementAgent -- 정산담당 에이전트
 *
 * 역할:
 *  1. 배달 완료 주문의 도매가/소매가 차익 계산
 *  2. 채널별 수익 집계
 *  3. 정산 리포트 생성
 *
 * 구독 이벤트:
 *  - order.delivered            : 배달 완료 → 정산 대상 추가
 *  - schedule.settlement.daily  : 매일 새벽 1시 일일 정산
 *  - settlement.report.requested: 수동 정산 리포트 요청
 */

import prisma from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'

// ─── 정산 결과 타입 ───

interface SettlementItem {
  orderId: number
  orderItemId: number
  productName: string
  wholesalePrice: number
  sellingPrice: number
  shippingCost: number
  profit: number
  channelId: number | null
}

interface ChannelSummary {
  channelId: number | null
  channelName: string | null
  orderCount: number
  totalRevenue: number
  totalCost: number
  totalShipping: number
  totalProfit: number
}

interface SettlementReport {
  period: string
  generatedAt: string
  ordersSettled: number
  totalRevenue: number
  totalCost: number
  totalShipping: number
  totalProfit: number
  items: SettlementItem[]
  channelSummaries: ChannelSummary[]
}

// ─── Agent 본체 ───

export class SettlementAgent extends AgentBase {
  readonly name = 'settlement-agent'
  readonly layer = AgentLayer.COMMERCE

  getSubscribedEvents(): string[] {
    return [
      'order.delivered',
      'schedule.settlement.daily',
      'settlement.report.requested',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      switch (event.type) {
        case 'order.delivered': {
          const orderId = event.data.orderId as number
          await this.log('INFO', `정산 대상 추가: 주문 ${orderId}`)
          // 배달 완료 주문은 다음 정산 사이클에서 처리됨
          return { success: true, data: { orderId, queued: true }, duration: Date.now() - start }
        }

        case 'schedule.settlement.daily':
        case 'settlement.report.requested': {
          const report = await this.runDailySettlement()
          return {
            success: true,
            data: report as unknown as Record<string, unknown>,
            duration: Date.now() - start,
          }
        }

        default:
          return { success: false, error: `알 수 없는 이벤트: ${event.type}`, duration: Date.now() - start }
      }
    } catch (error: any) {
      await this.log('ERROR', `정산 처리 중 오류 발생: ${error.message}`, { eventType: event.type })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───

  async onSchedule(): Promise<void> {
    await this.log('INFO', '일일 정산 시작')
    await this.runDailySettlement()
  }

  // ══════════════════════════════════════════════════
  //  통합 정산 실행
  // ══════════════════════════════════════════════════

  private async runDailySettlement(): Promise<SettlementReport> {
    const items = await this.calculateSettlement()
    const channelSummaries = this.aggregateByChannel(items)
    const report = this.generateReport(items, channelSummaries)

    // KPI 기록
    await this.recordKpi('orders_settled', report.ordersSettled)
    await this.recordKpi('total_revenue', report.totalRevenue)
    await this.recordKpi('total_profit', report.totalProfit)

    // 정산 완료 이벤트 발행
    await this.emitEvent('settlement.report.ready', {
      ordersSettled: report.ordersSettled,
      totalRevenue: report.totalRevenue,
      totalProfit: report.totalProfit,
      period: report.period,
    })

    await this.log('INFO', '일일 정산 완료', {
      ordersSettled: report.ordersSettled,
      totalRevenue: report.totalRevenue,
      totalProfit: report.totalProfit,
    })

    // placeholder: 향후 이메일 발송
    await this.sendReportEmail(report)

    return report
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 정산 계산
  // ══════════════════════════════════════════════════

  /**
   * 배달 완료 주문의 도매가/소매가 차익을 계산합니다.
   * deliveryStatus=DELIVERED이고 settlementStatus != SETTLED인 주문 대상.
   */
  async calculateSettlement(): Promise<SettlementItem[]> {
    const items: SettlementItem[] = []

    try {
      const orders = await prisma.order.findMany({
        where: {
          status: 'DELIVERED',
        },
        include: {
          items: {
            include: {
              variant: {
                select: { wholesalePrice: true },
              },
            },
          },
        },
        orderBy: { deliveredAt: 'desc' },
      })

      for (const order of orders) {
        for (const item of order.items) {
          const wholesalePrice = Number(item.variant?.wholesalePrice ?? 0)
          const sellingPrice = Number(item.totalPrice ?? 0)
          const profit = sellingPrice - wholesalePrice * (item.quantity ?? 1)

          items.push({
            orderId: order.id,
            orderItemId: item.id,
            productName: item.productName ?? '알 수 없음',
            wholesalePrice,
            sellingPrice,
            shippingCost: 0,
            profit,
            channelId: null,
          })
        }

        // 정산 완료 표시 (wholesaleOrderStatus로 추적)
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { wholesaleOrderStatus: 'CONFIRMED' },
          })
        } catch (updateErr: any) {
          await this.log('WARN', `정산 상태 업데이트 실패: 주문 ${order.id} - ${updateErr.message}`)
        }
      }

      await this.log('INFO', `정산 계산 완료: ${items.length}건`)
    } catch (error: any) {
      await this.log('ERROR', `정산 계산 실패: ${error.message}`)
    }

    return items
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 채널별 수익 집계
  // ══════════════════════════════════════════════════

  /**
   * 정산 항목을 채널별로 그룹화하여 수익을 집계합니다.
   */
  aggregateByChannel(items: SettlementItem[]): ChannelSummary[] {
    const channelMap = new Map<number | null, ChannelSummary>()

    for (const item of items) {
      const key = item.channelId
      const existing = channelMap.get(key)

      if (existing) {
        existing.orderCount++
        existing.totalRevenue += item.sellingPrice
        existing.totalCost += item.wholesalePrice
        existing.totalShipping += item.shippingCost
        existing.totalProfit += item.profit
      } else {
        channelMap.set(key, {
          channelId: key,
          channelName: null, // 후속 조회로 채울 수 있음
          orderCount: 1,
          totalRevenue: item.sellingPrice,
          totalCost: item.wholesalePrice,
          totalShipping: item.shippingCost,
          totalProfit: item.profit,
        })
      }
    }

    return Array.from(channelMap.values())
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 리포트 생성
  // ══════════════════════════════════════════════════

  /**
   * 정산 요약 데이터를 JSON 형태로 생성합니다.
   */
  generateReport(items: SettlementItem[], channelSummaries: ChannelSummary[]): SettlementReport {
    const totalRevenue = items.reduce((sum, i) => sum + i.sellingPrice, 0)
    const totalCost = items.reduce((sum, i) => sum + i.wholesalePrice, 0)
    const totalShipping = items.reduce((sum, i) => sum + i.shippingCost, 0)
    const totalProfit = items.reduce((sum, i) => sum + i.profit, 0)

    const today = new Date()
    const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return {
      period,
      generatedAt: today.toISOString(),
      ordersSettled: items.length,
      totalRevenue,
      totalCost,
      totalShipping,
      totalProfit,
      items,
      channelSummaries,
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: 리포트 이메일 발송 (placeholder)
  // ══════════════════════════════════════════════════

  /**
   * 정산 리포트를 이메일로 발송합니다. (향후 구현 예정)
   */
  async sendReportEmail(_report: SettlementReport): Promise<void> {
    // TODO: 이메일 발송 통합 시 구현
    await this.log('INFO', '정산 리포트 이메일 발송 (placeholder - 향후 구현 예정)')
  }
}

export const settlementAgent = new SettlementAgent()
