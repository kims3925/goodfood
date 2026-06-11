/**
 * AnalystAgent -- 분석담당 에이전트
 *
 * 역할:
 *  1. 일일 매출/수익/주문 분석 리포트 생성
 *  2. 판매량/수익 기준 상위 상품 분석
 *  3. 채널별 수익률(ROI) 계산
 *  4. Gemini AI를 활용한 인사이트 요약 생성
 *
 * 구독 이벤트:
 *  - schedule.analytics.daily    : 매일 오전 6시 일일 분석
 *  - analytics.report.requested  : 수동 분석 리포트 요청
 *
 * 발행 이벤트:
 *  - analytics.report.ready      : 리포트 생성 완료
 *  - analytics.insight.alert     : 이상 지표 감지 (예: 매출 30% 급락)
 */

import prisma from '@bandauto/db'
import { AiProvider } from '@bandauto/db'
import { AgentBase } from '../AgentBase'
import { AgentLayer, type AgentEvent, type AgentResult } from '../types'
import { GeminiClient } from '@/modules/transformation/ai.client'

// ─── 분석 결과 타입 ───

interface SalesReport {
  period: string
  startDate: string
  endDate: string
  totalOrders: number
  totalRevenue: number
  totalProfit: number
  averageOrderValue: number
}

interface TopProduct {
  productId: number
  productName: string
  totalQuantity: number
  totalRevenue: number
  totalProfit: number
}

interface ChannelROI {
  channelId: number
  channelName: string
  totalRevenue: number
  totalCost: number
  profit: number
  roi: number // (profit / cost) * 100
}

interface AnalyticsReport {
  generatedAt: string
  salesReport: SalesReport
  topProducts: TopProduct[]
  channelROIs: ChannelROI[]
  insightSummary: string | null
}

// ─── 이상 감지 임계값 ───

const REVENUE_DROP_THRESHOLD = 0.3 // 30% 급락

// ─── Agent 본체 ───

export class AnalystAgent extends AgentBase {
  readonly name = 'analyst-agent'
  readonly layer = AgentLayer.INFRA

  private geminiClient: GeminiClient | null = null

  getSubscribedEvents(): string[] {
    return [
      'schedule.analytics.daily',
      'analytics.report.requested',
    ]
  }

  async handleEvent(event: AgentEvent): Promise<AgentResult> {
    const start = Date.now()
    try {
      await this.log('INFO', `이벤트 수신: ${event.type}`, { eventId: event.id })

      const period = (event.data.period as string) ?? 'daily'
      const report = await this.runDailyAnalysis(period)

      return {
        success: true,
        data: report as unknown as Record<string, unknown>,
        duration: Date.now() - start,
      }
    } catch (error: any) {
      await this.log('ERROR', `분석 처리 중 오류 발생: ${error.message}`, { eventType: event.type })
      return { success: false, error: error.message, duration: Date.now() - start }
    }
  }

  // ─── 스케줄 실행 (onSchedule 오버라이드) ───

  async onSchedule(): Promise<void> {
    await this.log('INFO', '일일 분석 시작')
    // 판매 집계 일배치 (B2B 공급몰 전환 STEP 5-1) — 어제+오늘 재집계 (idempotent)
    try {
      const { aggregateRecentSales } = await import('@/modules/analytics/sales-aggregator.service')
      const agg = await aggregateRecentSales(2)
      await this.log('INFO', `판매 집계 완료 — 주문 ${agg.ordersScanned}건 → ${agg.rowsUpserted}행`)
      await this.recordKpi('sales_daily_rows', agg.rowsUpserted)
    } catch (e: any) {
      await this.log('WARN', `판매 집계 실패 (분석은 계속): ${e?.message}`)
    }
    await this.runDailyAnalysis('daily')
  }

  // ══════════════════════════════════════════════════
  //  통합 분석 실행
  // ══════════════════════════════════════════════════

  private async runDailyAnalysis(period: string): Promise<AnalyticsReport> {
    const salesReport = await this.generateSalesReport(period)
    const topProducts = await this.analyzeTopProducts(10)
    const channelROIs = await this.analyzeChannelROI()

    // Gemini 인사이트 생성
    const insightSummary = await this.generateInsightSummary({
      salesReport,
      topProducts,
      channelROIs,
    })

    // 이상 지표 감지
    await this.detectAnomalies(salesReport)

    const report: AnalyticsReport = {
      generatedAt: new Date().toISOString(),
      salesReport,
      topProducts,
      channelROIs,
      insightSummary,
    }

    // KPI 기록
    await this.recordKpi('reports_generated', 1)
    await this.recordKpi('insights_generated', insightSummary ? 1 : 0)

    // KPI에 분석 결과 저장
    await this.saveKpiRecords({
      totalOrders: salesReport.totalOrders,
      totalRevenue: salesReport.totalRevenue,
      totalProfit: salesReport.totalProfit,
    })

    // 리포트 완료 이벤트 발행
    await this.emitEvent('analytics.report.ready', {
      period,
      totalOrders: salesReport.totalOrders,
      totalRevenue: salesReport.totalRevenue,
      totalProfit: salesReport.totalProfit,
      topProductCount: topProducts.length,
    })

    await this.log('INFO', '일일 분석 완료', {
      totalOrders: salesReport.totalOrders,
      totalRevenue: salesReport.totalRevenue,
      totalProfit: salesReport.totalProfit,
    })

    return report
  }

