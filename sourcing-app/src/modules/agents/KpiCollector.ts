/**
 * Agent Runtime Engine - KpiCollector
 *
 * KPI aggregation and trend analysis for agent performance monitoring.
 */

import prisma from '@bandauto/db'
import type { KpiSummary, KpiTrend } from './types'

export class KpiCollector {
  private static instance: KpiCollector | null = null

  private constructor() {}

  static getInstance(): KpiCollector {
    if (!KpiCollector.instance) {
      KpiCollector.instance = new KpiCollector()
    }
    return KpiCollector.instance
  }

  /**
   * Record a KPI metric for a specific agent.
   * Uses upsert to update existing records for the same agent/metric/period/date.
   */
  async recordKpi(
    agentId: string,
    metric: string,
    value: number,
    target = 0,
    period = 'daily'
  ): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
      await prisma.agentKpiRecord.upsert({
        where: {
          agentId_metric_period_date: {
            agentId,
            metric,
            period,
            date: today,
          },
        },
        update: { value, target },
        create: {
          agentId,
          metric,
          value,
          target,
          period,
          date: today,
        },
      })
    } catch (err) {
      console.error(`[KpiCollector] Failed to record KPI:`, err)
    }
  }

  /**
   * Get KPI records for a specific agent within a date range.
   */
  async getAgentKpis(
    agentId: string,
    period = 'daily',
    startDate?: Date,
    endDate?: Date
  ): Promise<KpiSummary[]> {
    const now = new Date()
    const start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1) // Default: start of month
    const end = endDate ?? now

    try {
      const records = await prisma.agentKpiRecord.findMany({
        where: {
          agentId,
          period,
          date: {
            gte: start,
            lte: end,
          },
        },
        include: {
          agent: {
            select: { name: true },
          },
        },
        orderBy: { date: 'desc' },
      })

      // Group by metric and get latest value
      const metricMap = new Map<string, typeof records[0]>()
      for (const record of records) {
        if (!metricMap.has(record.metric)) {
          metricMap.set(record.metric, record)
        }
      }

      return Array.from(metricMap.values()).map((record) => ({
        agentId: record.agentId,
        agentName: record.agent.name,
        metric: record.metric,
        currentValue: record.value,
        targetValue: record.target,
        achievementRate: record.target > 0
          ? Math.round((record.value / record.target) * 100 * 100) / 100
          : 0,
      }))
    } catch (err) {
      console.error(`[KpiCollector] Failed to get agent KPIs:`, err)
      return []
    }
  }

  /**
   * Get overall achievement rate across all agents.
   * Returns the average achievement rate of all agents' latest KPI records.
   */
  async getOverallAchievement(): Promise<number> {
    try {
      const agents = await prisma.agentDefinition.findMany({
        where: { deletedAt: null },
        select: { id: true },
      })

      if (agents.length === 0) return 0

      let totalAchievement = 0
      let agentsWithKpis = 0

      for (const agent of agents) {
        const kpis = await this.getAgentKpis(agent.id)
        if (kpis.length > 0) {
          const avgAchievement =
            kpis.reduce((sum, kpi) => sum + kpi.achievementRate, 0) / kpis.length
          totalAchievement += avgAchievement
          agentsWithKpis++
        }
      }

      if (agentsWithKpis === 0) return 0
      return Math.round((totalAchievement / agentsWithKpis) * 100) / 100
    } catch (err) {
      console.error(`[KpiCollector] Failed to get overall achievement:`, err)
      return 0
    }
  }

  /**
   * Calculate the trend for a specific metric over the last N days.
   * Returns an array of date/value pairs sorted by date ascending.
   */
  async calculateTrend(
    agentId: string,
    metric: string,
    days = 30
  ): Promise<KpiTrend[]> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    try {
      const records = await prisma.agentKpiRecord.findMany({
        where: {
          agentId,
          metric,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          value: true,
        },
      })

      return records.map((record) => ({
        date: record.date,
        value: record.value,
      }))
    } catch (err) {
      console.error(`[KpiCollector] Failed to calculate trend:`, err)
      return []
    }
  }

  /**
   * Get a dashboard summary of all agents' KPIs.
   */
  async getDashboardSummary(): Promise<{
    overallAchievement: number
    agentSummaries: Array<{
      agentId: string
      agentName: string
      kpis: KpiSummary[]
    }>
  }> {
    try {
      const agents = await prisma.agentDefinition.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })

      const agentSummaries = await Promise.all(
        agents.map(async (agent) => {
          const kpis = await this.getAgentKpis(agent.id)
          return {
            agentId: agent.id,
            agentName: agent.name,
            kpis,
          }
        })
      )

      const overallAchievement = await this.getOverallAchievement()

      return {
        overallAchievement,
        agentSummaries,
      }
    } catch (err) {
      console.error(`[KpiCollector] Failed to get dashboard summary:`, err)
      return { overallAchievement: 0, agentSummaries: [] }
    }
  }
}
