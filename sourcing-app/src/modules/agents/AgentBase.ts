/**
 * Agent Runtime Engine - AgentBase
 *
 * Abstract base class for all agents. Provides logging, KPI recording,
 * event emission, and lifecycle management.
 */

import { v4 as uuidV4 } from 'uuid'
import prisma from '@bandauto/db'
import { EventBus } from './EventBus'
import type {
  AgentEvent,
  AgentResult,
  HealthCheckResult,
  AgentConfig,
} from './types'
import { AgentLayer, LogLevel } from './types'

export abstract class AgentBase {
  /** Unique name matching AgentDefinition.name in DB */
  abstract readonly name: string

  /** Agent layer: CORE, BUSINESS, or INTELLIGENCE */
  abstract readonly layer: AgentLayer

  protected readonly id: string
  protected readonly eventBus: EventBus
  protected config: AgentConfig
  protected isRunning = false

  private dbAgentId: string | null = null

  constructor(config: AgentConfig = {}) {
    this.id = uuidV4()
    this.eventBus = EventBus.getInstance()
    this.config = config
  }

  /**
   * Handle an incoming event. Each agent implements its own logic.
   */
  abstract handleEvent(event: AgentEvent): Promise<AgentResult>

  /**
   * Return event types this agent subscribes to.
   */
  abstract getSubscribedEvents(): string[]

  /**
   * Start the agent: connect to EventBus, subscribe to events.
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    await this.eventBus.connect()

    // Resolve DB agent definition ID
    await this.resolveDbAgentId()

    // Subscribe to all relevant events
    const events = this.getSubscribedEvents()
    for (const eventType of events) {
      await this.eventBus.subscribe(eventType, async (event) => {
        await this.handleEvent(event)
      })
    }

    this.isRunning = true

    await this.updateDbStatus('ACTIVE')
    await this.log('INFO', `Agent "${this.name}" started`, { subscribedEvents: events })
  }

  /**
   * Stop the agent: unsubscribe from events, update status.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false

    await this.updateDbStatus('INACTIVE')
    await this.log('INFO', `Agent "${this.name}" stopped`)
  }

  /**
   * Optional: called on a cron schedule if the agent has a schedule configured.
   */
  async onSchedule(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Optional: health check for monitoring.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return { healthy: this.isRunning }
  }

  // ─── Protected Helpers ───

  /**
   * Write a log entry to AgentLog via Prisma.
   */
  protected async log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL',
    message: string,
    metadata?: Record<string, unknown>,
    taskId?: string
  ): Promise<void> {
    const agentId = await this.getDbAgentId()
    if (!agentId) return

    try {
      await prisma.agentLog.create({
        data: {
          agentId,
          level: level as LogLevel,
          message,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          taskId: taskId ?? null,
        },
      })
    } catch (err) {
      // Fallback to console if DB write fails
      console.error(`[${this.name}] Log write failed:`, err)
      console.log(`[${this.name}] [${level}] ${message}`)
    }
  }

  /**
   * Record a KPI metric value for this agent.
   */
  protected async recordKpi(
    metric: string,
    value: number,
    target = 0,
    period = 'daily'
  ): Promise<void> {
    const agentId = await this.getDbAgentId()
    if (!agentId) return

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
      console.error(`[${this.name}] KPI record failed:`, err)
    }
  }

  /**
   * Emit an event through the EventBus.
   */
  protected async emitEvent(
    type: string,
    data: Record<string, unknown>,
    priority: AgentEvent['priority'] = 'NORMAL'
  ): Promise<void> {
    const event = EventBus.createEvent(type, data, this.name, priority)
    await this.eventBus.publish(event)
  }

  // ─── Private Helpers ───

  /**
   * Look up the AgentDefinition record by name.
   */
  private async resolveDbAgentId(): Promise<void> {
    if (this.dbAgentId) return

    try {
      const definition = await prisma.agentDefinition.findUnique({
        where: { name: this.name },
        select: { id: true },
      })

      if (definition) {
        this.dbAgentId = definition.id
      } else {
        console.warn(`[${this.name}] No AgentDefinition found in DB for name="${this.name}"`)
      }
    } catch (err) {
      console.error(`[${this.name}] Failed to resolve DB agent ID:`, err)
    }
  }

  private async getDbAgentId(): Promise<string | null> {
    if (!this.dbAgentId) {
      await this.resolveDbAgentId()
    }
    return this.dbAgentId
  }

  private async updateDbStatus(status: 'ACTIVE' | 'INACTIVE' | 'ERROR'): Promise<void> {
    const agentId = await this.getDbAgentId()
    if (!agentId) return

    try {
      await prisma.agentDefinition.update({
        where: { id: agentId },
        data: { status },
      })
    } catch (err) {
      console.error(`[${this.name}] Failed to update DB status:`, err)
    }
  }
}