  // ══════════════════════════════════════════════════
  //  SKILL 1: 매출 리포트 생성
  // ══════════════════════════════════════════════════

  /**
   * 기간별 매출/수익/주문 수를 집계합니다.
   */
  async generateSalesReport(period: string): Promise<SalesReport> {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        break
      case 'daily':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
    }

    try {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startDate },
          status: { not: 'CANCELLED' },
        },
        include: {
          items: true,
        },
      })

      let totalRevenue = 0
      let totalProfit = 0

      for (const order of orders) {
        const orderRevenue = Number(order.totalAmount ?? 0)
        totalRevenue += orderRevenue

        for (const item of order.items) {
          const selling = Number(item.unitPrice ?? 0) * (item.quantity ?? 1)
          totalProfit += selling
        }
      }

      // 매출 기준으로 수익 계산 (배송비 필드 없음)
      totalProfit = totalRevenue

      const totalOrders = orders.length
      const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalOrders,
        totalRevenue,
        totalProfit,
        averageOrderValue,
      }
    } catch (error: any) {
      await this.log('ERROR', `매출 리포트 생성 실패: ${error.message}`)
      return {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalOrders: 0,
        totalRevenue: 0,
        totalProfit: 0,
        averageOrderValue: 0,
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 2: 상위 상품 분석
  // ══════════════════════════════════════════════════

  /**
   * 판매량/수익 기준 상품 TOP N을 반환합니다.
   */
  async analyzeTopProducts(limit: number): Promise<TopProduct[]> {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const orderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: last24h },
            status: { not: 'CANCELLED' },
          },
        },
      })

      // 상품별 집계
      const productMap = new Map<number, {
        productName: string
        totalQuantity: number
        totalRevenue: number
        totalProfit: number
      }>()

      for (const item of orderItems) {
        const productId = item.shopProductId
        if (!productId) continue

        const quantity = item.quantity ?? 1
        const revenue = Number(item.unitPrice ?? 0) * quantity
        const profit = revenue

        const existing = productMap.get(productId)
        if (existing) {
          existing.totalQuantity += quantity
          existing.totalRevenue += revenue
          existing.totalProfit += profit
        } else {
          productMap.set(productId, {
            productName: item.productName ?? '알 수 없음',
            totalQuantity: quantity,
            totalRevenue: revenue,
            totalProfit: profit,
          })
        }
      }

      // 수익 기준 정렬 후 상위 N개
      const sorted = Array.from(productMap.entries())
        .map(([productId, data]) => ({ productId, ...data }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit)

      return sorted
    } catch (error: any) {
      await this.log('ERROR', `상위 상품 분석 실패: ${error.message}`)
      return []
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 3: 채널별 ROI 분석
  // ══════════════════════════════════════════════════

  /**
   * 채널별 수익률(ROI)을 계산합니다.
   */
  async analyzeChannelROI(): Promise<ChannelROI[]> {
    try {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // 쇼핑몰(Shop) 기준으로 ROI 분석 (Channel → Shop으로 대체)
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: last24h },
          status: { not: 'CANCELLED' },
          shopId: { not: null },
        },
        include: {
          shop: { select: { id: true, name: true } },
          items: true,
        },
      })

      const shopMap = new Map<number, {
        channelName: string
        totalRevenue: number
        totalCost: number
      }>()

      for (const order of orders) {
        const shopId = order.shopId
        if (!shopId) continue

        const orderRevenue = order.items.reduce(
          (sum, item) => sum + Number(item.totalPrice ?? 0), 0
        )

        const existing = shopMap.get(shopId)
        if (existing) {
          existing.totalRevenue += orderRevenue
        } else {
          shopMap.set(shopId, {
            channelName: order.shop?.name ?? '알 수 없음',
            totalRevenue: orderRevenue,
            totalCost: 0,
          })
        }
      }
      const channelMap = shopMap

      return Array.from(channelMap.entries()).map(([channelId, data]) => {
        const profit = data.totalRevenue - data.totalCost
        const roi = data.totalCost > 0 ? Math.round((profit / data.totalCost) * 100 * 100) / 100 : 0

        return {
          channelId,
          channelName: data.channelName,
          totalRevenue: data.totalRevenue,
          totalCost: data.totalCost,
          profit,
          roi,
        }
      })
    } catch (error: any) {
      await this.log('ERROR', `채널 ROI 분석 실패: ${error.message}`)
      return []
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 4: Gemini 인사이트 요약 생성
  // ══════════════════════════════════════════════════

  /**
   * Gemini를 사용하여 분석 데이터를 자연어 인사이트로 요약합니다.
   */
  async generateInsightSummary(data: {
    salesReport: SalesReport
    topProducts: TopProduct[]
    channelROIs: ChannelROI[]
  }): Promise<string | null> {
    const client = await this.getGeminiClient()
    if (!client) {
      await this.log('WARN', 'Gemini API 키 없음 — 인사이트 생성 건너뜀')
      return null
    }

    try {
      const prompt = `다음은 소셜커머스 플랫폼의 일일 분석 데이터입니다. 핵심 인사이트를 한국어로 3-5줄 요약해주세요.

## 매출 리포트
- 기간: ${data.salesReport.period}
- 총 주문: ${data.salesReport.totalOrders}건
- 총 매출: ${data.salesReport.totalRevenue.toLocaleString()}원
- 총 수익: ${data.salesReport.totalProfit.toLocaleString()}원
- 평균 주문가: ${data.salesReport.averageOrderValue.toLocaleString()}원

## TOP 상품 (상위 ${data.topProducts.length}개)
${data.topProducts.map((p, i) => `${i + 1}. ${p.productName} - 판매 ${p.totalQuantity}개, 매출 ${p.totalRevenue.toLocaleString()}원`).join('\n')}

## 채널별 ROI
${data.channelROIs.map((c) => `- ${c.channelName}: 매출 ${c.totalRevenue.toLocaleString()}원, ROI ${c.roi}%`).join('\n')}

핵심 인사이트와 개선 제안을 간결하게 작성해주세요.`

      const response = await client.generateContent(prompt)
      const insight = response.content

      await this.log('INFO', '인사이트 요약 생성 완료')
      return insight
    } catch (error: any) {
      await this.log('ERROR', `인사이트 생성 실패: ${error.message}`)
      return null
    }
  }

  // ══════════════════════════════════════════════════
  //  SKILL 5: KPI 레코드 저장
  // ══════════════════════════════════════════════════

  /**
   * AgentKpiRecord에 분석 결과를 저장합니다.
   */
  async saveKpiRecords(data: {
    totalOrders: number
    totalRevenue: number
    totalProfit: number
  }): Promise<void> {
    try {
      await this.recordKpi('daily_orders', data.totalOrders)
      await this.recordKpi('daily_revenue', data.totalRevenue)
      await this.recordKpi('daily_profit', data.totalProfit)
    } catch (error: any) {
      await this.log('ERROR', `KPI 저장 실패: ${error.message}`)
    }
  }

  // ══════════════════════════════════════════════════
  //  이상 지표 감지
  // ══════════════════════════════════════════════════

  /**
   * 전일 대비 매출 급락 등 이상 지표를 감지합니다.
   */
  private async detectAnomalies(currentReport: SalesReport): Promise<void> {
    let anomaliesDetected = 0

    try {
      // 전일 매출 KPI 조회
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)

      const previousKpi = await prisma.agentKpiRecord.findFirst({
        where: {
          metric: 'daily_revenue',
          date: yesterday,
          agent: { name: this.name },
        },
        select: { value: true },
      })

      if (previousKpi && previousKpi.value > 0) {
        const previousRevenue = Number(previousKpi.value)
        const currentRevenue = currentReport.totalRevenue
        const dropRate = (previousRevenue - currentRevenue) / previousRevenue

        if (dropRate >= REVENUE_DROP_THRESHOLD) {
          anomaliesDetected++
          await this.log('WARN', `매출 급락 감지: ${Math.round(dropRate * 100)}% 하락`, {
            previousRevenue,
            currentRevenue,
            dropRate,
          })

          await this.emitEvent('analytics.insight.alert', {
            alertType: 'revenue_drop',
            dropRate: Math.round(dropRate * 100),
            previousRevenue,
            currentRevenue,
            message: `매출이 전일 대비 ${Math.round(dropRate * 100)}% 급락했습니다.`,
          }, 'HIGH')
        }
      }
    } catch (error: any) {
      await this.log('ERROR', `이상 지표 감지 실패: ${error.message}`)
    }

    await this.recordKpi('anomalies_detected', anomaliesDetected)
  }

  // ─── 내부 헬퍼 ───

  private async getGeminiClient(): Promise<GeminiClient | null> {
    if (this.geminiClient) return this.geminiClient

    // AiApiConfig 테이블에서 GEMINI 키 조회
    const apiConfig = await prisma.aiApiConfig.findFirst({
      where: { provider: AiProvider.GEMINI, isActive: true },
    })

    if (!apiConfig?.apiKey) return null

    this.geminiClient = new GeminiClient({
      provider: AiProvider.GEMINI,
      apiKey: apiConfig.apiKey,
      model: apiConfig.model || 'gemini-2.5-flash',
      temperature: 0.3,
    })

    return this.geminiClient
  }
}

export const analystAgent = new AnalystAgent()
